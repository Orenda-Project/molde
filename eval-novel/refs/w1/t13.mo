app "Generator fuel" bolt slate
table fill litres num 0.1.., price money "Price per litre", hours num 0.. "Hours it ran"
stat fixed(sum(fill.litres) / sum(fill.hours), 2), "litres of diesel per hour"
"Total fuel cost" sum(fill, it.litres * it.price) bold
form fill, "Add fill"
list fill by day
