app "Electricity" bolt slate
table bill units num 0.., amount money
"This month" sum(bill.amount month) big
sum(bill.units month) "units" faint
"Last month" sum(bill.amount prev month) head
sum(bill.units prev month) "units" faint
if(sum(bill.amount month) > sum(bill.amount prev month), "Up by", "Down by") abs(sum(bill.amount month) - sum(bill.amount prev month)) "compared with last month" head color if(sum(bill.amount month) > sum(bill.amount prev month), bad, good)
bars 0..5, sum(bill.amount month of addmonths(today, -it)), monthname(addmonths(today, -it))
form bill, "Add bill"
list bill
