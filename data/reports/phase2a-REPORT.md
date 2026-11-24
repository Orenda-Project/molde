# Molde Phase 2a: how a small local model does with NO fine-tuning

Question: with a short instruction, a compact cheat sheet, 3 example pairs and grammar-constrained decoding (lang/moldescript.gbnf), how often does a small model write a MoldeScript program that passes the checker and does what was asked, and how fast is it on this laptop's CPU? This is the floor that fine-tuning must beat.

**Machine:** Intel Core i9-10885H (8 cores / 16 threads), 31 GB RAM, CPU only, llama.cpp b12144 `llama-server`, 8 threads, one model at a time, 6144 context, flash attention on. IMPORTANT: another job on this laptop (a CPU training run, load average 20 to 28) overlapped much of this run, so all speed numbers are pessimistic and noisy; see the speed section.
**Setup:** test set = 60 corpus requests whose Phase 0 coverage verdict was "full" (20 short, 10 custom_ui + 10 detailed, 20 from vague / multi_feature / typos), reference = the corpus program. Fixed examples e001, e010, e030 and the retrieval bank (177 full-verdict programs) never contain a test item. Prompt = system message (instruction + cheat sheet, `cheatsheet.txt`) + 3 user/assistant example turns + the request, through each model's own chat template (`--jinja`, Qwen thinking off). Temperature 0, 400 new tokens max, grammar sent as the `grammar` field. Models are Q8_0 GGUFs (unsloth / bartowski); the Qwen3.5-2B file is the post-trained model, not a base GGUF (none was available; no conversion done).

## Results table (Phase 2a, greedy, max 400 new tokens)

pass = passes `check` (outputs cut at 400 tokens are trimmed to the last full line first). Intent = automatic structural score (rules below). Judged = my own right/partly/wrong on the 20-item subset. s/app = median wall seconds per app with the fixed prefix cached; uncached = cache_prompt off, 10 items. RAM = peak resident of the server process.

| model | config | n | checker pass 1st try | after 1 repair | intent (auto) | judged r/p/w (of 20) | median out tokens | hit 400-token cap | gen tok/s | s/app cached | s/app uncached | peak RAM MB | file MB |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Gemma 3 270M it | k3g | 60 | 3.3% | 5.0% | 0.0% | - | 303.5 | 26/60 | 39.8 | 8.1 | 11.0 | 2470 | 291.5 |
| Gemma 3 270M it | retg | 60 | 33.3% | 36.7% | 10.0% | 2/8/10 | 143.0 | 2/60 | 33.7 | 6.6 | 11.0 | 2470 | 291.5 |
| Gemma 3 270M it | k3n | 20 | 5.0% | 5.0% | 0.0% | - | 148.0 | 4/20 | 55.6 | 2.6 | 11.0 | 2470 | 291.5 |
| SmolLM2 360M it | k3g | 60 | 1.7% | 1.7% | 0.0% | - | 400.0 | 60/60 | 38.6 | 10.7 | 18.5 | 4570 | 386.4 |
| SmolLM2 360M it | retg | 60 | 25.0% | 25.0% | 8.3% | 1/11/8 | 400.0 | 54/60 | 34.1 | 14.5 | 18.5 | 4570 | 386.4 |
| SmolLM2 360M it | k3n | 20 | 0.0% | 0.0% | 0.0% | - | 400.0 | 20/20 | 37.4 | 10.9 | 18.5 | 4570 | 386.4 |
| Qwen3.5 0.8B | k3g | 60 | 8.3% | 10.0% | 0.0% | - | 400.0 | 60/60 | 18.7 | 21.7 | 36.6 | 3014 | 811.8 |
| Qwen3.5 0.8B | retg | 60 | 11.7% | 11.7% | 5.0% | - | 400.0 | 58/60 | 15.5 | 31.7 | 36.6 | 3014 | 811.8 |
| Qwen3.5 0.8B | k3n | 20 | 5.0% | 5.0% | 0.0% | - | 155.5 | 8/20 | 18.7 | 8.4 | 36.6 | 3014 | 811.8 |

