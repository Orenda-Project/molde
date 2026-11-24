app "Bike service" bike slate
table service day date = today, odo num 0.. unit "km" "Odometer", cost money, work long? "What was done"
stat sum(service.cost), "spent on service"
"Last service at" last(service.odo) "km" faint
form service, "Add service"
list service
