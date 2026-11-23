app "Pharmacy stock" pill ocean
table med name text, batch text?, qty num 0.., expiry date, alert date
setting alert_days num = 30 "Alert days before expiry"
state n text = ""
state q num = 0
state ex date = today
field n "Medicine"
field q "Quantity"
field ex "Expiry date"
button "Add" tap add med name = n, qty = q, expiry = ex, alert = ex - alert_days then set n = ""
remind "A medicine expires soon" at med.alert
let soon = countof(med, it.expiry - today <= alert_days)
text soon "items expire within" alert_days "days" head color if(soon > 0, warn, good)
each med where expiry - today <= alert_days sort expiry as m
  row card tap edit m
    m.name bold grow
    m.qty "left"
    if(m.expiry < today, "Expired", "Expires soon") color if(m.expiry < today, bad, warn)
    m.expiry - today "days" faint
list med
