#!/usr/bin/env python3
"""MoldeScript keyword tokens for a Hugging Face tokenizer (behind a flag in train.py: add_molde_tokens: true).

Token list = every grammar literal and std component name (lang/grammar/added-tokens.json, generated from the
grammar) that the base tokenizer would split, with and without a leading space, plus newline+indent per depth.
Literals the base already encodes as ONE token are left alone (adding them only breaks merges such as '.ml').
New embeddings (input and output) start as the mean of the embeddings of the token's own sub-tokens.

CLI:
  python3 tokens/molde_tokens.py MODEL_ID --lang LANGDIR           report counts + round-trip test
  python3 tokens/molde_tokens.py MODEL_ID --lang LANGDIR --selftest   exit 1 unless every program round-trips
"""
import argparse, glob, json, os, statistics, sys


def molde_token_list(tok, lang):
    d = json.load(open(os.path.join(lang, "grammar", "added-tokens.json")))
    enc = lambda s: tok(s, add_special_tokens=False)["input_ids"]
    add = []
    for lit in d["literals"] + d["std"]:
        for form in (" " + lit, lit):
            if len(enc(form)) > 1:
                add.append(form)
    for ind in d["indents"]:
        s = "\n" + ind
        if len(enc(s)) > 1:
            add.append(s)
    return sorted(set(add), key=lambda x: (-len(x), x))


def add_molde_tokens(tok, model=None, lang=None):
    """Adds the tokens to tok (in place). If model is given, resizes and initialises embeddings.
    Returns (new_tokens, {token: sub_token_ids})."""
    from tokenizers import AddedToken
    new = molde_token_list(tok, lang)
    subs = {t: tok(t, add_special_tokens=False)["input_ids"] for t in new}   # before adding
    tok.add_tokens([AddedToken(t, normalized=False, special=False, lstrip=False, rstrip=False) for t in new])
    if model is not None:
        import torch
        old_n = model.get_input_embeddings().weight.shape[0]
        model.resize_token_embeddings(max(len(tok), old_n), pad_to_multiple_of=8)
        emb_in = model.get_input_embeddings().weight
        emb_out = model.get_output_embeddings().weight if model.get_output_embeddings() is not None else None
        with torch.no_grad():
            for t in new:
                i = tok.convert_tokens_to_ids(t)
                ids = torch.tensor(subs[t], device=emb_in.device)
                emb_in[i] = emb_in[ids].mean(0)
                if emb_out is not None and emb_out.data_ptr() != emb_in.data_ptr():
                    emb_out[i] = emb_out[ids].mean(0)
    return new, subs


def roundtrip(tok, text):
    ids = tok(text, add_special_tokens=False)["input_ids"]
    return tok.decode(ids, skip_special_tokens=False, clean_up_tokenization_spaces=False) == text, len(ids)


def main():
    from transformers import AutoTokenizer
    ap = argparse.ArgumentParser()
    ap.add_argument("model"); ap.add_argument("--lang", required=True); ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--glob", default=None)
    a = ap.parse_args()
    files = sorted(glob.glob(a.glob or os.path.join(a.lang, "examples", "*.mo")) + glob.glob(os.path.join(a.lang, "examples/edits/*/*.mo")))
    texts = {f: open(f).read() for f in files}
    base = AutoTokenizer.from_pretrained(a.model)
    plain = {f: roundtrip(base, t) for f, t in texts.items()}
    tok = AutoTokenizer.from_pretrained(a.model)
    new, _ = add_molde_tokens(tok, None, a.lang)
    withx = {f: roundtrip(tok, t) for f, t in texts.items()}
    bad_plain = [f for f, (ok, _) in plain.items() if not ok]
    bad = [f for f, (ok, _) in withx.items() if not ok]
    n0 = [n for _, n in plain.values()]; n1 = [n for _, n in withx.values()]
    rep = {"model": a.model, "files": len(files), "added_tokens": len(new),
           "tokens_median_without": statistics.median(n0), "tokens_median_with": statistics.median(n1),
           "tokens_total_without": sum(n0), "tokens_total_with": sum(n1),
           "saving_pct": round(100 * (1 - sum(n1) / sum(n0)), 1),
           "roundtrip_fail_without": len(bad_plain), "roundtrip_fail_with": len(bad), "failing_with": bad[:5]}
    print(json.dumps(rep))
    if a.selftest and bad:
        sys.exit(1)


if __name__ == "__main__":
    main()
