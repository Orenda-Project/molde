app "Tank filler" drop ocean
state l num = 4
state w num = 3
state h num = 3
state pump num = 20
let litres = l * w * h * 28.3168
stack card gap 2
  field l "Length (ft)"
  field w "Width (ft)"
  field h "Height (ft)"
  field pump "Pump (litres per minute)"
stat round(litres), "litres the tank holds"
stat fixed(litres / pump, 1), "minutes to fill"
"Volume" fixed(l * w * h, 1) "cubic feet" faint
