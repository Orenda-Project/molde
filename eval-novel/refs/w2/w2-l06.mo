app "Grocery by shop" cart mint
table item name text, shop pick Imtiaz|Sabzi_mandi|Dairy|Pharmacy, bought bool
stat count(item where bought = no), "items left"
form item, "Add item"
each options item.shop as sh
  if count(item where shop = sh) > 0
    sh head
    each item where shop = sh as i
      row card swipe remove i
        toggle i.bought
        i.name grow
