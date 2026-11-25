# Molde model sizes: what was actually done (2026-11-25)

Short version: **two of the three sizes exist.** Small (Gemma 3 270M, r2 and r3) and Medium (Qwen3.5-0.8B, 1 epoch). **Large (Qwen3.5-2B) was NOT trained**: the Colab units ran out first (see "What went wrong"). The LoRA path for it is written but untested (`train/train.py lora: true`, `train/configs/r2-qwen35-2b-lora.yaml`).

## Comparison (GGUF, decoder arm E of branch phase-2-decode, heldout2 = 149 items, laptop CPU 6 threads, other jobs running: load average shown)

| model | quant | file MB | checker pass | intent | intent_auto | create / edit / ask / oos pass | asks on heldout2 creates | s/app, arm E (laptop load) | peak RAM MB (bench) | load s | tok/s plain |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Small: Gemma 3 270M r2 (8 ep, v2) | Q4_K_M | 241 | 90.6% | 0.735 | 55.7% | 87 / 100 / 100 / 90% | 0% | 4.19 (load 5-26) | 398 | 1.0 | 67.8 |
| Small: Gemma 3 270M r2 | Q8_0 | 278 | 92.6% | 0.724 | 57.7% | 89 / 100 / 100 / 100% | 1% | 6.65 (load 17-25) | 454 | 2.0 | 58.4 |
| Small: Gemma 3 270M r3 (2 ep, v3.0) | Q4_K_M | 241 | 90.6% | 0.726 | 55.0% | 88 / 100 / 90 / 90% | 0% | 2.7 (load 20-11) | 398 | 1.0 | 67.8 |
| Small, 1 epoch only (equal-compute reference to Medium) | Q4_K_M | 241 | 87.9% | 0.675 | 47.7% | 83 / 100 / 100 / 90% | 0% | 3.9 (load 19-24) | 398 | 1.0 | 67.8 |
| Medium: Qwen3.5-0.8B (1 ep, v2) | Q4_K_M | 504 | **94.0%** | **0.746** | **61.7%** | 94 / 97 / 100 / 80% | 0% | 6.18 (load 29-88) | see bench | see bench | see bench |
| Medium: Qwen3.5-0.8B | Q8_0 | 774 | 90.6% | 0.704 | 55.0% | 92 / 86 / 90 / 90% | 0% | 6.46 (load 76-9) | see bench | see bench | see bench |
| Large: Qwen3.5-2B | | not trained | | | | | | | | | |

Caveats that matter:
- r2 rows were scored with the language at 2bf24a7, r3 and Qwen rows with a newer checker; r2 Q4 re-scored under the newer checker: 87.2% pass, intent 0.725 (`r3/eval/r2gemma-Q4_K_M-h2`). The fair Gemma r2 vs r3 comparison is 87.2% vs 90.6%.
- 149 items: one item is 0.7 points; differences below about 5 points are noise (checker pass 94.0 vs 90.6 is 5 items).
- The Qwen run had 1 epoch; the Gemma r2 8 epochs. Per epoch Qwen is clearly ahead (Gemma after 1 epoch: 87.9% / 0.675). At equal epochs the bigger model may or may not stay ahead: not measured.
- Speeds are polluted by load (a phone emulator and a browser were running; load average 10 to 88). Peak RAM comes from `sizes/bench.sh` (plain grammar, 5 requests); the RAM figure inside the arm-E runs (9.5 GB) is the llama.cpp prompt cache, not model memory.
- NOT done: Haiku "does it do what was asked" judging for the new files (sub-agents were not allowed in this phase; the r2-vs-r1 blind judge result stays in `r2/REPORT.md`: yes 42 vs 24 of 100), and the small-edit success per size except Gemma (below).

## Small changes (40 cases from `diag-2026-11-24/b-cases.mjs`, Gemma, arm E, Q4_K_M)

