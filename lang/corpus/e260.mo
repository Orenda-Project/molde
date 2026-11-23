app "Gas cylinder" fire ocean
table refill
since(refill) "days since last refill" big
"A cylinder usually lasts about" round(gap(refill)) "days" faint
button "Refilled today" tap add refill
form refill, "Add past refill"
list refill
