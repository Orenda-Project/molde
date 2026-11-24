app "Qaza namaz" mosque mint
table prayed prayer pick Fajr|Zuhr|Asr|Maghrib|Isha|Witr
setting fajr num 0.. = 1200 "Fajr missed"
setting zuhr num 0.. = 900 "Zuhr missed"
setting asr num 0.. = 1000 "Asr missed"
setting maghrib num 0.. = 800 "Maghrib missed"
setting isha num 0.. = 700 "Isha missed"
setting witr num 0.. = 300 "Witr missed"
let total = fajr + zuhr + asr + maghrib + isha + witr - count(prayed)
stat total, "qaza prayers remaining"
def qrow name text, left num, go act
  row card gap 2 align center
    text name bold grow
    text left big
    button "-1" tap go
qrow "Fajr", fajr - count(prayed where prayer = Fajr), add prayed prayer = Fajr
qrow "Zuhr", zuhr - count(prayed where prayer = Zuhr), add prayed prayer = Zuhr
qrow "Asr", asr - count(prayed where prayer = Asr), add prayed prayer = Asr
qrow "Maghrib", maghrib - count(prayed where prayer = Maghrib), add prayed prayer = Maghrib
qrow "Isha", isha - count(prayed where prayer = Isha), add prayed prayer = Isha
qrow "Witr", witr - count(prayed where prayer = Witr), add prayed prayer = Witr
"Prayed today" count(prayed today) faint