configs: k3g = 3 fixed examples + grammar; retg = 3 retrieved examples (word overlap) + grammar; k3n = 3 fixed examples, NO grammar, 20-item subset.

### Detail per model

**Gemma 3 270M it** (gemma-3-270m-it Q8_0)
- k3g: pass first 2/60, formatter-then-check 3.3%, repair fixed 1 of 58 tried, intent after repair 0.0%, mean structural score 0.309, prompt tokens new/cached per request 20.0/1196.0, prompt-processing tok/s 226.0; top first errors [['E_ICON', 33], ['E_RANGE', 7], ['E_SYNTAX', 6], ['E_DUP', 3], ['E_UNKNOWN_TABLE', 3]]
  - by group (k3g): {'short': {'pass_first_pct': 10.0, 'intent_auto_pct': 0.0}, 'custom_ui_or_detailed': {'pass_first_pct': 0.0, 'intent_auto_pct': 0.0}, 'other': {'pass_first_pct': 0.0, 'intent_auto_pct': 0.0}}; 20-item subset: pass 5.0%, intent 0.0%
- retg: pass first 20/60, formatter-then-check 33.3%, repair fixed 2 of 40 tried, intent after repair 11.7%, mean structural score 0.495, prompt tokens new/cached per request 674.5/659.5, prompt-processing tok/s 385.5; top first errors [['E_ICON', 13], ['E_SYNTAX', 8], ['E_UNKNOWN_FIELD', 5], ['E_UNKNOWN_TABLE', 4], ['E_UNKNOWN_NAME', 3]]
- k3n: pass first 1/20, formatter-then-check 5.0%, repair fixed 0 of 0 tried, intent after repair 0.0%, mean structural score 0.297, prompt tokens new/cached per request 19.5/1196.0, prompt-processing tok/s 293.2; top first errors [['E_SYNTAX', 14], ['E_ICON', 4], ['E_ARGS', 1]]
- uncached (k3g, 10 items): prompt 1210.0 tokens at 429.4 tok/s, gen 39.8 tok/s, 11.0 s/app

**SmolLM2 360M it** (SmolLM2-360M-Instruct Q8_0)
- k3g: pass first 1/60, formatter-then-check 1.7%, repair fixed 0 of 59 tried, intent after repair 0.0%, mean structural score 0.191, prompt tokens new/cached per request 21.0/1250.0, prompt-processing tok/s 95.0; top first errors [['E_ICON', 40], ['E_SYNTAX', 11], ['E_DUP', 3], ['E_UNKNOWN_NAME', 3], ['E_KIND', 1]]
  - by group (k3g): {'short': {'pass_first_pct': 0.0, 'intent_auto_pct': 0.0}, 'custom_ui_or_detailed': {'pass_first_pct': 0.0, 'intent_auto_pct': 0.0}, 'other': {'pass_first_pct': 5.0, 'intent_auto_pct': 0.0}}; 20-item subset: pass 0.0%, intent 0.0%
- retg: pass first 15/60, formatter-then-check 25.0%, repair fixed 0 of 45 tried, intent after repair 8.3%, mean structural score 0.418, prompt tokens new/cached per request 541.5/712.0, prompt-processing tok/s 183.5; top first errors [['E_ICON', 19], ['E_SYNTAX', 7], ['E_UNKNOWN_NAME', 5], ['E_UNKNOWN_TABLE', 3], ['E_DUP', 2]]
- k3n: pass first 0/20, formatter-then-check 0.0%, repair fixed 0 of 0 tried, intent after repair 0.0%, mean structural score 0.185, prompt tokens new/cached per request 20.0/1250.0, prompt-processing tok/s 94.5; top first errors [['E_ICON', 13], ['E_SYNTAX', 7]]
- uncached (k3g, 10 items): prompt 1265.0 tokens at 192.2 tok/s, gen 34.1 tok/s, 18.5 s/app

