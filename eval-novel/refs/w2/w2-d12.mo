app "SSL certs" lock ink
table cert domain text, issuer text, expiry date, owner text
stat count(cert where expiry - today < 30), "expiring in under 30 days"
form cert, "Add cert"
each cert sort expiry as c empty "No certs yet"
  row card tap edit c swipe remove c fill if(c.expiry - today < 30, warn, surface)
    stack gap 0 grow
      c.domain bold
      c.issuer "·" c.owner faint
    c.expiry - today "days left"
