app "Mood" smile plum
table mood score num 1..5
row gap 1 align center
  button "😡" tap add mood score = 1
  button "😟" tap add mood score = 2
  button "😐" tap add mood score = 3
  button "🙂" tap add mood score = 4
  button "😄" tap add mood score = 5
"Today" avg(mood.score today) head
trend days last 30 days, avg(mood.score on it)
