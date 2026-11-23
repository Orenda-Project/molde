# MoldeScript v0

MoldeScript is the one small language the Molde model writes. A program describes a personal tool: its data, its formulas and its screens. The Molde runtime reads the program and draws the app. Nothing in a program is ever run as code.

There are two levels:

- **Level 1, the core.** Data, formulas, layout, text, shapes, inputs, repetition over data, conditions, state, events and actions. With level 1 alone you can build a chart, a calendar, a heat map, a water glass, a timer, a counter, a quiz, a scoreboard or a game board.
- **Level 2, the standard library.** Common pieces (a stat, a bar chart, a list, a form, a timer, a calendar) are written in MoldeScript itself in `lang/std/*.mo` and used as one-line shorthands. A program can also define its own components with `def`.

The runtime only implements level 1. Every level-2 use expands to level 1 before it is checked or drawn (`node lang/mo.mjs expand FILE` shows the expansion).

This file is the whole language. If something is not here, it is not in v0.

## 1. A first program

```
app "Water" drop ocean
table drink ml num 1..5000 unit "ml"
setting goal num = 2000 "Daily goal (ml)"
goal sum(drink.ml today), goal, "today", "ml"
quick drink, ml, [250, 500]
form drink
daybars last 7 days, sum(drink.ml on it)
list drink
```

Line by line: the app is called Water with the `drop` icon and the `ocean` theme; it keeps a table of drinks, each with an amount in ml; the user can change a daily goal; it shows today's total against the goal with a bar, two one-tap buttons, a form, a 7-day bar chart and a list of drinks.

## 2. Program shape

- **One statement per line.** Lines are read top to bottom; what is drawn appears in that order.
- **Line 1** is `app "Name" [icon] [theme]`, or the program is a single `ask` line (section 13).
- **Indentation** (two spaces per level) puts lines inside a block: `stack`, `row`, `grid`, `box`, `scroll`, `card`-styled boxes, `each`, `if`, `else`, `draw`, `poly`, `screen`, `def`, and component calls. Other lines cannot have children. Depth limit: 8.
- **Declare before use.** A name (table, field, setting, state, let, screen, component) can only be used on a later line.
- **Prefix-valid.** Because of the two rules above, a program cut after any line is still a valid program. The app can draw each line as the model writes it.
- **Comments** (`# ...`) are allowed in library files and by hand; the model does not write them (the grammar for model output has none).

## 3. Words, names and literals

| Thing | Form | Examples |
|---|---|---|
| name | lowercase letter, then lowercase letters, digits, `_` | `drink`, `ml`, `gold_rate` |
| text | double quotes; `\"`, `\\`, `\n` escapes; any language | `"Daily goal"` |
| number | digits with an optional decimal part; minus is an operator | `2000`, `2.5`, `-3` |
| time of day | `H:MM` or `HH:MM`, 24 hours | `8:00`, `21:30` |
| duration | whole number + `s`, `m`, `h` or `d` | `90s`, `25m`, `8h`, `1d` |
| yes/no | `yes`, `no` | |
| dates | `today` (a date), `now` (date and time) | |
| colours | theme roles only (section 8.4) | `accent`, `warn` |

**Keywords cannot be names.** Hard keywords: `accent add align all and app arc as ask bad bg big bold box button by card choice circle color days def desc divider draw each edge edit else every faint field fill from gap go good grid grow head height icon if image in index ink it keep label last let lib line mint month months muted new no not notify now ocean of on opacity options or pad path plum poly prev pt radius rect remind remove row save screen scroll set setting size slate slider slot soft sort space span stack state stroke surface swipe table tap text then thick to today toggle top unit warn week weeks where width year yes yesterday`.

These words are keywords only where they appear, so they **can** be names: `long num money bool date time when dur pick ref name src win act mon tue wed thu fri sat sun tiny small large huge start center end day at`. Function words such as `sum`, `count`, `max`, `round` can also be names (they are only keywords with a bracket, as in `sum(`).

