// Domain tables. Each row is a compact string, parsed below.
const rows = s => s.trim().split('\n').map(l => l.split('|').map(x => x.trim()));

// QUANTITY: app|icon|table|field|unit|range|quick|goal|trk|ent|wish|kind(num|money)|limit(0|1)
export const Q = rows(`
Water|drop|drink|ml|ml|1..5000|250,500,750|2000|my water intake|a drink|I never drink enough water|num|0
Coffee|coffee|coffee|cups|cups|1..10|1,2|3|my coffee|a cup of coffee|I think I drink too much coffee|num|1
Tea|cup|tea|cups|cups|1..15|1,2|4|how much tea I drink|a cup of tea|I want to keep an eye on my chai|num|1
Steps|walk|walk|steps|steps|100..100000|1000,2000,5000|8000|my daily steps|a walk|I want to walk more every day|num|0
Pages|book|read|pages|pages|1..1000|5,10,20|30|the pages I read|a reading session|I want to read more|num|0
Push-ups|dumbbell|set|reps|reps|1..300|10,20,30|100|my push-ups|a set|I want to get stronger|num|0
Savings|coin|deposit|amount|PKR|10..1000000|500,1000,5000|50000|the money I save|a deposit|I want to save more money|money|0
Study|clock|session|mins|min|5..600|25,45,60|120|my study time|a study session|I need to study more regularly|num|0
Running|run|run|km|km|0.1..100|3,5,10|20|my runs|a run|I just started running|num|0
Cycling|bike|ride|km|km|0.5..200|5,10,20|50|my bike rides|a ride|I cycle to work and want to count it|num|0
Swim laps|drop|swim|laps|laps|1..100|4,8,16|20|my swimming laps|a swim|I swim a few times a week|num|0
Meditation|moon|sit|mins|min|1..180|5,10,20|20|my meditation|a sit|I want a calmer mind|num|0
Fruit|apple|fruit|servings|servings|1..10|1,2|5|my fruit servings|a serving|I should eat more fruit|num|0
Greens|leaf|veg|servings|servings|1..10|1,2|4|the vegetables I eat|a plate of veg|my kids eat no vegetables, help|num|0
Protein|food|meal|grams|g|1..300|20,30,50|120|my protein|a meal|I am trying to build muscle|num|0
Calories|food|bite|kcal|kcal|10..3000|100,250,500|2000|my calories|a meal|I am trying to lose a bit of weight|num|1
Milk|milk|milk|glasses|glasses|1..6|1,2|2|how much milk I drink|a glass|I want to drink more milk|num|0
Cigarettes|fire|smoke|count|cigs|1..20|1,2|5|the cigarettes I smoke|a cigarette|I want to smoke less|num|1
Screen time|phone|screen|mins|min|1..600|15,30,60|120|my phone time|a scroll session|I waste too much time on my phone|num|1
Piano|music|practice|mins|min|5..300|15,30,45|45|my piano practice|a practice|I keep skipping piano practice|num|0
Guitar|music|jam|mins|min|5..300|15,30,60|30|my guitar practice|a jam|I want to get better at guitar|num|0
Spanish|book|lesson|mins|min|5..240|10,20,30|20|my Spanish practice|a lesson|I am learning Spanish|num|0
Yoga|plant|class|mins|min|5..180|10,20,30|30|my yoga|a session|I want to do yoga daily|num|0
Coding|clock|code|hours|h|0.5..16|1,2,4|4|my coding hours|a session|I want to code every day|num|0
Volunteering|users|shift|hours|h|0.5..24|1,2,4|10|my volunteer hours|a shift|I do volunteer work and need hours for my record|num|0
Fuel|car|refuel|litres|L|1..120|10,20,40|0|my fuel|a fill-up|my petrol bill is out of control|num|1
Plant water|plant|water|ml|ml|10..2000|100,250,500|500|watering my plants|a watering|I keep killing my plants|num|0
Baby milk|baby|feed|ml|ml|10..300|60,90,120|700|my baby's milk|a feed|I am a new mom and forget the feeds|num|0
Dog walks|paw|stroll|mins|min|5..180|15,30,45|60|my dog's walks|a walk|my dog needs more walks|num|0
Writing|pen|page|words|words|50..10000|100,250,500|500|my daily writing|a writing session|I want to write every day|num|0
Drawing|pencil|sketch|mins|min|5..300|15,30,60|30|my drawing time|a sketch session|I want to draw more|num|0
Vitamins|pill|dose|count|pills|1..10|1,2|2|my vitamins|a dose|I forget to take my vitamins|num|0
Stairs|run|climb|floors|floors|1..100|5,10,20|30|the stairs I climb|a climb|I want to skip the lift more|num|0
Chores|home|clean|mins|min|5..240|15,30,60|45|my house cleaning time|a cleaning session|the house is always a mess|num|0
Charity|gift|donation|amount|PKR|10..1000000|100,500,1000|5000|my charity|a donation|I want to give sadaqah regularly|money|0
Pocket money|coin|saved|amount|PKR|10..100000|50,100,500|1000|my kids' pocket money|a saving|my son should learn to save|money|0
Daily spend|wallet|spent|amount|PKR|10..1000000|100,500,1000|2000|my daily spending|a purchase|I overspend every day|money|1
Sugar|cup|sweet|spoons|tsp|1..20|1,2|6|the sugar I eat|a sweet|I eat way too much sugar|num|1
Sit-ups|dumbbell|crunch|reps|reps|1..500|10,25,50|100|my sit-ups|a set|I want abs by summer|num|0
Walking|walk|stroll|km|km|0.1..50|1,2,5|5|my walks|a walk|I walk after dinner and want to log it|num|0
Gym time|dumbbell|workout|mins|min|10..240|30,45,60|180|my gym time|a workout|I keep missing the gym|num|0
Quran|book|recite|pages|pages|1..100|1,2,5|5|my Quran reading|a recitation|I want to finish the Quran this Ramadan|num|0
Jump rope|bolt|skip|reps|reps|10..2000|100,200,500|500|my skipping|a round|I jump rope to lose weight|num|0
Reading time|book|sit_read|mins|min|5..300|10,20,30|30|my reading time|a session|I want a reading habit|num|0
Tutoring|school|lesson_given|hours|h|0.5..8|1,1.5,2|10|my tutoring hours|a lesson|I tutor kids and need my hours|num|0
Eggs|egg|egg|count|eggs|1..30|1,2,6|0|the eggs my hens lay|a collection|my hens lay eggs and I lose count|num|0
Milk yield|milk|milking|litres|L|0.5..60|2,5,10|0|the milk from my buffalo|a milking|we sell milk and I need records|num|0
Rainfall|rain|rain|mm|mm|1..500|5,10,25|0|the rainfall at my farm|a rain|farmers need to know the rain|num|0
Overhead press|dumbbell|press|reps|reps|1..100|5,8,10|60|my overhead presses|a set|I want to press my bodyweight|num|0
Lunges|run|lunge|reps|reps|1..100|10,20|60|my lunges|a set|my legs are weak|num|0
Rosary|beads|tasbeeh|count|times|1..1000|33,100|100|my dhikr|a round|I want a dhikr habit|num|0
Homework|pencil|hw|pages|pages|1..50|1,2,5|10|my homework pages|a session|I always leave homework to the last minute|num|0
`);

