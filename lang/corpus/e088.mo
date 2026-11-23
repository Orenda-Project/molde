app "Plant Diary" plant mint
table plant species text, place text, watered date, days_gap num 1..90 = 3, repotted date?
"Need water today" head
each plant where watered + days_gap <= today
  row card
    it.species it.place grow
    button "Watered" tap set it.watered = today
"All plants" head
each plant sort species
  row card tap edit it
    stack grow
      it.species bold
      it.place "- every" it.days_gap "days. Last watered" it.watered faint
form plant, "Add plant"
