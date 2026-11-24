app "Car documents" car slate
table doc kind pick Registration|Insurance|Token_tax|Fitness, expiry date
stat count(doc where expiry - today < 30), "expiring in under 30 days"
form doc, "Add document"
each doc sort expiry as d empty "No documents yet"
  row card tap edit d swipe remove d fill if(d.expiry - today < 30, warn, surface)
    d.kind bold grow
    d.expiry - today "days left"
remind "A car document expires soon" at doc.expiry - 30d at 9:00
