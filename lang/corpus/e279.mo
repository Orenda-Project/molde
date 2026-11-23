app "Visitors" users slate
table visit
count(visit today) "visitors today" big
row gap 1
  button "+1" large tap add visit
  button "-1" tap remove last(visit today)
daybars last 7 days, count(visit on it)
count(visit week) "this week" faint
