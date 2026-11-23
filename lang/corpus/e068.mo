app "Roz Mood" smile plum
table mood score num 1..5
row gap 1
  button "😞" tap add mood score = 1
  button "😕" tap add mood score = 2
  button "😐" tap add mood score = 3
  button "🙂" tap add mood score = 4
  button "😄" tap add mood score = 5
"Aaj ka mood" avg(mood.score today) big
daybars last 7 days, avg(mood.score on it)
log mood
