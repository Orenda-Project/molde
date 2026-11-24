#!/bin/bash
# runs every model x quant x arm in turn, one llama-server at a time (this harness's own, PID file)
cd /tmp/molde-eval/eval-novel
while kill -0 1684125 2>/dev/null; do sleep 10; done
run() { ./stop.sh; ./serve.sh $1 $2; node gen.mjs --model $1 --quant $2 --arm $3 >> runs/$1_$2_$3.log 2>&1; }
for cfg in "r1 Q4_K_M E" "r2 Q4_K_M E" "r1 Q4_K_M P" "r2 Q4_K_M P" "r1 Q8_0 E" "r2 Q8_0 E" "r1 Q8_0 P" "r2 Q8_0 P"; do
  set -- $cfg; while [ ! -f refs/refs.json ] && [ "$1 $2 $3" != "r1 Q4_K_M E" ]; do sleep 30; done
  run $1 $2 $3
done
# catch-up: change requests skipped while references were missing
for cfg in "r1 Q4_K_M E" "r2 Q4_K_M E" "r1 Q4_K_M P" "r2 Q4_K_M P" "r1 Q8_0 E" "r2 Q8_0 E" "r1 Q8_0 P" "r2 Q8_0 P"; do set -- $cfg; run $1 $2 $3; done
./stop.sh
echo CHAIN DONE > runs/CHAIN_DONE
