#!/usr/bin/env python3
"""Generate programs for the held-out test split (greedy) and score them.

  python3 eval_gen.py --model runs/smoke/final --data data/out [--out runs/smoke/eval] [--lang ../lang] [--max_new 768]

Metrics (written to OUT/metrics.json and printed):
  checker_pass     share of outputs that pass `mo.mjs check` as generated (raw), and after canonical formatting
  exact_match      output == reference after canonical formatting (reference is also formatted)
  intent_score     mean structural score (table/field-type F1, node-kind Jaccard, aggregate Jaccard; score.mjs from
                   molde-model/phase2a) and the share with intent_auto (the Phase 2a pass rule)
  median_tokens    median generated tokens (model tokenizer, including added tokens if the model has them)
Greedy decoding, no grammar (grammar-constrained decoding is done later with llama.cpp on the GGUF).
Needs Node 20 and the lang/ folder (on Colab: apt install nodejs, lang copied next to train/).
"""
import argparse, json, os, pathlib, statistics, subprocess, sys, time

import torch

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from common import prompt_text, read_jsonl, repair_user_message  # noqa: E402

HERE = pathlib.Path(__file__).resolve().parent
SYSTEM_KEY = "system"


def build_messages(ref, system):
    if ref["task"] == "edit":
        user = f"Edit request: {ref['request']}\n\nCurrent program:\n{ref['before']}"
    else:
        user = f"Request: {ref['request']}"
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def node(lang, *args):
    return subprocess.run(["node", str(pathlib.Path(lang) / "mo.mjs"), *args], capture_output=True, text=True, env={**os.environ})