**Qwen3.5 0.8B** (Qwen3.5-0.8B Q8_0)
- k3g: pass first 5/60, formatter-then-check 8.3%, repair fixed 1 of 21 tried, intent after repair 0.0%, mean structural score 0.282, prompt tokens new/cached per request 26.5/1166.0, prompt-processing tok/s 90.5; top first errors [['E_SYNTAX', 26], ['E_ICON', 12], ['E_DUP', 7], ['E_UNKNOWN_TABLE', 2], ['E_TYPE', 2]]
  - by group (k3g): {'short': {'pass_first_pct': 0.0, 'intent_auto_pct': 0.0}, 'custom_ui_or_detailed': {'pass_first_pct': 20.0, 'intent_auto_pct': 0.0}, 'other': {'pass_first_pct': 5.0, 'intent_auto_pct': 0.0}}; 20-item subset: pass 20.0%, intent 0.0%
- retg: pass first 7/60, formatter-then-check 11.7%, repair fixed 0 of 20 tried, intent after repair 5.0%, mean structural score 0.469, prompt tokens new/cached per request 553.5/642.0, prompt-processing tok/s 99.4; top first errors [['E_SYNTAX', 14], ['E_TYPE', 8], ['E_ICON', 6], ['E_UNKNOWN_NAME', 4], ['E_UNKNOWN_FIELD', 4]]
- k3n: pass first 1/20, formatter-then-check 5.0%, repair fixed 0 of 0 tried, intent after repair 0.0%, mean structural score 0.292, prompt tokens new/cached per request 26.5/1166.0, prompt-processing tok/s 89.1; top first errors [['E_SYNTAX', 13], ['E_ICON', 3], ['E_UNKNOWN_TABLE', 1], ['E_RESERVED', 1], ['E_TYPE', 1]]
- uncached (k3g, 10 items): prompt 1187.0 tokens at 117.1 tok/s, gen 17.3 tok/s, 36.6 s/app

**Qwen3.5 2B** (Qwen3.5-2B Q8_0)

### Examples (5 per model: first-listed good, rest bad)

#### Gemma 3 270M it (retg)

GOOD e013: request: cups of tea counter, daily and monthly total  | checker: OK | truncated=False
```
app "Tea" cup mint
table tea
count(tea today) "cups today" big
button "+1 cup" tap add tea
button "Undo" tap remove last(tea today)
"This month" count(tea month) "cups" head
daybars last 7 days, count(tea on it)

```
GOOD e133: request: I forget what my friends like, so I buy the wrong gifts  | checker: OK | truncated=False
```
app "What I read" book plum
table book title text, author text?
table note book ref book, idea long, revisited date?
"Revisit one today" head
each note sort revisited top 1 as n
  stack card gap 1
    n.book.title faint
    n.idea
    button "Revisited" tap set n.revisited = today
"All notes" head
each book as b
  stack card gap 1
    b.title bold
    each b.note as n
```
BAD e144: request: track my parking expense  | checker: line 4: E_DUP: the name "lim_parking" is already used. Fix: pick a different name. | truncated=False
```
app "Parking Expense" users slate
table expense what text, amount money, category pick Rent|Groceries|School|Transport|Medicine|Eid_savings, note text?
setting lim_parking money = 30000 "Parking limit"
setting lim_parking money = 20000 "Parking expense"
setting lim_parking money = 10000 "Parking expense"
setting lim_parking money = 5000 "Parking expense"
state m date = today
monthnav m
"Spent this month" sum(expense.amount month of m) big
each options expense.category as k
  let spent = sum(expense.amount month of m where category = k)
  let lim = if(k = Rent, lim_rent, if(k = Groceries, lim_groceries, if(k = School, lim_school, if(k = Transport, lim_transport, if(k = Medicine, lim_medicine, lim_eid)))))
  stack gap 1
    row
```
BAD e280: request: fertilizer bags used per field  | checker: line 5: E_UNKNOWN_FIELD: plot has no field "crop" (here "it" is a plot). Fix: fields of plot: name, fertilizer, sown, bags, water, harvest, yield, at. | truncated=False
```
app "Fertilizer" plant mint
table plot name text, fertilizer pick Wheat|Rice, sown date, bags num 0.. unit "bags", water num 0.. = 0 "Irrigations", harvest date, yield num 0.. = 0 unit "maund" "Actual yield"
each plot sort name
  stack card gap 1
    it.name it.crop head
    "Sown" it.sown "| Expected harvest" it.harvest faint
    "Fertiliser" it.bags "bags | Irrigations" it.water "| Yield" it.yield "maund" bold
    row gap 1
      button "+1 irrigation" tap set it.water = it.water + 1
      button "Edit yield" tap edit it
form plot, "Add plot"

```
BAD e051: request: weight tracker in kg  | checker: line 6: E_REF: weight has no ref field pointing at weight. Fix: add a field like "weight ref weight" to table weight. | truncated=False
```
app "Weight tracker" coin plum
table weight name text
table buy weight ref weight, kg num 0..
table sale weight ref weight, kg num 0..
each weight as v
  let left = sum(v.weight) - sum(v.sale.weight)
  row card gap 1
    v.name bold grow
    "bought" sum(v.buy.kg) faint
    "sold" sum(v.sale.kg) faint
    "left" left bold color if(left <= 0, bad, ink)
form weight
"Sold" head
list weight where sold = yes
```
#### SmolLM2 360M it (retg)

