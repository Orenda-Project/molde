app "Refills" pill ocean
table med name text, refill date
remind "Refill your medicine" at med.refill
each med sort refill
  row card
    it.name bold grow
    "refill in" it.refill - today "days" color if(it.refill - today <= 3, bad, ink)
form med
