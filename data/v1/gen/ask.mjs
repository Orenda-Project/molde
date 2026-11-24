// requests too unclear to build: the whole program is one `ask` line
export const ASKS = `
make me an app|What should the app help you with?|Tracking something daily|Money|A list of things to do|Notes
track it|What do you want to track?|Health|Money|Habits|Something else
i need an app|What kind of app do you need?|A tracker|A list|A calculator|A counter
help|What would you like to keep track of?|My health|My money|My tasks
something for my business|What does your business need to track?|Sales|Stock|Customers who owe me|Expenses
an app for my family|What should the family app do?|Shared shopping list|Chores for the kids|Family budget
organize my life|Where should we start?|Daily tasks|Money|Health and fitness|Study
i want to be healthier|What should I help you track?|Water|Exercise|Food|Sleep
track my progress|Progress in what?|Exercise|Study|Weight|A skill I am learning
tracker|What do you want to track?|Habits|Money|Health|Time
make something useful|What do you do most days that an app could help with?|Exercise|Study|Work|Home
i want to save more|Do you want to track money you spend or money you save?|Money I spend|Money I save|Both
log|What do you want to log?|Workouts|Meals|Expenses|Mood
a list|What kind of list?|To do list|Shopping list|Packing list|Wish list
my stuff|What kind of stuff do you want to keep track of?|Things I own|Things I lend|Things in my shop
counter|What do you want to count?|Repetitions|Visitors|Days since something|Prayers or zikr
app for school|What do you need for school?|Homework list|Exam marks|Study timetable|Reading log
need something for work|What do you need at work?|Task list|Time log|Expense claims|Meeting notes
fitness app|What kind of fitness do you do?|Gym workouts|Running or walking|Home exercises|Weight and diet
for my shop|What do you want to manage in your shop?|Stock|Daily sales|Customer credit|Supplier orders
budget|Do you want a monthly budget or a daily one?|Monthly|Daily|Per trip
calculator|What should it calculate?|A tip or a bill split|A discount|A unit conversion|Something else
help me remember things|What do you often forget?|Medicines|Bills and dates|Birthdays|Tasks
i have a problem with my time|What would help most?|A task list|A timer for focus|A log of where my time goes
can you make an app|What is the app for?|My health|My work|My home|Fun
something simple|Simple for what?|Tracking a habit|Writing things down|Counting
i want to quit something|What do you want to quit?|Smoking|Sugar|Phone scrolling|Something else
my kids|What do you want to do for your kids?|Chores and rewards|Pocket money|Study time|Reading
health|What about your health?|Medicines|Blood pressure or sugar|Exercise|Weight
money app|What about money?|What I spend|What I owe or am owed|Savings goal|A budget
keep track of everything|What matters most to keep track of first?|Money|Tasks|Health|Home
i dont know what i want|What are you trying to improve?|My health|My money|My work or study|My habits
daily thing|What is the daily thing?|A habit I want to build|Something I take every day|Something I do for work
notes|What kind of notes?|A diary|Ideas|Lists|Things to remember
recipe|What do you want to do with recipes?|Save my recipes|Plan weekly meals|Make a shopping list from a recipe
app for my mom|What does your mom need?|Medicine reminders|A phone book|A prayer or zikr counter|Blood pressure log
gym|What do you want to do at the gym?|Log my workouts|Track my weight|A rest timer
study|What do you want to do for your study?|A timetable|Track hours|Exam marks|Flashcards
make a game|What kind of game?|A dice roller|A score keeper|A quiz|Tic tac toe
tasks|How do you want to handle tasks?|A simple to do list|A list with due dates|A list with priorities
tracking app please|What should be tracked?|Something I do every day|Something I spend|Something I measure
i want to keep a record|A record of what?|My expenses|My workouts|My health readings|My work hours
organize my shop|What should be organized?|Stock|Sales|Customers|Suppliers
i want a diary|Do you want a text diary or a quick mood log?|Write entries|Quick mood log|Both
plan my week|What do you want to plan?|Study|Meals|Workouts|Work
manage my money|Do you want to track spending or set a budget?|Track spending|Set a budget|Both
a timer|What is the timer for?|Studying|Exercise|Cooking|Prayer or meditation
for my wife|What would your wife like in the app?|A shared shopping list|Reminders|A budget|A diary
something for ramadan|What do you want to track in Ramadan?|Fasts|Quran pages|Prayers|Charity
i want to lose weight|What should I track?|Weight|Food and calories|Exercise|All of them
tracker for my dog|What do you want to track for your dog?|Walks|Feeding|Vet visits|Weight
an app|What should the app do?|Track something|Make lists|Calculate something|Remind me of something
i'm a student|What would help you most?|A homework list|A timetable|A study timer|Marks tracking
build me something|What should I build?|A tracker|A list|A counter|A reminder
reminders|What should we remind you about?|Medicines|Bills|Birthdays|Daily habits
i need to be more productive|What would make you more productive?|A task list|A focus timer|A habit tracker
inventory|What do you keep in your inventory?|Shop items|Home supplies|Tools|Food
business app|What kind of business app?|Daily sales and expenses|Customers and dues|Orders|Stock
a tracker for me|What do you want to track?|Health|Habits|Money|Time
log my day|What should the daily log hold?|How I feel|What I did|What I spent|What I ate
ideas app|What should the ideas app do?|Save ideas with a rating|Group ideas by topic|Remind me to revisit them
i want to read more|How should the app help you read more?|Track pages|Track minutes|A reading list|A daily reminder
spending|Do you want to see where money goes or set a limit?|See where it goes|Set a limit|Both
trip|What do you need for your trip?|A packing list|A trip budget|A plan for each day
my savings|What do you want to do with savings?|Track deposits|Reach a goal|Both
tools for home|What at home needs managing?|Bills|Chores|Supplies|Repairs
fasting|What do you want to track about fasting?|Days fasted|Fasts I owe|Both
`.trim().split('\n').map(l => { const [q, ques, ...o] = l.split('|'); return { request: q, question: ques, options: o }; });
export const askProgram = a => `ask "${a.question}" ${a.options.map(o => `"${o}"`).join(' ')}\n`;
