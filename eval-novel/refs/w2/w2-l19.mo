app "Shaadi budget" gift plum
table item name text, estimate money, actual money?, bought bool
row gap 2
  stat sum(item.estimate), "estimated"
  stat sum(item.actual), "actual"
stat sum(item.actual) - sum(item, if(it.actual > 0, it.estimate, 0)), "over or under on bought"
form item, "Add item"
each item as i empty "No items yet"
  row card tap edit i swipe remove i
    toggle i.bought
    i.name grow
    i.estimate faint
    i.actual - i.estimate color if(i.actual > i.estimate, bad, good)
