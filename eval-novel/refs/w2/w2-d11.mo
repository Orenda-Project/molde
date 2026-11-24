app "Code review" check ink
table review pr text, tests bool, secrets bool, naming bool, errors bool, docs bool
stat count(review where tests = yes and secrets = yes and naming = yes and errors = yes and docs = yes), "PRs fully passed"
state d new review keep
stack card gap 1
  field d.pr "PR name"
  toggle d.tests
  "Tests added" faint
  toggle d.secrets
  "No secrets" faint
  toggle d.naming
  "Naming ok" faint
  toggle d.errors
  "Error handling" faint
  toggle d.docs
  "Docs updated" faint
  button "Save review" tap save d
each review as r empty "No reviews yet"
  row card swipe remove r
    r.pr bold grow
    if(r.tests, 1, 0) + if(r.secrets, 1, 0) + if(r.naming, 1, 0) + if(r.errors, 1, 0) + if(r.docs, 1, 0) "/5"
