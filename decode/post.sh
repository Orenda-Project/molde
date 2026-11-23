#!/bin/bash
cd "$(dirname "$0")"
while ! grep -q DONE results/matrix_Q4_K_M.log 2>/dev/null; do sleep 10; done
for set in real templ; do node run.mjs --arm E --set $set --quant Q4_K_M --out results 2>&1 | tail -1 >> results/post.log; done
for p in $(pgrep -x llama-server); do kill $p; done; sleep 3
setsid nohup ./serve.sh Q8_0 > /tmp/molde-dec-server.log 2>&1 < /dev/null &
sleep 8
for set in real templ; do node run.mjs --arm E --set $set --quant Q8_0 --out results 2>&1 | tail -1 >> results/post.log; done
for arm in D C B; do PROMPT=text node run.mjs --arm $arm --set real --quant Q8_0 --tag ${arm}text_Q8_0_real --out results 2>&1 | tail -1 >> results/post.log; done
echo DONE >> results/post.log
