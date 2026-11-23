lib "time"
# Time pieces from level-1 parts: state, every, when, toggle actions and grids of days.

# It keeps the moment it ends (not a count of seconds), so it is right after any sleep.
# describe: a countdown timer of {secs}, labelled {caption}; when it ends it {done}
def timer secs dur, caption text = "Timer", done act = notify "Time is up"
  state left dur = secs
  state ends when = now
  state going bool = no
  when going and now >= ends set going = no then set left = secs then done
  stack align center gap 1
    text caption color muted
    text if(going, max(ends - now, 0s), left) big
    row gap 1
      if going
        button "Pause" tap set left = ends - now then set going = no
      else
        button "Start" tap set ends = now + left then set going = yes
      button "Reset" tap set going = no then set left = secs

# describe: a month calendar of {t}; tap a day to mark or unmark it
def calendar t src, day date = today
  grid 7 gap 1
    each ["M", "T", "W", "T", "F", "S", "S"] as w
      text w tiny color muted align center
    each 1..weekday(day - monthday(day) + 1) - 1 as n
      box
    each days month of day as d
      box height 32 radius 6 fill if(count(t on d) > 0, accent, soft) tap toggle t on d
        text monthday(d) small align center color if(count(t on d) > 0, bg, ink)

# describe: arrows that move {m} back and forward one month
def monthnav m name
  row align center gap 1
    button "<" tap set m = addmonths(m, -1)
    text monthname(m) bold grow align center
    button ">" tap set m = addmonths(m, 1)
