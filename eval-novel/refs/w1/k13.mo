app "BMI" scale ocean
state ft num = 5
state inch num = 8
state kg num = 70
let m = (ft * 12 + inch) * 0.0254
let bmi = kg / (m * m)
let cat = if(bmi < 18.5, "Underweight", if(bmi < 25, "Normal", if(bmi < 30, "Overweight", "Obese")))
stack card gap 2
  field ft "Height (feet)"
  field inch "Height (inches)"
  field kg "Weight (kg)"
stat fixed(bmi, 1), "BMI"
text cat head color if(bmi >= 18.5 and bmi < 25, good, warn)
