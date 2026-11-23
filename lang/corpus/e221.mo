app "Statement helper" wallet slate
table rule word text, category pick Food|Bills|Travel|Fun|Health|Other
table spend what text, amount money, category text
state ln text = ""
state amt money = 0
field ln "Paste one line from the statement"
field amt "Amount"
"Category guess" faint
last(rule.category where has(ln, word)) bold
button "Save" tap add spend what = ln, amount = amt, category = last(rule.category where has(ln, word)) then set ln = ""
"Teach the helper a word" head
form rule, "Add rule"
share spend month by category, sum(it.amount), it.key
log spend
