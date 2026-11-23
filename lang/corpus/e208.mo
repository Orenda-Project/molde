app "Appliances" home slate
table appliance name text, bought date, warranty_end date, serviced date?, tech_phone text?, repair_cost money?
let soon = count(appliance where warranty_end >= today and warranty_end <= today + 30)
text soon "warranties ending within 30 days" head color if(soon > 0, warn, ink)
when soon > 0 notify soon "warranty ending within 30 days"
each appliance sort warranty_end as a
  row card tap edit a swipe remove a
    stack grow
      a.name bold
      "Warranty until" a.warranty_end color if(a.warranty_end - today <= 30, warn, muted)
      "Last service" a.serviced ", repairs" a.repair_cost ", technician" a.tech_phone faint
form appliance
