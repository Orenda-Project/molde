app "Farm Record" plant mint
table plot name text, crop pick Wheat|Rice, sown date, bags num 0.. unit "bags", water num 0.. = 0 "Irrigations", harvest date, yield num 0.. = 0 unit "maund" "Actual yield"
each plot sort name
  stack card gap 1
    it.name it.crop head
    "Sown" it.sown "| Expected harvest" it.harvest faint
    "Fertiliser" it.bags "bags | Irrigations" it.water "| Yield" it.yield "maund" bold
    row gap 1
      button "+1 irrigation" tap set it.water = it.water + 1
      button "Edit yield" tap edit it
form plot, "Add plot"
