#!/usr/bin/env bash
# Pack the code + lang + dataset for Colab (small: a few MB). Upload the result with colab_drive_upload to molde-train/inputs/.
#   colab/make_inputs.sh OUT.tgz           (run from the repo root)
set -euo pipefail
OUT=${1:?out.tgz}
tar czf "$OUT" --exclude='train/runs' --exclude='__pycache__' --exclude='lang/node_modules' --exclude='train/data/sources/*.big.jsonl' train lang
ls -la "$OUT"
