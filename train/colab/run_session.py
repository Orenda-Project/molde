#!/usr/bin/env python3
"""Run ONE Colab session end to end: start the runner (one instance, lock file), stop it as soon as the Drive save is done
or any job aborted, print a per-job timing table from runner.log.

  python3 colab/run_session.py JOBS_DIR [T4|L4|A100]

Needs `uvx` (the runner imports mcp_colab_gpu from the uv env of the colab-gpu MCP). GPU assignment is capped at 20 tries
(one per 3 minutes); if none: JOBS_DIR/QUOTA is written and the script exits 2. The runtime is always released on exit.
"""
import pathlib, re, subprocess, sys, time

jobs = pathlib.Path(sys.argv[1]); accel = sys.argv[2] if len(sys.argv) > 2 else "T4"
here = pathlib.Path(__file__).resolve().parent
for stale in ("STOP", "READY", "QUOTA"):
    (jobs / stale).unlink(missing_ok=True)
rl = jobs / "runner.log"; n0 = len(rl.read_text().splitlines()) if rl.exists() else 0
p = subprocess.Popen(f"uvx --from mcp-colab-gpu --with 'mcp<2' python {here}/colab_runner.py {jobs} {accel} > {jobs}/daemon.out 2>&1", shell=True)
t0 = time.time()
while p.poll() is None:
    L = rl.read_text().splitlines()[n0:] if rl.exists() else []
    if any(("done 41_save" in l or "done 37_save_ckpt" in l or "done 37_save.drivesave" in l) for l in L) and not (jobs / "STOP").exists():
        (jobs / "STOP").write_text("done")
    if any("ABORT" in l for l in L) and not (jobs / "STOP").exists():
        (jobs / "STOP").write_text("abort")
    time.sleep(10)
L = rl.read_text().splitlines()[n0:]
print("\n".join(L))
ok = any((("done 41_save" in l) or ("done 37_save_ckpt" in l) or ("done 37_save.drivesave" in l)) and "rc=0" in l for l in L)
print("SESSION_OK" if ok else "SESSION_FAILED", f"wall {int(time.time() - t0)} s", "released" if any("released" in l for l in L) else "NOT RELEASED?")
sys.exit(0 if ok else (2 if (jobs / "QUOTA").exists() else 1))
