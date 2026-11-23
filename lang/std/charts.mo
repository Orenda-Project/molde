lib "charts"
# Charts drawn from level-1 parts: each, draw, rect, poly, pt, grid, box.
# Arguments are passed by name: an argument that uses `it` means the item of the chart's loop.

# describe: a bar chart of {value} for each day {win}
def daybars win win, value num
  plot 0..countof(days win, yes), 0..maxof(days win, value) axes
    each days win
      rect index + 0.15, 0, 0.7, value fill accent radius 2
      tick index + 0.5, dayname(it)

# describe: a bar chart of {value} for each of {src}
def bars src src, value num, key text = ""
  plot 0..countof(src, yes), 0..maxof(src, value) axes
    each src
      rect index + 0.15, 0, 0.7, value fill accent radius 2
      tick index + 0.5, key

# describe: a line chart of {value} over {src}
def trend src src, value num
  plot 0..countof(src, yes) - 1, minof(src, value)..maxof(src, value) axes
    poly stroke accent thick 2
      each src
        pt index, value

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
