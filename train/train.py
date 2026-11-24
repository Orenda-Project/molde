#!/usr/bin/env python3
"""Full fine-tune of a small causal LM on Molde chat data. Loss on the assistant part only. Resumable.

  python3 train.py --config configs/gemma270m.yaml [--set key=value ...]

Config keys (YAML, CLI --set overrides):
  model, tokenizer (default = model), data_dir (train.jsonl/val.jsonl), out_dir, lang (for added tokens),
  add_molde_tokens (bool), epochs, max_steps (0 = from epochs), lr, min_lr_ratio, warmup_steps, weight_decay,
  batch_size, grad_accum, max_len, precision (auto|bf16|fp16|fp32), grad_checkpointing, eval_every, save_every,
  max_minutes (pause after this wall time with a ckpt; 0 = no limit), seed, save_dtype (bf16|fp16|fp32),
  chat_kwargs (extra apply_chat_template kwargs, e.g. enable_thinking: false)

Output (out_dir): log.jsonl, ckpt/ (model + optimizer + state, for resume), final/ (HF model + tokenizer) when finished,
DONE (written when the schedule is complete), PAUSED (when max_minutes hit; run again to resume).
Precision: auto = bf16 on Ampere+, else fp32 for <=400M params, else fp16 autocast with GradScaler.
"""
import argparse, json, math, os, pathlib, random, shutil, sys, time

import torch
import torch.utils.checkpoint
import yaml

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from common import encode_example, read_jsonl  # noqa: E402

DEFAULTS = dict(tokenizer=None, data_dir="data/out", out_dir="runs/smoke", lang="lang", add_molde_tokens=False, token_mode="full",
                epochs=3, max_steps=0, lr=5e-5, min_lr_ratio=0.1, warmup_steps=10, weight_decay=0.0, batch_size=8,
                grad_accum=1, max_len=1536, precision="auto", grad_checkpointing=False, eval_every=20, save_every=50,
                max_minutes=0, seed=1234, pause_at_epoch=0, lora=False, lora_r=64, lora_alpha=128, lora_dropout=0.0, base_dtype="fp32", ckpt_mode="full", restart_warmup=20, es_val_n=48, es_patience=2, es_max_new=420, save_dtype="bf16", chat_kwargs={})


