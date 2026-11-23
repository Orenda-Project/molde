app "Gift ideas" gift plum
table friend name text, birthday date?
table likes friend ref friend, thing text
state who ref friend
choice who
each friend as f
  stack card gap 1
    row
      f.name bold grow
      f.birthday faint
    each f.likes as l
      "likes" l.thing size small
form friend, "Add friend"
form likes, "Add something they like"
