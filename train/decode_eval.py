#!/usr/bin/env python3
"""Run the line-stepped constrained decoder of branch phase-2-decode (decode/run.mjs, arms B..E) on a GGUF and score it like local_load_test.py.
  python3 decode_eval.py GGUF --data data/out-r2 --refs test2_refs.jsonl --arm E --out OUT.json [--decode-dir /tmp/molde-dec/decode] [--route text|tok]
Starts its own llama-server on a free port, copies the refs into a temp dir as test_refs.jsonl (run.mjs reads that name), runs run.mjs, and
writes the same metrics JSON as `local_load_test.py --full` (plus by_kind) so tables can mix both decoders.
Gemma note: run.mjs's tok route hard-codes Gemma turn markers; use --route text for other families (and a GGUF whose turn markers are control tokens)."""
import argparse, json, os, pathlib, shutil, socket, statistics, subprocess, sys, tempfile, time, urllib.request

HERE = pathlib.Path(__file__).resolve().parent
ap = argparse.ArgumentParser()
ap.add_argument("gguf"); ap.add_argument("--data", default=str(HERE / "data/out-r2")); ap.add_argument("--refs", default="test_refs.jsonl")
ap.add_argument("--arm", default="E"); ap.add_argument("--out", required=True); ap.add_argument("--decode-dir", default="/tmp/molde-dec/decode")
ap.add_argument("--route", default="text"); ap.add_argument("--limit", type=int, default=0)
a = ap.parse_args()
binp = os.path.expanduser(os.environ.get("LLAMA_BIN", "~/llama.cpp-b12144/llama-b12144"))
with socket.socket() as k:
    k.bind(("127.0.0.1", 0)); port = str(k.getsockname()[1])
tmp = pathlib.Path(tempfile.mkdtemp(prefix="molde-decode-"))
refs = [json.loads(l) for l in open(pathlib.Path(a.data) / a.refs) if l.strip()]
(tmp / "test_refs.jsonl").write_text("\n".join(json.dumps(r, ensure_ascii=False) for r in refs) + "\n")
shutil.copy(pathlib.Path(a.data) / "dataset_card.json", tmp / "dataset_card.json")
env = {**os.environ, "LD_LIBRARY_PATH": binp}
srv = subprocess.Popen([binp + "/llama-server", "-m", a.gguf, "--port", port, "-c", "4096", "-np", "1", "-t", os.environ.get("THREADS", "6"), "--no-warmup", "-ngl", "0", "--host", "127.0.0.1"],
                       env=env, stdout=open(tmp / "server.log", "w"), stderr=subprocess.STDOUT)
try:
    t0 = time.time()
    while time.time() - t0 < 240:
        if srv.poll() is not None: sys.exit("server exited: " + (tmp / "server.log").read_text()[-800:])
        try: urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=2); break
        except Exception: time.sleep(1)
    out = pathlib.Path(a.out).with_suffix("")
    out.mkdir(parents=True, exist_ok=True)
    cmd = ["node", f"{a.decode_dir}/run.mjs", "--arm", a.arm, "--set", "real", "--out", str(out), "--tag", "run"] + (["--limit", str(a.limit)] if a.limit else [])
    r = subprocess.run(cmd, env={**env, "PORT": port, "MOLDE_REFS": str(tmp), "PROMPT": a.route}, capture_output=True, text=True)
    if r.returncode != 0: sys.exit("run.mjs failed: " + r.stderr[-800:])
finally:
    srv.terminate()
summ = json.load(open(out / "run.summary.json"))
scored = [json.loads(l) for l in open(out / "run.scored.jsonl") if l.strip()]
gen = [json.loads(l) for l in open(out / "run.gen.jsonl") if l.strip()]
kinds = {}
for x, ref in zip(scored, refs):
    kd = kinds.setdefault(ref.get("kind", ref["task"]), {"n": 0, "pass": 0, "intent": 0.0, "asked": 0})
    kd["n"] += 1; kd["pass"] += int(x["pass_raw"]); kd["intent"] += x.get("score") or 0; kd["asked"] += int(x["output"].lstrip().startswith("ask "))
by_kind = {k: {"n": v["n"], "checker_pass": round(v["pass"] / v["n"], 3), "intent_score": round(v["intent"] / v["n"], 3), "output_is_ask": round(v["asked"] / v["n"], 3)} for k, v in kinds.items()}
m = {"decoder": "line-stepped arm " + a.arm, "file": os.path.basename(a.gguf), "n": summ["n"], "checker_pass_raw": summ["pass"], "intent_score": summ["intent_score"], "intent_auto": summ["intent_auto"],
     "median_gen_tokens": summ["median_gen_tokens"], "mean_tok_s": summ["median_tok_s"], "median_secs_per_app": summ["median_s_per_app"], "calls_per_app": summ["mean_calls"],
     "by_kind": by_kind, "load_avg_start_end": [summ["loadavg_start"], summ["loadavg_end"]], "first_errors": summ["errors_first"], "size_mb": os.path.getsize(a.gguf) // (1 << 20), "route": a.route}
json.dump(m, open(a.out, "w"), indent=1)
json.dump([{"id": g["id"], "task": g["task"], "request": g["request"], "output": g["output"], "ref": g["ref"], "pass": s["pass_raw"], "score": s.get("score"), "err": s.get("err_first")} for g, s in zip(gen, scored)], open(pathlib.Path(a.out).with_suffix(".rows.json"), "w"), indent=1)
print(json.dumps({k: v for k, v in m.items() if k != "by_kind"}))
