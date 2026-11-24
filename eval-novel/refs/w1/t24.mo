app "Fish log" fish ocean
table catch day date = today, spot pick River|Lake|Canal, fish text, kg num 0.., bait text
stat sum(catch.kg), "total kg caught"
form catch, "Add catch"
list catch by day
