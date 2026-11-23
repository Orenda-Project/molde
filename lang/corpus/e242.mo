app "Energy" bolt mint
table energy level num 1..10
state level num = 5
text level big align center
slider level 1..10
button "Save" tap add energy level = level
trend energy last 30 days sort at, it.level
