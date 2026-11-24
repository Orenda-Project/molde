app "Paracetamol dose" pill ocean
state kg num = 10
field kg "Child weight (kg)"
stat kg * 15, "dose in mg (15 mg per kg)"
stat fixed(kg * 15 / 120 * 5, 1), "syrup in ml (120 mg per 5 ml)"
"Check the dose with a doctor or pharmacist before giving it." faint color warn
