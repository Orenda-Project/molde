app "Chores" home mint
table child name text
table tick child ref child
row gap 1
  stack gap 1
    box height 32
    each days week as d
      box height 32
        dayname(d) faint
  each child as c
    stack grow gap 1 align center
      c.name bold
      each days week as d
        box height 32 radius 6 fill if(count(c.tick on d) > 0, good, soft) tap toggle c.tick on d
form child, "Add child"