| | success |
|---|---|
| Gemma r2 | 30.0% (12/40) |
| Gemma r3 | 37.5% (15/40): title rename 4/6 (r2 1/6), goal/default 4/5; theme-dark, add field, reorder, bigger, rename button all 0 |

Earlier on 20 simpler changes (colour, title, add/remove chart) Gemma r2 scored 55% (Q4) / 60% (Q8). Qwen 0.8B small-edit runs were not completed.

## Short named requests ("todo", "track water", ...; 60 items; asking instead of building)

| | asks | checker pass |
|---|---|---|
| Gemma r2 Q4_K_M | 53.3% | 96.7% |
| Gemma r3 Q4_K_M | 31.7% | 95.0% |

r3 asks less because data v3 added build-first examples, but one third of one-word requests still end in a question. Qwen 0.8B was not run on this set.

## Phone estimates

Phones are roughly 3 to 8 times slower than this laptop. Laptop arm-E seconds per app (best seen, load-polluted): Gemma 270M Q4_K_M 2.7 to 4.2 s -> **about 8 to 34 s on a phone**; Qwen 0.8B Q4_K_M about 6 s -> **about 18 to 50 s**. Memory: Gemma Q4_K_M peaks near 0.4 GB (plus the app); Qwen 0.8B Q4_K_M about 1 GB (see bench file `sizes/eval/bench-qwen08-*.json`).

## Recommendation

- **3 to 4 GB phones: Gemma 3 270M r3 Q4_K_M** (241 MB, about 0.4 GB RAM, about 90% checker pass, asks least). This is the file marked `recommended` in `models.json`.
- **6 to 8 GB phones: keep Gemma r3 Q4_K_M as default; offer Qwen3.5-0.8B Q4_K_M (504 MB) as the "smarter" option only after it is trained 2 to 3 epochs on v3.** One epoch on v2 already gives +3 to +5 points pass and +0.02 intent over Gemma's 8 epochs, but it costs 2 to 2.5 times the time and about 2.5 times the memory. With the evidence in hand (one epoch, no judge run, no small-edit run) this is a lead, not a decision.
- 2B: no data. Do not plan for it on phones before the 0.8B result on v3 is in: a 2B Q4 file is about 1.3 GB and would be 5 to 8 times slower than Gemma on the same phone.

## What went wrong (for the next run)

- Colab reclaimed runtimes after about 65 minutes and websockets dropped on this laptop's connection: four Qwen/Gemma sessions lost their model (about 6 of the units). Fixes now in `train/colab/`: the runner reconnects with a new kernel after a dropped connection and train jobs re-attach to the running process; sessions must stay under 50 minutes; per-epoch weights and a dummy-aware ckpt pack; `train.py init_weights/start_step` restarts from a Drive weights file.
- The checkpoint pack with `ckpt_parts: 4` silently dropped the 5th part (the `best/` weights make the tar bigger): count the parts instead of guessing.
- Qwen3.5 batched generation with left padding is wrong (linear attention): the early-stopping metric reads 10% for a good model; use val loss, and batch size 1 for any HF-side eval.
- T4 with fp16 autocast trains Gemma 270M fine and fast (1 epoch of 15.8k pairs in 21 minutes), the cheapest way to train the small size.
- Data v3.0 has 4,497 rows in the pre-r14 `topbar "Name"` syntax that the current checker rejects; they were dropped. The data agent should regenerate them.

## Files

GGUFs: `r3/gguf/`, `r2/gemma270m/`, `sizes/gguf/` (Qwen 0.8B, Gemma 1-epoch). HF: `oyekamal/molde-tiny` folders `r2-gemma270m`, `r3-gemma270m`, `r2-qwen35-0.8b`; `models.json` lists r3 Q4_K_M first with `recommended: true` and every other file `false`.
Eval outputs: `sizes/eval/`, `r3/eval/`, tools `r3/run_eval.sh`, `sizes/bench.sh`, `r3/score_changes.mjs`.