// COUNT-ONLY LOG: app|icon|table|trk|ent|wish|goalPerWeek|limit
export const B = rows(`
Gym visits|dumbbell|gym|my gym visits|a visit|I want to go to the gym more|3|0
Zikr|beads|zikr|my zikr|a round|I want to remember Allah more|0|0
Headaches|pill|headache|my headaches|a headache|I get headaches and the doctor wants a record|0|1
Cold showers|drop|shower|my cold showers|a shower|I am trying cold showers|5|0
Walks|walk|walk|my walks|a walk|I should walk more|4|0
Skipped meals|food|skip|the meals I skip|a skipped meal|I skip meals when I am busy|0|1
Late arrivals|clock|late|my late arrivals|a late day|I keep getting to work late|0|1
Date nights|heart|date|our date nights|a date|we never go out anymore|1|0
Phone-free evenings|phone|detox|my phone-free evenings|an evening|I want to put the phone down|4|0
Home cooked meals|food|cooked|the meals I cook at home|a meal|I eat out too much|5|0
Calls to mom|phone|call|my calls to mom|a call|I forget to call my mother|2|0
Prayers on time|mosque|prayer|my prayers|a prayer|I want to pray on time|35|0
Seizures|pill|seizure|my son's seizures|a seizure|the neurologist asked me to keep a record|0|1
Coffee runs|coffee|run_out|my coffee runs|a run|my office coffee habit costs a lot|0|1
Library visits|book|visit|my library visits|a visit|I want to use the library|1|0
Dentist floss|tooth|floss|my flossing|a floss|my dentist keeps telling me to floss|7|0
Cheat meals|fire|cheat|my cheat meals|a cheat meal|I want to stay on my diet|0|1
Bike commutes|bike|commute|my bike commutes|a ride|I cycle to work|3|0
Sleep before 11|bed|early|the nights I sleep early|a night|I always sleep too late|5|0
Hugs|heart|hug|my hugs|a hug|I want to be more affectionate|0|0
Sketches|pencil|doodle|my sketches|a sketch|I want to draw a bit every day|5|0
Reels posted|phone|post|my posts|a post|I want to post regularly|3|0
Customers served|users|customer|the customers in my shop|a customer|I want to know how busy the shop is|0|0
Birds seen|paw|bird|the birds I spot|a sighting|I am getting into birdwatching|0|0
Goals scored|ball|goal_scored|my goals|a goal|I play football on weekends|0|0
`);

