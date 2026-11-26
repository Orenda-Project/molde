# Molde r4 report (written overnight, updated as results land)

Plain words: r4 trains on the new data (v3.1, 20,866 pairs, language round 14) on the spark server. Gemma 270M and Qwen 0.8B train at the same time on the same data.

## Gemma 270M against r3 Gemma (Q4_K_M, laptop, 4 threads; app core 0.6.0 for the app runs)

| | r3 Gemma | r4 Gemma epoch 1 | r4 Gemma epoch 2 (best) |
|---|---|---|---|
| heldout2 (149) checker pass, arm E | 90.6% | **94.6%** | 89.3% |
| heldout2 intent score / intent_auto | 0.726 / 55.0% | 0.686 / 52.3% | 0.724 / 50.3% |
| heldout2 create / edit / ask / oos pass | 88 / 100 / 90 / 90 | 94 / 100 / 100 / 80 | 87 / 93 / 90 / 100 |
| 60 short named requests: asks instead of building (no rule) | 31.7% | **5.0%** | 21.7% |
| same 60 through the app (no-ask rule): builds that pass | 59 of 60 | 58 of 60 | 53 of 60 |
| 40 small changes through the app: pass checker / do what was asked | 31 / 14 | 30 / 14 | 34 / **16** |
| median seconds per create / per small edit (app core) | 2.3 / 5.6 | 2.0 / 6.5 | 3.2 / 5.0 |
| validation checker pass during training (48 val requests) | n/a | 0.729 | 0.875 |

Provisional best (the first rule, small changes and intent first; the rule is now: judge on all rows together, and if two epochs are within 2 on the 40 changes, the one with more app builds and fewer asks wins, which would favour epoch 1 over epoch 2): epoch 2: 16 of 40 changes (14 before) and intent 0.724 (0.686); its checker pass on heldout2 is lower (89.3%) and it asks more than epoch 1 (21.7% against 5.0%), so the trade is not clean (16 against 14 of 40 is within noise). **The epoch-1 Gemma weights no longer exist.** I deleted the epoch-1 GGUFs on the laptop and the epoch-1 export folder on spark under the first keep rule (best+latest), and the training run itself overwrote its best and latest checkpoints at epoch 2 (spark `runs/r4-gemma270m`: `best/` and `ckpt/` now hold epoch 2 and later; no trash, no copy elsewhere, nothing in the Hugging Face cache). Epoch 1 therefore cannot be exported again; only its measured numbers (column above) remain. If it is needed for the final pick, a 1-epoch rerun with the same seed and data order takes about 50 minutes of the shared GPU (not started). Epochs 3 and 4 are still training. Laptop load average 6 to 10; other jobs running; all GGUF tokens verified identical in llama.cpp (180 of 180 programs).

## Qwen 0.8B (r4, trained on spark, 3 epochs): epochs measured so far (Q4_K_M, partial)

| | epoch 1 (laptop, app core 0.6.0) | epoch 2 (spark CPU) | epoch 3 |
|---|---|---|---|
| heldout2 (149) checker pass | 94.6% | **98.0%** | not measured |
| heldout2 intent score / intent_auto | 0.760 / 63.1% | 0.759 / 64.4% | not measured |
| 60 short named requests: asks instead of building | 11.7% | 16.7% | not measured |
| same 60 through the app (no-ask rule): builds that pass | 56 | 51 | not measured |
| 40 small changes through the app: do what was asked | 22 | 25 | not measured |
| median seconds per create / small edit | 4.3 / 11 (laptop) | 4.2 / 6.9 (spark CPU, not comparable) | not measured |

PARTIAL: epoch 3 was stopped before its evaluation finished (Kamal: Gemma only for now). Epoch 2 was measured on spark's CPU (speeds not comparable with the laptop numbers). The app model in `models.json` is epoch 1 (Q4_K_M, ChatML); epoch 2 looks better on heldout2 and small changes but builds fewer short requests, so it was not swapped in.

## Saved Qwen work (nothing is lost; each item is on Hugging Face or on spark)

| what | where |
|---|---|
| Qwen 0.8B epoch 1, 2, 3 Q4_K_M GGUF; epoch 3 Q8_0 | HF `oyekamal/molde-tiny/r4-qwen35-0.8b/` and spark `~/kamal/molde/runs/r4/gguf/` |
| Qwen 0.8B epoch-3 (final) full weights, bf16 | spark `~/kamal/molde/runs/r4/final/`; HF `r4-qwen35-0.8b/hf/` (upload running: see the model card) |
| Qwen 0.8B epoch-2 weights (best by validation) | spark `~/kamal/molde/runs/r4/best/` (bf16) |
| Qwen 0.8B epoch-1 weights | gone (overwritten during training); only its GGUF exists |
| Qwen 0.8B training log, checkpoints, config | spark `runs/r4/` (log.jsonl, ckpt/), `train/configs/r4-qwen35-0.8b.yaml` |
| Qwen 0.8B evaluation outputs | laptop `r4/q-ep1-Q4-*`; spark `~/kamal/molde/evalkit/out/q-ep2-*` |
| Qwen3.5-2B (paused) | spark `~/kamal/molde/runs/r4-qwen35-2b/` (ckpt = step 250 of 2,608, model + optimizer) |

## Qwen 2B: paused at step 250 (not resumed until told)

Config `train/configs/r4-qwen35-2b.yaml` (full fine-tune, 2 epochs, lr 2e-5, bf16, 40 validation requests one at a time), data v3.1 (`data/out-r4`). Resume: `systemctl --user enable --now molde-r4l molde-snap2` on spark (units in `~/.config/systemd/user`, script `~/kamal/molde/run_2b.sh`: checkpointing on, batch 8 x 2, cap 80 GB; it continues from `runs/r4-qwen35-2b/ckpt`, data order skips to step 250). Speed seen: about 13 s per step with checkpointing while sharing the GPU (about 16 s per step without it at batch 2 x 8; batch 4 x 4 without checkpointing ran out of memory at a 70 GB cap; a 100 GB cap starved the machine and was stopped). ETA when running alone: roughly 7 to 9 hours. Both units are disabled now; the checkpoint folder is kept. Shared limits when resuming: shrink the cap to the allowed total.

## Keep rule (changed overnight)
The Q4_K_M GGUF of every epoch is kept, on the laptop and on spark under `runs/<run>/gguf/` (a watcher in tmux `molde-snapg` and `molde-snapq` exports each epoch as its validation line appears). The big training checkpoints follow best+latest. The trainer only saves exact epoch-end weights when that epoch is the new best; otherwise the file is exported from the first 250-step checkpoint after the epoch end and the name says `approx-stepN`; if even that is gone a `MISSING-epN` note is written.
