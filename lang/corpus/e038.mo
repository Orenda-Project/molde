app "Meal Stars" star mint
table meal name text?, stars num 1..5
avg(meal.stars all) big
"average of" count(meal) "meals" faint
state who text = ""
field who "Meal"
row gap 1
  each 1..5
    button it "★" tap add meal name = who, stars = it
list meal
