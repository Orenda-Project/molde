#!/usr/bin/env bash
# Convert a fine-tuned HF model dir to GGUF f16 + Q8_0 + Q4_K_M with llama.cpp's own converter, write SHA256SUMS.
#   export_gguf.sh MODEL_DIR NAME OUT_DIR
# Env: LLAMA_TAG (default b12144, the build used on the laptop and in offline-teacher-coach)
#      LLAMA_SRC  llama.cpp source checkout (default /content/llama.cpp, cloned at LLAMA_TAG if missing)
#      LLAMA_BIN  folder with llama-quantize (default /content/llama-$LLAMA_TAG, downloaded if missing)
#      QUANTS     default "Q8_0 Q4_K_M"
set -euo pipefail
MODEL_DIR=${1:?model dir}; NAME=${2:?name}; OUT=${3:?out dir}
TAG=${LLAMA_TAG:-b12144}; SRC=${LLAMA_SRC:-/content/llama.cpp}; BIN=${LLAMA_BIN:-/content/llama-$TAG}
QUANTS=${QUANTS:-"Q8_0 Q4_K_M"}
mkdir -p "$OUT"
if [ ! -d "$SRC" ]; then git clone -q --depth 1 --branch "$TAG" https://github.com/ggml-org/llama.cpp "$SRC"; fi
if [ ! -d "$BIN" ]; then
  mkdir -p "$BIN"; wget -q "https://github.com/ggml-org/llama.cpp/releases/download/$TAG/llama-$TAG-bin-ubuntu-x64.tar.gz" -O /tmp/lc.tgz
  tar xzf /tmp/lc.tgz -C "$BIN"
fi
Q=$(find "$BIN" -name llama-quantize -type f | head -1)
export PYTHONPATH="$SRC/gguf-py:${PYTHONPATH:-}"
python3 -c "import numpy, sentencepiece" 2>/dev/null || pip install -q numpy sentencepiece gguf || pip install -q --break-system-packages numpy sentencepiece
python3 "$SRC/convert_hf_to_gguf.py" "$MODEL_DIR" --outtype f16 --outfile "$OUT/$NAME-f16.gguf"
for q in $QUANTS; do LD_LIBRARY_PATH="$(dirname "$Q")" "$Q" "$OUT/$NAME-f16.gguf" "$OUT/$NAME-$q.gguf" "$q"; done
HERE=$(cd "$(dirname "$0")" && pwd)
for q in $QUANTS; do LLAMA_SRC="$SRC" python3 "$HERE/tokens/fix_gguf_control.py" "$OUT/$NAME-$q.gguf"; done
( cd "$OUT" && sha256sum "$NAME"-*.gguf > SHA256SUMS && cat SHA256SUMS && ls -la )
echo EXPORT_OK
