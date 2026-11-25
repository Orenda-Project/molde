app "Home Inventory" home slate
table thing item text, room text, bought date, warranty date
remind "Warranty ends" at thing.warranty
each thing where warranty - today <= 30 and warranty >= today sort warranty
  row card
    it.item "- warranty ends" it.warranty color warn
form thing, "Add item"
list thing
