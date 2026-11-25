app "Saved by month" coin mint
table saving amount money
setting best money = 20000 "Great month"
grid 4 gap 1
  each days year
    if monthday(it) = 1
      stack radius 8 pad 1 gap 0 align center fill if(sum(saving.amount month of it) > 0, accent, soft) opacity if(sum(saving.amount month of it) > 0, clamp(sum(saving.amount month of it) / best, 0.25, 1), 1)
        dayname(it) tiny
        monthname(it) tiny
        sum(saving.amount month of it) bold small
quick saving, amount, [500, 1000, 5000]
form saving