**Spacing is fixed.** One space between words; no space inside brackets, around `.`, `..`, `|`, before `,` or `?`, or after a minus sign that starts a number. `node lang/mo.mjs format FILE` writes the canonical form; the grammar only accepts that form.

## 4. Data

### 4.1 Tables

```
table NAME ["Label"] FIELD, FIELD, ...
```

A table holds rows the user adds. A field is `name type[?] [range] [= default] ["Label"] [unit "u"]` (range, default, label and unit in any order).

| Type | Holds | Notes |
|---|---|---|
| `text` | one line of text | |
| `long` | many lines of text | |
| `num` | a number | range `1..5000`, `0..` (no upper limit) |
| `money` | an amount of money | shown in the user's currency |
| `bool` | yes/no | starts as `no`; shown as a tick box |
| `date` | a calendar day | |
| `time` | a time of day | |
| `when` | a date and time | |
| `dur` | a duration | shown as `m:ss` or `h:mm` |
| `image` | a picture the user picks from the phone | |
| `pick A\|B\|C` | one of fixed options | options are words or `"texts with spaces"` |
| `ref TABLE` | a link to a row of an earlier table | |

`?` after the type makes the field optional; every other field (except `bool`) must be filled in when a row is added, unless it has a default.

**Every row also has `at`** (when it was added; type `when`, editable) and `id`. Time windows (section 5.3) always look at `at`. A table with no fields (`table zikr`) is a plain log of moments, which is how counters work.

```
table spend amount money, category pick Food|Bills|Travel = Food, note text?
table check habit ref habit
table zikr
```

### 4.2 Settings, state and named formulas

```
setting NAME TYPE [range] [= default] ["Label"]     # a value the user can change; listed in the app's settings
state NAME TYPE [= formula] [keep]                  # a value the screen holds (selected tab, running timer, search text)
state NAME new TABLE [keep]                         # a new row being filled in (a form); `keep` keeps values after saving
let NAME = formula                                  # a name for a formula; read-only, always up to date
```

Settings and state persist on the phone. `state` and `let` inside a block (for example inside `each`) belong to that block; inside `each` there is one per item. `edit NAME` (as an action) lets the user change a setting or state in a small sheet.

## 5. Formulas

Formulas always finish: there are no loops except over data, a bounded range or a window of days.

### 5.1 Values and operators

