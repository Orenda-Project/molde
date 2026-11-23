app "Measurements" pen plum
table customer name text, phone text?, chest num 0.., waist num 0.., hips num 0.., length num 0.., sleeve num 0.., shoulder num 0.., note text?
each customer sort name as c
  stack card gap 1
    row
      c.name head grow
      "Updated" c.at faint
    grid 3 gap 1
      stack radius 6 pad 1 fill soft align center
        "Chest" size tiny faint
        c.chest big
        "inches" size tiny faint
      stack radius 6 pad 1 fill soft align center
        "Waist" size tiny faint
        c.waist big
        "inches" size tiny faint
      stack radius 6 pad 1 fill soft align center
        "Hips" size tiny faint
        c.hips big
        "inches" size tiny faint
      stack radius 6 pad 1 fill soft align center
        "Length" size tiny faint
        c.length big
        "inches" size tiny faint
      stack radius 6 pad 1 fill soft align center
        "Sleeve" size tiny faint
        c.sleeve big
        "inches" size tiny faint
      stack radius 6 pad 1 fill soft align center
        "Shoulder" size tiny faint
        c.shoulder big
        "inches" size tiny faint
    c.note faint
    button "Edit" tap edit c
form customer, "Add customer"
