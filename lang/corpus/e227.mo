app "Sugar" drop plum
table reading value num 20..600 unit "mg/dL", moment pick Morning|Evening, note text?
row gap 2
  stat round(avg(reading.value last 30 days where moment = Morning)), "morning average"
  stat round(avg(reading.value last 30 days where moment = Evening)), "evening average"
trend reading last 30 days sort at, it.value
form reading
list reading by day
