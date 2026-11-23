app "Event Vendors" users slate
table vendor name text, phone text?, total money, deposit money = 0, status pick Booked|Confirmed|Done = Booked
"Deposits paid" sum(vendor.deposit all) "| Balance due" sum(vendor.total all) - sum(vendor.deposit all) head
each vendor sort name
  row card tap edit it
    stack grow
      it.name bold
      "Deposit" it.deposit "Balance" it.total - it.deposit faint
    it.status bold
form vendor, "Add vendor"
