#!/bin/bash
# plan v2; gen exits 3 after recording a server crash for one item: restart the server and continue (max 15 restarts per run)
cd /tmp/molde-eval/eval-novel
run() {
  for t in $(seq 15); do
    ./stop.sh; ./serve.sh $1 $2; echo "=== $1 $2 $3 start $(date +%T)" >> /tmp/molde-eval-llama.log
    node gen.mjs --model $1 --quant $2 --arm $3 $4 $5 >> runs/$1_$2_$3.log 2>&1; rc=$?
    n=$(python3 clean_errors.py runs/$1_$2_$3.jsonl); echo "$1 $2 $3 try $t rc $rc dropped $n $(date +%T)"
    [ "$rc" = "0" ] && [ "$n" = "0" ] && break
  done
}
run r1 Q4_K_M P
run r2 Q4_K_M E
run r2 Q4_K_M P
run r1 Q8_0 E --subset subset40.json
run r2 Q8_0 E --subset subset40.json
run r1 Q8_0 P --subset subset40.json
run r2 Q8_0 P --subset subset40.json
./stop.sh
echo CHAIN DONE > runs/CHAIN_DONE
