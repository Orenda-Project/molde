app "Jog laps" run ocean
table lap
setting lap_len num 50.. = 400 "Lap length (m)"
button "+1 lap" large tap add lap
stat count(lap) * lap_len, "metres covered"
"Laps" count(lap) "=" fixed(count(lap) * lap_len / 1000, 2) "km" faint
row gap 1
  button "Undo last lap" tap remove last(lap)
  button "Reset" tap remove all lap
