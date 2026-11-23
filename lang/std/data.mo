lib "data"
# Lists and forms built from level-1 parts. The editor sheet (edit) and remove-with-undo
# are runtime actions; nothing here deletes data for good.

# describe: a list of {src}; tap one to edit it, swipe to remove it
def list src src
  if countof(src, yes) = 0
    text "Nothing here yet." color muted
  each src as r
    row card tap edit r swipe remove r
      text r grow

# describe: a list of {src} by day; tap one to edit it, swipe to remove it
def log src src
  if countof(src, yes) = 0
    text "Nothing here yet." color muted
  each src by day as g
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
