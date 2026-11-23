app "Renovation fund" coin slate
setting target money = 200000
table donation amount money, donor text?
let raised = sum(donation.amount)
let p = clamp(raised / target, 0, 1)
"Target" target head
row gap 3
  draw 40, 120 width 60
    rect 14, 6, 12, 92 fill soft radius 6
    rect 14, 98 - 92 * p, 12, 92 * p fill warn radius 6
    circle 20, 106, 12 fill warn
  stack grow
    "Raised" faint
    text raised big color warn
    round(p * 100) "% of the target" faint
quick donation, amount, [500, 1000, 5000]
form donation
log donation
