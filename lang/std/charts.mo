lib "charts"
# Charts drawn from level-1 parts: each, draw, rect, poly, pt, grid, box.
# Arguments are passed by name: an argument that uses `it` means the item of the chart's loop.

# describe: a bar chart of {value} for each day {win}
def daybars win win, value num
  row gap 1 align end
    each days win
      stack grow gap 0 align center
        draw 10, 60
          rect 0, 60 - 60 * value / maxof(days win, value), 10, 60 * value / maxof(days win, value) fill accent radius 2
        text dayname(it) size tiny color muted

# describe: a bar chart of {value} for each of {src}
def bars src src, value num, key text = ""
  row gap 1 align end
    each src
      stack grow gap 0 align center
        draw 10, 60
          rect 0, 60 - 60 * value / maxof(src, value), 10, 60 * value / maxof(src, value) fill accent radius 2
        text key size tiny color muted

# describe: a line chart of {value} over {src}
def trend src src, value num
  draw 100, 40
    poly stroke accent thick 1
      each src
        pt 100 * index / (countof(src, yes) - 1), 38 - 36 * value / maxof(src, value)

# describe: a heat map of {value} for each day {win}
def heat win win, value num, peak num = 1
  grid 7 gap 1
    each days win
      box height 14 radius 3 fill if(value > 0, accent, soft) opacity if(value > 0, clamp(value / peak, 0.25, 1), 1)

# describe: bars that compare {value} across {src}
def share src src, value num, key text
  each src
    stack gap 0
      row gap 1
        text key grow
        text value bold
      draw 100, 3
        rect 0, 0, 100 * value / maxof(src, value), 3 fill accent radius 1
