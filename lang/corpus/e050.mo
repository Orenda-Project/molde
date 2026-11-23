app "Meal Planner" food mint
table dish name text, cost money
table ingredient dish ref dish, item text, cost money
table plan day pick Mon|Tue|Wed|Thu|Fri|Sat|Sun, meal pick Breakfast|Lunch|Dinner, dish ref dish
each options plan.day as dd
  stack card gap 1
    text dd head
    each plan where day = dd sort meal
      row
        it.meal grow
        it.dish.name bold
"Grocery list" head
each plan as p
  each p.dish.ingredient
    row
      it.item grow
      it.cost
"Estimated cost" sumof(plan, sum(it.dish.ingredient.cost)) head
form dish, "Add dish"
form ingredient, "Add ingredient"
form plan, "Plan a meal"
