lib "charts"
# Charts drawn from level-1 parts: each, draw, rect, poly, pt, grid, box.
# Arguments are passed by name: an argument that uses `it` means the item of the chart's loop.

# describe: a bar chart of {value} for each day {win}
def daybars win win, value num
  plot 0..count(days win, yes), 0..max(days win, value) axes
    each days win
      rect index + 0.15, 0, 0.7, value fill accent radius 2
      tick index + 0.5, dayname(it)

# describe: a bar chart of {value} for each of {src}
def bars src src, value num, key text = ""
  plot 0..count(src, yes), 0..max(src, value) axes
    each src
      rect index + 0.15, 0, 0.7, value fill accent radius 2
      tick index + 0.5, key

# describe: a line chart of {value} over {src}
def trend src src, value num
  plot 0..count(src, yes) - 1, min(src, value)..max(src, value) axes
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
        rect 0, 0, 100 * value / max(src, value), 3 fill accent radius 1

# describe: a bar chart of {value} for each day {win}, with a line at the goal {target}
def goalbars win win, value num, target num, reached text = "", notyet text = "Not yet"
  plot 0..count(days win, yes), 0..max(target, max(days win, value)) axes gridlines
    line 0, target, count(days win, yes), target stroke ink thick 1
    each days win
      rect index + 0.15, 0, 0.7, value fill if(value >= target, accent, muted) opacity if(value >= target, 1, 0.5) radius 3
      tick index + 0.5, dayname(it)
  if reached != ""
    row gap 3
      row gap 1
        box width 14 height 14 radius 4 fill accent
        text reached faint
      row gap 1
        box width 14 height 14 radius 4 fill muted opacity 0.5
        text notyet faint

# describe: a grid of the days {win}, each coloured by {value}, with its day of the month
def daygrid win win, value num, peak num = 1
  grid 7 gap 1
    each days win
      stack gap 0 align center
        text monthday(it) tiny color muted
        box height 24 radius 6 fill if(value > 0, accent, soft) opacity if(value > 0, clamp(value / peak, 0.3, 1), 1)

# describe: a row of the last 7 days, each marked when {value}
def weekdots value bool
  row gap 1
    each days last 7 days
      stack grow gap 0 align center
        text dayname(it) tiny color muted
        box height 10 width 24 radius 5 fill if(value, accent, soft)
