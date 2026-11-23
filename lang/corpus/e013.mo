app "Tea" cup mint
table tea
let t = count(tea today)
text t "cups today" big
button "+1 cup" tap add tea
button "Undo" tap remove last(tea today)
"This month:" count(tea month) "cups" head
daybars last 7 days, count(tea on it)
