app "Shots" eye slate
table shot subject text, camera text?, iso num 50..102400 = 100, aperture text?, shutter text?, place text?, rating num 1..5
"Average rating" round(avg(shot.rating) * 10) / 10 big
form shot, "Log shot"
each shot sort rating desc as s
  stack card gap 0 tap edit s swipe remove s
    row
      s.subject bold grow
      s.rating "/ 5" bold
    "ISO" s.iso s.aperture s.shutter faint
    s.camera s.place faint
