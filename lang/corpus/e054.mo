app "Fridge" food mint
table item name text, expires date
remind "Item expires today" at item.expires
"Expiring this week" head
each item where expires - today <= 7 sort expires
  row card
    it.name grow
    it.expires bold color if(it.expires < today, bad, warn)
form item, "Add item"
list item
