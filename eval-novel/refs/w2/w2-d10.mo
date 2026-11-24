app "Incident timeline" flag slate
table event at_time when = now, what text, who text
setting status pick Open|Mitigated|Resolved = Open "Incident status"
choice status
stat now - first(event.at_time), "since first event"
form event, "Add event"
each event sort at_time as e empty "No events yet"
  row card swipe remove e
    e.at_time faint
    e.what grow
    e.who bold
