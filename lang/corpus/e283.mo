app "Blood sugar" drop plum
table reading value num 20..600 unit "mg/dL", note text?
last(reading.value) "mg/dL, last reading" big
"Average, last 7 days" round(avg(reading.value last 7 days)) faint
trend reading last 30 days sort at, it.value
form reading
log reading
