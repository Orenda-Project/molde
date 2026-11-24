app "API key expiry" key ink
table apikey name text, service text, expires date
stat count(apikey where expires - today <= 14), "expiring within 14 days"
form apikey, "Add key"
each apikey sort expires as k empty "No keys yet"
  row card tap edit k swipe remove k fill if(k.expires - today <= 14, warn, surface)
    stack gap 0 grow
      k.name bold
      k.service faint
    k.expires - today "days left"
remind "An API key expires soon" at apikey.expires - 14d at 9:00
