#!/bin/bash
# usage: serve.sh Q8_0|Q4_K_M   -> llama-server on :8201, one slot, 6 threads
LLAMA=$HOME/llama.cpp-b12144/llama-b12144
export LD_LIBRARY_PATH=$LLAMA
M=/home/oye/Documents/free_work/molde-model/r1/gemma270m/r1-gemma270m-$1.gguf
exec $LLAMA/llama-server -m $M --port 8201 -c 4096 -np 1 -t ${THREADS:-6} --no-warmup -ngl 0 --host 127.0.0.1
