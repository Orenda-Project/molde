app "Mehndi bookings" pen plum
table booking bride text, event date, people num 1..50 "Hands / people", price money, advance money = 0, travel bool "Travel needed"
"Upcoming this month:" count(booking where event >= today and event <= today + 30) faint
form booking, "Add booking"
each booking where event >= today sort it.event empty "No upcoming bookings"
  row card tap edit it
    stack grow gap 0
      it.bride bold
      it.event "for" it.people faint
      if it.travel
        "Travel needed" faint color warn
    stack gap 0 align end
      it.price bold
      "balance" it.price - it.advance faint
list booking
