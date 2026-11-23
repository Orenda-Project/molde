app "Exam Countdown" hourglass ocean
setting exam when "Exam date and time"
setting begun when "Started studying"
let left = exam - now
floor(left / 1d) "days" big
floor(left / 1h) % 24 "hours" floor(left / 1m) % 60 "minutes" head
draw 100, 4
  rect 0, 0, 100, 4 fill soft radius 2
  rect 0, 0, 100 * clamp(1 - left / (exam - begun), 0, 1), 4 fill accent radius 2
"of the time to the exam is gone" faint
