lib "show"
# Numbers people read at a glance. Every part is plain level-1 MoldeScript.

# describe: a big number: {value}, labelled {caption}
def stat value num, caption text = words(value)
  stack gap 0
    text value big
    text caption faint

# describe: {value} out of {target} with a progress bar, labelled {caption}
def goal value num, target num, caption text = words(value), suffix text = ""
  stack gap 1
    row gap 1 align end
      text value suffix big color if(value > target, warn, ink)
      text "of" target suffix color muted
    draw 100, 4
      rect 0, 0, 100, 4 fill soft radius 2
      rect 0, 0, 100 * clamp(value / target, 0, 1), 4 fill if(value > target, warn, accent) radius 2
    text caption faint

