#!/bin/bash
# plan v2 with retry: a run whose server died leaves error rows; they are dropped and the run is redone (max 4 tries)
cd /tmp/molde-eval/eval-novel
while kill -0 1967306 2>/dev/null; do sleep 10; done
run() {
  for t in 1 2 3 4; do
    ./stop.sh; ./serve.sh $1 $2; node gen.mjs --model $1 --quant $2 --arm $3 $4 $5 >> runs/$1_$2_$3.log 2>&1
    n=$(python3 clean_errors.py runs/$1_$2_$3.jsonl); echo "$1 $2 $3 try $t dropped $n"
    [ "$n" = "0" ] && break
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
