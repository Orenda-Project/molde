app "My field" plant mint
table plot cell num 1..24, crop text
state cur text = ""
field cur "Crop to plant"
grid 6 gap 1
  each 1..24 as c
    box height 48 radius 6 fill if(count(plot where cell = c) > 0, good, soft) tap add plot cell = c, crop = cur
      last(plot.crop where cell = c) size tiny align center
log plot
