app "Home" home mint
table shop item text, got bool
table chore what text, who pick Mum|Dad|Ali|Sara = Mum, day pick Mon|Tue|Wed|Thu|Fri|Sat|Sun = Mon, done bool
table bill name text, amount money, due date, paid bool
screen shopping "Shopping" cart
  each shop as s
    row card swipe remove s
      toggle s.got
      s.item grow
  form shop, "Add item"
screen chores "Chores" check
  each options chore.day as d
    text d bold
    each chore where day = d as c
      row card
        toggle c.done
        c.what grow
        c.who faint
  form chore, "Add chore"
screen bills "Bills" wallet
  each bill where paid = no sort due as b
    row card tap edit b
      b.name bold grow
      b.due color if(b.due < today, bad, ink)
      b.amount
      toggle b.paid
  form bill, "Add bill"
