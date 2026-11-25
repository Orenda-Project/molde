app "Fertilizer" leaf mint
table use plot text, bags num 0.. = 1
sum(use.bags) "bags used" big
share use by plot, sum(it.bags), it.key
form use, "Log bags"
list use by day