def load_cfg(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", required=True)
    ap.add_argument("--set", nargs="*", default=[])
    a = ap.parse_args(argv)
    cfg = dict(DEFAULTS); cfg.update(yaml.safe_load(open(a.config)))
    for kv in a.set:
        k, v = kv.split("=", 1)
        cfg[k] = yaml.safe_load(v)
    return cfg


def batches(rows, bs, rng):
    """length-bucketed shuffled batches (sorted inside chunks of 8*bs to cut padding)."""
    idx = list(range(len(rows))); rng.shuffle(idx)
    out = []
    for i in range(0, len(idx), bs * 8):
        ch = sorted(idx[i:i + bs * 8], key=lambda j: len(rows[j][0]))
        out += [ch[k:k + bs] for k in range(0, len(ch), bs)]
    rng.shuffle(out)
    return out


def collate(rows, ids, pad, dev):
    L = max(len(rows[i][0]) for i in ids)
    x = torch.full((len(ids), L), pad, dtype=torch.long); y = torch.full((len(ids), L), -100, dtype=torch.long); m = torch.zeros((len(ids), L), dtype=torch.long)
    for r, i in enumerate(ids):
        a, b, _ = rows[i]
        x[r, :len(a)] = torch.tensor(a); y[r, :len(b)] = torch.tensor(b); m[r, :len(a)] = 1
    return x.to(dev), y.to(dev), m.to(dev)


def main():
    cfg = load_cfg(sys.argv[1:])
    t0 = time.time()
    from transformers import AutoModelForCausalLM, AutoTokenizer
    out = pathlib.Path(cfg["out_dir"]); out.mkdir(parents=True, exist_ok=True)
    logf = open(out / "log.jsonl", "a")
    def log(**k):
        k["t"] = round(time.time() - t0, 1); print(json.dumps(k), flush=True); logf.write(json.dumps(k) + "\n"); logf.flush()
    if (out / "DONE").exists():
        print("SFT_DONE already"); return
    random.seed(cfg["seed"]); torch.manual_seed(cfg["seed"])
    dev = "cuda" if torch.cuda.is_available() else "cpu"
    ck = out / "ckpt"
    src = str(ck / "model") if (ck / "state.json").exists() else cfg["model"]
    tok = AutoTokenizer.from_pretrained(src if (ck / "state.json").exists() else (cfg["tokenizer"] or cfg["model"]))
    BD = {"fp32": torch.float32, "bf16": torch.bfloat16}[cfg["base_dtype"]]
    resuming = (ck / "state.json").exists()
    if cfg["lora"] and resuming:   # adapter checkpoint: base model from the hub, tokenizer (with added tokens) from the checkpoint
        model = AutoModelForCausalLM.from_pretrained(cfg["model"], torch_dtype=BD)
        model.resize_token_embeddings(len(tok), pad_to_multiple_of=8)
    else:
        model = AutoModelForCausalLM.from_pretrained(src, torch_dtype=BD)
    nparams = sum(p.numel() for p in model.parameters())
    if cfg["add_molde_tokens"] and not (ck / "state.json").exists():
        sys.path.insert(0, str(pathlib.Path(__file__).parent / "tokens"))
        from molde_tokens import add_molde_tokens
        orig_vocab = len(tok); (out / "orig_vocab.txt").write_text(str(orig_vocab))
        new, _ = add_molde_tokens(tok, model, cfg["lang"], cfg["token_mode"])
        log(event="added_tokens", n=len(new), vocab=len(tok))
    if cfg["lora"]:
        from peft import LoraConfig, get_peft_model, PeftModel
        if resuming:
            model = PeftModel.from_pretrained(model, str(ck / "model"), is_trainable=True)
        else:
            kw = {}
            if cfg["add_molde_tokens"]:
                kw["trainable_token_indices"] = {"embed_tokens": [tok.convert_tokens_to_ids(x) for x in new]}
            try:
                lc = LoraConfig(r=cfg["lora_r"], lora_alpha=cfg["lora_alpha"], lora_dropout=cfg["lora_dropout"], target_modules="all-linear", task_type="CAUSAL_LM", **kw)
                model = get_peft_model(model, lc)
            except Exception as e:   # older peft or tied-embedding trouble: keep the new keyword rows frozen at their mean initialisation
                log(event="lora_trainable_tokens_failed", err=str(e)[:200])
                lc = LoraConfig(r=cfg["lora_r"], lora_alpha=cfg["lora_alpha"], lora_dropout=cfg["lora_dropout"], target_modules="all-linear", task_type="CAUSAL_LM")
                model = get_peft_model(model, lc)
        ntrain = sum(p.numel() for p in model.parameters() if p.requires_grad)
        log(event="lora", trainable=ntrain, total=sum(p.numel() for p in model.parameters()))
    inner = model.get_base_model() if cfg["lora"] else model
    model.to(dev)
    if cfg["grad_checkpointing"]:
        inner.gradient_checkpointing_enable(); inner.config.use_cache = False
        if cfg["lora"]: inner.enable_input_require_grads()
    prec = cfg["precision"]
    if prec == "auto":
        cc = torch.cuda.get_device_capability()[0] if dev == "cuda" else 0
        prec = "bf16" if cc >= 8 else ("fp32" if nparams < 400e6 else "fp16")
    amp_dtype = {"bf16": torch.bfloat16, "fp16": torch.float16}.get(prec)
    scaler = torch.amp.GradScaler("cuda", enabled=(prec == "fp16"))
    pad = tok.pad_token_id if tok.pad_token_id is not None else (tok.eos_token_id or 0)

    ck_args = cfg["chat_kwargs"]
    def enc(rows):
        res = [encode_example(tok, r["messages"], cfg["max_len"], ck_args) for r in rows]
        return res
    train = enc(read_jsonl(pathlib.Path(cfg["data_dir"]) / "train.jsonl"))
    val = enc(read_jsonl(pathlib.Path(cfg["data_dir"]) / "val.jsonl"))
    trunc = sum(1 for r in train if r[2])
    spe = math.ceil(len(train) / cfg["batch_size"]) // cfg["grad_accum"]
    total = cfg["max_steps"] or spe * cfg["epochs"]
    log(event="start", model=cfg["model"], params=nparams, precision=prec, device=dev, train=len(train), val=len(val),
        truncated=trunc, max_len_seen=max(len(r[0]) for r in train), steps_per_epoch=spe, total_steps=total,
        gpu=torch.cuda.get_device_name(0) if dev == "cuda" else None)

    opt = torch.optim.AdamW([p for p in model.parameters() if p.requires_grad], lr=cfg["lr"], weight_decay=cfg["weight_decay"], betas=(0.9, 0.95))
    def lr_at(s):
        if s - resume_step < cfg["restart_warmup"]:
            return lr_base(s) * (s - resume_step + 1) / cfg["restart_warmup"]
        return lr_base(s)
    def lr_base(s):
        if s < cfg["warmup_steps"]:
            return cfg["lr"] * (s + 1) / cfg["warmup_steps"]
        p = (s - cfg["warmup_steps"]) / max(1, total - cfg["warmup_steps"])
        return cfg["lr"] * (cfg["min_lr_ratio"] + (1 - cfg["min_lr_ratio"]) * 0.5 * (1 + math.cos(math.pi * min(1, p))))
    step = 0; resume_step = -10**9
    if (ck / "state.json").exists():
        for nm in ("best.json", "orig_vocab.txt"):
            if (ck / "extra" / nm).exists() and not (out / nm).exists(): shutil.copy(ck / "extra" / nm, out / nm)
        if (ck / "extra" / "best").exists() and not (out / "best").exists(): shutil.copytree(ck / "extra" / "best", out / "best")
        st = json.load(open(ck / "state.json")); step = st["step"]
        if (ck / "opt.pt").exists():
            opt.load_state_dict(torch.load(ck / "opt.pt", map_location=dev)); resume_step = -10**9
        else:
            resume_step = step   # weights-only checkpoint: Adam restarts, so warm the learning rate up again
        log(event="resumed", step=step, optimizer_state=(ck / "opt.pt").exists())

    def fwd(x, y, m):
        """summed CE over assistant tokens; logits only at those positions (Gemma's 262k vocab would OOM a T4 otherwise)."""
        ctx = torch.autocast("cuda", dtype=amp_dtype) if amp_dtype and dev == "cuda" else torch.autocast("cpu", enabled=False)
        tgt = y[:, 1:]; sel = tgt != -100
        base = getattr(inner, "model", None)
        with ctx:
            if base is not None and inner.get_output_embeddings() is not None:
                hs = base(input_ids=x, attention_mask=m).last_hidden_state[:, :-1][sel]
                head = inner.get_output_embeddings()
                loss = 0.0
                for i in range(0, hs.size(0), 1024):
                    part = lambda h: head(h).float()
                    lg = torch.utils.checkpoint.checkpoint(part, hs[i:i + 1024], use_reentrant=False) if model.training else part(hs[i:i + 1024])
                    loss = loss + torch.nn.functional.cross_entropy(lg, tgt[sel][i:i + 1024], reduction="sum")
                return loss, sel.sum()
            logits = model(input_ids=x, attention_mask=m).logits[:, :-1].float()
        return torch.nn.functional.cross_entropy(logits.reshape(-1, logits.size(-1)), tgt.reshape(-1), ignore_index=-100, reduction="sum"), sel.sum()

    @torch.no_grad()
    def evaluate():
        model.eval(); tl = 0.0; tn = 0
        for i in range(0, len(val), cfg["batch_size"]):
            ids = list(range(i, min(len(val), i + cfg["batch_size"])))
            l, n = fwd(*collate(val, ids, pad, dev)); tl += l.item(); tn += n.item()
        model.train(); return tl / max(1, tn)

    def checker_pass(n):
        """greedy-generate the first n validation requests and count programs that pass `mo.mjs check` (early-stopping metric)."""
        import subprocess, tempfile
        from concurrent.futures import ThreadPoolExecutor
        from common import prompt_text
        rows = read_jsonl(pathlib.Path(cfg["data_dir"]) / "val.jsonl")[:n]
        model.eval(); tok.padding_side = "left"; outs = []
        old_cache = model.config.use_cache; model.config.use_cache = True
        for i in range(0, len(rows), 16):
            ps = [prompt_text(tok, r["messages"][:-1], ck_args) for r in rows[i:i + 16]]
            enc = tok(ps, return_tensors="pt", padding=True, add_special_tokens=False).to(dev)
            with torch.no_grad(), (torch.autocast("cuda", dtype=amp_dtype) if amp_dtype and dev == "cuda" else torch.autocast("cpu", enabled=False)):
                o = model.generate(**enc, max_new_tokens=cfg["es_max_new"], do_sample=False, pad_token_id=pad)
            outs += [tok.decode(x[enc["input_ids"].shape[1]:], skip_special_tokens=True).strip("\n") + "\n" for x in o]
        model.config.use_cache = old_cache; model.train()
        td = tempfile.mkdtemp()
        def chk(j):
            p = pathlib.Path(td) / f"{j}.mo"; p.write_text(outs[j])
            return subprocess.run(["node", str(pathlib.Path(cfg["lang"]) / "mo.mjs"), "check", str(p)], capture_output=True).returncode == 0
        with ThreadPoolExecutor(8) as ex:
            ok = list(ex.map(chk, range(len(outs))))
        return sum(ok) / max(1, len(ok))

    best = {"score": -1.0, "epoch_bad": 0}
    if (out / "best.json").exists():
        best["score"] = json.load(open(out / "best.json"))["checker_pass"]
    def save_ckpt():
        tmp = out / "ckpt_tmp"; tmp.mkdir(exist_ok=True)
        model.save_pretrained(tmp / "model", safe_serialization=True); tok.save_pretrained(tmp / "model")
        if cfg["ckpt_mode"] == "full": torch.save(opt.state_dict(), tmp / "opt.pt")
        json.dump({"step": step}, open(tmp / "state.json", "w"))
        ex = tmp / "extra"; ex.mkdir(exist_ok=True)
        for nm in ("best.json", "orig_vocab.txt"):
            if (out / nm).exists(): shutil.copy(out / nm, ex / nm)
        if (out / "best").exists(): shutil.copytree(out / "best", ex / "best", dirs_exist_ok=True)
        if ck.exists(): shutil.rmtree(ck)
        tmp.rename(ck); log(event="ckpt", step=step)

    model.train()
    if step == 0:
        log(event="eval", step=0, val_loss=round(evaluate(), 4))
    last_loss = []; step_stop = False
    while step < total and not step_stop:
        ep, within = divmod(step, spe)
        order = batches(train, cfg["batch_size"], random.Random(cfg["seed"] + ep))
        ga = cfg["grad_accum"]
        for k in range(within * ga, len(order) - ga + 1, ga):
            for g in opt.param_groups: g["lr"] = lr_at(step)
            group = order[k:k + ga]
            ntok = sum(sum(1 for t in train[i][1][1:] if t != -100) for b in group for i in b)
            tot = 0.0
            for b in group:
                l, n = fwd(*collate(train, b, pad, dev))
                scaler.scale(l / ntok).backward(); tot += l.item()
            scaler.unscale_(opt); gn = torch.nn.utils.clip_grad_norm_([p for p in model.parameters() if p.requires_grad], 1.0)
            if not math.isfinite(gn.item()):
                log(event="NONFINITE", step=step); 
                if prec == "fp16": opt.zero_grad(set_to_none=True); scaler.update(); continue
                sys.exit("NONFINITE loss: use precision fp32")
            scaler.step(opt); scaler.update(); opt.zero_grad(set_to_none=True)
            step += 1; last_loss.append(tot / ntok)
            if step % 5 == 0 or step == total:
                log(event="train", step=step, epoch=round(step / spe, 2), loss=round(sum(last_loss) / len(last_loss), 4), lr=round(lr_at(step), 8), gnorm=round(gn.item(), 3)); last_loss = []
            if step % cfg["eval_every"] == 0 or step == total:
                log(event="eval", step=step, val_loss=round(evaluate(), 4))
            if cfg["es_val_n"] and step % spe == 0 and step < total:
                sc = checker_pass(cfg["es_val_n"]); log(event="val_checker", step=step, epoch=step // spe, checker_pass=round(sc, 3))
                if sc > best["score"]:
                    best.update(score=sc, epoch_bad=0)
                    shutil.rmtree(out / "best", ignore_errors=True); (out / "best").mkdir(parents=True)
                    from safetensors.torch import save_file
                    save_file({k: v.detach().to(torch.bfloat16).cpu().contiguous() for k, v in model.state_dict().items()}, str(out / "best" / "model.safetensors"), metadata={"format": "pt"})
                    (out / "best.json").write_text(json.dumps({"step": step, "checker_pass": sc}))
                else:
                    best["epoch_bad"] += 1
                    if best["epoch_bad"] >= cfg["es_patience"]:
                        log(event="early_stop", step=step); step_stop = True; break
            if cfg["pause_at_epoch"] and step % spe == 0 and step // spe >= cfg["pause_at_epoch"] and step < total:
                save_ckpt(); (out / "PAUSED").write_text(str(step)); log(event="PAUSE", step=step, epoch=step // spe); return
            if step % cfg["save_every"] == 0 and step < total:
                save_ckpt()
            if step >= total: break
            if cfg["max_minutes"] and (time.time() - t0) / 60 > cfg["max_minutes"]:
                save_ckpt(); (out / "PAUSED").write_text(str(step)); log(event="PAUSE", step=step); return
    if cfg["es_val_n"] and (out / "best.json").exists():
        fin = checker_pass(cfg["es_val_n"]); log(event="val_checker", step=step, epoch="final", checker_pass=round(fin, 3))
        if fin < best["score"]:
            from safetensors.torch import load_file
            sd = load_file(out / "best" / "model.safetensors"); model.load_state_dict(sd, strict=False); model.tie_weights()
            log(event="restored_best", checker_pass=round(best["score"], 3))
    dt = {"bf16": torch.bfloat16, "fp16": torch.float16, "fp32": torch.float32}[cfg["save_dtype"]]
    if cfg["lora"]:
        model = model.merge_and_unload()
    model.to(dt).save_pretrained(out / "final", safe_serialization=True); tok.save_pretrained(out / "final")
    json.dump({k: v for k, v in cfg.items()}, open(out / "final" / "train_config.json", "w"), indent=1)
    if cfg["add_molde_tokens"] and (out / "final" / "tokenizer.json").exists():
        orig_vocab = int((out / "orig_vocab.txt").read_text()) if (out / "orig_vocab.txt").exists() else len(AutoTokenizer.from_pretrained(cfg["tokenizer"] or cfg["model"]))
        # llama.cpp's SentencePiece path reads added tokens from added_tokens.json (tokenizer.json alone would export [PAD] placeholders)
        json.dump({t: i for t, i in tok.get_vocab().items() if i >= orig_vocab}, open(out / "final" / "added_tokens.json", "w"))
    if True:   # llama.cpp's converter needs the SentencePiece file for Gemma (tokenizer.json alone fails an assert)
        try:
            from huggingface_hub import hf_hub_download
            shutil.copy(hf_hub_download(cfg["tokenizer"] or cfg["model"], "tokenizer.model"), out / "final" / "tokenizer.model")
        except Exception as e:
            print("no tokenizer.model for this base (fine for BPE models):", type(e).__name__)
    (out / "DONE").write_text(f"steps={step}"); (out / "PAUSED").unlink(missing_ok=True)
    log(event="SFT_DONE", step=step, minutes=round((time.time() - t0) / 60, 1))


if __name__ == "__main__":
    main()
