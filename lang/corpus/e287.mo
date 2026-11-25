app "Car service" car slate
table service done_on date = today, odometer num 0.., cost money, garage text
setting every_km num = 5000 "Service every (km)"
setting every_months num = 6 "Service every (months)"
setting odo num = 0 "Current odometer (km)"
let due_km = last(service.odometer) + every_km
let due_date = addmonths(last(service.done_on), every_months)
"Next service at" due_km "km or" due_date head
if(odo >= due_km - 500, "Service is due very soon. Km left:", "Km to next service:") due_km - odo big color if(odo >= due_km - 500, warn, good)
when odo >= due_km - 500 notify "Service due within 500 km"
button "Update odometer" tap edit odo
form service, "Log service"
list service by day
