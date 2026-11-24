app "Family vote" users mint
table vote opt pick Pizza|Biryani|Burger
stat count(vote), "total votes"
each options vote.opt as o
  stack gap 0
    row gap 1
      button o tap add vote opt = o
      count(vote where opt = o) bold grow
    draw 100, 4
      rect 0, 0, 100, 4 fill soft radius 2
      rect 0, 0, 100 * count(vote where opt = o) / max(count(vote), 1), 4 fill accent radius 2
button "Reset votes" tap remove all vote
