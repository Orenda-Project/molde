lib "data"
# Lists and forms built from level-1 parts. The editor sheet (edit) and remove-with-undo
# are runtime actions; nothing here deletes data for good.

# describe: a list of {src}; tap one to edit it, swipe to remove it
def list src src, none text = "Nothing here yet. Add one to see it here."
  each src as r empty none
    row card tap edit r swipe remove r
      text r grow

# written list SRC by day (the formatter turns the older log SRC into that)
# describe: a list of {src} by day; tap one to edit it, swipe to remove it
def log src src, none text = "Nothing here yet. Add one to see it here."
  each src by day as g empty none
    text g.key bold faint
    each g as r
      row card tap edit r swipe remove r
        text r grow

# describe: a form to add a {t}
def form t table, caption text = "Add"
  state d new t keep
  stack card gap 2
    field d
    button caption tap save d

# describe: one-tap buttons that add a {t} with {f} set to each of {values}
def quick t table, f name, values src
  row gap 1
    each values as v
      button v tap add t f = v

# An app bar: the title and one button that opens a form for a new row; Save adds it and closes.
# describe: a bar with {title} and a button that opens a form to add a {t}
def topbar t table, caption text = "Add", done text = "Save"
  state adding bool = no
  state d new t keep
  row bar
    button if(adding, "Close", caption) fill if(adding, soft, accent) tap set adding = not adding
  if adding
    stack card gap 2
      field d
      button done fill accent tap save d then set adding = no
