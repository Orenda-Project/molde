app "Paintings" pen plum
table painting title text, dims text, medium pick Watercolour|Gouache|Ink|Mixed = Watercolour, took dur, reference text?, done bool
count(painting year where done = yes) "paintings finished this year" big
stat sum(painting.took year) / 1h, "hours painting this year"
each painting sort at desc as p
  row card gap 1 tap edit p
    stack grow
      p.title bold
      p.at p.dims p.medium faint
      "Reference:" p.reference faint
    p.took
    toggle p.done
form painting, "Log painting"