// HABIT CHECKLISTS: app|icon|habitTable|checkTable|trk|starter|wish
export const C = rows(`
Habits|check|habit|check|my daily habits|reading|I want to build good habits
Morning routine|sun|step|stepdone|my morning routine|wake up early|my mornings are chaos
Kids chores|home|chore|chore_done|my kids' chores|make bed|my kids never do their chores
Skincare|star|care|care_done|my skincare routine|cleanser|I keep forgetting my skincare
Prayer times|mosque|namaz|namaz_done|my five prayers|Fajr|I want to be regular in my prayers
Workout week|dumbbell|move|move_done|my workouts|push-ups|I want to work out every day
Study routine|school|subject|subject_done|my study subjects|maths|I need to study every subject daily
Self care|heart|ritual|ritual_done|my self care|journal|I never take time for myself
Pet care|paw|task|task_done|my pet's care|feed the cat|I forget to feed the fish
Plant care|plant|plant|plant_done|watering my plants|fern|my plants are dying
Evening routine|moon|wind|wind_done|my evening routine|no screens|I can't wind down at night
Healthy eating|apple|rule|rule_done|my food rules|no soda|I want to eat healthier
Language practice|book|drill|drill_done|my language practice|flashcards|I never practice my vocabulary
Home cleaning|home|room|room_done|my cleaning rota|kitchen|my wife and I keep fighting about cleaning
Money habits|wallet|money_rule|money_rule_done|my money habits|note spending|I want to be careful with money
Ramadan goals|moon|ibadah|ibadah_done|my Ramadan goals|read Quran|I want a good Ramadan
Baby routine|baby|routine|routine_done|my baby's routine|vitamin D|I can't remember what I gave the baby
Gym stretches|run|stretch|stretch_done|my stretches|hamstrings|my back hurts from sitting
Digital detox|phone|detox_rule|detox_done|my screen rules|no phone at meals|I am addicted to my phone
Gratitude|heart|thanks|thanks_done|my gratitude practice|three good things|I want to be more positive
`);

// EXPENSE: app|icon|table|trk|cats|budgetDefault|currency-ish label|wish
export const D = rows(`
Budget|wallet|spend|my monthly budget|Food|Bills|Travel|Fun|Health|80000|I never know where my salary goes
Groceries|cart|buy|my grocery spending|Veg|Meat|Dairy|Pantry|Snacks|30000|the grocery bill keeps growing
Trip budget|plane|trip_cost|my trip budget|Hotel|Food|Transport|Tickets|Shopping|120000|we are planning a family trip
Household bills|home|bill|our household bills|Electricity|Gas|Water|Internet|Rent|60000|bills pile up every month
Pocket money|coin|pocket|my pocket money|Snacks|Games|Books|Gifts|Other|3000|I am a student and I run out of money
Business costs|bag|cost|my business expenses|Stock|Rent|Staff|Transport|Tax|200000|my shop expenses are all in my head
Wedding|gift|wed_cost|my wedding budget|Venue|Food|Clothes|Photos|Jewellery|1500000|I am planning my sister's wedding
Car costs|car|car_cost|my car costs|Fuel|Service|Repairs|Insurance|Parking|40000|my car is eating my money
Pet costs|paw|pet_cost|my pet's costs|Food|Vet|Toys|Grooming|Other|10000|I just got a puppy
School fees|school|fee|my children's school costs|Fees|Books|Uniform|Transport|Trips|50000|school costs are huge this year
Eating out|food|meal_out|my eating out|Lunch|Dinner|Coffee|Delivery|Treats|15000|I order food too often
Home renovation|tool|reno|my house renovation|Labour|Material|Furniture|Paint|Electric|900000|we are building a floor on our house
Baby costs|baby|baby_cost|my baby expenses|Diapers|Milk|Medicine|Clothes|Toys|25000|babies are expensive
Shopping|bag|purchase|my shopping|Clothes|Shoes|Gadgets|Beauty|Gifts|20000|I shop too much online
Hobby spending|pencil|hobby_cost|my hobby spending|Gear|Courses|Materials|Events|Other|10000|my photography hobby is expensive
`);

