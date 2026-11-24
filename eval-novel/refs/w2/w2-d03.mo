app "Deploy checklist" check ink
table done step pick Run_tests|DB_backup|Migrate|Deploy|Smoke_test|Notify_team
goal count(done), 6, "steps done"
if count(done) = 6
  "Ready: release is complete" bold color good
each options done.step as s
  row card
    toggle done all where step = s
    s grow
button "Reset for next release" tap remove all done
