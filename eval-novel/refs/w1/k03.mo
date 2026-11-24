app "Cloth needed" tag plum
state height num = 66
state chest num = 38
state sleeve num = 24
state style pick Wide|Slim = Wide
let kameez = 2 * (height * 0.58 + 4) + 2 * (sleeve + 2) + if(chest > 44, 12, 0)
let shalwar = 2 * (height * 0.58) + if(style = Wide, 36, 12)
stack card gap 2
  field height "Height (inches)"
  field chest "Chest (inches)"
  field sleeve "Sleeve length (inches)"
  "Shalwar style" faint
  choice style
stat fixed((kameez + shalwar) * 0.0254, 2), "metres of cloth (estimate)"
row gap 3
  stat fixed(kameez * 0.0254, 2), "kameez (m)"
  stat fixed(shalwar * 0.0254, 2), "shalwar (m)"
