import json
Y,P,N="yes","partly","no"
def u(uid,checks,looks,worst):
    return {"uid":uid,"checks":[{"n":i+1,"v":v,"why":w} for i,(v,w) in enumerate(checks)],"looks":looks,"worst":worst}
R=[
u("eb6673fd",[(Y,"held=25m, Start sets ends=now+held"),(Y,"Work to Break sets ends=now+5m"),(Y,"round>=4 goes to Long 15m, then resets round"),(Y,"'Round n of 4' head text"),(Y,"Start/Pause toggle plus Reset")],4,"Large empty space below, plain"),
u("e03207bb",[(Y,"price money? field on item table"),(P,"only per-shop totals via sum(item.price where shop=sh); no overall total"),(Y,"form item, shop pick, bought toggle all present"),(Y,"per-shop 'total bill' row")],4,"Form dominates top before the bills"),
u("efa88afd",[(Y,"grid 6 with each 1..5 x each 1..6 gives 30 boxes"),(Y,"tap selects seat, then name field + Seat here adds name"),(Y,"fill accent when occupied vs soft when empty, selected seat outlined"),(Y,"stat counts filled seats among 1..30")],4,"Empty seats all show a dash; no name shown until filled"),
u("f38acc1b",[(Y,"amount, rate, months fields"),(N,"formula amount*pow(1+r/1200,n)/12 is not an EMI; screen shows 45 for 500 at 10% 10 months"),(N,"interest formula is wrong (simple-interest guess), not total interest"),(N,"no total repayment shown"),(N,"no total repayment shown")],2,"Wrong numbers shown as results"),
u("a4f2dcca",[(P,"km field present; date is only auto-added day grouping plus optional 'next' date, no service date input"),(Y,"cost money field"),(Y,"list service by day"),(Y,"Total spent sum of cost"),(Y,"'what' text field holds what was done")],4,"No explicit service date field"),
u("38cd18ca",[(Y,"field q filters entries with has(customer,q)"),(Y,"list entry and who-owes groups retained"),(Y,"form entry and pending stat retained")],4,"Search box sits below the form, list empty in shot"),
u("e6b9126c",[(P,"name and price present; no child pick Hamza/Zara"),(N,"no bought tick"),(P,"only qty*price 'Still to buy'; no total of all items"),(P,"'Still to buy' sums everything, not tied to bought"),(N,"no per-child subtotal")],3,"Missing child and bought; odd Low field and '5 Rs 250' row"),
u("3ca41b9a",[(Y,"domain, issuer, expiry, owner form"),(Y,"expiry - today days left"),(Y,"count stat and warn fill under 30"),(Y,"each cert sort expiry")],3,"Faint grey subtext on orange card hard to read"),
u("a7f60426",[(N,"work setting never used, no timer or alert"),(N,"no 20s countdown"),(N,"no start button; Done buttons appear only after a count exists"),(P,"counts brk today but no way to add the first one")],2,"Almost empty screen, no timer or start"),
u("903a8b5a",[(P,"length and width only, no tile size; labelled m not ft"),(N,"t is always 100 regardless of input"),(N,"no real 10% wastage applied"),(P,"result shown but meaningless"),(N,"no boxes")],2,"Result is nonsense, no tile size input"),
u("404f37ee",[(Y,"form with tenant, flat, rent"),(Y,"paid toggle"),(Y,"expected and collected stats plus progress goal"),(Y,"elec money field, added to totals"),(Y,"'Not paid yet' list")],4,"Long form pushes the tenant list below the fold"),
u("4dae48d4",[(Y,"version, on date, new/fixed/changed long text"),(Y,"published toggle"),(Y,"sort on desc"),(Y,"drafts stat count published=no")],4,"Tall form before the list"),
u("405bbd7f",[(Y,"plant form with name and every N days"),(Y,"Watered button adds watered record"),(N,"no due calculation; top count is watered today"),(N,"last watered date never used against every"),(N,"'plants due today' actually counts watered today")],3,"Wrong 'plants due today' number"),
u("71d21ebf",[(Y,"drawing tap sets n=n+1"),(Y,"buttons 33/99/100 with highlight"),(Y,"notify plus 'Target of X reached' text"),(Y,"Reset button"),(Y,"zikr entries give 'Total count ever'")],4,"Tap area is an unlabeled ring"),
u("3b019618",[(N,"taps only exist after count>=1; nothing to tap at start"),(P,"setting 'Count to' number, not 33/99/100 choice"),(N,"icon given text 'Target reached', not a message"),(Y,"Reset today removes taps"),(N,"no total across sessions")],1,"Empty screen, no counter or tap target"),
u("3143a281",[(N,"no time input; app is about something else"),(N,"no city times"),(N,"no offsets"),(N,"no day change")],1,"App is unrelated to the request"),
u("2d31f8a3",[(P,"generic add-verse entries with done, not 30 preset paras"),(N,"finish date never shown"),(N,"no paras-left figure"),(P,"only a total entry count"),(N,"no days left to Eid")],2,"Garbled labels 'Sipsar complete' and 'verse'"),
u("031a2cd6",[(N,"no PR name field, generic item/name"),(N,"no five criteria ticks"),(N,"counts level=Normal as 'tests passed'"),(N,"list is generic entries with 'New Secret' button")],2,"Meaningless labels and buttons"),
u("1771eac0",[(Y,"pick includes Critical"),(Y,"form, stats and grouped list retained"),(Y,"toggle b.fixed retained"),(N,"Critical is last in order, not first")],4,"Severity groups not ordered by severity"),
u("643635bc",[(Y,"bill, GST, service, people fields"),(Y,"total with tax and service stat"),(Y,"per person stat"),(Y,"round() on both")],4,"Plain, no currency hint on inputs"),
]
json.dump(R,open('/tmp/molde-eval/eval-novel/judge/results/r011.json','w'),indent=1)
