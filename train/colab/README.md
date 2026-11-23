# Colab runner for Molde training

One GPU runtime, a folder of job files, a runner that executes them in order and releases the runtime when done.
Everything here is copied from lessons paid for in offline-teacher-coach (see `colab_runner.py` header).

## Rules the runner enforces (do not weaken)

- **Tiny cells only.** The setup cell is under 2 KB. Code, `lang/` and the dataset go through Drive (`colab_drive_upload`, then a `drivefetch` job). A 12 MB cell once killed a runtime and burned 4.6 units.
- **Abort the chain** on any failed setup/fetch/smoke/train/eval/export/pack job (writes `STOP`, runtime released in `finally`). `sys.exit` is not used in cells; they `assert`.
- **Smoke job before training** (files present, CUDA, Node 20 + checker, tokenizer downloads).
- **One runner at a time** (`RUNNER.pid` lock). `STOP` file releases the runtime. Idle 40 min = release.
- **GPU assignment capped at 20 tries (one per 3 min = one hour)**; then `QUOTA` is written and it exits. HTTP 412 = an old session holds the slot: the runner releases its own stale assignments once and retries; 503/429 = no quota/capacity now.
- **Drive saves** are separate jobs, files below 1 GB (`pack.py` splits into 900 MB parts with a SHA256SUMS file and a whole-file hash). Background jobs cannot use `drive_save`.
- **Detached training + heartbeat** (a line every 45 s) so the connector never sits on a silent cell; training pauses itself after `max_minutes` with a checkpoint and `PAUSED` marker.
- **Nothing runs on Colab without cost awareness**: each session prints wall time; units are about `hours x rate` (T4 about 1.2 to 1.8 units/h, L4 about 1.6 to 2.5, A100 about 5 to 8 on Pro; the balance is not readable through the connector, read it in Colab > Manage sessions).

## Start a real run (exact commands, from the repo root)

```bash
# 0. build the dataset (re-run after any change of sources/ or the language; add --migrate if the syntax changed)
python3 train/data/build_dataset.py --lang lang
# 1. pack code + lang + data and put them on Drive (MCP tool colab_drive_upload, folder molde-train/inputs-<runname>)
bash train/colab/make_inputs.sh /tmp/molde_inputs.tgz
#    -> colab_drive_upload(local_path=/tmp/molde_inputs.tgz, drive_folder="molde-train/inputs-<runname>")   (use a NEW folder per upload; Drive keeps duplicates and the fetch may pick the old one)
# 2. write the jobs for a base model (config in train/configs/)
python3 train/colab/make_jobs.py /tmp/jobs-<runname> --name <runname> --config configs/gemma270m.yaml \
    --inputs molde-train/inputs-<runname>/molde_inputs.tgz [--set epochs=5 lr=5e-5 add_molde_tokens=true]
# 3. run one session (T4; use L4 for 0.8B), stops itself after the Drive save
python3 train/colab/run_session.py /tmp/jobs-<runname> T4
# 4. fetch results (MCP colab_drive_download): molde-train/runs/<runname>/gguf/<runname>-Q8_0.gguf, SHA256SUMS, final.tar.part00, eval.tar.part00, log.jsonl
# 5. local load test, scores on the quantised file, upload to the private HF repo
python3 train/local_load_test.py <file>.gguf --full --metrics q8.metrics.json
python3 train/publish_hf.py --round <runname> --gguf <q8>.gguf <q4>.gguf --base-model <id> --licence <licence> \
    --dataset-card train/data/out/dataset_card.json --train-log <runs>/log.jsonl --metrics q8.metrics.json
```

Drive layout (new folder `molde-train/` in the owner's Drive):

```
molde-train/
  inputs-<name>/molde_inputs.tgz          code + lang + dataset (small)
  data/<set>.tgz                          big datasets (20k, 300k), fetched with --extra-fetch
  runs/<name>/log.jsonl, train.stdout.log, eval.tar.part00, final.tar.part00 (+ .SHA256SUMS), ckpt.tar.partNN (resume)
  runs/<name>/gguf/<name>-f16.gguf, -Q8_0.gguf, -Q4_K_M.gguf, SHA256SUMS
```

## Resume after a pause or a dropped runtime

`train.py` writes `ckpt/` (model fp32 + AdamW state + step) every `save_every` steps and on `max_minutes`. Free runtimes live 55 to 90 minutes, so for long runs: set `--set max_minutes=40`, make the jobs with `--ckpt-parts N` (N = ceil(ckpt size / 0.9 GB); about 12 bytes per parameter: 270M = 3.3 GB = 4 parts, 0.8B = 10 GB = 12 parts) and `--stages train` (skip eval/export), run the session, then for the next session add `--resume-parts N`. Repeat until `SFT_DONE` is in the log, then a last session with `--resume-parts N --stages eval,export`. (In this task the resume path was tested locally: pause at step 1, resume to the end.)

## Expected time and units (T4 unless stated; measured numbers are in the PR description)

| base | params | precision | fits | note |
|---|---|---|---|---|
| Gemma 3 270M | 268M | fp32 (T4) | T4 | smoke run measured |
| SmolLM2-135M / 360M | 135M / 362M | fp32 | T4 | about 0.5x / 1.3x the Gemma time |
| Qwen3.5-0.8B | 873M | fp16 autocast or bf16 on L4/A100, grad checkpointing | L4 (T4 tight: fp32 weights + Adam = 14 GB) | 3x to 4x the Gemma time |

Rule of thumb: tokens per example about 400 to 700 (prompt + program). Training FLOPs about 6 x params x tokens; a T4 sustains roughly 20 to 30 percent of its 8 TFLOPs in fp32.

## What changes for the 20k and 300k datasets

- Put generated sets in `train/data/sources/*.jsonl` (schema in `build_dataset.py`), or build them elsewhere and ship a pre-built `data/out` as `molde-train/data/<set>.tgz` (`--extra-fetch molde-train/data/<set>.tgz=/content/<set>.tgz`, and untar into `/content/molde/train/data/out` in an extra job). Never put big data in the inputs tarball or in a cell.
- 20k pairs (about 12M tokens per epoch): 1 to 2 epochs; set `epochs=2 eval_every=200 save_every=200 batch_size=16`, use the chunked resume loop above, and expect about 1 h per epoch for 270M on a T4 (estimate, confirm from the smoke numbers). Use `add_molde_tokens=true` only after checking that GGUF conversion keeps the added tokens (see the PR notes).
- 300k pairs: 0.8B on an L4/A100; pack checkpoints in parts; evaluate on a fixed 500-request subset every few thousand steps instead of the full test; consider sequence packing (not implemented: batches are length-bucketed).
- Held-out test stays the 40 corpus ids (+4 edits) chosen by hash; `build_dataset.py` also drops any source row whose request text equals a test request. For 300k, add a near-duplicate filter against the test requests (n-gram Jaccard) before training.
