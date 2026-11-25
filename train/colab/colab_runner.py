#!/usr/bin/env python3
"""Hold ONE Colab GPU runtime and run job files dropped into a folder (Molde training runner; copied from
offline-teacher-coach/finetune/colab_runner.py, which carries the lessons of its failed sessions).

Adapted from oyekamal/colab-3d-generation tools/colab_daemon.py, with the round-2 safety rules:
  * GPU-assign retries are CAPPED: one try every 180 s (= 20/hour), give up after MAX_ASSIGN_TRIES.
    412 = a previous (abandoned) session still holds the free slot -> release our own assignments once, retry.
    503/429 for MAX_ASSIGN_TRIES in a row = free quota gone -> write <jobs>/QUOTA and exit (no endless loop).
  * Drive saves: drop <n>.drivesave.json = {"<colab path>": "<drive folder>"}; the runner asks the local
    mcp-colab-gpu login for a fresh Drive token and runs the connector's own upload code in the kernel.
    The token lives only in memory and in the kernel cell; it is never written to disk or printed.
    Keep each file <= ~1 GB (split big files first, see train_colab.py split).
  * Drive fetches: <n>.drivefetch.json = {"<drive path>": "<colab path>"} (same token handling).
  * No credentials are ever passed on a command line.

Run with the python of the uv env that has mcp-colab-gpu (mcp<2):
  <uv-env>/bin/python finetune/colab_runner.py <jobs_dir> [T4]
Drop <n>.py -> <n>.out (stdout, stderr, exit code). ARTIFACT_BASE64_START/END zip -> <n>_artifact/.
Create <jobs_dir>/STOP to release the runtime. Idle timeout 40 min. RUNNER.pid = single-instance lock.
Any failed setup/fetch/smoke/train/eval/export job writes STOP (abort the chain) and the runtime is released in `finally`.
"""
import base64
import io
import json
import re
import pathlib
import sys
import time
import types
import zipfile

import requests as _real_requests
from mcp_colab_gpu import colab_runtime as cr
from mcp_colab_gpu import server as srv
from mcp_colab_gpu.drive import generate_drive_fetch_code, generate_drive_save_code, get_drive_credentials, resolve_file_id

MAX_ASSIGN_TRIES = 20          # 20 x 180 s = 1 hour (the Molde limit: about 20 tries an hour, then stop and report)
ASSIGN_SLEEP = 180

jobs = pathlib.Path(sys.argv[1])
_lock = jobs / "RUNNER.pid"
if _lock.exists():
    import os
    try:
        os.kill(int(_lock.read_text()), 0)
        sys.exit(f"another runner is alive (pid {_lock.read_text()}); not starting a second one")
    except (ProcessLookupError, ValueError):
        pass
import os as _os
_lock.write_text(str(_os.getpid()))
accel = sys.argv[2] if len(sys.argv) > 2 else "T4"   # "CPU" = no accelerator (CPU-only runtime)
jobs.mkdir(parents=True, exist_ok=True)


def status(msg):
    print(msg, flush=True)
    with open(jobs / "runner.log", "a") as f:
        f.write(time.strftime("%H:%M:%S ") + msg + "\n")


def _long(fn):
    def wrapped(*a, **k):
        k["timeout"] = max(k.get("timeout") or 0, 420)   # short client timeouts leak the runtime being assigned
        return fn(*a, **k)
    return wrapped


cr.requests = types.SimpleNamespace(**{n: getattr(_real_requests, n) for n in dir(_real_requests) if not n.startswith("__")})
cr.requests.get = _long(_real_requests.get)
cr.requests.post = _long(_real_requests.post)


def release_own():
    token = cr.get_credentials().token
    r = _real_requests.get(f"{cr.COLAB_API}/tun/m/assignments", params={"authuser": "0"},
                           headers=cr._colab_headers(token), timeout=60)
    data = cr._strip_xssi(r.text) if r.ok else {}
    for a in (data.get("assignments", []) if isinstance(data, dict) else []):
        status(f"releasing stale assignment {a.get('endpoint')}")
        cr.unassign_runtime(token, a["endpoint"])


assignment, codes, released = None, [], False
for attempt in range(1, MAX_ASSIGN_TRIES + 1):
    try:
        token = cr.get_credentials().token
        assignment = cr.allocate_runtime(token, "" if accel.upper() == "CPU" else accel, False)
        break
    except (_real_requests.HTTPError, _real_requests.ConnectionError, _real_requests.Timeout) as e:
        code = getattr(getattr(e, "response", None), "status_code", None)
        codes.append(code)
        if code is not None and code not in (412, 429, 500, 502, 503, 504):
            raise
        status(f"assign {accel} not granted (HTTP {code or type(e).__name__}), try {attempt}/{MAX_ASSIGN_TRIES}")
        if code == 412 and not released:
            release_own()
            released = True
        time.sleep(ASSIGN_SLEEP)
