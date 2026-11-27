// c2: hand-made option families for "add option" edits.
// One line per family:  id | members (words a pick may already hold) | additions (plausible new options for that family)
// A pick matches a family when at least 2 of its options (and at least 60% of them) are members. The new option is taken from
// the additions and is never one the pick already has. Words are written naturally; spaces become "_" in the program.
// Picks that match no family are skipped (names, A|B|C, team names, and so on).
const RAW = `
weekdays_short | mon,tue,wed,thu,fri,sat,sun | Sat,Sun,Weekend,Every_day
weekdays_long | monday,tuesday,wednesday,thursday,friday,saturday,sunday | Saturday,Sunday,Weekend,Every_day
dayparts | morning,afternoon,evening,night,noon,midday,dawn,late night,day,dusk | Noon,Night,Afternoon,Evening,Late night,Dawn,Midday
meals | breakfast,lunch,dinner,snack,brunch,dessert,supper,tea,tea time,sehri,iftar | Snack,Brunch,Dessert,Supper,Tea time,Breakfast,Lunch,Dinner
prayers | fajr,zuhr,dhuhr,asr,maghrib,isha,witr,tahajjud,ishraq,duha,jummah | Witr,Tahajjud,Ishraq,Duha,Jummah
dhikr | subhanallah,alhamdulillah,allahuakbar,astaghfirullah,durood,hasbunallah,la ilaha illallah | Astaghfirullah,Durood,Hasbunallah,La ilaha illallah
quran_parts | sabaq,sabqi,manzil,revision,new lesson,tajweed | Revision,Tajweed,New lesson
priority | low,normal,high,medium,urgent,critical,someday,none,lowest,highest,important | Urgent,Critical,Medium
eisenhower | urgent,important,both,neither,not urgent | Neither,Both,Not urgent
sizes_letters | s,m,l,xl,xs,xxl,xxxl | XL,XXL,XS,XXXL
sizes_words | small,medium,large,regular,big,tiny,huge,extra large,mini,jumbo,half,full,family | Extra large,Regular,Mini,Jumbo,Family
cup_sizes | small,medium,large,regular,tall,grande,venti,single,double | Regular,Double,Extra large
todo_states | todo,to do,doing,done,review,blocked,backlog,in progress,testing,waiting,next,later,someday | Blocked,Review,Backlog,Testing,Waiting,In progress
kanban_dev | idea,building,shipped,recorded,edited,published,draft,scripted,planned,filmed | Draft,Scripted,Filmed,Planned
job_pipeline | applied,interview,offer,rejected,screening,saved,withdrawn,accepted,ghosted,phone screen,assessment | Screening,Withdrawn,Ghosted,Accepted,Assessment,Phone screen
difficulty | easy,medium,hard,expert,very hard,beginner,normal,insane,intermediate,advanced | Expert,Very hard,Beginner,Intermediate,Advanced
payment_methods | cash,card,easypaisa,jazzcash,bank,cheque,online,credit card,debit card,sadapay,nayapay,transfer,paypal,wallet,bank transfer | Bank transfer,Cheque,Sadapay,Online,Credit card,Wallet,Nayapay
mobile_wallets | easypaisa,jazzcash,sadapay,nayapay,upaisa,raast | Sadapay,Nayapay,Upaisa,Raast
expense_general | food,bills,travel,fun,health,other,rent,groceries,transport,shopping,education,gifts,clothes,fuel,utilities,medicine,savings,insurance,subscriptions,dining,coffee,charity,school,fees | Savings,Gifts,Education,Subscriptions,Charity,Clothes,Insurance,Fuel,Medicine,Groceries,Transport,Shopping
household_costs | electricity,gas,water,internet,rent,phone,tv,garbage,maintenance,cable,sui gas,wapda | Internet,Phone,Maintenance,Water,Gas,Cable
shop_costs | stock,rent,staff,transport,tax,electricity,packaging,repairs,wages,licence,marketing | Packaging,Repairs,Marketing,Electricity,Wages,Licence
grocery_aisles | veg,vegetables,fruit,dairy,meat,pantry,snacks,bakery,drinks,frozen,cleaning,spices,grains,home,household,toiletries | Fruit,Bakery,Frozen,Drinks,Toiletries,Cleaning,Spices
fresh_forms | dry,fresh,frozen,canned,tinned,packed,loose | Canned,Packed,Loose
moods_five | awful,bad,okay,good,great,low,fine,meh,terrible,amazing | Terrible,Meh,Fine,Amazing
moods_named | happy,calm,tired,anxious,angry,sad,stressed,excited,irritable,relaxed,bored,lonely,hopeful,grateful,proud,worried,content | Stressed,Excited,Bored,Grateful,Lonely,Proud,Worried
school_subjects | maths,math,english,urdu,science,physics,chemistry,biology,history,geography,islamiat,computer,art,social studies,economics,civics,pst,sindhi,pashto,punjabi,drawing,quran | Biology,Geography,Islamiat,Computer,Art,Civics,Economics
study_activities | read,practice,revise,notes,homework,revision,quiz,project,flashcards,exam prep,past papers | Past papers,Quiz,Project,Flashcards,Revision,Homework
workout_types | run,gym,yoga,walk,strength,stretch,cycle,swim,hiit,pilates,cardio,rest,jog,bike,football,cricket,skipping | Swim,Hiit,Pilates,Cardio,Cycle,Rest,Skipping
lifts | squat,bench,deadlift,press,row,pull up,pullup,curl,dip,lunge,overhead press,bench press | Row,Pull up,Curl,Dip,Lunge,Overhead press
muscle_groups | chest,back,legs,arms,shoulders,core,abs,biceps,triceps,glutes,calves | Core,Glutes,Calves,Shoulders,Abs
split_days | push,pull,legs,upper,lower,full body,arms,cardio,rest | Rest,Cardio,Full body,Arms
body_parts_pain | lower back,upper back,neck,hips,knee,shoulder,ankle,wrist,elbow,head,foot | Knee,Shoulder,Ankle,Wrist,Elbow
symptoms | fever,cough,pain,nausea,fatigue,headache,dizziness,cold,sore throat,rash,other,vomiting,chills,cramps | Headache,Dizziness,Sore throat,Rash,Chills,Cramps
med_timing | fasting,after meal,bedtime,before meal,morning,evening,with food,before bed,empty stomach | Before meal,With food,Empty stomach,Before bed
severity | none,mild,moderate,severe,bad,slight,extreme,light,heavy | Moderate,Severe,Slight
flow_levels | light,medium,heavy,spotting,none,normal | Spotting,Heavy
weather | sunny,cloudy,rainy,windy,snowy,stormy,foggy,hot,cold,clear,humid,hazy | Foggy,Stormy,Hazy,Humid,Windy
seasons | spring,summer,autumn,winter,monsoon,fall | Monsoon,Autumn
vehicles | car,bike,van,truck,bus,rickshaw,motorbike,scooter,cycle,taxi,tractor,loader,pickup | Rickshaw,Scooter,Pickup,Taxi,Bus
car_services | oil,tyres,papers,wash,brakes,battery,other,service,fuel,parking,insurance,repairs,filter,tuning | Brakes,Battery,Filter,Insurance,Tuning
car_costs | fuel,service,repairs,insurance,parking,tolls,tyres,wash,tax,fines | Tolls,Tyres,Tax,Fines,Wash
tyre_positions | front left,front right,rear left,rear right,spare | Spare
telecom | jazz,zong,telenor,ufone,sco,scom,onic | Onic,Sco
currencies | pkr,usd,eur,gbp,aed,sar,cad,aud,inr,try,cny | Aed,Sar,Gbp,Eur,Cad
languages | english,urdu,punjabi,pashto,sindhi,balochi,arabic,hindi,french,spanish,german,chinese,turkish,persian,saraiki,brahui | Pashto,Sindhi,Balochi,Arabic,Saraiki,Turkish
pet_animals | cat,dog,bird,fish,rabbit,hen,goat,cow,buffalo,sheep,horse,parrot,hamster,turtle,duck,quail,donkey,camel | Rabbit,Parrot,Hamster,Turtle,Goat
livestock | cow,buffalo,goat,sheep,hen,duck,quail,camel,horse,donkey,bull,calf | Camel,Sheep,Duck,Quail,Calf
goat_stock | doe,buck,kid,ewe,ram,lamb,heifer,bull,calf | Kid,Lamb,Calf,Ewe,Ram
pet_costs | food,vet,toys,grooming,other,medicine,vaccine,sitter,bedding | Medicine,Vaccine,Bedding,Sitter
crops | wheat,rice,maize,cotton,sugarcane,potato,onion,tomato,garlic,mustard,sunflower,barley,corn,basmati | Sugarcane,Barley,Mustard,Sunflower,Corn
vegetables | tomato,chilli,okra,spinach,mint,onion,potato,garlic,carrot,cauliflower,peas,cabbage,brinjal,coriander,radish,turnip,cucumber | Carrot,Cauliflower,Peas,Cabbage,Radish,Cucumber
fruits | apple,banana,orange,mango,grapes,guava,melon,pomegranate,peach,pear,lemon,dates,strawberry,watermelon | Guava,Pomegranate,Peach,Pear,Lemon,Watermelon
rice_kinds | basmati,sella,irri,broken,brown,steamed,parboiled | Brown,Steamed,Parboiled
farm_tasks | sow,water,weed,harvest,other,spray,fertilise,plough,prune,irrigate,thin,transplant | Spray,Fertilise,Plough,Irrigate,Transplant
plant_care | water,feed,prune,repot,mist,rotate,clean,spray,trim,fertilise | Mist,Rotate,Trim,Fertilise
plant_places | kitchen,balcony,lounge,bedroom,garden,lawn,roof,terrace,window,office,patio,porch | Terrace,Patio,Porch,Roof
rooms | kitchen,bedroom,living room,bathroom,garage,lounge,study,balcony,lawn,store,hall,drawing room,dining room,laundry,attic,basement,terrace | Study,Balcony,Garage,Store,Laundry,Dining room
chores | cook,clean,wash,iron,sweep,mop,dishes,laundry,shopping,trash,garden,dust,vacuum,tidy | Dust,Tidy,Vacuum,Dishes,Trash
laundry_kinds | whites,colours,colors,delicates,bedding,towels,darks,woollens,uniform,jeans | Woollens,Uniform,Jeans,Darks
laundry_states | washing,ironing,ready,delivered,dirty,wet,dry,folded,pressed,collected,packed | Folded,Pressed,Collected
order_status | new,packed,shipped,delivered,ordered,baking,ready,collected,returned,cancelled,pending,out,received,confirmed,paid,processing,dispatched,refunded | Cancelled,Returned,Confirmed,Processing,Dispatched,Refunded
repair_stages | received,fixing,ready,collected,waiting,diagnosing,waiting part,waiting parts,open,fixed,handed over,cutting,stitching,in progress | Diagnosing,Waiting part,Handed over
tailor_stages | measured,cutting,stitching,finishing,ready,delivered,trial,pressed,ordered | Trial,Finishing,Pressed,Measured
delivery | out,delivered,returned,pending,sent,received,lent,borrowed,collected,failed,delayed | Delayed,Failed,Collected
loan_dirs | lent,borrowed,returned,gave,got,paid back,paid for,took,repaid,advance,owed | Returned,Repaid,Advance
money_dirs | gave,got,spent,earned,in,out,income,expense,credit,debit,paid,received,deposit,withdraw | Deposit,Withdraw,Credit,Debit
paid_states | paid,due,unpaid,pending,partial,overdue,bill,fee,waived,late | Overdue,Partial,Waived,Late
yes_no | yes,no,maybe,waiting,pending,probably,not sure | Maybe,Probably,Not sure
approval | approved,rejected,pending,waiting,declined,on hold,draft,review | On hold,Declined,Review
sport_result | win,draw,loss,won,lost,tie,no result,abandoned,walkover | Tie,No result,Abandoned
cricket_runs | dot,single,two,three,four,six,wide,no ball,wicket,bye,leg bye,out | Wide,No ball,Wicket,Bye,Leg bye
ball_sports | cricket,football,hockey,badminton,tennis,volleyball,basketball,squash,kabaddi,table tennis,baseball | Kabaddi,Squash,Volleyball,Basketball,Badminton
board_games | ludo,carrom,chess,monopoly,uno,cards,scrabble,checkers,snakes,backgammon,rummy,bridge,poker | Rummy,Bridge,Scrabble,Carrom,Uno
card_suits | hearts,spades,clubs,diamonds | Joker
quarters | q1,q2,q3,q4,term1,term2,term3,term 1,term 2,term 3,semester 1,semester 2 | Term 4,Semester 3
class_levels | class 6,class 7,class 8,class 9,class 10,class 5,class 4,class 3,class 2,class 1,grade 1,grade 2,grade 3,grade 4,grade 5,grade 6,grade 7,grade 8,class 11,class 12 | Class 11,Class 12,Class 10,Class 5
grades_letter | a,b,c,d,f,e,a plus,b plus | E,A plus,B plus
letters_seq | a,b,c,d,e,f,g,h | C,D,E,F
attendance | present,late,absent,leave,excused,half day,holiday,sick,off | Excused,Half day,Holiday,Sick,Leave
leave_types | casual,sick,annual,unpaid,maternity,paternity,study,emergency,compassionate | Emergency,Study,Unpaid,Maternity
pay_rates | normal,overtime,time and half,double,holiday,night,weekend,bonus | Holiday,Night,Weekend,Bonus
shift_names | day,evening,night,morning,afternoon,early,late,split,weekend | Early,Late,Split,Weekend
work_places | home,work,other,office,school,mosque,gym,shop,market,outside,travel,campus,site,hospital | Office,School,Market,Gym,Site
home_away | home,away,neutral,away match,home match | Neutral
locations_errand | bank,post,shop,other,market,pharmacy,school,hospital,mall,bakery,petrol pump,post office | Pharmacy,Market,Bakery,Hospital,Mall
trip_costs | hotel,food,transport,tickets,shopping,fuel,tolls,fees,guide,tips,souvenirs,visa,activities | Tips,Souvenirs,Fuel,Tolls,Activities,Guide
trip_lists | clothes,toiletries,documents,gadgets,medicine,snacks,shoes,bags,cash,chargers,books | Shoes,Snacks,Chargers,Books,Medicine
packing_boxes | pack,utilities,paperwork,clean,kitchen,books,clothes,fragile,electronics,bedroom,garage,movers | Fragile,Electronics,Movers
wedding_costs | venue,food,clothes,photos,jewellery,cards,catering,decor,music,gifts,makeup,transport,dowry,mehndi,barat,valima | Decor,Music,Makeup,Mehndi,Gifts,Transport
wedding_sides | bride,groom,friends,family,both,cousins,neighbours,colleagues | Cousins,Neighbours,Colleagues,Family
event_kinds | birthday,anniversary,wedding,eid,party,funeral,aqiqah,graduation,engagement,reunion,meeting,exam | Graduation,Engagement,Reunion,Eid,Aqiqah
gift_kinds | clothes,toys,books,cash,sweets,jewellery,tech,home,flowers,perfume,shoes,watch,gadgets | Flowers,Perfume,Shoes,Sweets,Watch
shopping_kinds | shopping,cooking,gifts,clothes,groceries,decor,household,tech,books,toys,packing,wishes,shoes,beauty,gadgets | Shoes,Beauty,Groceries,Books,Toys,Decor
shop_cats_clothes | clothes,shoes,gadgets,beauty,gifts,bags,watches,jewellery,perfume | Bags,Watches,Perfume,Jewellery
screen_apps | instagram,youtube,whatsapp,games,other,tiktok,facebook,twitter,snapchat,netflix,reddit,telegram,browser,messages | Tiktok,Facebook,Netflix,Reddit,Telegram,Snapchat
screen_kinds | games,videos,social,reading,study,work,calls,chat,tv,browsing | Calls,Browsing,Study,Chat
time_use | work,family,prayer,sleep,study,phone,fun,exercise,commute,chores,reading,rest,travel,meals,errands | Commute,Errands,Reading,Meals,Exercise,Rest
sleep_factors | stress,sleep,food,screen,weather,unknown,caffeine,noise,exercise,pain,heat,late meal,light | Caffeine,Noise,Heat,Late meal
habit_triggers | stress,boredom,hunger,tired,anger,social,habit,craving,loneliness,after meals,coffee | Craving,Loneliness,After meals,Coffee
meditation | breath,body scan,walking,silent,guided,mantra,gratitude,loving kindness,visualisation | Mantra,Gratitude,Guided,Visualisation
sleep_quality | poor,fair,good,great,bad,okay,restless,deep,light,broken | Restless,Deep,Broken
energy_levels | low,medium,high,tired,normal,great,drained,okay,fine | Drained,Okay
vaccines | polio,bcg,measles,hepatitis,mmr,dpt,typhoid,pcv,rota,tetanus,hpv,flu,covid | Typhoid,Tetanus,Flu,Hpv,Rota
blood_tests | fasting,after meal,random,bedtime,before meal,post meal | Random,Post meal,Before meal
feeds | breast,bottle,formula,solid,water,milk,puree,snack | Solid,Puree,Snack,Water
diaper_kinds | wet,dirty,both,dry,leak | Dry,Leak
baby_items | diapers,milk,medicine,clothes,toys,wipes,formula,cream,bottles,food | Wipes,Cream,Bottles,Formula
films | action,comedy,drama,horror,family,other,romance,thriller,sci fi,documentary,animation,musical,history,crime | Romance,Thriller,Sci fi,Documentary,Animation
music_genres | pop,rock,jazz,classical,qawwali,ghazal,folk,hip hop,sufi,naat,rap,country,blues | Sufi,Naat,Folk,Blues
book_genres | fiction,fantasy,history,science,biography,poetry,romance,mystery,self help,religion,children,comics,novel,thriller,business | Poetry,Biography,Mystery,Comics,Self help,Business
book_states | want,reading,done,watched,paused,dropped,finished,to read,wishlist,abandoned,reread,owned | Dropped,Paused,Wishlist,Owned
media_states | want,watching,watched,dropped,paused,finished,planned,on hold,seen,rewatch | Dropped,Paused,Rewatch,Planned
content_kinds | reel,post,story,video,short,carousel,live,blog,podcast,thread,article | Story,Carousel,Live,Podcast,Thread
content_pipeline | idea,recorded,edited,published,scripted,draft,planned,posted,scheduled,filmed | Scheduled,Scripted,Posted
feedback_kinds | bug,idea,praise,question,complaint,request,other,suggestion,compliment | Question,Complaint,Suggestion
bug_severity | patch,minor,major,critical,blocker,trivial,cosmetic | Blocker,Trivial,Cosmetic
environments | dev,staging,prod,test,qa,local,production,uat,beta,demo | Test,Qa,Beta,Local
test_results | untested,pass,fail,skipped,blocked,flaky,passed,failed | Skipped,Blocked,Flaky
traffic_light | red,amber,green,yellow,orange | Yellow,Orange
colour_names | red,blue,green,yellow,orange,purple,pink,black,white,grey,gray,brown,teal,navy,maroon,beige,gold,silver | Green,Yellow,Orange,Purple,Pink,White,Grey
paint_finishes | plain,tinted,frosted,mirror,matte,gloss,satin,textured,glossy | Matte,Gloss,Satin,Textured
paper_kinds | paper,iron,plastic,copper,tin,aluminium,steel,brass,glass,cardboard,rubber,lead,zinc,battery | Brass,Steel,Glass,Cardboard,Rubber,Lead
metals | iron,copper,aluminium,steel,brass,tin,lead,zinc,silver,gold,bronze | Steel,Brass,Zinc,Bronze,Lead
gold_karats | k24,k22,k21,k18,k14,k10 | K14,K10
gold_items | ring,chain,bangle,necklace,earrings,bracelet,set,pendant,bar,coin,anklet,nosepin | Bracelet,Pendant,Anklet,Coin
jewellery_metals | gold,silver,platinum,diamond,pearl,copper,brass | Platinum,Pearl,Diamond
condition_grades | mint,used,damaged,new,good,fair,poor,worn,refurbished,broken,like new | Fair,Refurbished,Like new,Worn
bike_parts | chain,tyres,brakes,gears,seat,lights,pedals,bell,handlebar,wheel,tube | Pedals,Handlebar,Tube,Bell,Lights
home_repair | labour,material,furniture,paint,electric,plumbing,tiles,windows,doors,cement,sand,steel,bricks,woodwork | Plumbing,Tiles,Cement,Woodwork,Windows
tools_kinds | drill,saw,hammer,wrench,pliers,screwdriver,level,tape,sander,ladder | Sander,Ladder,Level,Tape
repair_issues | screen,battery,charging port,software,water,speaker,camera,mic,keyboard,motherboard,button,back glass | Camera,Speaker,Mic,Back glass,Keyboard
laptop_issues | screen,battery,keyboard,software,fan,charger,hinge,ram,hard disk,virus | Fan,Charger,Hinge,Virus
cobbler_jobs | sole,stitching,polish,zip,heel,buckle,strap,lace,patch,glue | Buckle,Strap,Lace,Patch,Glue
tailor_items | shirt,trouser,shalwar,kameez,suit,coat,waistcoat,dupatta,abaya,frock,uniform,sherwani,kurta,pant | Kurta,Waistcoat,Sherwani,Frock,Dupatta
food_dishes | biryani,karahi,pizza,burger,pulao,nihari,haleem,qorma,kebab,pasta,sandwich,fries,roll,pakora,samosa,chaat,daal,sabzi,paratha,halwa | Haleem,Kebab,Chaat,Pakora,Samosa,Paratha
voting_dishes | pizza,burger,biryani,karahi,pasta,shawarma,pulao,nihari,sushi,steak | Shawarma,Pasta,Pulao,Nihari
drinks | tea,coffee,chai,juice,water,milk,lassi,soda,shake,smoothie,cola,sharbat,lemonade,green tea | Lassi,Sharbat,Lemonade,Smoothie,Green tea,Juice
tea_kinds | doodh patti,kadak,green tea,karak,sulaimani,kashmiri,black tea,masala,lemon tea,herbal | Kashmiri,Lemon tea,Masala,Herbal,Black tea
cafe_items | tea,snack,ride,other,coffee,juice,lunch,fries,burger,sandwich,cake | Juice,Cake,Sandwich
meats | beef,mutton,chicken,fish,liver,lamb,goat,prawn,eggs,turkey,keema,kaleji | Fish,Liver,Prawn,Keema,Turkey
dairy | milk,yoghurt,yogurt,butter,cheese,cream,ghee,lassi,eggs,paneer,dahi | Cream,Ghee,Paneer,Cheese,Yoghurt
grains | wheat,rice,flour,sugar,butter,milk,lentils,daal,oil,salt,maize,barley,gram,chickpeas,beans | Lentils,Chickpeas,Oil,Salt,Beans
baking_items | bread,rusk,cake,cookies,naan,pastry,biscuits,buns,pie,donut,muffin,cupcake,brownie | Pastry,Buns,Donut,Muffin,Brownie
kitchen_items | flour,sugar,butter,rice,milk,eggs,oil,salt,spices,tea,coffee,yeast | Yeast,Salt,Spices,Eggs
spices | salt,pepper,cumin,turmeric,chilli,coriander,garam masala,cardamom,cloves,cinnamon,ginger,garlic,saffron | Cardamom,Cloves,Cinnamon,Saffron,Ginger
units_weight | g,kg,mg,lb,oz,gram,grams,kilo,ton,pound | Oz,Lb,Mg
units_volume | ml,l,litre,litres,cup,cups,tsp,tbsp,pcs,pieces,glass,glasses,spoon,pinch,bowl | Cup,Tbsp,Pinch,Glass,Bowl
units_length | m,cm,mm,km,ft,feet,inch,inches,yard,mile,metre | Yard,Mile,Inch
units_time | seconds,minutes,hours,days,weeks,months,years | Weeks,Months
frequencies | daily,weekly,rare,monthly,yearly,quarterly,fortnightly,hourly,once,often,sometimes,never,occasionally,twice a day,weekdays | Quarterly,Fortnightly,Occasionally
billing_cycles | monthly,yearly,quarterly,weekly,annual,one time,half yearly,fortnightly | Quarterly,Weekly,One time,Half yearly
subscriptions | netflix,spotify,youtube,prime,disney,icloud,gym,internet,phone,hosting,software,magazine,news | Disney,Icloud,Hosting,Magazine
bank_kinds | bank,post,shop,other,loan,savings,current,credit card,mortgage,insurance,committee | Loan,Savings,Credit card,Insurance
contact_kinds | client,supplier,bank,other,friend,family,colleague,vendor,staff,neighbour,landlord,partner | Vendor,Colleague,Landlord,Partner,Staff
family_members | mum,dad,sister,brother,wife,husband,son,daughter,grandma,grandpa,uncle,aunt,cousin,mother,father,me | Cousin,Uncle,Aunt,Grandma,Grandpa
relations_pair | mum,dad,son,daughter,wife,husband,sister,brother,mother,father | Grandma,Grandpa,Uncle,Aunt
people_roles | teacher,student,parent,principal,tutor,driver,cook,maid,guard,manager,worker,intern,volunteer,member,leader | Tutor,Volunteer,Intern,Driver,Guard
team_roles | dev,design,qa,pm,lead,support,ops,sales,marketing,finance,hr,intern,manager | Qa,Support,Ops,Marketing,Finance
project_stages | idea,planning,building,testing,launch,live,done,paused,design,research,review,shipped,maintenance | Research,Maintenance,Paused,Review
house_stages | foundation,walls,roof,plaster,electric,plumbing,tiles,paint,finishing,woodwork,flooring,boundary,grey structure | Flooring,Boundary,Woodwork,Tiles
building_stages | design,approval,excavation,foundation,columns,slab,brickwork,plaster,finishing,handover | Approval,Excavation,Handover
visit_kinds | visit,call,message,email,meeting,follow up,demo,quote,site visit,delivery | Demo,Quote,Follow up,Email,Delivery
call_outcomes | answered,no answer,busy,voicemail,wrong number,callback,interested,not interested | Busy,Voicemail,Callback,Wrong number
lead_stages | new,contacted,replied,quoted,won,lost,negotiating,lead,qualified,follow up,proposal | Qualified,Negotiating,Proposal,Follow up
sale_channels | shop,online,walk in,phone,whatsapp,instagram,facebook,delivery,daraz,market,wholesale | Wholesale,Daraz,Phone,Whatsapp
donation_kinds | zakat,sadaqah,fitrana,fidya,kaffara,khums,tithe,offering,building,charity,fund,gift | Fitrana,Fidya,Sadaqah,Kaffara
islamic_months | muharram,safar,rabi ul awwal,rajab,shaban,ramadan,shawwal,dhul hijjah,dhul qadah | Rajab,Shaban,Ramadan
fasting_kinds | ramadan,monday,thursday,white days,shawwal,qaza,nafl,ashura,arafah | Qaza,Nafl,Ashura,Arafah
good_deeds | sadaqah,dua,quran,dhikr,charity,help,smile,visit sick,teach,forgive,tahajjud,prayer | Dua,Dhikr,Charity,Teach
reading_kinds | quran,hadith,tafseer,islamic,novel,news,study,fiction,article,textbook,poetry | Hadith,Tafseer,Poetry,Textbook
mistakes_kinds | tajweed,memory,pronunciation,pauses,stumbles,forgot,wrong word,speed | Pauses,Pronunciation,Speed
zakat_assets | gold,silver,cash,savings,business,property,shares,stock,loans,bank,investments | Shares,Property,Investments
fuel_kinds | petrol,diesel,cng,lpg,octane,electric,hi octane | Octane,Lpg,Electric
petrol_pumps | shell,pso,total,attock,hascol,caltex,byco,gas,go | Byco,Hascol,Attock
cities | lahore,karachi,islamabad,peshawar,quetta,multan,faisalabad,rawalpindi,hyderabad,sialkot,gujranwala,murree,abbottabad,sukkur,bahawalpur | Multan,Faisalabad,Sialkot,Hyderabad,Sukkur
provinces | punjab,sindh,balochistan,kpk,gilgit,ajk,islamabad,fata,gb,khyber pakhtunkhwa | Gilgit,Ajk,Islamabad
sectors_isb | e7,f6,f7,f8,g6,g7,g9,g10,g11,i8,i9,i10,h8,h9,f10 | G11,I8,H8
bus_routes | route 1,route 2,route 3,north,south,east,west,orange,blue,green,red,express,feeder | Route 3,Express,Feeder
transport_kinds | bus,metro,rickshaw,taxi,uber,careem,bike,walk,car,train,van,flight,ride,pool | Metro,Train,Careem,Uber,Flight
train_classes | economy,business,ac,sleeper,first,standard,parlour,ac standard | Business,Parlour,First
rooms_hotel | single,double,triple,suite,family,deluxe,twin,standard,dorm | Suite,Deluxe,Twin,Triple
ticket_kinds | adult,child,senior,student,family,vip,general,vvip,group,early bird | Senior,Family,Vip,Early bird,Group
membership | basic,standard,premium,gold,silver,bronze,free,pro,plus,family,student,vip | Plus,Pro,Student,Family
plan_tiers | free,basic,pro,standard,premium,enterprise,starter,team,plus,business | Starter,Team,Business,Enterprise
rating_words | poor,fair,good,great,excellent,bad,okay,average,terrible,amazing,superb | Excellent,Average,Superb
feelings_day | good day,bad day,okay,great,rough,busy,calm,productive,lazy,tired | Productive,Lazy,Rough,Busy
decision_states | yes,no,maybe,later,skip,done,sold,bought,waiting,hold,want,skipped | Hold,Later
want_states | waiting,bought,skipped,want,gifted,returned,saved,sold,ordered | Gifted,Ordered,Returned
borrow_states | lent,returned,borrowed,lost,damaged,pending,overdue | Damaged,Lost,Overdue
inspect_states | clean,dirty,ok,broken,missing,damaged,fine,needs repair,good,poor,worn | Missing,Needs repair,Worn
chore_status | pending,done,skipped,late,in progress,missed,partial,paused | Partial,Late,Paused
habit_status | done,missed,skipped,partial,rest,sick,travel,late,pending | Rest,Sick,Travel,Partial
grade_levels | beginner,intermediate,advanced,expert,novice,basic,pro,master | Expert,Master,Novice
cooking_methods | boil,fry,bake,grill,steam,roast,saute,stew,slow cook,microwave,air fry,deep fry | Steam,Roast,Stew,Air fry,Microwave
cook_levels | raw,rare,medium,well done,burnt,undercooked,perfect,overcooked,crispy,soft | Crispy,Undercooked,Overcooked
taste_notes | sweet,salty,sour,bitter,spicy,mild,bland,rich,tangy,smoky | Tangy,Smoky,Bland
bread_kinds | naan,roti,paratha,chapati,bread,puri,kulcha,bun,rusk,sheermal,tandoori roti | Kulcha,Puri,Sheermal,Chapati
fish_kinds | rahu,tilapia,catfish,trout,pomfret,prawn,salmon,tuna,sole,hilsa | Trout,Pomfret,Salmon,Tuna
egg_kinds | brown,white,desi,farm,organic,duck,quail,boiled,fried,omelette | Organic,Duck,Quail,Desi
milk_kinds | cow,buffalo,goat,camel,full cream,skimmed,powder,tetra,fresh,raw | Camel,Skimmed,Powder
water_sources | tap,tanker,filter,bottle,well,borewell,rain,boiled,mineral,ro | Rain,Well,Mineral,Boiled
power_sources | wapda,solar,generator,ups,battery,k electric,iesco,lesco,gas,inverter | Inverter,Ups,Generator
appliance_kinds | fan,ac,fridge,tv,washing machine,iron,heater,geyser,microwave,oven,cooler,freezer,oven | Geyser,Cooler,Freezer,Heater,Microwave
phone_brands | samsung,iphone,oppo,vivo,infinix,tecno,xiaomi,huawei,realme,nokia,oneplus,motorola | Realme,Oneplus,Nokia,Motorola
computer_parts | cpu,ram,ssd,hdd,gpu,monitor,keyboard,mouse,psu,case,motherboard,fan,cooler | Gpu,Psu,Monitor,Mouse,Case
file_kinds | pdf,doc,image,video,audio,sheet,slide,zip,photo,text,form,receipt,contract,letter | Receipt,Contract,Letter,Zip
doc_kinds | cnic,passport,licence,bform,degree,transcript,contract,receipt,policy,warranty,visa,tax return,deed | Warranty,Visa,Policy,Deed,Tax return
key_kinds | door,car,padlock,cabinet,remote,gate,bike,office,safe,locker,drawer,garage | Gate,Safe,Locker,Garage
borrowed_items | book,tool,money,clothes,charger,umbrella,bike,car,laptop,phone,pen,dvd,game | Umbrella,Charger,Laptop,Game
lesson_parts | warm up,main,practice,review,quiz,homework,starter,plenary,intro,recap,activity,reading | Plenary,Starter,Recap,Activity
reading_levels | red,blue,green,orange,yellow,easy,medium,hard,level 1,level 2,level 3,a,b,c | Green,Orange,Level 3
tajweed_rules | idgham,ikhfa,izhar,iqlab,madd,qalqalah,ghunna,waqf | Ghunna,Qalqalah,Waqf
mood_scales | very low,low,ok,good,very good,bad,fine,great | Very good,Very low
pain_scales | none,mild,moderate,severe,worst,slight,intense | Worst,Intense
blood_pressure_time | morning,evening,night,before meds,after meds,noon,after walk,after exercise | After walk,After meds,Before meds
meal_quality | healthy,okay,junk,heavy,light,skipped,cheat,late,home cooked,outside | Home cooked,Outside,Late,Skipped
sleep_places | bed,sofa,car,floor,mat,hotel,hospital,bus,train,chair | Hotel,Floor,Chair
rain_kinds | drizzle,shower,heavy,storm,hail,thunder,mist | Hail,Thunder,Mist
game_modes | easy,normal,hard,endless,timed,practice,versus,solo,team,story,arcade | Endless,Timed,Versus,Arcade
game_results | win,loss,draw,forfeit,abandoned,pending,won,lost | Forfeit,Pending
chess_openings | e4,d4,c4,nf3,english,sicilian,french,caro kann,london,italian | Italian,London
scout_badges | camping,first aid,cooking,hiking,knots,swimming,signalling,fire lighting,map reading | Knots,Signalling,Map reading
exam_types | quiz,test,midterm,final,mock,assignment,oral,practical,project,viva | Practical,Oral,Mock,Viva
fee_kinds | tuition,admission,exam,transport,uniform,books,hostel,lab,sports,library,annual,monthly | Hostel,Lab,Library,Annual
class_sections | a,b,c,d,red,blue,green,rose,jasmine,lily,boys,girls | Jasmine,Lily
dental | cleaning,filling,extraction,checkup,braces,whitening,root canal,crown,xray,scaling | Whitening,Root canal,Crown,Scaling
doctors | gp,dentist,eye,skin,child,heart,bone,ent,gynae,physio,neuro,lab,pharmacy | Physio,Ent,Skin,Eye,Heart
lab_tests | cbc,sugar,cholesterol,thyroid,urine,xray,ecg,mri,ultrasound,lft,rft,vitamin d | Thyroid,Ecg,Mri,Ultrasound,Vitamin d
snack_kinds | chips,biscuits,nuts,fruit,sweets,chocolate,popcorn,samosa,pakora,fries,candy,cake,ice cream | Popcorn,Candy,Ice cream,Nuts,Chocolate
sweet_kinds | gulab jamun,jalebi,barfi,ladoo,halwa,kheer,rasmalai,falooda,kulfi,gajar halwa,sheer khurma,zarda | Rasmalai,Kulfi,Falooda,Kheer
ice_cream | vanilla,chocolate,strawberry,mango,pistachio,kulfi,caramel,mint,butterscotch,coffee | Pistachio,Caramel,Butterscotch,Mint
pizza_toppings | cheese,chicken,tikka,beef,veg,mushroom,olives,pepperoni,fajita,bbq,corn,onion | Mushroom,Olives,Pepperoni,Corn
burger_kinds | zinger,beef,chicken,veg,cheese,double,smash,patty,crispy,grilled | Smash,Grilled,Crispy
printing_kinds | photocopy,print,scan,lamination,binding,colour print,black white,spiral,poster | Binding,Lamination,Poster,Spiral
banner_kinds | flex,sticker,card,brochure,poster,standee,letterhead,visiting card,flyer,banner | Flyer,Standee,Letterhead,Brochure
cleaning_kinds | floor,bathroom,kitchen,windows,dusting,laundry,fridge,carpet,sofa,garden,car | Windows,Fridge,Carpet,Sofa
garden_zones | front,back,roof,lawn,pots,beds,nursery,greenhouse,balcony,side | Greenhouse,Nursery,Side
bird_kinds | hen,duck,quail,pigeon,parrot,turkey,goose,rooster,peacock,finch,cockatiel | Turkey,Goose,Pigeon,Finch
bee_tasks | inspect,feed,harvest,split,treat,requeen,add super,clean | Requeen,Add super,Treat
vote_options | yes,no,abstain,maybe,not sure,skip | Abstain,Skip
poll_options | option a,option b,option c,option 1,option 2,option 3,first,second,third | Option 4,Option D
`;

export const FAMILIES = RAW.trim().split('\n').map(l => {
  const [id, mem, add] = l.split('|').map(x => x.trim());
  return { id, members: new Set(mem.split(',').map(x => x.trim().toLowerCase())), adds: add.split(',').map(x => x.trim()).filter(Boolean) };
});

export const normOpt = o => o.toLowerCase().replace(/_/g, ' ').trim();
export const optWord = a => a.replace(/ +/g, '_');

// best family for a list of option words, or null
export function familyFor(options) {
  const have = options.map(normOpt);
  let best = null;
  for (const f of FAMILIES) {
    const hit = have.filter(o => f.members.has(o)).length;
    if (hit < 2 || hit < 0.6 * have.length) continue;
    const adds = f.adds.filter(a => !have.includes(normOpt(a.replace(/ +/g, '_'))));
    const exist = f.adds.filter(a => have.includes(normOpt(a.replace(/ +/g, '_'))));
    if (!adds.length && !exist.length) continue;
    const score = hit / have.length + hit / 100 - f.members.size / 100000;
    if (!best || score > best.score) best = { family: f, adds: adds.map(optWord), exist: exist.map(optWord), score };
  }
  return best;
}
