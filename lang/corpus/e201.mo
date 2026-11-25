app "Shops" pin ocean
table shop name text, address text, phone text?
each shop as s
  row card gap 2 tap edit s swipe remove s
    icon pin
    stack grow
      s.name bold
      s.address faint
form shop, "Add shop"
"Maps and directions need the internet, which this app cannot use." faint
