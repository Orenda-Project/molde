app "Car Service" car slate
table service day date, km num 0.., done text, cost money, garage text, next_km num 0..
setting now_km num = 0 "Current km"
let due = last(service.next_km)
if(now_km >= due and due > 0, "Service is due", "Next service at") due "km" head color if(now_km >= due and due > 0, warn, ink)
"Total spent" sum(service.cost all) faint
form service, "Add service"
each service sort day desc
  row card tap edit it swipe remove it
    stack grow
      it.day it.km "km" bold
      it.done "at" it.garage faint
    it.cost bold
