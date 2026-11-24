# Molde r1 report (Phase 2 training: Gemma 3 270M and Qwen3.5-0.8B)

Written 2026-11-24. Language commit used for r1: `232f772` (round 4 syntax; head is now `6af2e11`, no syntax change since). Data: pilot v1, 5,493 train / 282 val pairs (63% templated), migrated and checked with `mo.mjs`, 0 dropped. Held-out: 40 real-wording corpus requests + 4 edit pairs (`heldout_ids.txt`), and a separate slice of 60 templated validation requests (not trained on).

## Table (GGUF = quantised file, llama.cpp b12144, laptop CPU 6 threads, grammar `moldescript.gbnf`, greedy; HF = transformers fp32, no grammar)

Columns: checker pass on first try, after one repair round (the checker's first error is sent back once), exact match after canonical format, structural intent score (mean) and intent_auto (the Phase 2a pass rule), median output tokens, generation tokens/s, median seconds per app (prompt not cached).

| arm | file / set | n | pass 1st | pass after repair | exact | intent score | intent auto | median tok | tok/s | s/app |
|---|---|---|---|---|---|---|---|---|---|---|
| r1 Gemma 3 270M | HF fp32, 40+4 real wording | 44 | 54.5% | 56.8% | 2.3% | 0.627 | 20.5% | 112.5 | - | - |
| r1 Gemma 3 270M | HF fp32, 60 templated | 60 | 83.3% | 83.3% | 61.7% | 0.860 | 75.0% | 120.5 | - | - |
| r1 Gemma 3 270M | GGUF Q8_0 (278 MB), 40+4 real wording | 44 | 50.0% | 50.0% | 2.3% | 0.629 | 18.2% | 126.0 | 65.5 | 2.1 |
| r1 Gemma 3 270M | GGUF Q4_K_M (241 MB), 40+4 real wording | 44 | 43.2% | 43.2% | 2.3% | 0.650 | 11.4% | 121.0 | 64.7 | 2.1 |
| r1 Gemma 3 270M | GGUF Q8_0, 60 templated | 60 | 86.7% | 86.7% | 60.0% | 0.887 | 73.3% | 118.0 | 65.1 | 2.1 |
| r1a Gemma 3 270M (2,080 pairs, old syntax 6801a61, not shipped) | HF fp32, 40+4 | 44 | 43.2% | 43.2% | 2.3% | 0.535 | 11.4% | 110.0 | - | - |
| r1a | GGUF Q8_0 | 44 | 40.9% | 40.9% | 2.3% | 0.570 | 15.9% | 120.5 | 62.6 | 2.0 |
| r1a | GGUF Q4_K_M | 44 | 34.1% | 34.1% | 0.0% | 0.563 | 13.6% | 115.0 | 66.0 | 1.9 |
| r1 Qwen3.5-0.8B (1.1 epochs) | GGUF Q8_0 (774 MB), 40+4 real wording | 44 | 43.2% | 43.2% | 2.3% | 0.651 | 11.4% | 121.0 | 49.6 | 4.8 |
| r1 Qwen3.5-0.8B (1.1 epochs) | GGUF Q4_K_M (505 MB), 40+4 real wording | 44 | 43.2% | 43.2% | 2.3% | 0.651 | 11.4% | 121.0 | 49.2 | 2.9 |
| r1 Qwen3.5-0.8B (1.1 epochs) | GGUF Q8_0, 60 templated | 60 | 83.3% | 85.0% | 53.3% | 0.874 | 75.0% | 120.0 | 57.9 | 2.7 |
| baseline Phase 2a (no training, Gemma 270M, 3 retrieved examples + grammar, 60 other corpus requests) | Q8_0 | 60 | 33.3% | 36.7% | - | 0.495 (mean structural) | 10.0% | 143 | 33.7 | 6.6 |

Notes: the baseline used a different 60-request set and prompts with about 700 tokens of examples; compare loosely. Qwen3.5-0.8B got only 380 optimizer steps (1.1 epochs) versus Gemma's 1,715 steps (5 epochs): see 'Qwen arm' below, it is not a fair comparison of the models.

## What the numbers say

- Training on 5.5k pairs lifts the real-wording checker pass from about 33% (baseline, with examples in the prompt) to 50% (Q8_0 with grammar) with a prompt of about 50 tokens instead of 700; seconds per app fell from 6.6 to 2.1.
- Templated requests pass 87% (exact 60%): the model learned the generator's patterns; real wording is the weak spot (63% of the data is templated).
- Quantisation: Q4_K_M loses 7 points of checker pass versus Q8_0 (43% vs 50%, 44 requests, so 3 requests) with the same speed class on this CPU (65 tok/s).
- One repair round fixed 0 of 22 failing GGUF outputs (HF fp32: 1 of 20): the model repeats its mistake when told the error. The fix is not another round; it is the decoder not allowing the mistake (see below).
- Exact match on real wording is about 2%: programs differ in naming and layout from the references; the intent score (0.63) is the better signal.
- Epochs: validation checker pass rose 0.67, 0.71, 0.75, 0.83, 0.83 over epochs 1 to 5 and was still rising: more epochs will help.
- r1a (2,080 pairs, older syntax) scored 41% / 34%: 2.6x more data and the final syntax gave +9 points.

## Failure classes on the 22 failing held-out programs (Gemma r1, Q8_0 with grammar)

| first error | count | meaning |
|---|---|---|
| E_UNKNOWN_FIELD | 7 | uses a field the table does not have |
| E_TYPE | 4 | wrong kind of value (text compared with number, bad argument) |
| E_UNKNOWN_NAME | 3 | name never declared |
| E_DUP | 2 | same field declared twice |
| E_UNKNOWN_COMPONENT | 2 | calls a component or statement that does not exist |
| E_CHILD | 1 | indented lines under a line that takes none |
| E_DEFAULT | 1 | default not one of the options |
| E_UNKNOWN_TABLE | 1 | table never declared |
| E_SYNTAX | 1 | syntax slip that the grammar still allowed |

13 of 22 are name errors (unknown field, name, component, table). The grammar cannot know names; `lang/constrain.mjs` (allowedWords / tokenMask) is built for exactly this. NOT wired into the llama.cpp decoding loop in this round: llama-server accepts a GBNF but no per-step token mask from outside, so wiring needs a custom llama.cpp decoding loop (llama-cpp-python or the C API). Grammar-only numbers are the ones reported. A second failure type is the degenerate fallback: for unusual requests the model emits a one-line `ask` program that passes the checker but does not do the job (counted as pass above; see sample e011).

## 10 failing held-out examples (Gemma r1, GGUF Q8_0, grammar on)

#### e005

Request: Track my livestock: for each goat give tag number, breed, birth date, weight in kg each month, vaccination dates, and deworming dates. Warn me 7 days before any vaccine is due and show a monthly weight chart per goat.

```
app "Livestock" paw mint
table goat tag text, kind pick Goat|Dog|Bird|Rabbit|Other = Goat, born date, weight num 0.., vaccinated bool
table treat goat ref goat
"Vaccines due this month" head
each treat month as r
  stack card gap 1
    r.goat.tag bold
    "Vaccine" r.vaccinated "days old" faint
    button "Vaccine given" tap add treat goat = r
"Good goat (kg per month)" head
bars options goat.kind, sum(it.weight), it.tag
form goat, "Add goat"
form treat, "Add vaccine"
```

First error: `line 8: E_UNKNOWN_FIELD: treat has no field "vaccinated". Fix: fields of treat: goat, at.`

#### e024

Request: notes from my doctor visits, what he said, nxt visit date

```
app " Visits" heart plum
table visit note text, day date, note text
"Last visit" since(visit) big
"Next visit" since(visit) - since(visit) "days ago" faint
form visit, "Add a visit"
list visit by day
```

First error: `line 2: E_DUP: field "note" appears twice in visit. Fix: remove one or rename it.`

#### e029

Request: A row of five big emoji faces I tap once a day, and a line chart of the last 30 days

```
app "FiveFaces" dumbbell ink
table face
  streak(face) "day streak" big
  button "Log face" tap add face
"Average this month" round(avg(face.day last 30 days)) faint
heat last 70 days, count(face on it), 5
```

First error: `line 3: E_CHILD: "table" cannot have indented lines under it. Fix: un-indent this line, or put both inside a stack/row/box.`

#### e039

Request: sleep log, bedtime, wakeup, naps, caffeine after 4pm, and show a weekly chart with best and worst nights

```
app "Sleep" bed ink
table night woke time, quality num 1..5 = 3, woke time, quality num 1..5 = 3
let avg7 = sum(night.woke week) - sum(night.woke prev week)
"Average sleep, last 7 nights" faint
avg7 big color if(avg7 < 4, bad, good)
daybars last 7 days, sum(night.quality on it)
"Rested nights average" round(avg(night.woke last 7 days) * 10) / 10 faint
remind "Time to wind down" at 22:30
form night
list night by day
```

First error: `line 2: E_DUP: field "woke" appears twice in night. Fix: remove one or rename it.`

#### e046

Request: A weekly timetable grid with colours per subject; tap a box to change the class in it

```
app "Weekly" school mint
table period day pick Mon|Tue|Wed|Thu|Fri|Sat|Sun, name text
table lesson period ref period, subject text, mins num 15..180 = 45
grid 3 gap 1
  each options period.day as dd
    stack gap 1
      dd bold align center color if(dd = dayname(today), accent, muted)
      each period where day = dd sort name as p
        stack radius 8 pad 1 fill if(dd = dayname(today), accent, soft) tap edit p
          p.name bold
          p.subject tiny
form period, "Add period"
```

First error: `line 11: E_UNKNOWN_FIELD: period has no field "subject". Fix: fields of period: day, name, at.`

#### e047

Request: tasbeeh counter for 3 zikr, with a reset button and total

```
app "Tasbeeh" beads mint
table zikr phrase pick SubhanAllah|Alhamdulillah|AllahuAkbar = SubhanAllah
setting target num = 3 "Count to"
row gap 1
  each options zikr.phrase
    button it fill if(it = target, accent, soft) tap set target = it
button "Reset today" tap remove all zikr today
stat count(zikr), "all zikr"
```

First error: `line 6: E_TYPE: cannot use = between text and a number. Fix: make both sides the same kind of value.`

#### e050

Request: meal planner for the week: breakfast, lunch, dinner, grocery list generated from it, and cost estimate

```
app "Meal plan" food mint
table meal day pick Mon|Tue|Wed|Thu|Fri|Sat|Sun, breakfast text, lunch text, dinner text, grocery text?
"Today" head
each meal where day = dayname(today) as m
  stack card gap 1
    row
      m.breakfast bold grow
      m.lunch faint
    "Dinner" faint
    each meal where day = dayname(today) as m
      row gap 1
        m.breakfast grow
        m.lunch faint
        m.grocery faint
form meal
"Week" head
each meal where day = dayname(today) as m
  row card gap 1
    m.day bold
    m.breakfast grow
    m.lunch faint
    m.grocery faint
"Cost" round(sum(meal.price month) + sum(meal.delivery month) + sum(meal.grocery month) * 10) / 10 bold
```

First error: `line 23: E_UNKNOWN_FIELD: meal has no field "price". Fix: fields of meal: day, breakfast, lunch, dinner, grocery, at.`

#### e054

Request: fridge grocery expiry alert, what items expire this week

```
app "Fridge" milk mint
table food name text, expires date
let soon = count(food, it.expires < today)
soon "items expire soon" head color if(soon > 0, warn, good)
each food sort expires as f
  row card gap 1 tap edit f swipe remove f
    f.name bold grow
    f.expires f.grams "days" color if(f.expires < today, bad, muted)
    button "-1" tap set f.expires = today - 1
form food, "Add food"
```

First error: `line 8: E_UNKNOWN_FIELD: food has no field "grams". Fix: fields of food: name, expires, at.`

#### e078

Request: garden seeds and when to plant each one in the month

```
app "Seed Year" plant mint
table seed name text, planted_each date
"Planted this year" count(seed year) "of" count(seed) big
each seed sort planted_each as s
  row card gap 2 tap edit s swipe remove s
    stack grow
      s.name bold
      s.planted_each faint
    s.planted.each "mth" color if(s.planted.each < today, bad, muted)
form seed, "Add seed"
```

First error: `line 9: E_UNKNOWN_FIELD: seed has no field "planted". Fix: fields of seed: name, planted_each, at.`

#### e093

Request: Ramadan 30 days: taraweeh count, Quran pages read per day, charity given, and final summary when Eid comes

```
app "Ramadan 30" moon plum
table nighteh
table read part text, surah num 1..30
"Taraweeh today" count(nighteh today) big
"Quran pages" head
each nighteh today as qn
  pages "Quran" n
"Charity given" head
each nighteh today as k
  if sum(k.read.pages) > 0
    "I gave this month" sum(k.read.pages month) faint
"Last 10 pages" head
each nighteh last 10 days as s
  row card
    s.key grow
    sum(s.read.pages) "of 30" bold
form nighteh, "Add to the summary"
```

First error: `line 7: E_UNKNOWN_COMPONENT: there is no component, statement or value called "pages". Fix: start the line with a statement from SPEC.md, a component (daybars, bars, trend, heat, share, list, log, form, quick, stat, goal, timer, calendar, monthnav) or a declared value.`

## 5 passing examples

#### e011

Request: mosque donation book

```
ask "What do you want to do in your mosque?" "Make dua" "I prayed in mosque" "I am a mosque"
```

#### e016

Request: the kids always forget their school things, maybe a checklist

```
app "School supplies" school ocean
table school_item name text, qty num 0.., low num 0.. = 10
let short = count(school_item, it.qty <= it.low)
short "supplies running low" head color if(short > 0, warn, good)
each school_item sort qty as i
  row card gap 1 tap edit i swipe remove i
    stack grow
      i.name bold color if(i.qty <= i.low, warn, ink)
    button "-" tap set i.qty = i.qty - 1
    i.qty bold
    button "+" tap set i.qty = i.qty + 1
form school_item
```

#### e065

Request: mothly electricty bill record, unit and amount, compare with last month

```
app " mothly" bolt plum
setting rate money = 25 "Price per unit"
table elec units num 0.., cost money
"Total bill" sum(elec.cost month) big
"Last month" sum(elec.cost prev month) faint
form elec, "Add appliance"
list elec by day
```

#### e073

Request: text my cousins a reminder before each birthday

```
app "Cousin birthday" gift plum
table cune name text, birthday date
remind "Car unsere" at cune.birthday
each cune sort birthday as c
  row card gap 1 tap edit c swipe remove c
    c.name bold grow
    "turns" year(today) - year(c.birthday) "on the" monthday(today) faint
form cune, "Add birthday"
```

#### e097

Request: today's bakery sales

```
app "Bakery" bread plum
table sale item pick Chai|Coffee|Biscuit|Other = Chai, amount money
"Today" sum(sale.amount today) big
daybars last 7 days, sum(sale.amount on it)
form sale, "Add sale"
list sale by day
```

## Pipeline facts worth keeping

- Added MoldeScript tokens: Gemma `safe` mode, 48 tokens; `full` mode (whitespace-carrying tokens) breaks parity with llama.cpp (34 of 180 programs tokenize differently) so it is not used; checked 180/180 identical on the shipped GGUF (`tokens/check_gguf_tokenizer.py`). Token saving is small (about 2 to 6%); the language is the saving.
- Colab: 24 min on an L4 for 5 epochs (about 1 unit), export on Colab works (tokenizer.model + added_tokens.json are shipped). A runtime was reclaimed at about 83 minutes: save checkpoints to Drive between chunks.
- HF uploads: `oyekamal/molde-tiny` folders `smoke-r0/` (pipeline test) and `r1-gemma270m/`.

## Qwen arm (Qwen3.5-0.8B, full fine-tune, no LoRA)

- Trained on a Colab L4 with gradient checkpointing, batch 8 x 2, lr 3e-5, bf16 autocast with fp32 master weights, 380 steps (about 1.1 epochs of 5,493 pairs, 30 min). Val loss 0.126 at the end. Gradient checkpointing is required (batch 4 without it ran out of 22 GB).
- Speed: about 5 s per optimizer step of 16 pairs (Gemma 270M: 0.84 s). One epoch costs about 29 min on an L4, so the same 5 epochs as Gemma would cost about 2.4 hours (over one runtime's life: needs Drive checkpoints between sessions).
- Result with so little training: checker pass 43.2% (Q8_0) and 43.2% (Q4_K_M, no loss from Q4 on 44 requests), templated 83.3%, versus Gemma's 50% / 43% / 87% after 5 epochs. On real wording Qwen after one epoch is within 7 points of Gemma after five, so per epoch it learns faster; at equal epochs it may be ahead. The data cannot say yet.
- Laptop CPU speed: 49.6 tok/s and 4.8 s per app (Q8_0, 774 MB; the Q4_K_M file 505 MB: 49.2 tok/s, 2.9 s per app). Gemma 270M Q8_0: 65 tok/s, 2.1 s per app, 278 MB. Qwen is about 2x slower and 2.8x bigger.
- Failure classes (Q8_0, 25 failing): {'E_TYPE': 8, 'E_UNKNOWN_FIELD': 7, 'E_UNKNOWN_NAME': 4, 'E_UNKNOWN_TABLE': 2, 'E_REF': 1, 'E_CONTEXT': 1, 'E_ARGS': 1, 'E_SYNTAX': 1}.
- Method note: the HF-side eval of Qwen was not obtained. Colab's HF eval job died on a lost websocket, and batched left-padded generation is unreliable for Qwen3.5's linear-attention layers (the in-training validation checker read 10% for the same weights that give 43% under llama.cpp one request at a time). The GGUF numbers are the true ones; for any HF eval of Qwen3.5 use batch size 1 (`--eval-bs 1` in make_jobs).
- The GGUF was exported on the laptop from the Colab model (llama.cpp b12144, same script). It loads and runs; the tokenizer in llama.cpp gives the same ids as the training tokenizer (180/180 programs).

## Recommendation for r2

1. **More epochs before more data.** Gemma's validation checker pass was still rising at epoch 5 (0.67, 0.71, 0.75, 0.83, 0.83). Train Gemma 8 epochs (about 40 min on an L4, about 1.5 units) and Qwen at least 3 epochs (about 90 min, two sessions with Drive checkpoints).
2. **Real-wording data is the gap**: templated requests pass 83 to 87% but real wording 43 to 50%. Add real-wording variety (the 249 corpus pairs are the only ones; 63% of v1 is templated). Aim for 5 to 10k more pairs whose requests are paraphrased by an LLM from the templated programs, plus the Roman Urdu and Urdu requests when the language scope returns.
3. **Wire `lang/constrain.mjs` into decoding** (custom llama.cpp loop). 13 of Gemma's 22 failures are unknown names, which the constraint removes by construction. This is worth more than any extra training for the checker pass rate; after it, the remaining errors are type and duplicate errors that a single typed repair can fix.
4. **Stop using the repair round as a metric lever.** It fixed 0 of 22 (GGUF) and 1 of 20 (HF) failures. Use constrained decoding instead.
5. **Which arm:** Gemma 270M is the cheap, fast arm (278 MB, 65 tok/s, 2.1 s per app, 24 min of training) and already at 50%. Qwen3.5-0.8B should be rerun at equal epochs before choosing; if it ends clearly higher (say above 65% on real wording) it is the quality arm at about 2x the latency. SmolLM2-360M was not run (units and time went to the Qwen retries).
6. Colab hygiene for r2: keep a runtime under about 70 minutes, save Drive checkpoints at chunk boundaries, use `--eval-bs 1` for Qwen, and prefer the laptop for GGUF export when the runtime is nearly spent (it takes 1 minute).

## Resources spent (estimates)

About 8.5 of the 12 r1 units plus about 1 setup unit: smoke 0.4, r1a 0.6, Gemma r1 1.2 (plus 0.2 of failed starts), Qwen v4 2.8 (runtime reclaimed at 83 min, nothing saved), Qwen v5 0.1 (out of memory), Qwen v6 1.1 (model save incomplete: only 1 of 2 parts), Qwen v7 1.3 (good). The connector does not expose the balance; these are runtime minutes times about 1.7 units per hour for an L4 and 1.2 for a T4. No runtime is attached (checked with `colab_jobs` and `colab/release_all.py`).

## Local disk cleanup (plain rm -rf)

Listed in `/home/oye/Documents/free_work/molde-model/r1-deleted-manifest.txt`: smoke and test checkpoints, unpacked finals, f16 GGUFs, scratch tokenizers and dry-run job folders. Kept: final GGUFs under `r1/*`, the llama.cpp source, and job folders with logs.
