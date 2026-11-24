app "Tile counter" grid ocean
state len num = 12
state wid num = 10
state tw num = 24
state th num = 24
state per num = 4
setting waste num 0..50 = 10 "Wastage (percent)"
let raw = len * wid * 144 / (tw * th)
let tiles = 0 - floor(0 - raw * (1 + waste / 100))
stack card gap 2
  field len "Room length (ft)"
  field wid "Room width (ft)"
  field tw "Tile width (in)"
  field th "Tile length (in)"
  field per "Tiles per box"
stat tiles, join("tiles to buy, incl. ", waste, "% wastage")
"Boxes:" 0 - floor(0 - tiles / per) bold
"Floor area" len * wid "sq ft" faint
