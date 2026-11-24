#!/bin/bash
# plan v2: Q4_K_M both arms on all 140 items (r1, r2); Q8_0 both arms on subset40.json (r1, r2). One server at a time (own PID file).
cd /tmp/molde-eval/eval-novel
while kill -0 1887611 2>/dev/null; do sleep 10; done
run() { ./stop.sh; ./serve.sh $1 $2; node gen.mjs --model $1 --quant $2 --arm $3 $4 $5 >> runs/$1_$2_$3.log 2>&1; }
run r2 Q4_K_M E
run r1 Q4_K_M P
run r2 Q4_K_M P
run r1 Q8_0 E --subset subset40.json
run r2 Q8_0 E --subset subset40.json
run r1 Q8_0 P --subset subset40.json
run r2 Q8_0 P --subset subset40.json
./stop.sh
echo CHAIN DONE > runs/CHAIN_DONE
