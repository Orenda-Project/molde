#!/bin/bash
# usage: llama_server.sh MODEL.gguf [PORT]   one slot, 4 threads (a phone-like setting), ctx 4096, port 8341 by default
LLAMA=${LLAMA:-$HOME/llama.cpp-b12144/llama-b12144}
export LD_LIBRARY_PATH=$LLAMA
exec $LLAMA/llama-server -m "$1" --port ${2:-8341} -c 4096 -np 1 -t ${THREADS:-4} --no-warmup -ngl 0 --host 127.0.0.1
