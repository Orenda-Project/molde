app "Gold price" coin plum
state tola num = 1
state karat pick K18|K21|K22|K24 = K22
state rate money = 0
state making money = 0
let purity = if(karat = K18, 18, if(karat = K21, 21, if(karat = K22, 22, 24))) / 24
field tola "Weight (tola)"
"Karat" faint
choice karat
field rate "Today's 24k rate per tola"
field making "Making charges per tola"
stat tola * rate * purity + tola * making, "total price"
"Gold value" tola * rate * purity faint
"Making" tola * making faint
"Purity" fixed(purity * 100, 1) "percent" faint
