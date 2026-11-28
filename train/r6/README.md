# Round 6: long-app edit data and eval for the Molde edit model (Gemma 270M, ops format)

Status: data and eval built and verified, **no training run yet** (Spark not touched). Numbers: `VERIFY.md` (rows, rejects, checks), `EVAL.md` (eval set, baselines), `data/build_summary.*.json`, `data/mix_report.json`.

## Why
The app report (`molde-design/app-r6/REPORT.md`, "0.7.1-dev: why ops edits failed in the app") showed the model, not the app, failed the critic's long-app edits: add a chart (invented arguments), a total, a label inside `if(...)` (rewrote the line unchanged or edited the wrong string), move a block (into the wrong parent), delete half of a legend. r5 plain test: add section 9/29, goal number 6/27, rename field 4/28, reorder 2/6, long programs 30/82.

## What is here
| File | What |
|---|---|
| `build_r6.mjs` | the builder. `node bases.mjs` first (pool of real 45-90 line programs from every earlier corpus, verified, clustered into apps), then `node build_r6.mjs --only held` and `--only train` (each deterministic; ~10 and ~35 min). Then `node postfix_r6.mjs data/r6_train.jsonl data/r6_train_rows.jsonl data/r6_heldout.jsonl` (two wording fixes for a build that predates them; idempotent), `node verify_r6.mjs`, `node mix_r6.mjs`. |
| `gens6.mjs` `blocks6.mjs` `pm.mjs` | the edit generators and part names; programs are never generated, only edits computed from a real program's own names |
| `phrases6.mjs` | hand-written paraphrase pools: 4 styles per kind (terse, plain, casual, specific) plus a small "unseen" pool used only by the eval |
| `judge6.mjs` `neg6.mjs` | "did the change do what was asked" (from before and after only) and the filter for the observed mistakes |
| `data/r6_train.jsonl` | 5,563 training rows (5,334 in the mix train, 229 in the mix val) in the r5 chat format (`messages`), meta has kind, sub, style, app, lines |
| `data/r6_train_rows.jsonl` | the same rows with before, after, spec (audits, critic) |
| `data/r6_heldout.jsonl` | 876 eval changes on 22 held-out apps; `core:true` marks the 246-row subset used for baselines |
| `data/mix_train.jsonl`, `mix_val.jsonl` | the training mix: r5c ops rows (build_5c.py ops, 23,757) minus rows with the observed mistakes (2) minus rows built from held-out apps (491) plus the r6 rows, 28,611 train and 1,260 val (see `mix_report.json`) |
| `eval_gen.mjs` `score_r6.mjs` `app_flow_r6.mjs` `run_baselines.sh` `eval_report.mjs` | the eval (laptop CPU, llama.cpp b12144) |
| `CRITIC_BRIEF.md`, `sample_for_critic.mjs`, `critic/` | brief and a 60-row sample for an independent reviewer |
| `ref/` | language commit 4698991 (checker, formatter, evaluator, diff) and the reference applier, copied so this folder runs on its own |
| `pipe6.sh`, `r6-gemma270m.yaml` | Spark training, resumable (below) |

## Train on Spark (do not run until the critic has passed the data)
Same recipe as r5c-ops: Gemma 3 270M instruct, MoldeScript tokens (`safe`), lr 5e-5, batch 4 x accum 4, bf16, 3 epochs; every epoch exported and kept.
1. `ssh spark`; `uptime` and `nvidia-smi` first (shared box: work only in `~/kamal`, 8 GB cap via `gpu_mem_gb`; ask before starting if other jobs run).
2. `cd ~/kamal/molde`; copy the repo's `train/` as for r5 (`train.py`, `common.py`, `export_gguf.sh`, `tokens/`, `lang/`); `scp` this folder's `r6-gemma270m.yaml` to `train/configs/` and `pipe6.sh` to the root.
3. `mkdir -p data/out-r6 && scp laptop:.../r6/data/mix_train.jsonl data/out-r6/train.jsonl && scp laptop:.../r6/data/mix_val.jsonl data/out-r6/val.jsonl` (to try a lighter mix, build with `node mix_r6.mjs --r6x 2` to repeat the r6 rows).
4. `nohup bash pipe6.sh > pipe6.log 2>&1 &`. It trains with `pause_at_epoch=E` (writes `ckpt/model` = the weights after epoch E), copies them to `runs/r6-ops/epE`, runs `export_gguf.sh` (Q8_0 and Q4_K_M, control-token fix, SHA256SUMS) and continues. Run it again after any interruption: it resumes from `ckpt/` and skips finished epochs. **Never delete an epoch's GGUF.**
5. Score every epoch the same way as the baselines: `node eval_gen.mjs runs/.../r6-ops-epN-Q4_K_M.gguf out/r6-epN.core.jsonl --core` (drop `--core` for all 876), `node score_r6.mjs out/r6-epN.core.jsonl`, then the app flow (`run_baselines.sh MODEL NAME ops`). Compare on the same core subset with the baselines in `EVAL.md`; use all by-kind numbers and a noise margin (n=28 per kind) before picking an epoch (r5 rule). Also re-run the r5 sets (40 changes, 321 chain, 60 new apps) so creates do not regress.
(`pipe6.sh` is modelled on the r5 recipe; the r5 `pipe5c.sh` itself is on Spark only and was not available on the laptop, so check the paths against it.)

## Honest caveats
See the end of `EVAL.md` and the report of this round; the short version: the corpus has almost no real programs over 50 lines (longer ones are real apps grown by verified add-edits), a few kinds are thin (add section, in-`if` renames, refusals), there are only 92 open real app families (70 train, 22 held-out) so variety is limited, and the old r5c/r3 baselines may have seen the held-out apps in their own training.
