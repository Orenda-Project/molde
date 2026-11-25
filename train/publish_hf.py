#!/usr/bin/env python3
"""Upload one training round to the private HF repo oyekamal/molde-tiny under <round>/ (GGUFs, SHA256SUMS, README.md card).

  python3 publish_hf.py --round smoke-r0 --gguf A.gguf [B.gguf ...] --base-model ID --licence NAME \\
      --dataset-card data/out/dataset_card.json --train-log runs/x/log.jsonl [--train-config final/train_config.json] \\
      --metrics q8.metrics.json [q4.metrics.json] [--pipeline-test] [--dry-run]

Rules enforced here:
  * every GGUF must pass local_load_test.py (loads with the laptop llama.cpp, 5 grammar-constrained requests) BEFORE upload; any failure = no upload
  * this script never changes the repo's visibility (it was private for r1 and smoke, public from 2026-11-24)
  * metrics in the card come from local_load_test.py --full on the SAME quantised files that are uploaded (pass them with --metrics)
  * the token is read by huggingface_hub from the local login; it is never printed.
If a large upload stalls: HF_HUB_DISABLE_XET=1 python3 publish_hf.py ...
"""
import argparse, datetime, hashlib, json, pathlib, shutil, subprocess, sys, tempfile

HERE = pathlib.Path(__file__).resolve().parent
REPO = "oyekamal/molde-tiny"


def sha(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for c in iter(lambda: f.read(1 << 22), b""):
            h.update(c)
    return h.hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--round", required=True); ap.add_argument("--gguf", nargs="+", required=True)
    ap.add_argument("--base-model", required=True); ap.add_argument("--licence", required=True)
    ap.add_argument("--dataset-card", required=True); ap.add_argument("--train-log"); ap.add_argument("--train-config")
    ap.add_argument("--metrics", nargs="*", default=[]); ap.add_argument("--pipeline-test", action="store_true")
    ap.add_argument("--chat-kwargs", default="{}"); ap.add_argument("--note", default=""); ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--lang", default=str(HERE.parent / "lang")); ap.add_argument("--data", default=str(HERE / "data/out"))
    a = ap.parse_args()
    if "/" in a.round or a.round in ("", ".", ".."):
        sys.exit("bad round name")
    from huggingface_hub import HfApi
    api = HfApi()
    info = api.model_info(REPO)
    print(f"repo {REPO} private={info.private} (visibility is never changed by this script)")
    tests = {}
    for g in a.gguf:
        g = pathlib.Path(g)
        out = pathlib.Path(tempfile.mkdtemp(prefix="molde-pub-")) / "load.json"
        r = subprocess.run([sys.executable, str(HERE / "local_load_test.py"), str(g), "--data", a.data, "--lang", a.lang, "--json", str(out), "--chat-kwargs", a.chat_kwargs])
        if r.returncode != 0:
            sys.exit(f"REFUSED: {g.name} failed the local load test (exit {r.returncode}); nothing uploaded")
        t = json.load(open(out)); t.pop("rows", None); tests[g.name] = t
    stage = pathlib.Path(tempfile.mkdtemp(prefix="molde-stage-")) / a.round
    stage.mkdir(parents=True)
    sums = []
    for g in a.gguf:
        g = pathlib.Path(g); shutil.copy(g, stage / g.name); sums.append(f"{sha(g)}  {g.name}")
    (stage / "SHA256SUMS").write_text("\n".join(sums) + "\n")
    ds = json.load(open(a.dataset_card))
    cfg = json.load(open(a.train_config)) if a.train_config else {}
    log = [json.loads(l) for l in open(a.train_log)] if a.train_log else []
    evals = [(e["step"], e["val_loss"]) for e in log if e.get("event") == "eval"]
    trains = [(e["step"], e["loss"]) for e in log if e.get("event") == "train"]
    start = next((e for e in log if e.get("event") == "start"), {})
    done = next((e for e in log if e.get("event") == "SFT_DONE"), {})
    ms = [json.load(open(m)) for m in a.metrics]
    L = [f"# {a.round}", ""]
    if a.pipeline_test:
        L += ["> **PIPELINE TEST, NOT A USABLE MODEL.** Trained on a few hundred examples only to prove that the training, export and upload steps work. Do not use it.", ""]
    L += [f"- date: {datetime.date.today()}", f"- base model: `{a.base_model}` (licence: {a.licence})",
          f"- dataset: {ds['counts']} (train/val/test), by task {ds['by_task']['train']} in train; language commit `{ds['language_commit']}`",
          f"- training: precision {start.get('precision')}, {start.get('total_steps')} steps, epochs {cfg.get('epochs')}, lr {cfg.get('lr')}, batch {cfg.get('batch_size')}x{cfg.get('grad_accum', 1)}, max_len {cfg.get('max_len')}, molde tokens added: {cfg.get('add_molde_tokens')}, gpu {start.get('gpu')}, minutes {done.get('minutes')}",
          f"- loss: train {trains[0][1] if trains else '?'} (step {trains[0][0] if trains else '?'}) to {trains[-1][1] if trains else '?'} (step {trains[-1][0] if trains else '?'}); val {evals[0][1] if evals else '?'} to {evals[-1][1] if evals else '?'}"]
    if a.note:
        L.append(f"- note: {a.note}")
    L += ["", "## Scores on the held-out set (measured on the uploaded quantised files, llama.cpp b12144, greedy)", "",
          "| file | grammar | n | checker pass (raw) | exact match | intent score | median tokens | tok/s |", "|---|---|---|---|---|---|---|---|"]
    for m in ms:
        L.append(f"| {m['file']} | {'yes' if m['grammar'] else 'no'} | {m['n']} | {m['checker_pass_raw']} | {m['exact_match']} | {m['intent_score']} | {m['median_gen_tokens']} | {m['mean_tok_s']} |")
    L += ["", "## Local load test (laptop CPU, grammar-constrained, 5 requests)", "", "| file | MB | load s | mean tok/s | checker OK |", "|---|---|---|---|---|"]
    for n, t in tests.items():
        L.append(f"| {n} | {t['size_mb']} | {t['load_s']} | {t['mean_tok_s']} | {t['checker_ok']}/{t['n']} |")
    L += ["", "## Files", "", "```", *sums, "```", ""]
    (stage / "README.md").write_text("\n".join(L))
    print("\n".join(L))
    if a.dry_run:
        print("DRY RUN, staged at", stage); return
    api.upload_folder(repo_id=REPO, folder_path=str(stage), path_in_repo=a.round, commit_message=f"Add {a.round}")
    print(f"UPLOADED https://huggingface.co/{REPO}/tree/main/{a.round}")


if __name__ == "__main__":
    main()
