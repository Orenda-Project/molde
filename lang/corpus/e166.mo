app "Counter" plus mint
table hit
let n = count(hit today)
stack align center gap 1
  draw width 260 tap add hit
    circle 50, 50, 36 fill accent
    circle 50, 50, 46 stroke soft thick 6
    arc 50, 50, 46, 0, 360 * clamp(n / 100, 0, 1) stroke good thick 6
    label 50, 50, n big color bg
  "of 100 today" faint
button "Undo" tap remove last(hit today)
