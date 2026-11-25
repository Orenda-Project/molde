app "Tasbeeh" beads mint
table zikr phrase pick SubhanAllah|Alhamdulillah|AllahuAkbar
"Total" count(zikr all) big
each options zikr.phrase
  state base num = 0
  let n = count(zikr where phrase = it) - base
  row card gap 1
    it bold grow
    n big
    button "+1" tap add zikr phrase = it
    button "Reset" tap set base = count(zikr where phrase = it)
