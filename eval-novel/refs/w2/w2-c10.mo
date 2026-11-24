app "Grocery by shop" cart mint
table item name text, shop pick Imtiaz|Sabzi_mandi|Dairy|Pharmacy, price money?, bought bool
stat count(item where bought = no), "items left"
form item, "Add item"
each options item.shop as sh
  if count(item where shop = sh) > 0
    row gap 1
      sh head grow
      sum(item.price where shop = sh) "total bill"
    each item where shop = sh as i
      row card swipe remove i
        toggle i.bought
        i.name grow
        i.price
