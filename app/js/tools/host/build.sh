#!/bin/bash
# Builds the host test server against llama.cpp b12144 (prebuilt libs + headers from a source tree of the same tag).
LLAMA=${LLAMA:-$HOME/llama.cpp-b12144/llama-b12144}
SRC=${LLAMA_CPP_DIR:-$HOME/Documents/free_work/molde-model/train-setup/llama-src}
OUT=${OUT:-/tmp/molde-app-scratch/core_server}
g++ -O2 -std=c++17 -I"$SRC/include" -I"$SRC/ggml/include" "$(dirname "$0")/core_server.cpp" -o "$OUT" -L"$LLAMA" -lllama -lggml -lggml-base -Wl,-rpath,"$LLAMA" && echo "built $OUT"
