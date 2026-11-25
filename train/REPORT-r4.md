# Molde r4 report (written overnight, updated as results land)

Plain words: r4 trains on the new data (v3.1, 20,866 pairs, language round 14) on the spark server. Gemma 270M and Qwen 0.8B train at the same time on the same data.

## Gemma 270M, epoch 1 (best so far) against r3 Gemma (Q4_K_M, laptop, 4 threads; the app's loop for speed)

| | r3 Gemma | r4 Gemma, epoch 1 |
|---|---|---|
| heldout2 (149): checker pass, arm E | 90.6% | **94.6%** |
| heldout2: intent score / intent_auto | 0.726 / 55.0% | 0.686 / 52.3% |
| heldout2 per kind (create / edit / ask / oos pass) | 88 / 100 / 90 / 90 | 94 / 100 / 100 / 80 |
| short named requests (60), asks instead of building, no rule | 31.7% | **5.0%** |
| same 60 through the app (no-ask rule): builds that pass | 59 of 60 | 58 of 60 |
| 40 small changes through the app (fixed scorer): pass the checker / do what was asked | 31 / 14 | 30 / 14 |
| seconds per create (median of the 60) / per small edit (median of the 40), app core 0.6.0 | 2.3 / 5.6 | 2.0 / 6.5 |
| file size | 241 MB | 241 MB |

Reading: epoch 1 of r4 builds more valid programs (+4 points) and almost never asks on one-word requests (5% instead of 32%), but its intent score is 0.04 lower and small changes did not improve (14 of 40 both). Epochs 2 to 4 are still training (validation checker pass at epoch 1: 0.729).
Notes: laptop load average 6 to 10 during these runs, other jobs running; GGUF tokens verified identical in llama.cpp (180 of 180 programs), turn markers are control tokens. The epoch-1 weights were exported from the best-checkpoint file on spark.

## Qwen 0.8B on spark
Training since 20:57 (restarted after a server reboot at 20:07 killed the first run at step 1,180 with no checkpoint). Sharing the GPU with the Gemma run slows it from about 8 to about 11 s per step. Epoch 1 expected about 03:00. Evaluation follows the same plan as above.

## Large model (Qwen 2B)
Not started: the GPU is busy with the two runs above. It starts when one finishes.

## Files
GGUFs `r4/gguf/`, evaluation outputs `r4/g-ep1-Q4-*`, app evaluation tool `r4/app_eval.mjs`, app notes for Qwen `r4/app-qwen-template.patch.md` and `r4/app-qwen-speed.md`.
