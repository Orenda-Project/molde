#!/usr/bin/env python3
"""Build the Molde chat-format dataset (create + edit tasks).

Sources, all re-checked and canonically formatted with lang/mo.mjs:
  corpus    lang/corpus/eNNN.mo + requests.jsonl (id, text)            -> create
  examples  lang/examples/*.mo + data/example_requests.json            -> create
  edits     lang/examples/edits/*/{request.txt,before.mo,after.mo}     -> edit
  sources/  data/sources/*.jsonl, one object per line (drop-in, later bigger sets):
            {"id": str, "task": "create"|"edit", "request": str, "program": str,
             "before": str (edit only), "meta": {...}}   ("program" = target)
Split (deterministic, by id): test = 40 corpus ids (+4 edit pairs), val ~5%, rest train.
Test requests (and any source row with an identical request text) are never in train.
Language change: re-run with --migrate; every target/before is passed through `mo.mjs migrate`
before the check, so old-spelling data (older sources) stays valid.

Usage: python3 data/build_dataset.py --lang LANGDIR [--requests requests.jsonl] [--out data/out] [--migrate]
"""
import argparse, hashlib, json, os, pathlib, re, subprocess, sys, tempfile

SYSTEM = ("You write MoldeScript, a tiny language for small phone apps. "
          "Reply with the complete program only, no explanation. "
          "For an edit request you get the current program: reply with the full updated program.")
N_TEST_CORPUS, N_TEST_EDIT = 40, 4
SEED = "molde-p2-v1"
NO_SOURCES = False


def h(s):
    return int(hashlib.sha1((SEED + s).encode()).hexdigest(), 16)


def node(lang, *args, inp=None):
    return subprocess.run(["node", str(pathlib.Path(lang) / "mo.mjs"), *args], capture_output=True, text=True)


def normalise(lang, progs, migrate):
    """progs: dict key->text. returns dict key->canonical text or None (with reasons)."""
    out, bad = {}, {}
    with tempfile.TemporaryDirectory() as td:
        paths = {}
        for i, (k, t) in enumerate(progs.items()):
            p = pathlib.Path(td) / f"{i:06d}.mo"
            p.write_text(t if t.endswith("\n") else t + "\n")
            paths[k] = p
        if migrate:
            node(lang, "migrate", *map(str, paths.values()), "--write")
        def one(kp):
            k, p = kp
            c = node(lang, "check", str(p))
            if c.returncode != 0:
                return k, None, (c.stdout + c.stderr).strip()[:300]
            f = node(lang, "format", str(p))
            if f.returncode != 0 or not f.stdout.strip():
                return k, None, "format failed: " + f.stderr[:200]
            return k, (f.stdout if f.stdout.endswith("\n") else f.stdout + "\n"), None
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(8) as ex:
            for k, text, err in ex.map(one, paths.items()):
                if err: bad[k] = err
                else: out[k] = text
    return out, bad


def collect(lang, requests_path, root):
    rows = []
    reqs = {}
    if requests_path and os.path.exists(requests_path):
        for l in open(requests_path):
            if l.strip():
                r = json.loads(l); reqs[r["id"]] = r
    for p in sorted(pathlib.Path(lang, "corpus").glob("e*.mo")):
        i = p.stem
        if i in reqs:
            rows.append(dict(id=i, src="corpus", task="create", request=reqs[i]["text"], program=p.read_text(),
                             meta={k: reqs[i].get(k) for k in ("style", "domain")}))
    er = json.load(open(root / "data/example_requests.json"))
    for p in sorted(pathlib.Path(lang, "examples").glob("*.mo")):
        rows.append(dict(id="x" + p.stem, src="examples", task="create", request=er[p.name], program=p.read_text(), meta={}))
    for d in sorted(pathlib.Path(lang, "examples/edits").iterdir()):
        if d.is_dir():
            rows.append(dict(id="ed-" + d.name, src="edits", task="edit", request=(d / "request.txt").read_text().strip(),
                             before=(d / "before.mo").read_text(), program=(d / "after.mo").read_text(), meta={}))
    for p in ([] if NO_SOURCES else sorted((root / "data/sources").glob("*.jsonl"))):
        for n, l in enumerate(open(p)):
            if l.strip():
                r = json.loads(l)
                r.setdefault("id", f"{p.stem}-{n}")
                r["src"] = "sources/" + p.name
                r.setdefault("meta", {})
                rows.append(r)
    return rows


