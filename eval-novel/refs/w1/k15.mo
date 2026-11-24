app "Bill split" food mint
state bill money = 0
state gst num = 16
state svc num = 10
state people num = 4
stack card gap 2
  field bill "Restaurant bill"
  field gst "GST (percent)"
  field svc "Service (percent)"
  field people "People"
let total = bill * (1 + (gst + svc) / 100)
stat round(total), "total with tax and service"
stat round(total / people), "per person"
