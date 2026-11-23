app "Receipts" tag slate
table doc name text, shop text?, bought date?, warranty_end date?, photo image?
each doc sort name as d
  row card tap edit d swipe remove d
    stack grow
      d.name bold
      d.shop d.bought faint
      "Warranty until" d.warranty_end faint
    image d.photo
form doc, "Add paper"
