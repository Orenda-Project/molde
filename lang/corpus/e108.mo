app "Water" drop ocean
table drink
remind "Drink water" every 2h from 9:00 to 18:00
stat count(drink today), "glasses today"
button "I drank" tap add drink
daybars last 7 days, count(drink on it)
