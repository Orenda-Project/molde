app "Travel album" map plum
table trip place text, visited date, cost money, photo image?
count(trip) "places," sum(trip.cost) "spent" head
each trip sort visited desc as t
  stack card gap 1 tap edit t swipe remove t
    image t.photo
    t.place bold
    t.visited t.cost faint
form trip, "Add a place"
"A map of the cities is not possible here." faint
