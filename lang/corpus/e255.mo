app "Receipt" list ink
table item what text, price money
stack card width 260 gap 1
  "Today" head align center
  divider
  each item today as i
    row
      i.what grow
      i.price
  divider
  row
    "Total" bold grow
    sum(item.price today) bold
form item
