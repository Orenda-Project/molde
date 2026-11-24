app "Uptime notes" bolt slate
table outage server pick S1|S2|S3|S4|S5, went_down when = now, came_back when = now
row gap 2
  stat count(outage), "outages"
  stat sum(outage, it.came_back - it.went_down), "total downtime"
form outage, "Log outage"
each outage as o empty "No outages logged"
  row card tap edit o swipe remove o
    o.server bold grow
    o.came_back - o.went_down
    o.went_down faint
