app "Sabzi stock" leaf mint
table veg name text
table buy veg ref veg, kg num 0..
table sale veg ref veg, kg num 0..
each veg as v
  let left = sum(v.buy.kg) - sum(v.sale.kg)
  row card gap 1
    v.name bold grow
    "bought" sum(v.buy.kg) faint
    "sold" sum(v.sale.kg) faint
    "left" left bold color if(left <= 0, bad, ink)
form veg, "Add vegetable"
form buy, "Bought"
form sale, "Sold"
