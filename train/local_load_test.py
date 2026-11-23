#!/usr/bin/env python3
"""Load a GGUF with the laptop's llama.cpp, generate 5 test requests under lang/moldescript.gbnf, print programs and speed.
  python3 local_load_test.py FILE.gguf [--data data/out] [--lang ../lang] [-n 5] [--json OUT.json]
Exit 0 only if the file loads and every request produced a program. Checks `free -h` first and refuses if RAM is short.
Env: LLAMA_BIN (default ~/llama.cpp-b12144/llama-b12144), THREADS (default 6), PORT (default 8197).
Uses the chat template stored in the GGUF (/v1/chat/completions), greedy, grammar-constrained, 600-token cap.
"""
import argparse, json, os, pathlib, subprocess, sys, time, urllib.request

HERE = pathlib.Path(__file__).resolve().parent


def avail_mb():
    for l in open("/proc/meminfo"):
        if l.startswith("MemAvailable"):
            return int(l.split()[1]) // 1024


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("gguf"); ap.add_argument("--data", default=str(HERE / "data/out")); ap.add_argument("--lang", default=str(HERE.parent / "lang"))
    ap.add_argument("-n", type=int, default=5); ap.add_argument("--refs", default="test_refs.jsonl"); ap.add_argument("--json"); ap.add_argument("--n_predict", type=int, default=600)
    ap.add_argument("--full", action="store_true", help="run the whole test split (create + edit) and score it with score.mjs")
    ap.add_argument("--nogrammar", action="store_true", help="with --full: no grammar (raw model quality)")
    ap.add_argument("--metrics", help="with --full: write metrics JSON here")
    a = ap.parse_args()
    size = os.path.getsize(a.gguf) // (1 << 20)
    print(subprocess.run(["free", "-h"], capture_output=True, text=True).stdout)
    need = size * 2 + 600
    if avail_mb() < need:
        sys.exit(f"REFUSED: only {avail_mb()} MB available, need about {need} MB for a {size} MB file")
    binp = os.path.expanduser(os.environ.get("LLAMA_BIN", "~/llama.cpp-b12144/llama-b12144"))
    port = os.environ.get("PORT", "8197")
    env = {**os.environ, "LD_LIBRARY_PATH": binp + ":" + os.environ.get("LD_LIBRARY_PATH", "")}
    grammar = open(pathlib.Path(a.lang) / "moldescript.gbnf").read()
    refs = [json.loads(l) for l in open(pathlib.Path(a.data) / a.refs)]
    refs = refs if a.full else [r for r in refs if r["task"] == "create"][:a.n]
    system = json.load(open(pathlib.Path(a.data) / "dataset_card.json"))["system_prompt"]
    log = open("/tmp/molde-llama-server.log", "w")
    srv = subprocess.Popen([binp + "/llama-server", "-m", a.gguf, "--port", port, "-c", "4096", "-t", os.environ.get("THREADS", "6"), "--no-warmup", "-ngl", "0"],
                           env=env, stdout=log, stderr=subprocess.STDOUT)
    t0 = time.time(); loaded = False
    try:
        while time.time() - t0 < 240:
            if srv.poll() is not None:
                sys.exit("LOAD FAILED: llama-server exited; see /tmp/molde-llama-server.log\n" + open("/tmp/molde-llama-server.log").read()[-1500:])
            try:
                urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=2); loaded = True; break
            except Exception:
                time.sleep(1)
        if not loaded:
            sys.exit("LOAD FAILED: server not healthy in 240 s")
        load_s = time.time() - t0
        print(f"loaded in {load_s:.1f}s ({size} MB)")
        rows = []
        for r in refs:
            user = ("Edit request: %s\n\nCurrent program:\n%s" % (r["request"], r["before"])) if r["task"] == "edit" else "Request: " + r["request"]
            body = {"messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
                    "temperature": 0, "max_tokens": a.n_predict, "cache_prompt": False}
            if not a.nogrammar:
                body["grammar"] = grammar
            q = urllib.request.Request(f"http://127.0.0.1:{port}/v1/chat/completions", json.dumps(body).encode(), {"Content-Type": "application/json"})
            t_req = time.time()
            d = json.load(urllib.request.urlopen(q, timeout=600))
            secs = time.time() - t_req
            text = d["choices"][0]["message"]["content"]
            tm = d.get("timings", {})
            p = pathlib.Path("/tmp") / f"molde-lt-{r['id']}.mo"; p.write_text(text)
            ck = subprocess.run(["node", str(pathlib.Path(a.lang) / "mo.mjs"), "check", str(p)], capture_output=True, text=True)
            rows.append({"id": r["id"], "task": r["task"], "ref": r["ref"], "output": text, "request": r["request"], "program": text, "gen_tokens": tm.get("predicted_n"), "tok_s": tm.get("predicted_per_second"),
                         "prompt_tok_s": tm.get("prompt_per_second"), "check_ok": ck.returncode == 0, "secs": round(secs, 2),
                         "err": (ck.stdout.strip().splitlines() or [""])[0][:400], "user": user})
            print(f"--- {r['id']}: {r['request']}\n{text}\n[{tm.get('predicted_n')} tokens, {tm.get('predicted_per_second', 0):.1f} tok/s, checker {'OK' if ck.returncode == 0 else 'FAIL'}]")
        if a.full:   # one repair round for every failing program (same prompt text as eval_gen.py)
            sys.path.insert(0, str(HERE)); from common import repair_user_message
            for x in rows:
                x["repaired_ok"] = x["check_ok"]
                if x["check_ok"]:
                    continue
                body = {"messages": [{"role": "system", "content": system}, {"role": "user", "content": x["user"]}, {"role": "assistant", "content": x["output"]},
                                     {"role": "user", "content": repair_user_message(x["err"] or "invalid program")}], "temperature": 0, "max_tokens": a.n_predict, "cache_prompt": False}
                if not a.nogrammar: body["grammar"] = grammar
                q = urllib.request.Request(f"http://127.0.0.1:{port}/v1/chat/completions", json.dumps(body).encode(), {"Content-Type": "application/json"})
                t2 = json.load(urllib.request.urlopen(q, timeout=600))["choices"][0]["message"]["content"]
                p = pathlib.Path("/tmp") / f"molde-lt-{x['id']}-rep.mo"; p.write_text(t2)
                x["repaired_ok"] = subprocess.run(["node", str(pathlib.Path(a.lang) / "mo.mjs"), "check", str(p)], capture_output=True).returncode == 0
        speeds = [x["tok_s"] for x in rows if x["tok_s"]]
        summary = {"file": os.path.basename(a.gguf), "size_mb": size, "load_s": round(load_s, 1), "n": len(rows),
                   "mean_tok_s": round(sum(speeds) / len(speeds), 1) if speeds else None, "threads": os.environ.get("THREADS", "6"),
                   "checker_ok": sum(x["check_ok"] for x in rows), "all_nonempty": all(x["program"].strip() for x in rows), "rows": rows}
        print(json.dumps({k: v for k, v in summary.items() if k != "rows"}))
        if a.json:
            json.dump(summary, open(a.json, "w"), indent=1)
        if a.full:
            gp = pathlib.Path("/tmp/molde-quant-gen.jsonl")
            gp.write_text("\n".join(json.dumps({k: x[k] for k in ("id", "task", "request", "ref", "output")}) for x in rows) + "\n")
            sc = subprocess.run(["node", str(HERE / "score.mjs"), str(gp)], capture_output=True, text=True, env={**os.environ, "MOLDE_LANG": a.lang})
            sd = [json.loads(l) for l in sc.stdout.splitlines() if l.strip()]
            import statistics
            def canon(t):
                q = pathlib.Path("/tmp/molde-quant-x.mo"); q.write_text(t)
                f = subprocess.run(["node", str(pathlib.Path(a.lang) / "mo.mjs"), "format", str(q)], capture_output=True, text=True)
                return f.stdout.strip() if f.returncode == 0 else None
            for x in sd:
                x["exact"] = canon(x["output"]) == canon(x["ref"])
            mean = lambda k, f=float: round(sum(f(x[k]) for x in sd) / len(sd), 3)
            m = {"file": os.path.basename(a.gguf), "grammar": not a.nogrammar, "n": len(sd), "checker_pass_raw": mean("pass_raw"), "checker_pass_formatted": mean("pass_fmt"),
                 "exact_match": mean("exact"), "intent_score": mean("score", lambda v: v or 0), "intent_auto": mean("intent_auto"),
                 "median_gen_tokens": statistics.median(x["gen_tokens"] for x in rows if x["gen_tokens"]), "mean_tok_s": summary["mean_tok_s"],
                 "checker_pass_after_repair": round(sum(x["repaired_ok"] for x in rows) / len(rows), 3), "median_secs_per_app": round(statistics.median(x["secs"] for x in rows), 1),
                 "size_mb": size, "threads": os.environ.get("THREADS", "6")}
            print(json.dumps(m))
            if a.metrics:
                json.dump(m, open(a.metrics, "w"), indent=1)
        if not summary["all_nonempty"]:
            sys.exit("FAILED: empty output")
    finally:
        srv.terminate()


if __name__ == "__main__":
    main()
