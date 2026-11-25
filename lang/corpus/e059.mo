app "Mood Pattern" smile plum
table mood score num 1..5, note text?
state sc num = 3
row gap 1
  each 1..5
    button it fill if(sc = it, accent, soft) tap set sc = it
button "Save today's mood" tap add mood score = sc
"Average this month" avg(mood.score month) big
"Lows (1 or 2) this month:" count(mood month where score <= 2) faint
heat last 70 days, avg(mood.score on it), 5
"By weekday (avg)" head
each [1, 2, 3, 4, 5, 6, 7] as w
  row
    dayname(today - weekday(today) + w) grow
    round(sum(days last 70 days, if(weekday(it) = w, sum(mood.score on it), 0)) / (count(days last 70 days, weekday(it) = w and count(mood on it) > 0) + 0.001) * 10) / 10 bold
list mood by day
