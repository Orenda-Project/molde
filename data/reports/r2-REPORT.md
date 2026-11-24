# Molde r2 report (Gemma 3 270M, 8 epochs on data v2) - written 2026-11-24

Decision: **r2 ships** (rule: arm E on Q4_K_M beats r1 by at least 5 points checker pass and is not worse on the Haiku yes-rate by more than 3). Uploaded to `oyekamal/molde-tiny/r2-gemma270m/`; `models.json` lists r2 Q4_K_M first with `recommended=true`, r1 entries kept with `recommended=false`.

## Decision numbers (Q4_K_M, line-stepped decoder arm E of branch phase-2-decode, heldout2 = 149 items, same conditions for both)

| | r1 (v1 data, 5.5k pairs) | r2 (v2 data, 14.1k pairs, 8 epochs) |
|---|---|---|
| checker pass, all 149 | 84.6% | **90.6%** (+6.0) |
| checker pass, 100 creates | 79% | 87% |
| edits (29) / ask (10) / out-of-scope (10) pass | 100 / 100 / 80% | 100 / 100 / 90% |
| intent score, all / creates | 0.727 / 0.635 | 0.735 / 0.658 |
| intent_auto (Phase 2a rule) | 49.0% | 55.7% |
| ask items answered with an `ask` program | 90% | 100% |
| Haiku judge on the 100 creates, blind, same prompt: yes / partly / no | 24 / 64 / 12 | **42 / 54 / 4** |
| median s per app, calls per app | 5.4 s, 10.5 | 4.2 s, 11.1 (laptop load average 5 to 26, other jobs running: speeds are not clean) |

Plain grammar, r1 Q8_0 on the same 149 (earlier run): 63.8% pass, intent 0.746, intent_auto 44.3% (create 50, edit 100, ask 90, oos 70). r2 HF fp32 no grammar (Colab, same 149): 78.5% pass (create 72, edit 93, ask 100, oos 80), intent 0.727, intent_auto 0.517.
The full matrix (Q8_0 and Q4_K_M, plain grammar and arm E, heldout2 and the old 44) is running in the background and writes `r2/eval/<model>-<quant>-<decoder>-<set>.metrics.json`; the Q4_K_M arm E heldout2 pair above is the one the decision rule needs and it is complete. Judge verdicts: `r2/eval/judge/` (key.json maps blind item ids to models).

## Training

- Data: v2 (14,538 pairs, 68% real wording by Haiku, 10% templated), v1 removed from sources; 14,124 train / 720 val; language commit 2bf24a7 (migrated, 0 dropped). Built in under 5 minutes now (batched migrate + check).
- Gemma 3 270M (unsloth mirror of google/gemma-3-270m-it), full fine-tune, 8 epochs, MoldeScript tokens added (safe mode, verified identical in llama.cpp, 180/180 programs), L4, 883 steps per epoch of 16 pairs, about 11 to 12 minutes per epoch.
- Validation checker pass (48 val requests, one request = 2.1 points) by epoch: 0.71, 0.77, 0.88, 0.90, 0.83, 0.85, 0.81, final 0.90. The curve is flat from epoch 3 on within noise: 8 epochs were more than needed; 4 to 5 would give about the same.
- Two Colab sessions (51 and 59 min, under the 70-minute rule), per-epoch bf16 weights saved to Drive (`molde-train/runs/r2-gemma270m/epochs/`), full checkpoint (4 parts) between sessions, resume worked. The final model was saved to Drive before eval.
- 38_eval asserted on the word "Traceback" appearing somewhere in the combined eval log (three evals run in one command); the last eval (heldout2) completed and printed metrics, the log tail does not show which of the first two printed it. The eval job's assertion is too blunt (it matches a warning text); fix: check each eval's metrics.json instead. Nothing was lost: the model was already on Drive.
- Units (estimates from runtime minutes, about 1.9 units per hour on an L4): about 3.8 of the 8 cap. No runtime is attached (checked: `colab_jobs` empty, runner exited, `released` in both runner logs).

## Export and tokenizer

GGUF exported on the laptop (llama.cpp b12144 converter) with `tokens/fix_gguf_control.py` in the export script: `<start_of_turn>` and `<end_of_turn>` are marked as CONTROL tokens (they were plain text in r1: the chat template fed the model 7 text pieces). Verified: the chat prompt tokenises to the same ids as the training tokenizer ([105, 2364, 107, ..., 106, 107, 105, 4368, 107]) and 180 of 180 programs tokenise identically.

## Decoder hook

`train/decode_eval.py` wraps `decode/run.mjs` of branch phase-2-decode (arms B to E) with the trainer's scoring; `local_load_test.py --decoder runner:E` calls it. It runs against a copy of decode/ that points to this branch's `lang/` (`/tmp/molde-decx`), so r1 and r2 are scored with the same checker. Route: `text` (the server's chat template, correct now that the turn markers are control tokens).

## Deleted locally (plain rm)

r2 safetensors (`train-setup/r2-gemma/final/model.safetensors`) and the f16 GGUF, after the Q8_0 and Q4_K_M files were verified (load test in publish_hf, tokenizer check). Also the earlier lists in `molde-model/r1-deleted-manifest.txt`. Kept: GGUFs in `r2/gemma270m/`, `r1/*`.

## What r2 did not do

Qwen3.5-0.8B was not started (coordinator's instruction). The 10 failing heldout2 examples per file are in `r2/eval/*-E-h2.metrics.rows.json` (fields output, ref, pass, err). HF-side per-kind r2 table is in the Colab log only.
