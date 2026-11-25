app "Income split" chart mint
setting income money = 100000 "Monthly income"
setting rent money = 30000
setting food money = 25000
setting transport money = 10000
let savings = income - rent - food - transport
"Savings" savings big color if(savings < 0, bad, good)
draw 100, 14
  rect 0, 0, 100 * rent / income, 14 fill accent
  rect 100 * rent / income, 0, 100 * food / income, 14 fill good
  rect 100 * (rent + food) / income, 0, 100 * transport / income, 14 fill warn
  rect 100 * (rent + food + transport) / income, 0, 100 * clamp(savings / income, 0, 1), 14 fill muted
row gap 2
  "Rent" rent color accent
  "Food" food color good
  "Transport" transport color warn
  "Savings" savings color muted
