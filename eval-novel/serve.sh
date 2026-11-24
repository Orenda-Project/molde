#!/bin/bash
# usage: serve.sh r1|r2 Q4_K_M|Q8_0  -> llama-server on :8241 (one slot, 6 threads); PID in /tmp/molde-eval-llama.pid
LLAMA=$HOME/llama.cpp-b12144/llama-b12144
export LD_LIBRARY_PATH=$LLAMA
M=/home/oye/Documents/free_work/molde-model/$1/gemma270m/$1-gemma270m-$2.gguf
$LLAMA/llama-server -m $M --port ${PORT:-8241} -c 4096 -np 1 -t ${THREADS:-6} --no-warmup -ngl 0 --host 127.0.0.1 >> /tmp/molde-eval-llama.log 2>&1 &
echo $! > /tmp/molde-eval-llama.pid
for i in $(seq 60); do curl -s localhost:${PORT:-8241}/health | grep -q ok && break; sleep 1; done
echo "server pid $(cat /tmp/molde-eval-llama.pid) model $1 $2"