- Arithmetic: `+ - * / %` and brackets. `x / 0` is `0`. An empty optional number counts as `0`.
- Comparison: `= != < > <= >=` give yes/no. Join with `and`, `or`, `not`.
- Dates: `date + 3` (days later), `date - date` (days between), `time - time` and `when - when` (a duration).
- Durations: `dur + dur`, `dur * num`, `dur / num`, `dur / dur` (a number, for example `slept / 1h` is hours).
- Money mixes with numbers and stays money.
- Names: a setting, state or let; `it` (the current item, section 7.1); `index` (0, 1, 2 … inside `each`); paths with `.`: `it.name`, `it.habit.name` (follow a `ref`), `d.mood` (a field of a new row).
- **Back links:** `it.check` means the rows of table `check` that link to the row `it` (the `check` table must have exactly one `ref` to `it`'s table). `count(it.check today)`, `toggle it.check`, `sum(f.cost.amount)`.

### 5.2 Aggregates (over the rows of a table)

```
count(T [window] [where condition])      sum(T.field ...)   avg(T.field ...)   min(T.field ...)   max(T.field ...)
last(T.field ...)   first(T.field ...)   (latest/earliest value; last(T) is the latest row)
streak(T ...)   days in a row, up to today, with at least one row (yesterday counts if today has none yet)
best(T ...)     the longest such run ever
since(T ...)    whole days since the latest row
gap(T ...)      average days between the days that have rows
```

`T` can be a table, a back link (`it.check`), a group (section 7.1) or a column (`T.field`). Inside `where`, bare names are the table's own fields first: `count(task where done = no and due < today)`. Aggregates of nothing are `0` (`last`/`first`: empty).

### 5.3 Time windows

| Window | Rows whose `at` is … |
|---|---|
| `today`, `yesterday` | on that day |
| `week`, `month`, `year` | in the current one (weeks start Monday) |
| `prev week`, `prev month`, `prev year` | in the previous one |
| `last 7 days`, `last 4 weeks`, `last 3 months` | in the last N, today included (N from 1 to 366) |
| `on DATE` | on that day, for example `on it` inside `each days ...` |
| `week of DATE`, `month of DATE`, `year of DATE` | in the one containing DATE (for month navigation) |
| `all` (or nothing) | any time |

### 5.4 Folds (over any source, with `it` = each item)

```
sumof(SOURCE, formula)   maxof(SOURCE, formula)   minof(SOURCE, formula)   countof(SOURCE, condition)
```

`sumof(sets today, it.kg * it.reps)`, `maxof(habit, streak(it.check))`, `countof(days last 14 days, count(entry on it) > 0)`. Sources are listed in section 7.1.

### 5.5 Functions

| Function | Gives |
|---|---|
| `if(condition, a, b)` | `a` or `b` (same type) |
| `round(x)`, `floor(x)`, `abs(x)`, `clamp(x, lo, hi)` | numbers |
| `len(text)`, `has(text, part)` | length; yes if `part` is in `text` (ignores case; `has(x, "")` is yes) |
| `weekday(d)` | 1 (Monday) to 7 |
| `monthday(d)`, `monthdays(d)` | day of the month; days in that month |
| `dayname(d)`, `monthname(d)` | `"Mon"`; `"November 2026"` |
| `hour(t)` | 0 to 23 |
| `addmonths(d, n)` | the same day n months later (or earlier, with a minus) |

## 6. Showing things

### 6.1 Layout blocks

| Line | What it is |
|---|---|
| `stack` | children one under another (the screen itself is a stack) |
| `row` | children side by side; wraps on small screens |
| `grid N` | children in N columns |
| `box` | one plain area (for colour cells, tiles, seats) |
| `scroll` | a row that scrolls sideways |
| `screen NAME "Label" [icon]` | a screen; the app gets a tab bar. Only at the top level. Lines outside any screen form the first tab |

### 6.2 Content and inputs

| Line | What it shows |
|---|---|
| `text PART PART ...` | parts are texts in quotes or formulas, joined by one space (no space before a text that starts with `, . ; : ! ? % ) /`, none after one ending in `( / #`) |
| `button PART ... tap ACTION` | a button (a `tap` is required) |
| `icon NAME` | an icon by name (section 8.5), or a formula giving a name |
| `image FORMULA` | a picture from an `image` field |
| `space [N]`, `divider` | empty space; a thin line |
| `field TARGET ["Label"]` | an input for a setting, a state, a field of a new row (`d.note`) or a field of a row (`it.qty`). `field d` (a whole new row) shows one input per field, typed by the field's type |
| `toggle TARGET` | a tick box for a yes/no setting, state or row field |
| `toggle TABLE [window] [where field = value ...]` | a tick box that is on when the table has a row in the window (default today); tapping adds or removes that row. Inside `each`, `toggle it.check` links the new row to `it`. `where` values are copied into the new row |
| `choice TARGET` | tap chips for a `pick`, `ref` or yes/no value |
| `slider TARGET LO..HI` | a slider for a number |

### 6.3 Drawing

```
draw [W, H] [mods]        # a canvas W wide and H tall in its own units (default 100, 100), scaled to fit
  rect X, Y, W, H
  circle CX, CY, R
  arc CX, CY, R, FROM, TO       # degrees, 0 at the top, clockwise
  line X1, Y1, X2, Y2
  path "M6 4h44l-6 100H12z"     # a fixed SVG path
  label X, Y, PART ...          # text centred at X, Y
  poly                          # a line through the points below it
    pt X, Y
```

Every number can be a formula, so sizes, positions and colours follow the data: a glass that fills, a ring that closes, a bar per day. `each` and `if` can be used inside `draw` and `poly`. Shapes take `fill`, `stroke`, `thick`, `radius`, `opacity` and `tap`.

## 7. Repetition and conditions

### 7.1 each

```
each SOURCE [as NAME]
  ...children, repeated for every item...
```

| Source | Items |
|---|---|
| `TABLE [window] [where ...] [by GROUP] [sort FIELD [desc]] [top N]` | rows (newest first unless sorted). With `by day\|week\|month\|FIELD` the items are groups: `it.key`, `count(it)`, `sum(it.amount)`, and `each it` for the group's rows |
| back link `it.check ...` | rows linked to `it` |
| `days WINDOW` | dates, for calendars and charts (`each days last 70 days`) |
| `options T.field` | the options of a `pick` field |
| `[250, 500, 1000]` | the listed values |
| `1..9`, `1..n` | whole numbers (at most 1000) |

Inside the block, `it` is the item and `index` its position from 0. **`as NAME` names the item and leaves `it` alone**, so an inner `each` can still reach the outer item: `each habit as h` then `each days last 7 days` with `count(h.check on it)`.

### 7.2 if / else

```
if condition
  ...
else
  ...
```

## 8. Style

### 8.1 Modifiers (end of a line, any order, each at most once)

| Modifier | Effect |
|---|---|
| `big` / `head` / `faint` | text roles: the main number; a heading; small quiet text |
| `size tiny\|small\|large\|huge`, `bold` | text size and weight |
| `color C`, `fill C`, `stroke C` | text colour; background or shape fill; outline (C is a colour formula) |
| `thick N`, `radius N`, `opacity N` | line width; corner radius; 0 to 1 |
| `width N`, `height N` | size in screen points; `grow` takes the free space in a row |
| `pad N`, `gap N`, `span N` | inner space; space between children (both on a 0 to 6 scale); columns to span in a grid |
| `align start\|center\|end` | alignment |
| `card` | a raised surface |
| `tap ACTION`, `swipe ACTION` | what a tap or a sideways swipe does |

### 8.2 Colours

Only theme roles: `accent ink muted soft good warn bad bg surface edge`. A colour can be a formula: `fill if(it.qty <= it.low, warn, soft)`. Raw colour codes are not part of v0; themes keep every app readable in light and dark mode.

### 8.3 Themes

`ocean mint slate ink plum` (the five kit themes). Locale numbers, currency, dates, right-to-left text and dark mode come from the runtime.

### 8.4 Icons

`drop check wallet dumbbell book clock heart star moon sun leaf cart list calendar pill money user users bell timer calc home cup bed scale smile note pen gift tag package chart flame bolt target trophy coin bag phone pin flag music map car bus plane bike walk run baby paw plant tree cloud rain snow fire coffee food apple bread fish egg milk tooth eye brain mosque beads school pencil alarm hourglass dice cards ball game board shield key lock seat plus minus`

## 9. Actions and events

### 9.1 Actions (after `tap`, `swipe`, `every`, `when`; chain with `then`)

| Action | Does |
|---|---|
| `add TABLE [field = formula, ...]` | adds a row (`at` is now unless set) |
| `set TARGET = formula` | changes a state, a setting or a row field (`set it.qty = it.qty - 1`) |
| `toggle TABLE [window] [where ...]` | adds or removes the matching row, like the `toggle` line |
| `remove ROW` | removes a row; the user gets an Undo, and nothing is ever deleted for good |
| `edit ROW` / `edit NAME` | opens the editor sheet for a row, a setting or a state |
| `save NAME` | saves a new row (`state NAME new TABLE`), checks required fields, then clears it (unless `keep`) |
| `go SCREEN` | opens a screen |
| `notify PART ...` | shows a notice (and a phone notification if the app is closed) |
| `remind "Text" in DURATION` | schedules one reminder |

Values written to a field are kept inside its range (a stock count cannot go below `0..`).

### 9.2 Events

```
every DURATION [if condition] ACTION ...     # repeats while the app is open (at least 1s), e.g. a timer tick
when condition ACTION ...                    # runs once each time the condition turns from no to yes
remind "Text" at 8:00, 21:00 [on mon wed fri] [if condition]
remind "Text" at TABLE.field                 # one reminder per row: daily at a time field, once on a date field
remind "Text" every 2h [from 9:00 to 21:00] [if condition]
```

`remind` lines are top level; they become phone notifications even when the app is closed.

## 10. Components

### 10.1 Using one

```
NAME value, value, ...
```

Values are matched to the component's parameters in order; trailing ones with defaults can be left out. A component line can have indented children if the component has a `slot`.

### 10.2 Defining one

```
def NAME param kind [= default], param kind [= default], ...
  ...level-1 lines (and other components)...
  slot                     # where the caller's indented lines go (optional)
```

Kinds: values `num money text bool date time dur color icon`; `table` (a table name), `name` (a field, setting or state name), `src` (any `each` source), `win` (a time window), `act` (actions).

A use **substitutes the values by name**, like filling in a template, and then the result is checked as ordinary level 1. So a value can mention `it`, meaning the item of the component's own `each`: in `daybars last 7 days, sum(drink.ml on it)` the `it` is each day of the chart. `state` inside a def is private to each use. A component cannot use itself, and nesting stops at 8.

```
def panel title text
  stack card gap 1
    text title head
    slot
panel "Today"
  text count(drink today) "drinks"
```

## 11. The standard library (level 2)

Written in MoldeScript in `lang/std/*.mo`; read those files to see exactly what each one draws.

| Use | Shows |
|---|---|
| `stat value [, caption]` | a big number with a caption |
| `goal value, target [, caption, suffix]` | "value of target" and a progress bar (turns `warn` above the target) |
| `ring value, target [, caption]` | a progress ring with the value in the middle |
| `daybars WINDOW, value` | a bar per day of the window (`it` = the day) |
| `bars SOURCE, value [, key]` | a bar per item of any source (`it` = the item) |
| `trend SOURCE, value` | a line through the items (`it` = the item) |
| `heat WINDOW, value [, peak]` | a 7-column heat map of the days (`it` = the day); darker as value nears peak |
| `share SOURCE, value, key` | labelled bars comparing items, for example `share spend month by category, sum(it.amount), it.key` |
| `list SOURCE` | rows (tap to edit, swipe to remove), with an empty message |
| `log SOURCE` | rows grouped by day (the source may not use `by`, `sort` or `top`) |
| `form TABLE [, button text]` | inputs for every field and a save button; keeps the last values |
| `quick TABLE, field, [values]` | one-tap buttons that add a row with that field set |
| `timer DURATION [, caption, actions when done]` | a countdown with start, pause and reset; default end action `notify "Time is up"` |
| `calendar SOURCE [, date]` | a month grid; days with rows are filled; tap a day to add or remove its row |
| `monthnav NAME` | back/forward arrows for a date state, used with `month of NAME` windows |

## 12. What the runtime gives every app for free

These cost no tokens and cannot be turned off by a program:

- an editor sheet for any row (`edit it`) and for settings, built from the field types; validation of required fields and ranges;
- remove with Undo, and soft delete: no data is ever destroyed;
- a settings sheet listing every `setting`, with its label;
- a tab bar when the program has screens;
- formatting of numbers, money, dates, times and durations in the user's locale; right-to-left layout for right-to-left text;
- the five themes in light and dark mode, contrast and touch sizes;
- phone notifications for `remind` and `notify`;
- every version of the program kept, the request that made it, and one-tap undo of a change;
- backup and export of the data.

## 13. ask

When a request is unclear, the whole program is one line:

```
ask "Do you want to track money you spend or money people owe you?" "Spending" "Money owed" "Both"
```

The app shows the question with tap answers and builds again with the answer added to the request.

## 14. Edits and data safety

To change an app, the model writes the whole new program. `node lang/mo.mjs diff OLD NEW` lists the changes and gives a verdict:

- a new table or field is **safe** (old rows get the default or stay empty);
- a table, field or setting that disappears is **hidden, never dropped**: its data stays and returns if the name comes back;
- renaming a field is a hide plus an add (the diff says so; old values are not moved);
- changing a stored type is **refused**, except widenings that keep every value: `text` to `long`, `pick` to `text`, `num` to/from `money`, `date` to `when`, and adding `pick` options. Removing a `pick` option is allowed; rows keep their old value.

There is no statement that deletes data.

## 15. Deliberately impossible in v0

- loops other than `each` over data, a range or a window; recursion; functions that compute values (a `def` draws UI, `let` names a formula);
- deleting data for good, or changing a field's type;
- network, internet, accounts, sync between phones, sharing; camera, microphone, sensors, location; files other than the app's own export;
- text building beyond joining parts (no substring, no number formatting choices), sorting by a formula, joins other than `ref` and back links;
- raw colours, fonts, animation, drag and drop, gestures other than tap and swipe;
- heavy algorithms (search over many options, optimisation, maths beyond the functions above).

## 16. Errors

`node lang/mo.mjs check FILE` prints each problem as `line N: CODE: what is wrong. Fix: what to do.`, ready to paste into a repair prompt.

| Code | Meaning |
|---|---|
| `E_SYNTAX` | the line does not match any statement |
| `E_RESERVED` | a keyword used as a name, or a built-in field (`at`, `id`) redeclared |
| `E_HEADER`, `E_ASK` | the first line is not `app`/`ask`; an `ask` program has more lines |
| `E_INDENT`, `E_CHILD` | indentation is off; a line that cannot have children has some |
| `E_UNKNOWN_TABLE`, `E_UNKNOWN_FIELD`, `E_UNKNOWN_NAME`, `E_UNKNOWN_COMPONENT` | a name that is not declared above |
| `E_TYPE` | a value of the wrong type |
| `E_WINDOW` | a bad time window |
| `E_REF` | a `ref` to a table not declared above, or an unclear back link |
| `E_DUP` | a name, field, option or modifier used twice |
| `E_CONTEXT` | a statement in the wrong place (`it` outside `each`, a shape outside `draw`, `table` inside a block, `else` without `if`) |
| `E_ARGS`, `E_KIND`, `E_RECURSION` | wrong values for a component; a component that uses itself |
| `E_OPTION`, `E_DEFAULT`, `E_RANGE` | a value that is not one of a `pick`'s options; a bad default; a bad range |
| `E_ICON`, `E_ACTION`, `E_TARGET`, `E_REQUIRED` | unknown icon; button without `tap`; something that cannot be changed; an `add` missing a required field |

## 17. Version

This is **MoldeScript v0**. The version is the first word of the program: `app` (and `ask`) mean v0. A later version that changes meaning will start programs with a new first word (for example `app1`); the runtime keeps a reader for every version it has shipped, and stores the language version next to every saved program.

## 18. More examples

`lang/examples/` has 30 programs (`INDEX.json` says which are std-style and which draw their main visual from level 1) and `lang/examples/edits/` has 20 edits (`before.mo`, `request.txt`, `after.mo`). A custom one, a tasbeeh counter with a ring:

```
app "Tasbeeh" beads mint
table zikr phrase pick SubhanAllah|Alhamdulillah|AllahuAkbar = SubhanAllah
setting target num = 33 "Count to"
state ph text = "SubhanAllah"
let n = count(zikr today where phrase = ph)
row gap 1
  each options zikr.phrase
    button it fill if(ph = it, accent, soft) tap set ph = it
draw width 240 tap add zikr phrase = ph
  circle 50, 50, 44 stroke soft thick 8
  arc 50, 50, 44, 0, 360 * (n % target) / target stroke accent thick 8
  label 50, 46, n % target big
  label 50, 64, "Round" floor(n / target) + 1 faint
when n > 0 and n % target = 0 notify "Round complete"
```
