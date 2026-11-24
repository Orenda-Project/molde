app "Screen time" phone ocean
table use kid pick Kid_1|Kid_2, spent dur
state cur pick Nobody|Kid_1|Kid_2 = Nobody
state st when = now
setting allowance dur = 90m "Daily allowance"
let left(sp dur, on bool) = max(allowance - sp - if(on, now - st, 0s), 0s) / 1m
def kidrow name text, mins num, on bool, go act, stop act
  stack card gap 1
    row gap 2 align center
      text name bold grow
      text mins big
      text "min left" faint
    if on
      button "Stop" tap stop
    else
      button "Start" tap go
kidrow "Kid 1", left(sum(use.spent today where kid = Kid_1), cur = Kid_1), cur = Kid_1, set st = now then set cur = Kid_1, add use kid = Kid_1, spent = now - st then set cur = Nobody
kidrow "Kid 2", left(sum(use.spent today where kid = Kid_2), cur = Kid_2), cur = Kid_2, set st = now then set cur = Kid_2, add use kid = Kid_2, spent = now - st then set cur = Nobody