GOOD e013: request: cups of tea counter, daily and monthly total  | checker: OK | truncated=True
```
app "Tea" cup mint
table tea
count(tea today) "cups today" big
button "+1 cup" tap add tea
button "Undo" tap remove last(tea today)
"This month" count(tea month) "cups" head
daybars last 7 days, count(tea on it)
daybars last 7 days, count(tea on it)
daybars last 7 days, count(tea on it)
daybars last 7 days, count(tea on it)
daybars last 7 days, count(tea on it)
daybars last 7 days, count(tea on it)
daybars last 7 days, count(tea on it)
daybars last 7 days, count(tea on it)
```
GOOD e037: request: Ramadan tracker: sehri and iftar times, roza done or missed, reason for missed, and total count at the end of month  | checker: OK | truncated=True
```
app "Ramadan Tracker" moon plum
table day d date, sehri time, iftar time, roza bool = yes "Roza kept", rakaat num 0..20 = 8 "Taraweeh rakaat", note text?
form day, "Add day"
each day sort d
  row card tap edit it
    stack grow
      it.d bold
      "Sehri" it.sehri "Iftar" it.iftar it.note faint
    if(it.roza, "Roza", "Missed") bold color if(it.roza, good, bad)
"Total roza kept" count(day where roza = yes) head
"Total missed" count(day where roza = no) head
"Days missed:" head
each day where roza = no sort d
  it.d
```
BAD e144: request: track my parking expense  | checker: line 1: E_ICON: unknown icon "parking". Fix: use one of: drop, check, wallet, dumbbell, book, clock, heart, star, moon, sun, leaf, cart, list, calendar, pill, money, user, users, bell, timer, calc, home, cup, bed, scale, smile, note, pen, gift, tag ... | truncated=True
```
app "Parking" parking mint
table expense what text, amount money, category pick parking_fee|parking_cost|parking_time, note text?
setting parking_fee money = 1000 "Parking fee"
setting parking_cost money = 500 "Parking cost"
setting parking_time month of m
state m date = today
monthnav m
"Spent this month" sum(expense.amount month of m) big
each options expense.category as k
  let spent = sum(expense.amount month of m where category = k)
  let lim = if(k = parking_fee, lim_parking_fee, if(k = parking_cost, lim_parking_cost, lim_parking_time))
  stack gap 1
    row
      text k bold grow color if(spent > lim, bad, ink)
```
BAD e230: request: monthly electricity units log  | checker: line 5: E_DUP: the name "usage" is already used. Fix: pick a different table name. | truncated=True
```
app "Monthly electricity" home slate
table units "Units" text num 1..31 = 1
table usage "Units used" text num 1..31 = 1
table cost "Units cost" text num 1..31 = 1
table usage "Units used" text num 1..31 = 1
table cost "Units cost" text num 1..31 = 1
table rent "Rent" text num 1..31 = 1
table rent "Rent" text num 1..31 = 1
screen units "Units" home
  each unit as u
    row card gap 1 tap edit u
      stack grow
        u.name bold
        "units" u.units "units used" u.usage "units cost" u.cost "units cost"
```
BAD e280: request: fertilizer bags used per field  | checker: line 5: E_UNKNOWN_FIELD: plot has no field "crop" (here "it" is a plot). Fix: fields of plot: name, bags, water, harvest, yield, at. | truncated=False
```
app "Fertilizer Bags Used" plant mint
table plot name text, bags num 0.. unit "bags", water num 0.. = 0 "Irrigations", harvest date, yield num 0.. = 0 unit "maund" "Actual yield"
each plot sort name
  stack card gap 1
    it.name it.crop head
    "Fertilizer used" it.bags "bags | Irrigation" it.water "| Yield" it.yield "maund" bold
    row gap 1
      button "+1 irrigation" tap set it.water = it.water + 1
      button "Edit yield" tap edit it
form plot, "Add plot"

```
#### Qwen3.5 0.8B (retg)

