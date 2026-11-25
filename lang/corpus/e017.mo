app "Salon" tag plum
table booking customer text, service text, day date, price money, deposit money = 0
stat sum(booking.price month), "income this month"
"Deposits" sum(booking.deposit month) "| Balance due" sum(booking.price month) - sum(booking.deposit month) faint
form booking, "Add booking"
each booking sort day desc
  row card tap edit it swipe remove it
    stack grow
      it.customer it.service bold
      it.day faint
    it.price bold