def canonical(lang, text, tmp, name):
    p = tmp / f"{name}.mo"; p.write_text(text if text.endswith("\n") else text + "\n")
    f = node(lang, "format", str(p))
    return f.stdout if f.returncode == 0 and f.stdout.strip() else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True); ap.add_argument("--data", default="data/out")
    ap.add_argument("--out", default=None); ap.add_argument("--lang", default=str(HERE.parent / "lang"))
    ap.add_argument("--max_new", type=int, default=768); ap.add_argument("--bs", type=int, default=8)
    ap.add_argument("--chat_kwargs", default="{}"); ap.add_argument("--limit", type=int, default=0)
    a = ap.parse_args()
    from transformers import AutoModelForCausalLM, AutoTokenizer
    out = pathlib.Path(a.out or pathlib.Path(a.model).parent / "eval"); out.mkdir(parents=True, exist_ok=True)
    refs = read_jsonl(pathlib.Path(a.data) / "test_refs.jsonl")
    if a.limit: refs = refs[:a.limit]
    system = json.load(open(pathlib.Path(a.data) / "dataset_card.json"))["system_prompt"]
    tok = AutoTokenizer.from_pretrained(a.model); tok.padding_side = "left"
    if tok.pad_token_id is None: tok.pad_token = tok.eos_token
    dev = "cuda" if torch.cuda.is_available() else "cpu"
    model = AutoModelForCausalLM.from_pretrained(a.model, dtype=torch.float32)
    if dev == "cuda" and sum(p.numel() for p in model.parameters()) > 500e6:
        model = model.half()      # small models stay fp32 (Gemma 3 is not safe in fp16)
    model = model.to(dev).eval()
    ck = json.loads(a.chat_kwargs)
    t0 = time.time()
    def generate(msgs_by_idx):
        order = sorted(msgs_by_idx, key=lambda i: len(str(msgs_by_idx[i])))
        res = {}
        for s in range(0, len(order), a.bs):
            ids = order[s:s + a.bs]
            prompts = [prompt_text(tok, msgs_by_idx[i], ck) for i in ids]
            enc = tok(prompts, return_tensors="pt", padding=True, add_special_tokens=False).to(dev)
            with torch.no_grad():
                o = model.generate(**enc, max_new_tokens=a.max_new, do_sample=False, pad_token_id=tok.pad_token_id)
            for k, i in enumerate(ids):
                new = o[k, enc["input_ids"].shape[1]:]
                n_tok = int((new != tok.pad_token_id).sum()) if tok.pad_token_id != tok.eos_token_id else int(len(new))
                res[i] = (tok.decode(new, skip_special_tokens=True).strip("\n") + "\n", n_tok)
            print(f"generated {len(res)}/{len(msgs_by_idx)} in {time.time() - t0:.0f}s", flush=True)
        return res
    res = generate({i: build_messages(refs[i], system) for i in range(len(refs))})
    gen_s = time.time() - t0
    tmp = out / "programs"; tmp.mkdir(exist_ok=True)
    rows = []
    for i, r in enumerate(refs):
        text, n_tok = res[i]
        refc = canonical(a.lang, r["ref"], tmp, r["id"] + "_ref") or r["ref"]
        (tmp / f"{r['id']}.mo").write_text(text)
        rows.append({"id": r["id"], "task": r["task"], "request": r["request"], "ref": refc, "output": text, "gen_tokens": n_tok})
    with open(out / "gen.jsonl", "w") as f:
        for x in rows: f.write(json.dumps(x, ensure_ascii=False) + "\n")
    sc = subprocess.run(["node", str(HERE / "score.mjs"), str(out / "gen.jsonl")], capture_output=True, text=True, env={**os.environ, "MOLDE_LANG": a.lang})
    if sc.returncode != 0:
        sys.exit("score.mjs failed: " + sc.stderr[-500:])
    scored = [json.loads(l) for l in sc.stdout.splitlines() if l.strip()]
    for x in scored:
        c = canonical(a.lang, x["output"], tmp, x["id"] + "_fmt")
        x["exact"] = bool(c and c.strip() == x["ref"].strip())
    with open(out / "scored.jsonl", "w") as f:
        for x in scored: f.write(json.dumps(x, ensure_ascii=False) + "\n")
    # one repair round: failures get the checker's first error back, the model answers once more
    fails = {i: x for i, x in enumerate(scored) if not x["pass_raw"]}
    rep = generate({i: build_messages(refs[i], system) + [{"role": "assistant", "content": x["output"]}, {"role": "user", "content": repair_user_message(x["err_first"] or "invalid program")}] for i, x in fails.items()}) if fails else {}
    with open(out / "repair_gen.jsonl", "w") as f:
        for i, (text, n_tok) in rep.items():
            f.write(json.dumps({"id": refs[i]["id"], "output": text, "ref": scored[i]["ref"]}, ensure_ascii=False) + "\n")
    rsc = subprocess.run(["node", str(HERE / "score.mjs"), str(out / "repair_gen.jsonl")], capture_output=True, text=True, env={**os.environ, "MOLDE_LANG": a.lang}) if rep else None
    fixed = {json.loads(l)["id"] for l in rsc.stdout.splitlines() if l.strip() and json.loads(l)["pass_raw"]} if rsc else set()
    for x in scored:
        x["pass_after_repair"] = bool(x["pass_raw"] or x["id"] in fixed)
    n = len(scored)
    def by(task, key, fn=lambda v: v):
        v = [fn(x[key]) for x in scored if task in (None, x["task"])]
        return round(sum(v) / len(v), 3) if v else None
    m = {"model": a.model, "n": n, "n_create": sum(x["task"] == "create" for x in scored), "n_edit": sum(x["task"] == "edit" for x in scored),
         "checker_pass_raw": by(None, "pass_raw", float), "checker_pass_formatted": by(None, "pass_fmt", float), "checker_pass_after_repair": by(None, "pass_after_repair", float),
         "exact_match": by(None, "exact", float), "intent_score": by(None, "score"), "intent_auto": by(None, "intent_auto", float),
         "by_task": {t: {"checker_pass_raw": by(t, "pass_raw", float), "exact": by(t, "exact", float), "intent_score": by(t, "score")} for t in ("create", "edit")},
         "median_gen_tokens": statistics.median(x["gen_tokens"] for x in scored), "max_gen_tokens": max(x["gen_tokens"] for x in scored),
         "median_ref_lines": statistics.median(len(x["ref"].splitlines()) for x in scored),
         "gen_seconds": round(gen_s, 1), "first_errors": [x["err_first"] for x in scored if x.get("err_first")][:5]}
    json.dump(m, open(out / "metrics.json", "w"), indent=1)
    print(json.dumps(m, indent=1))


if __name__ == "__main__":
    main()
