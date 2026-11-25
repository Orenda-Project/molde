app "Laundry" cloud ocean
table wash kind pick Whites|Colours|Delicates|Bedding|Towels = Whites, folded bool
count(wash where folded = no) "loads to fold" head
quick wash, kind, ["Whites", "Colours", "Delicates", "Bedding", "Towels"]
each wash where folded = no as w
  row card gap 1
    w.kind bold grow
    w.at faint
    toggle w.folded
stat count(wash week), "loads this week"
list wash by day
