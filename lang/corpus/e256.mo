app "Think first" shield slate
table want what text, price money, status pick Waiting|Bought|Skipped = Waiting
"Money saved by not buying" sum(want.price where status = Skipped) big color good
"Wait 24 hours before you decide." faint
each want where status = Waiting sort at as w
  stack card gap 1
    w.what w.price bold
    if(now - w.at >= 24h, "24 hours passed: still want it?", "Wait a little longer") faint
    row gap 1
      button "Still want it" tap set w.status = Bought
      button "Skip it" fill good tap set w.status = Skipped
form want, "I want to buy"
