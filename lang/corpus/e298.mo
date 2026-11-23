app "Cycling" bike mint
table ride km num 0.., time dur, cal num?
sum(ride.km month) "km this month" big
sum(ride.time month) "riding time," sum(ride.cal month) "calories" faint
bars ride last 12 weeks by week, sum(it.km), it.key
form ride
log ride