// MIXED LOG: app|icon|table|trk|fields spec ('name type [range] [= d]' joined by ;)|chartField|chartKind(avg|sum|trend)|chartTail|wish
// fields written in MoldeScript field syntax, joined with ;
export const E = rows(`
Blood pressure|pill|reading|my blood pressure|high num 50..250; low num 30..150; pulse num? 30..220|high|trend|my father has high blood pressure
Blood sugar|pill|test|my blood sugar|level num 20..600 unit "mg/dl"; moment pick Fasting~After_meal~Bedtime = Fasting|level|trend|I am diabetic and keep forgetting my readings
Mood|smile|checkin|my mood|score num 1..5; note text?|score|avg|I feel low often and want to see patterns
Headache log|pill|ache|my headaches|severity num 1..10; trigger pick Stress~Sleep~Food~Screen~Weather~Unknown = Unknown; note text?|severity|avg|I get migraines
Sleep|bed|night|my sleep|hours num 0..16; quality num 1..5|hours|trend|I sleep badly
Baby temperature|baby|temp|my baby's temperature|degrees num 34..42 unit "C"; note text?|degrees|trend|my baby has a fever
Fuel fill-ups|car|fillup|my fuel fill-ups|litres num 1..120; cost money; km num 0..2000000 "Odometer"|cost|sum|I want to know my petrol mileage
Car service|car|service|my car service history|what text; km num 0..2000000; cost money; next date?|cost|sum|I forget when I last serviced my car
Book list|book|book|the books I read|title text; author text?; pages num 1..3000; rating num 1..5; finished bool|pages|sum|I want a record of my books
Movie list|star|movie|the movies I want to watch|title text; genre pick Action~Comedy~Drama~Horror~Family~Other = Drama; seen bool|seen|count|my wife and I never decide what to watch
Workout log|dumbbell|set|my workouts|exercise text; sets num 1..20; reps num 1..100; kg num 0..500|kg|trend|I lift weights and forget my numbers
Run log|run|run|my runs|km num 0.1..100; mins num 1..600; note text?|km|sum|I am training for a 10k
School marks|school|mark|my marks|subject pick Maths~English~Urdu~Science~History~Other = Maths; got num 0..100; of num 1..100 = 100|got|avg|I want to track my exam marks
Plant care|plant|care|my plant care|plant text; action pick Water~Feed~Prune~Repot = Water; note text?|action|count|I have a lot of plants and I forget what I did
Gratitude|heart|thanks|my gratitude|thing text; person text?|thing|count|I want to feel more thankful
Dream journal|moon|dream|my dreams|title text; story long; vivid num 1..5|vivid|avg|I have strange dreams and want to write them down
Gift ideas|gift|idea|my gift ideas|for_who text; idea text; price money?; bought bool|price|sum|I never know what to buy people
Recipes|food|recipe|my recipes|name text; mins num 5..480; rating num 1..5; steps long?|mins|avg|I keep losing my recipes
Contacts|user|contact|my important contacts|name text; phone text; role text?|name|count|I want a tiny phone book
Book lending|book|lent|the things I lend|item text; who text; due date?; back bool|back|count|friends never return my books
Symptoms|pill|symptom|my symptoms|what pick Fever~Cough~Pain~Nausea~Fatigue~Other = Pain; severity num 1..10; note text?|severity|avg|my doctor asked for a symptom diary
Pet weight|paw|weigh_pet|my pet's weight|kg num 0.1..100; note text?|kg|trend|my vet says my dog is overweight
Baby growth|baby|growth|my baby's growth|kg num 1..30; cm num 30..130|kg|trend|I want to see how my baby is growing
Tutoring sessions|school|tutor|my tutoring sessions|student text; topic text; mins num 15..240 = 60; paid bool|mins|sum|I teach kids at home
Delivery runs|bike|delivery|my delivery runs|orders num 1..60; km num 1..300; earned money|earned|sum|I deliver for a food app and want my real earnings
Daily steps and weight|scale|body|my body numbers|kg num 20..300; waist num 40..200 unit "cm"|kg|trend|I am on a diet
Mileage|car|trip|my business mileage|from_place text; to_place text; km num 1..2000; purpose text?|km|sum|my company pays per km
Reading log|book|page_log|my reading|title text; mins num 1..600; pages num 1..500|pages|sum|I want to read more books
Practice log|music|rehearsal|my practice|piece text; mins num 5..300; rating num 1..5|mins|sum|I have a music exam coming
Garden log|plant|dig|my garden|bed text; task pick Sow~Water~Weed~Harvest~Other = Water; note text?|task|count|my kitchen garden needs tracking
Expense notes|wallet|note_spend|my small expenses|item text; amount money; shop text?|amount|sum|I want to see every little expense
Prayer notes|mosque|dua|my duas|title text; text long|title|count|I want to save my favourite duas
Ideas|star|idea_note|my ideas|title text; why long?; score num 1..5|score|avg|ideas come when I am walking and then I forget
`);