GOOD e265: request: Grocery list organiser with categories: vegetables, dairy, grains, spices, cleaning and medicine. Add items with quantity and estimated price, tick them off in the store, and see the estimated total before I pay.  | checker: OK | truncated=True
```
app "Grocery Organiser" cart mint
table item name text, price money?, qty num 1.. = 1, category pick A|B|C|D|E|F, got bool
count(item where got = no) "to buy" sumof(item, it.price * it.qty) head
each item where got = no as i
  row card swipe remove i
    toggle i.got
    i.name grow
    i.price grow
    i.qty grow
    i.category grow
"Already in the store" faint
each item where got = yes as i
  row swipe remove i
    toggle i.got
```
GOOD e111: request: meri shop ka stock  | checker: OK | truncated=True
```
app "My Shop" coin plum
table piece name text, tola num 0.., bought money, price money, sold bool
count(piece where sold = no) "pieces in stock," sum(piece.tola where sold = no) "tola" head
"Stock cost" sum(piece.bought where sold = no) "Profit on sold" sumof(piece where sold = yes, it.price - it.bought) faint
each piece where sold = no sort at as p
  row card tap edit p swipe remove p
    stack grow
      p.name bold
      p.tola "tola, bought" p.bought "ask" p.price faint
    button "Sold" tap set p.sold = yes
form piece
"Sold" head
list piece where sold = yes
each piece where sold = no sort at as p
```
BAD e060: request: cricket score keeper  | checker: line 6: E_SYNTAX: cannot read the line from "runs" (column 13). Fix: expected "text", "long", "num", "money", "bool", "date". | truncated=True
```
app "Score Keeper" ball ocean
table match runs num 0..400, wickets num 0..10
setting name_match text = "Match"
setting name_runs text = "Runs"
setting name_wickets text = "Wickets"
state match runs shuffle
state match wickets shuffle
let match_runs = count(match where runs >= 0)
let match_wickets = count(match where wickets >= 0)
let match_runs_avg = sum(match_runs) / count(match_runs)
let match_wickets_avg = sum(match_wickets) / count(match_wickets)
row gap 2
  stack card grow
    text name_match head
```
BAD e230: request: monthly electricity units log  | checker: line 10: E_REF: usage has no ref field pointing at unit. Fix: add a field like "unit ref unit" to table usage. | truncated=True
```
app "Electricity" home slate
table unit name text, power money, date num 1..12 = 1
table usage power num, date num 1..12 = 1
screen units "Units"
  each unit as u
    row card gap 1 tap edit u
      u.name bold
      "power" u.power "per unit"
      "date" u.date "day"
      "usage" u.usage "kWh"
  form unit, "Add unit"
screen usage "Usage"
  stat sum(usage.power month), "total power this month"
  stat sum(usage.power week), "total power this week"
```
BAD e280: request: fertilizer bags used per field  | checker: line 1: E_ICON: unknown icon "fertilizer". Fix: use a known icon; the closest is timer. All icons are listed in SPEC.md section 8.4. | truncated=True
```
app "Fertilizer Bags" fertilizer mint
table field name text, bags num 0.. unit "bags"
each field sort name
  stack card gap 1
    it.name it.bags head
    row gap 1
      button "+1" tap set it.bags = it.bags + 1
      button "Edit" tap edit it
form field, "Add field"
log "Fertilizer bags per field"
log "Total bags"
log "Sum of bags"
log "Avg bags"
log "Min bags"
```
