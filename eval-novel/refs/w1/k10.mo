app "Meeting time" clock ocean
state city pick Islamabad|London|New_York = Islamabad
state t time = 9:00
state bst bool = no
state edt bool = no
let off_src = if(city = Islamabad, 5, if(city = London, if(bst, 1, 0), if(edt, -4, -5)))
let utc = hour(t) - off_src
let shift_ldn = utc + if(bst, 1, 0)
let shift_ny = utc + if(edt, -4, -5)
let shift_isb = utc + 5
let m = if(minute(t) < 10, join("0", minute(t)), join(minute(t)))
"Time is in" faint
choice city
field t "Time"
toggle bst
"London on summer time" faint
toggle edt
"New York on summer time" faint
def zone name text, h num
  row card
    text name bold grow
    text join(h % 24, ":", m) big
    text if(floor(h / 24) > 0, "next day", if(floor(h / 24) < 0, "previous day", "")) faint
zone "Islamabad", shift_isb
zone "London", shift_ldn
zone "New York", shift_ny
