app "Trees" tree mint
table tree species text, qty num 1.. = 1, place text?
sum(tree.qty) "trees planted" big
share tree by species, sum(it.qty), it.key
form tree, "Record planting"
list tree by day