if not assignment:
    (jobs / "QUOTA").write_text(json.dumps({"tries": len(codes), "codes": codes}))
    status("GAVE UP: no GPU after capped retries; see QUOTA")
    sys.exit(2)

stop_keepalive = cr.start_keepalive(token, assignment["endpoint"])
try:
    kernel = cr.create_session(assignment["proxy_url"], assignment["proxy_token"])
    (jobs / "READY").write_text(assignment["endpoint"])
    status(f"READY {assignment.get('accelerator', accel)}")
    last, done, retried = time.time(), set(), set()
    while not (jobs / "STOP").exists() and time.time() - last < 2400:
        for f in sorted(list(jobs.glob("*.py")) + list(jobs.glob("*.drivesave.json")) + list(jobs.glob("*.drivefetch.json"))):
            if f.name in done or not f.exists():
                continue
            done.add(f.name)
            last = time.time()
            stem = f.name.split(".")[0]
            status(f"running {f.name}")
            token = cr.get_credentials().token
            try:
              if f.name.endswith(".drivesave.json"):
                mapping = json.loads(f.read_text())
                saves = [{"local_path": lp, "drive_folder": df, "filename": pathlib.PurePosixPath(lp).name}
                         for lp, df in mapping.items()]
                code = generate_drive_save_code(saves, get_drive_credentials().token)
              elif f.name.endswith(".drivefetch.json"):
                dc = get_drive_credentials()
                code = generate_drive_fetch_code([{"file_id": resolve_file_id(dp, dc), "dest_path": cp}
                                                  for dp, cp in json.loads(f.read_text()).items()], dc.token)
              else:
                code = f.read_text()
            except Exception as e:  # Drive/network hiccup: fail this job (the chain aborts) instead of crashing the runner and leaking the runtime
                code = f"raise RuntimeError({type(e).__name__ + ': ' + str(e)[:150]!r})"
            try:
                out, err, rc = cr.execute_code(assignment["proxy_url"], assignment["proxy_token"], kernel, code,
                                               timeout=(600 if f.name.endswith(".json") else 3000), access_token=token, endpoint=assignment["endpoint"])
            except Exception as e:  # keep the runtime alive across a failed job
                out, err, rc = "", f"{type(e).__name__}: {e}", 1
            # a dropped laptop connection (websocket / SSL) must not kill the work: the training process is detached on the VM.
            # Reconnect with a NEW kernel session and run the same job again (jobs are idempotent: they attach to a running process).
            for _try in range(6):
                if rc == 0 or not re.search(r"WebSocket|SSL|Connection|Broken pipe|404", str(err)) or (jobs / "STOP").exists():
                    break
                status(f"{f.name}: connection lost ({str(err)[:80]}), reconnect try {_try + 1}/6")
                time.sleep(60)
                try:
                    token = cr.get_credentials().token
                    kernel = cr.create_session(assignment["proxy_url"], assignment["proxy_token"])
                    out, err, rc = cr.execute_code(assignment["proxy_url"], assignment["proxy_token"], kernel, code,
                                                   timeout=(600 if f.name.endswith(".json") else 3000), access_token=token, endpoint=assignment["endpoint"])
                except Exception as e2:
                    out, err, rc = "", f"{type(e2).__name__}: {e2}", 1
            if rc != 0 and "Timed out" in str(err) and "DONE" in str(out)[-600:]:
                status(f"{f.name}: connector timeout after DONE marker, treating as success"); rc = 0
            b64 = srv._extract_artifact_b64(out)
            (jobs / f"{stem}.out").write_text(f"{srv._strip_artifact_b64(out)}\n--- STDERR ---\n{err[-3000:]}\n--- exit {rc} ---\n")
            if b64:
                zipfile.ZipFile(io.BytesIO(base64.b64decode(b64))).extractall(jobs / f"{stem}_artifact")
            status(f"done {f.name} rc={rc}")
            last = time.time()
            if rc != 0 and f.name.endswith(("drivefetch.json", "drivesave.json")) and f.name not in retried:
                retried.add(f.name); done.discard(f.name)
                status(f"retry once: {f.name}")
                time.sleep(10)
                break
            if rc != 0 and re.search(r"(setup|fetch|restore|smoke|train|eval|export|pack)", f.name):
                status(f"ABORT chain: {f.name} rc={rc}")
                (jobs / "STOP").write_text("abort")
                break
        time.sleep(2)
finally:
    stop_keepalive.set()
    try:
        cr.unassign_runtime(cr.get_credentials().token, assignment["endpoint"])
    finally:
        (jobs / "READY").unlink(missing_ok=True)
        status("released"); (jobs / "RUNNER.pid").unlink(missing_ok=True)
