app "Pages" book mint
table read pages num 1..2000
stat sum(read.pages week), "pages this week"
quick read, pages, [5, 10, 20]
form read, "Add pages"
daybars last 7 days, sum(read.pages on it)
