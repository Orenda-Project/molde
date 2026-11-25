app "Measurements" pen plum
table customer name text, phone text?, chest num 20..80 unit "in", waist num 20..80 unit "in", sleeve num 10..40 unit "in"
each customer sort name
  row card tap edit it swipe remove it
    stack grow
      it.name bold
      "Chest" it.chest "Waist" it.waist "Sleeve" it.sleeve faint
form customer, "Add customer card"
