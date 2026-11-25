app "Community" users ocean
table member name text, phone text?
table meeting title text
table present meeting ref meeting, member ref member
table gift donor text, amount money
state m date = today
screen members "Members" users
  form member, "Add member"
  list member
screen meetings "Meetings" calendar
  form meeting, "Add meeting"
  each meeting as mt
    stack card gap 1
      row
        mt.title bold grow
        count(mt.present) "present" faint
      each member as p
        row gap 1
          toggle present where meeting = mt and member = p
          p.name
screen donations "Donations" money
  form gift, "Add donation"
  list gift by day
screen report "Report" chart
  monthnav m
  stat sum(gift.amount month of m), "donations this month"
  stat count(meeting month of m), "meetings this month"
  stat count(member), "members"
  "The report is shown here; sending it to a WhatsApp group is not possible." faint
