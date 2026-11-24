app "Feature flags" flag ink
table flag name text, env pick Dev|Staging|Prod, owner text, on bool
stat count(flag where on = yes), "flags on"
form flag, "Add flag"
each options flag.env as ev
  if count(flag where env = ev) > 0
    ev head
    each flag where env = ev as f
      row card swipe remove f fill if(f.on and f.env = Prod, warn, surface)
        toggle f.on
        f.name bold grow
        f.owner faint
