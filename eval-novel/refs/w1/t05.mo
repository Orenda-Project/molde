app "Dad insulin" pill ocean
table dose day when = now, units num 0.5..100 unit "units", kind pick Fast|Long, sugar num 20..600 unit "mg/dl" "Blood sugar before"
state d new dose
stat sum(dose.units today), "units today"
stack card gap 2
  field d
  button "Save dose" large tap save d
each dose top 10 empty "No doses yet"
  row card tap edit it
    stack grow gap 0
      it.day large bold
      it.kind large
    it.units huge bold
    "sugar" it.sugar faint
