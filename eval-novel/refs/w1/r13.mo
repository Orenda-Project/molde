app "Dhikr counters" beads mint
table zikr phrase pick Subhanallah|Alhamdulillah|Allahu_Akbar|La_ilaha_illallah|Astaghfirullah
setting target num = 33 "Target for each"
each options zikr.phrase as p
  row card gap 2 align center tap add zikr phrase = p
    text p bold grow
    text count(zikr where phrase = p) big color if(count(zikr where phrase = p) >= target, good, ink)
    button "+1" tap add zikr phrase = p
button "Reset all" tap remove all zikr
