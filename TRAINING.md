# Training Molde models

This page shows how to rebuild the dataset, fine-tune a small model, export it to GGUF and score it, so you can reproduce r2 or train something better. Everything runs on one GPU with 16 GB of memory or more (a free Colab T4 is enough for the 270M model). Exporting and evaluating work on a laptop CPU.

## What you need

- Python 3.10+ with `torch`, `transformers`, `pyyaml`, `safetensors`, `huggingface_hub` (and `peft` for LoRA configs)
- Node 20+ (the checker and scorer are plain ES modules, no `npm install`)
- llama.cpp for export and local tests (we use build b12144; `train/export_gguf.sh` downloads it)
- This repo: `lang/` (the language, grammar and checker) and `train/` (the pipeline)

The base model is Gemma 3 270M instruct. `google/gemma-3-270m-it` is gated on Hugging Face; the configs use the ungated mirror `unsloth/gemma-3-270m-it` (same weights; the Gemma Terms of Use still apply).

## 1. The data

Dataset: [huggingface.co/datasets/oyekamal/molde-data](https://huggingface.co/datasets/oyekamal/molde-data).

| File | Pairs | Notes |
|---|---|---|
| `v1/v1.jsonl` | 5,469 | 4,210 create, 1,259 edit; mostly templated wording |
| `v2/v2.jsonl` | 14,538 | 10,924 create, 3,614 edit; 68% real-user wording. r2 was trained on this. |
| `v2/heldout2.jsonl` | 149 | the main test set (100 create, 29 edit, 10 ask, 10 out of scope); never train on it |
| `v3/v3.jsonl` | 18,524 | 12,903 create, 5,621 edit; richer apps, long-program edits, named short requests. r3 trains on this. |

One JSON object per line:

```json
{"id": "v3-cr-2b61d9a283", "task": "create", "request": "bills due this month unpaid total pls",
 "program": "app \"Bills month\" wallet slate\ntable bill name text, due date, amount money, paid bool\n...",
 "source": "v2:real:create", "meta": {"style": "hurried", "domain": "real", "tokens": 141, "language_commit": "07f253b"}}
```

- `task`: `create` or `edit`. An edit also has `before` (the current program); `program` is always the full target program.
- Ask and out-of-scope items are also `create` rows. For a vague request the target is an `ask ...` program (a question with tap answers). For a request the language cannot fully do (voice input, internet), the target is the closest app it can build without that part.
- `meta.language_commit` is the MoldeScript version the row was checked against. Older rows are migrated automatically (step 2).

### How the data was made, and how to make more

The data is synthetic. Large language models wrote varied app programs and real-sounding requests; scripts generated templated and mutated variants and edit pairs; **every program was then run through the MoldeScript checker and canonical formatter, and anything that failed was dropped**. A sample was judged by a separate model for "does the program do what the request asks" (90.8% yes on 872 v2 items).

The generators live on the [`data` branch](https://github.com/Orenda-Project/molde/tree/data/data) and in the dataset repo:

- `v1/gen/`: domain lists, app archetypes, mutations, edits, asks, out-of-scope (`build.mjs` assembles, `verify.mjs` checks)
- `v2/gen/`: `prep.mjs` (prompts for the request writers), `assemble.mjs`, `verify.mjs`, `heldout2.mjs`, judge prep and aggregation
- `v3/gen/`: `rich/` (richer app generators: dates, timers, calculators, custom drawing), `longedit.mjs` and `mkedits.mjs` (small changes to long programs), `assemble3.mjs`, `simcheck.mjs` (similarity against the test set)
- `hand/`: the batches of hand-written or model-written programs the generators start from

To add data, write rows in the format above (any number of `.jsonl` files) and put them in `train/data/sources/`. The builder checks every row, so a broken program never reaches training. Keep test requests out: `build_dataset.py` drops any source row whose request text equals a test request; for big sets also filter near-duplicates.

Useful checks while writing data:

```bash
node lang/mo.mjs check my.mo          # OK, or line + error code + fix hint
node lang/mo.mjs format my.mo         # the one canonical spelling
node lang/mo.mjs describe my.mo       # plain-English summary, good for writing requests from programs
node lang/mo.mjs diff before.mo after.mo   # is this edit safe for saved data?
```

## 2. Build the training set

```bash
cd train
mkdir -p data/sources
curl -L -o data/sources/molde_data_v3.jsonl \
  https://huggingface.co/datasets/oyekamal/molde-data/resolve/main/v3/v3.jsonl
python3 data/build_dataset.py --lang ../lang --migrate --out data/out-r3
```

This writes `train.jsonl`, `val.jsonl`, `test.jsonl`, `test_refs.jsonl` and `dataset_card.json` (system prompt, counts, dropped rows with the reason). The split is fixed by id: the test split is 40 language-corpus programs plus 4 edits, validation is about 5%. Built with the current language, v3 gives 15,809 train and 827 val pairs.

The chat format (from `common.py`): system prompt

```
You write MoldeScript, a tiny language for small phone apps. Reply with the complete program only, no explanation. For an edit request you get the current program: reply with the full updated program.
```

then the user turn `Request: <text>` for a create, or `Edit request: <text>\n\nCurrent program:\n<program>` for an edit. Loss is on the assistant turn only.

## 3. Train

```bash
cd train
python3 train.py --config configs/r3-gemma270m.yaml \
  --set data_dir=data/out-r3 out_dir=runs/my-r3 lang=../lang
```

- Full fine-tune, resumable: `ckpt/` is written every `save_every` steps; run the same command again to resume. `max_minutes` pauses cleanly with a checkpoint (useful on Colab).
- `add_molde_tokens: true` with `token_mode: safe` adds MoldeScript keywords as tokens. Use `safe`: in `full` mode, tokens that carry spaces or newlines tokenize differently in llama.cpp than in Hugging Face (34 of 180 programs differed), in `safe` mode 180 of 180 match. Check with `tokens/check_gguf_tokenizer.py` on the exported GGUF.
- Precision `auto`: bf16 on Ampere or newer, fp32 for models up to 400M on older GPUs (T4).
- Other configs in `configs/`: SmolLM2 135M/360M, Qwen3.5 0.8B (needs gradient checkpointing and an L4 or better), a 2B LoRA config.

What r2 used: Gemma 3 270M, data v2, 8 epochs, lr 5e-5, batch 8 x grad accum 2, MoldeScript tokens in safe mode, one L4, about 12 minutes per epoch. Validation checker pass was flat from epoch 3, so 4 to 5 epochs are enough; the r3 config stops early on validation.

Quick look at quality before export (Hugging Face model, greedy, no grammar):

```bash
python3 eval_gen.py --model runs/my-r3/final --data data/out-r3 --lang ../lang
```

### On Colab

`train/colab/` runs the whole chain (fetch, smoke test, train, eval, export, save to Drive) as job files on one runtime and releases it when done. Read [`train/colab/README.md`](train/colab/README.md) first: it holds the rules learned the hard way (small cells only, save checkpoints to Drive before a runtime is reclaimed at about 80 minutes, abort the chain on any failed step). The runner talks to Colab through a Colab MCP connector; if you do not use that connector, run the same steps in a notebook by hand: `train.py`, then `export_gguf.sh`. No tokens or credentials are stored in this repo; Colab and Drive sign-in happen on your side.

## 4. Export to GGUF

```bash
cd train
LLAMA_SRC=$HOME/llama.cpp LLAMA_BIN=$HOME/llama-b12144 \
  bash export_gguf.sh runs/my-r3/final my-r3 runs/my-r3/gguf
```

It clones llama.cpp at the pinned tag if `LLAMA_SRC` is missing, downloads the release binaries if `LLAMA_BIN` is missing, converts to f16, quantizes to Q8_0 and Q4_K_M, and writes `SHA256SUMS`.

**The control-token fix.** llama.cpp's converter reads Gemma's `<start_of_turn>` and `<end_of_turn>` as plain text, so the chat template fed the model 7 text pieces instead of the one id it was trained on (r1 suffered from this). `export_gguf.sh` runs `tokens/fix_gguf_control.py` on each file, which marks them as CONTROL tokens in place. To verify by hand:

```bash
python3 tokens/fix_gguf_control.py runs/my-r3/gguf/my-r3-Q4_K_M.gguf --hf runs/my-r3/final
```

The chat prompt must tokenize to the same ids as the training tokenizer (for Gemma it starts `105, 2364, 107` and the model turn is `106, 107, 105, 4368, 107`).

## 5. Evaluate

Three levels, from quick to thorough. Always score the quantized file you would ship.

**a. Fixed test split with llama.cpp and the grammar** (laptop CPU, a few minutes):

```bash
cd train
LLAMA_BIN=$HOME/llama-b12144 python3 local_load_test.py runs/my-r3/gguf/my-r3-Q4_K_M.gguf \
  --data data/out-r3 --lang ../lang --full --metrics q4.metrics.json
```

Reports checker pass (raw and after formatting), intent score (table and field F1, component and aggregate overlap; `score.mjs`), median tokens and speed. `--nogrammar` measures raw model quality.

**b. heldout2 (149 requests) with the app's decoder.** The app does not use the plain grammar alone: it decodes line by line with a per-line name grammar and re-samples a line that fails the checker (arm E, branch [`phase-2-decode`](https://github.com/Orenda-Project/molde/tree/phase-2-decode), report `decode/REPORT.md`). With that branch's `decode/` next to `lang/`:

```bash
curl -L -o heldout2.raw.jsonl \
  https://huggingface.co/datasets/oyekamal/molde-data/resolve/main/v2/heldout2.jsonl
# the scorer expects the reference in "ref" and the kind (create/edit/ask/oos) in "kind"
python3 -c "import json
for l in open('heldout2.raw.jsonl'):
    r = json.loads(l); print(json.dumps({**r, 'ref': r['program'], 'before': r.get('before'), 'kind': r['meta']['kind']}))" \
  > data/out-r3/heldout2.jsonl
python3 local_load_test.py my-r3-Q4_K_M.gguf --data data/out-r3 --refs heldout2.jsonl \
  --decoder runner:E --metrics e.metrics.json
```

**c. 140 new ideas, judged** (branch [`eval-novel`](https://github.com/Orenda-Project/molde/tree/eval-novel)): `eval-novel/gen.mjs` generates (`--arm P` plain or `--arm E`), `score_auto.py` checks validity, drives each app in a headless browser (add a row, see it) and takes screenshots, `make_judge.py` builds blind judge batches against must-have lists, `aggregate.py` writes `results/summary.json`. The judge prompt is in `eval-novel/judge/PROMPT.md`.

Numbers to beat (Q4_K_M, arm E):

| | r2 |
|---|---|
| heldout2 checker pass | 90.6% |
| heldout2 creates pass | 87% |
| 140 new ideas: valid | 81.4% |
| 140 new ideas: works when used | 77.9% |
| 140 new ideas: must-haves met | 41.5% |
| median seconds per app, laptop CPU | 3.7 |

A new model ships when it beats the current one on these with the same decoder and the same test sets.

## 6. Publish

`publish_hf.py` writes a model card for the round folder, checks that the file loads, and uploads it; `update_models_json.py` adds the files to `models.json`, which the app reads to offer models. To use your own model in the app without publishing, push it to the phone:

```bash
adb push my-r3-Q4_K_M.gguf /sdcard/Android/data/com.oyekamal.molde/files/models/model.gguf
```

## Ideas that would help most

1. More and richer **small-change** pairs on long programs (the weakest area).
2. Data whose targets look like the hand-written demo apps (custom layouts, drawings, app bars), not only plain forms and lists.
3. A real measurement on a low-end phone (seconds per app, memory).
4. Other base models in the 100M to 500M range, scored with the same tables.
