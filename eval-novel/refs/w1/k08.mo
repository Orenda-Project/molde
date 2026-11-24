app "Tola converter" scale mint
state tola num = 1
state grams num = 0
state price money = 0
row gap 2
  field tola "Tola"
  field grams "Grams"
"Tola to grams" head
stat fixed(tola * 11.6638, 3), "grams"
row gap 3
  stat fixed(tola * 12, 2), "masha"
  stat fixed(tola * 96, 1), "ratti"
"Grams to tola" head
stat fixed(grams / 11.6638, 4), "tola"
row gap 3
  stat fixed(grams / 11.6638 * 12, 3), "masha"
  stat fixed(grams / 11.6638 * 96, 2), "ratti"
"1 tola = 12 masha = 96 ratti = 11.6638 g" faint
field price "Gold price per tola"
stat tola * price, "value of the tola entered"
