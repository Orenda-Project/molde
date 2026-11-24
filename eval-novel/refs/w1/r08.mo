app "Eye rest" eye mint
table breakdone
state on bool = no
remind "Look away for 20 seconds" every 20m from 9:00 to 21:00 if on
toggle on
"Reminders every 20 minutes" faint
timer 20s, "Look away", add breakdone then notify "Break done"
stat count(breakdone today), "breaks taken today"
