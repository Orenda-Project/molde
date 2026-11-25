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

Choice of best (small changes and intent first, checker pass second): **epoch 2**: 16 of 40 changes (14 before) and intent 0.724 (0.686); its checker pass on heldout2 is lower (89.3%) and it asks more than epoch 1 (21.7% against 5.0%), so the trade is not clean. The epoch-1 files were dropped under the best+latest rule. Epochs 3 and 4 are still training. Laptop load average 6 to 10; other jobs running; all GGUF tokens verified identical in llama.cpp (180 of 180 programs).

## Qwen 0.8B on spark
Training since 20:57 (restarted after a server reboot at 20:07 killed the first run at step 1,180 with no checkpoint). Sharing the GPU with the Gemma run slows it from about 8 to about 11 s per step. Epoch 1 expected about 03:00. Evaluation follows the same plan as above.

## Large model (Qwen 2B)
Not started: the GPU is busy with the two runs above. It starts when one finishes.

## Files
GGUFs `r4/gguf/`, evaluation outputs `r4/g-ep1-Q4-*`, app evaluation tool `r4/app_eval.mjs`, app notes for Qwen `r4/app-qwen-template.patch.md` and `r4/app-qwen-speed.md`.
