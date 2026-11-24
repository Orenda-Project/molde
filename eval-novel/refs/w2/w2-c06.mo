app "Mom's medicines" pill ocean
table medicine name text, dose text, slot pick Morning|Afternoon|Night, stock num 0..
table taken medicine ref medicine
stat count(medicine where stock < 2), "running low"
remind "Take your medicines" at 7:00
form medicine, "Add medicine"
each options medicine.slot as sl
  if count(medicine where slot = sl) > 0
    sl head
    each medicine where slot = sl as m
      row card swipe remove m fill if(m.stock < 2, warn, surface)
        toggle m.taken
        stack gap 0 grow
          m.name bold
          m.dose faint
        button "-" tap set m.stock = m.stock - 1
        m.stock "strips"
