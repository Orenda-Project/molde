app "Study timer" timer ink
table session subject text, mins num 0..
state sub text = ""
state el dur = 0s
state going bool = no
every 1s if going set el = el + 1s
field sub "Subject"
el big
row gap 1
  button if(going, "Pause", "Start") tap set going = not going
  button "Save" tap add session subject = sub, mins = round(el / 1m) then set going = no then set el = 0s
"Minutes per subject" head
each session by subject
  row
    it.key grow
    sum(it.mins) "min" bold
daybars last 7 days, sum(session.mins on it)
log session
