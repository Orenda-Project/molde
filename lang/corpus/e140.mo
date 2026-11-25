app "Follow-ups" heart ocean
table patient name text, phone text?
table followup patient ref patient, due date, reason text?, done bool
remind "Patient follow-up due" at followup.due
count(followup where done = no and due <= today) "follow-ups due" head color if(count(followup where done = no and due <= today) > 0, warn, good)
each followup where done = no sort due as f
  row card gap 1 tap edit f
    stack grow
      f.patient.name bold
      f.reason faint
    f.due color if(f.due < today, bad, ink)
    toggle f.done
form patient, "Add patient"
form followup, "Add follow-up"