def to_chat(r):
    if r["task"] == "edit":
        user = f"Edit request: {r['request']}\n\nCurrent program:\n{r['before']}"
    else:
        user = f"Request: {r['request']}"
    return {"id": r["id"], "task": r["task"], "src": r["src"], "meta": r.get("meta", {}),
            "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": user},
                         {"role": "assistant", "content": r["program"]}]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", required=True)
    ap.add_argument("--requests", default="/tmp/molde-requests-en-1/requests.jsonl")
    ap.add_argument("--out", default=None)
    ap.add_argument("--migrate", action="store_true")
    ap.add_argument("--no-sources", action="store_true", help="only corpus, examples and edits (the small committed base set)")
    a = ap.parse_args()
    global NO_SOURCES; NO_SOURCES = a.no_sources
    root = pathlib.Path(__file__).resolve().parent.parent
    out = pathlib.Path(a.out or root / "data/out"); out.mkdir(parents=True, exist_ok=True)
    rows = collect(a.lang, a.requests, root)
    progs = {}
    for r in rows:
        progs[(r["id"], "p")] = r["program"]
        if r["task"] == "edit":
            progs[(r["id"], "b")] = r["before"]
    good, bad = normalise(a.lang, {f"{k[0]}|{k[1]}": v for k, v in progs.items()}, a.migrate)
    kept, dropped = [], []
    for r in rows:
        kp, kb = f"{r['id']}|p", f"{r['id']}|b"
        if kp not in good or (r["task"] == "edit" and kb not in good):
            dropped.append({"id": r["id"], "why": bad.get(kp) or bad.get(kb)}); continue
        r["program"] = good[kp]
        if r["task"] == "edit":
            r["before"] = good[kb]
        kept.append(r)
    seen = set()
    for r in list(kept):  # duplicate ids
        if r["id"] in seen:
            kept.remove(r); dropped.append({"id": r["id"], "why": "duplicate id"})
        seen.add(r["id"])
    corpus = sorted([r for r in kept if r["src"] == "corpus"], key=lambda r: h(r["id"]))
    edits = sorted([r for r in kept if r["src"] == "edits"], key=lambda r: h(r["id"]))
    test_ids = {r["id"] for r in corpus[:N_TEST_CORPUS]} | {r["id"] for r in edits[:N_TEST_EDIT]}
    test_req = {re.sub(r"\W+", " ", r["request"].lower()).strip() for r in kept if r["id"] in test_ids}
    split = {"train": [], "val": [], "test": []}
    for r in kept:
        key = re.sub(r"\W+", " ", r["request"].lower()).strip()
        if r["id"] in test_ids:
            s = "test"
        elif key in test_req:
            dropped.append({"id": r["id"], "why": "request text equals a test request"}); continue
        elif h("val" + r["id"]) % 100 < 5:
            s = "val"
        else:
            s = "train"
        split[s].append(r)
    for s, rs in split.items():
        with open(out / f"{s}.jsonl", "w") as f:
            for r in sorted(rs, key=lambda r: r["id"]):
                f.write(json.dumps(to_chat(r), ensure_ascii=False) + "\n")
    # test_refs: what eval_gen needs (request, reference program, before)
    with open(out / "test_refs.jsonl", "w") as f:
        for r in sorted(split["test"], key=lambda r: r["id"]):
            f.write(json.dumps({"id": r["id"], "task": r["task"], "request": r["request"], "before": r.get("before"), "ref": r["program"]}, ensure_ascii=False) + "\n")
    commit = subprocess.run(["git", "-C", a.lang, "log", "-1", "--format=%h", "--", "."], capture_output=True, text=True).stdout.strip()
    cnt = lambda rs, k: sum(1 for r in rs if r[k[0]] == k[1])
    by_src = {}
    for s, rs in split.items():
        for r in rs:
            by_src.setdefault(r["src"], {}).setdefault(s, 0)
            by_src[r["src"]][s] += 1
    card = {"language_commit": commit, "migrated": a.migrate, "system_prompt": SYSTEM,
            "counts": {s: len(rs) for s, rs in split.items()},
            "by_task": {s: {"create": cnt(rs, ("task", "create")), "edit": cnt(rs, ("task", "edit"))} for s, rs in split.items()},
            "by_source": by_src, "dropped": dropped, "seed": SEED, "split_rule": f"test = {N_TEST_CORPUS} corpus ids + {N_TEST_EDIT} edit pairs, lowest sha1(seed+id); val = 5% by sha1; rest train"}
    json.dump(card, open(out / "dataset_card.json", "w"), indent=1)
    md = [f"# Molde dataset card", "", f"- language commit: `{commit}` (migrated: {a.migrate})",
          f"- counts: {card['counts']}", f"- by task: {card['by_task']}", f"- by source: {by_src}",
          f"- dropped: {len(dropped)}", f"- split: {card['split_rule']}", f"- system prompt: {SYSTEM!r}"]
    (out / "DATASET_CARD.md").write_text("\n".join(md) + "\n")
    print("\n".join(md))
    if dropped:
        print("dropped sample:", dropped[:5])


if __name__ == "__main__":
    main()
