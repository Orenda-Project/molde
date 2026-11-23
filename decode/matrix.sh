#!/bin/bash
# usage: matrix.sh QUANT   (server for that quant must already be up on :8201)
Q=$1; cd "$(dirname "$0")"
for set in real templ; do for arm in A Atok B C D; do
  [ -f results/${arm}_${Q}_${set}.summary.json ] && continue
  node run.mjs --arm $arm --set $set --quant $Q --out results 2>&1 | tail -1 >> results/matrix_$Q.log
done; done
echo DONE >> results/matrix_$Q.log
