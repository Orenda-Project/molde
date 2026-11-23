app "Rider Log" bike slate
table ride day date, start num 0.., stop num 0.., earn money, fuel money = 0
each ride sort day desc
  row card tap edit it swipe remove it
    stack grow
      it.day bold
      it.stop - it.start "km" faint
    "Net" it.earn - it.fuel bold color if(it.earn - it.fuel >= 0, good, bad)
form ride, "Add day"
"Net this month" sumof(ride month, it.earn - it.fuel) head
