#!/usr/bin/env python3
"""Collect r1 metrics into one markdown table. python3 make_report.py ARMDIR... > table.md
Each ARMDIR (e.g. molde-model/r1/gemma270m) holds: hf.metrics.json (eval_gen, fp16/fp32), hf_templ.metrics.json (optional),
Q8_0.metrics.json, Q4_K_M.metrics.json (local_load_test --full), *.load.json."""
import json, pathlib, sys
def J(p):
    p = pathlib.Path(p); return json.load(open(p)) if p.exists() else None
rows = ["| arm | model | n | pass 1st try | pass after repair | exact | intent score | intent auto | median tokens | tok/s | s/app (median) | MB |", "|---|---|---|---|---|---|---|---|---|---|---|---|"]
for d in map(pathlib.Path, sys.argv[1:]):
    for name, lab in (("hf.metrics.json", "HF fp32/fp16 greedy"), ("hf_templ.metrics.json", "HF templated slice"), ("Q8_0.metrics.json", "GGUF Q8_0 + grammar"), ("Q4_K_M.metrics.json", "GGUF Q4_K_M + grammar")):
        m = J(d / name)
        if not m: continue
        g = lambda k: m.get(k, "-")
        rows.append(f"| {d.name} | {lab} | {g('n')} | {g('checker_pass_raw')} | {g('checker_pass_after_repair')} | {g('exact_match')} | {g('intent_score')} | {g('intent_auto')} | {g('median_gen_tokens')} | {g('mean_tok_s')} | {g('median_secs_per_app')} | {g('size_mb')} |")
print("\n".join(rows))


def samples(load_json, n_good=5, n_bad=5):
    """10 sample outputs (good and bad) from a local_load_test.py --full JSON."""
    rows = json.load(open(load_json))["rows"]
    good = [r for r in rows if r["check_ok"] and r["task"] == "create"][:n_good]
    bad = [r for r in rows if not r["check_ok"]][:n_bad]
    out = []
    for tag, rs in (("GOOD (checker passes)", good), ("BAD (checker fails)", bad)):
        for r in rs:
            out.append(f"#### {tag}: {r['id']}\n\nRequest: {r['request']}\n\n```\n{r['output'].rstrip()}\n```\n" + ("" if r["check_ok"] else f"\nChecker: `{r['err'].strip()}`\n"))
    return "\n".join(out)


if len(sys.argv) > 2 and sys.argv[1] == "--samples":
    print(samples(sys.argv[2]))
