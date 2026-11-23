app "Mehndi plan" gift plum
table guest name text, count num 1.. = 1
table menu item text, cost money
table vendor name text, kind pick Catering|Decor|Other = Decor, cost money
let total = sum(menu.cost) + sum(vendor.cost)
let heads = sum(guest.count)
"Total cost" total big
"Per guest" round(total / heads) head
text heads "guests," count(guest) "invites" faint
screen guests "Guests" users
  list guest
  form guest, "Add guest"
screen food "Menu" food
  list menu
  form menu, "Add menu item and catering cost"
screen vendors "Vendors" tag
  list vendor
  form vendor, "Add vendor"
