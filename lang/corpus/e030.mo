app "Egg Farm" egg mint
table collect eggs num 1..10000
table sale shop text, eggs num 1.., amount money
table feed bags num 1.., cost money
"Eggs today" sum(collect.eggs today) big
"Sold today" sum(sale.eggs today) "| Feed bags this month" sum(feed.bags month) faint
form collect, "Eggs collected"
form sale, "Sale to shop"
form feed, "Feed bought"
"Profit by month" head
bars 0..5, sum(sale.amount month of addmonths(today, -it)) - sum(feed.cost month of addmonths(today, -it)), monthname(addmonths(today, -it))