// STOCK: app|icon|table|trk|unitWord|priceLabel
export const F = rows(`
Stock|package|item|my shop stock|items
Pantry|food|ingredient|what is in my pantry|ingredients
First aid kit|pill|supply|my first aid kit|supplies
Tool shed|tool|tool|my tools|tools
Medicine cabinet|pill|med_item|the medicines at home|medicines
Cleaning supplies|home|cleaner|my cleaning supplies|supplies
Art supplies|pencil|material|my art supplies|materials
Baby supplies|baby|baby_item|my baby supplies|supplies
Fridge|milk|food_item|what is in my fridge|food
Craft stock|gift|craft_item|my craft stock|items
Mobile shop|phone|accessory|my mobile accessories stock|accessories
Bakery|bread|product|my bakery products|products
Salon products|star|product_s|my salon products|products
Spare parts|tool|part|my spare parts|parts
Books for sale|book|title_stock|my bookstall stock|books
`);

// TODO: app|icon|table|trk|tags(|)|wish
export const G = rows(`
Grocery list|cart|grocery|my grocery list|Veg|Meat|Dairy|Home|I forget half the things at the shop
Packing list|bag|packed|my packing list|Clothes|Papers|Tech|Toiletries|I always forget something when I travel
Wishlist|gift|wish|my wish list|Tech|Home|Clothes|Fun|I keep forgetting what I want to buy
Errands|pin|errand|my errands|Bank|Post|Shop|Other|I have too many small errands
Homework|school|homework|my homework|Maths|English|Science|Other|I forget my homework deadlines
Wedding checklist|gift|wedding_task|my wedding checklist|Venue|Food|Clothes|Cards|there is so much to do for the wedding
Bucket list|star|dream_goal|my bucket list|Travel|Learn|Try|Give|I want to remember my dreams
Project tasks|list|task|my project tasks|Now|Next|Later|Bug|my side project has no structure
Moving house|home|move_task|my moving checklist|Pack|Utilities|Paperwork|Clean|we are moving next month
Eid prep|moon|eid_task|my Eid preparations|Shopping|Cooking|Gifts|Clothes|Eid is close and nothing is ready
Exam prep|school|exam_task|my exam prep|Read|Practice|Revise|Notes|my exams start soon
Garden jobs|plant|garden_job|my garden jobs|Water|Plant|Fix|Buy|the garden is a jungle
Car checklist|car|car_task|my car checklist|Oil|Tyres|Papers|Wash|I forget car maintenance
Baby checklist|baby|baby_task|my baby checklist|Doctor|Shopping|Vaccine|Home|the baby arrives soon
Office tasks|bag|work_task|my office tasks|Urgent|Normal|Waiting|Idea|my boss gives me too many tasks
`);
