# MoldeScript v0

MoldeScript is the one small language the Molde model writes. A program describes a personal tool: its data, its formulas and its screens. The Molde runtime reads the program and draws the app. Nothing in a program is ever run as code.

There are two levels:

- **Level 1, the core.** Data, formulas, layout, text, shapes, inputs, repetition over data, conditions, state, events and actions. With level 1 alone you can build a chart, a calendar, a heat map, a water glass, a timer, a counter, a quiz, a scoreboard or a game board.
- **Level 2, the standard library.** Common pieces (a stat, a bar chart, a list, a form, a timer, a calendar) are written in MoldeScript itself in `lang/std/*.mo` and used as one-line shorthands. A program can also define its own components with `def`, and its own formulas with `let name(values) = ...`.

The runtime only implements level 1. Every level-2 use expands to level 1 before it is checked or drawn (`node lang/mo.mjs expand FILE` shows the expansion). What each statement *means* is pinned down in [`SEMANTICS.md`](SEMANTICS.md) and executed by the reference evaluator `eval.mjs`; what a renderer receives is [`UITREE.md`](UITREE.md).

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
- **Indentation** (two spaces per level) puts lines inside a block: `stack`, `row`, `grid`, `box`, `scroll`, `each`, `if`, `else`, `draw`, `poly`, `screen`, `def`, and component calls. Other lines cannot have children. Depth limit: 8.
- **Declare before use.** A name (table, field, setting, state, let, screen, component) can only be used on a later line. Tables, settings, states, lets and screens share one set of names.
- **Prefix-valid.** Because of the two rules above, a program cut after any line is still a valid program.
- **Comments** (`# ...`) are allowed in library files and by hand; the model does not write them.

### 2.1 Streaming rules (how a program appears while it is written)

- The renderer draws **only complete lines**. A line is complete when its newline has arrived and it passes the checker together with the lines above it; the screen grows line by line.
- `every`, `when` and `remind` lines **do nothing until the whole program is complete** and checked: no timer ticks and no reminder is scheduled from a half-written program.
- An **edit** (a rewrite of an existing app) replaces the running version **only when the new program is complete, passes the checker, and the data-safety diff says safe** (section 14). Until then the old version keeps running; if the new one fails, the old one stays.

## 3. Words, names and literals

| Thing | Form | Examples |
|---|---|---|
| name | lowercase letter, then lowercase letters, digits, `_` | `drink`, `ml`, `gold_rate` |
| text | double quotes; `\"`, `\\`, `\n` escapes; any language | `"Daily goal"` |
| number | digits with an optional decimal part | `2000`, `2.5`, `-3` |
| time of day | `H:MM` or `HH:MM`, 24 hours | `8:00`, `21:30` |
| duration | whole number + `s`, `m`, `h` or `d` | `90s`, `25m`, `8h`, `3d` |
| yes/no | `yes`, `no` | |
| dates | year-month-day; `today` (a date), `now` (date and time) | `2026-11-30`, `today` |
| option value | the option word as declared, bare | `Food`, `Eating_out` |
| colour | a theme role, a named colour or `hue(N)` (section 8.2) | `accent`, `red`, `hue(200)` |

**Keywords are contextual.** A word is a keyword only where the grammar expects that keyword; anywhere else it is a name. So everyday words such as `label size color line text image icon unit card top from to year month week last slot row box state field app days every on` are fine as table, field, setting or state names. When a line could be read both ways, the keyword reading wins (so in `text a bold`, `bold` is a style); write `(bold)` to show a value called bold. Your names win over colour words: if you declare `good`, then `good` means your value, not the colour.

**Only 12 words are reserved** and can never be names: `it index yes no today now and or not then where as`.

**Spacing is fixed.** One space between words; no space inside brackets, around `.` and `|`, before `,` or `?`, after a minus sign that starts a number, or around `..` in a range like `1..10` (but `0.. = 0` keeps the space for an open range). `node lang/mo.mjs format FILE` writes the canonical form, which is the only form the grammar accepts; the decoding pipeline always formats.

**One spelling per idea.** Where two spellings would mean the same thing, the formatter rewrites to the one below, so the model only ever sees one:

| Write | Not |
|---|---|
| `"Total" count(t)` (a text line) | `text "Total" count(t)` (the `text` keyword is only needed when the line starts with a bare name: `text goal`) |
| `big`, `head`, `faint` | `size huge bold`, `size large bold`, `size small color muted` |
| `where kind = Food` (option values bare) | `where kind = "Food"` |
| `pick Eating_out\|Home` (an underscore shows as a space) | `pick "Eating out"\|Home` |
| `tiny` `small` `large` `huge` | `size tiny` ... |
| `sum(t, it.a * it.b)`, `count(habit, streak(it.check) > 3)`, `max(src, f)`, `min(src, f)` | `sumof(...)`, `countof(...)`, `maxof(...)`, `minof(...)` |
| `goal value, target` | `ring value, target` (one way to show progress toward a target) |
| `list t by day` | `log t` |

## 4. Data

### 4.1 Tables

```
table NAME [was OLD] ["Label"] FIELD, FIELD, ...
```

A table holds rows the user adds. A field is `name type[?] [range] [= default] ["Label"] [unit "u"] [was OLD]` (the parts after the type in any order).

| Type | Holds | Notes |
|---|---|---|
| `text` | one line of text | |
| `long` | many lines of text | |
| `num` | a number | range `1..5000`, `0..` (no upper limit) |
| `money` | an amount of money | stored to 2 decimals; shown in the user's currency |
| `bool` | yes/no | starts as `no`; shown as a tick box |
| `date` | a calendar day | |
| `time` | a time of day | |
| `when` | a date and time | |
| `dur` | a length of time | shown as `m:ss` or `h:mm` |
| `image` | a picture the user picks from the phone | |
| `pick A\|B\|C` | one of fixed options | options are words; `_` shows as a space; `New was Old` renames an option |
| `ref TABLE` | a link to a row of an earlier table | |

`?` goes **right after the type** (`seat num? 1..10`) and makes the field optional; every other field (except `bool`) must be filled in when a row is added, unless it has a default.

**Every row also has `at`** (when it was added; type `when`, editable) and `id`. Time windows (section 5.3) look at `at`. A table with no fields (`table zikr`) is a plain log of moments.

`was` is for renaming without losing data (section 14): `table drinks was drink`, `amount num was ml`, `pick Meals was Food|Bills`. A `was` that has already been applied is harmless and may stay.

### 4.2 Settings, state and named formulas

```
setting NAME TYPE [range] [= default] ["Label"] [was OLD] [set]   # a value the user can change; listed in the app's settings
state NAME TYPE [was OLD] [= formula] [keep]        # a value the screen holds (selected tab, running timer, search text); was renames it keeping its value
state NAME new TABLE [keep]                         # a new row being filled in (a form); keep keeps values after saving
let NAME = formula                                  # a name for a formula; read-only, always up to date
let NAME(value kind, ...) = formula                 # a formula with values, used as NAME(...) anywhere below
                                                    # a value can be a row: let worth(r item) = r.qty * r.price
```

`TYPE` is any field type, including `pick A|B` (`state view pick Grid|List = Grid`) and `date` (`setting start date = today`). Settings and state persist on the phone. A setting's `= default` only fills it when nothing is stored; a value the user saved always wins. An edit that must change the saved value says so with `set` at the end of the line (`setting target num = 100 set`); the change is listed and undoable. `state` and `let` inside a block belong to that block (inside `each`, one per item). Kinds for `let` values: `num money text bool date time dur`. A `let` with values is filled in where it is used, like writing the formula out: `let win(m text) = count(...)` then `win(X)`.

## 5. Formulas

Formulas always finish: there are no loops except over data, a bounded range or a window of days.

### 5.1 Values and operators

- Arithmetic: `+ - * / %` and brackets. `x / 0` is `0`.
- Comparison: `= != < > <= >=` give yes/no. Join with `and`, `or`, `not`.
- Dates: `date + 3` (days later), `date - date` and `date - when` (whole days between), `date + 2h` (a date and time), `when - when` (a length of time). A date compared with a date and time compares whole days (`at <= today` includes all of today).
- `time - time` is the forward length from the second time to the first, wrapping past midnight: bed `23:00` to wake `7:00` is `wake - bed` = 8 hours.
- Durations: `dur + dur`, `dur * num`, `dur / num`, `dur / dur` (a number: `slept / 1h` is hours).
- Money mixes with numbers and stays money.
- Names: a setting, state or let; `it` (the current item, section 7.1); `index` (0, 1, 2 … inside `each`); `pi`; paths with `.`: `it.name`, `it.habit.name` (follow a `ref`), `d.mood` (a field of a new row).
- **Back links:** `it.check` means the rows of table `check` that link to the row `it` (the `check` table must have exactly one `ref` to `it`'s table). `count(it.check today)`, `toggle it.check`, `sum(f.cost.amount)`. After a ref you can go on: `sum(it.dish.ingredient.cost)`.
- **Empty values:** an optional field nobody filled in, `last()` of no rows and `since()` of no rows are empty. Empty plus anything is empty; every comparison with empty is no; sums and averages skip empty values; a text shows empty as nothing (or `–` when it is the only part).
- Option values are written bare: `where category = Food`, `add spend category = Bills`.

### 5.2 Aggregates (over the rows of a table)

```
count(T [window] [where condition])      sum(T.field ...)   avg(T.field ...)   min(T.field ...)   max(T.field ...)
last(T.field ...)   first(T.field ...)   (latest or earliest value; last(T) is the latest row)
streak(T ...)   days in a row, up to today, with at least one row (yesterday counts if today has none yet)
best(T ...)     the longest such run ever
since(T ...)    whole days since the latest row (empty if there are none: never 0 by accident)
due(T ..., n)   yes when there are no rows or the latest is n or more days ago (never done counts as overdue)
gap(T ...)      average days between the days that have rows (empty with fewer than 2 days)
```

**The window comes first, then `where`.** `T` can be a table, a back link (`it.check`), a group (section 7.1) or a column (`T.field`). Inside `where` (and `sort`), bare names are the table's own fields first: `count(task where done = no and due < today)`. If a field and your state share a name, the field wins inside `where`; `where team = team` is an error (E_SELF_COMPARE): rename the state.

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
sum(SOURCE, formula)   max(SOURCE, formula)   min(SOURCE, formula)   count(SOURCE, condition)
```

`sum(sets today, it.kg * it.reps)`, `max(habit, streak(it.check))`, `count(days last 14 days, count(entry on it) > 0)`. With one value these are the aggregates of section 5.2; with a source and a formula they work item by item (`it` is the item). `min(a, b)` and `max(a, b)` of two values are the smaller and the larger. Sources are listed in section 7.1.

### 5.5 Functions

| Function | Gives |
|---|---|
| `if(condition, a, b)` | `a` or `b` (one value, both the same type; to mix words and numbers use two text parts) |
| `min(a, b)`, `max(a, b)` | the smaller or larger of two values (with one column inside, they are aggregates) |
| `round(x)`, `floor(x)`, `abs(x)`, `clamp(x, lo, hi)` | numbers (`round` goes half away from zero; `x % n` is never negative) |
| `sin(deg)`, `cos(deg)`, `pi` | for placing things on a circle (degrees, 0 at the top when used as `x + r * sin`, `y - r * cos`) |
| `len(text)`, `has(text, part)` | length; yes if `part` is in `text` (ignores case; `has(x, "")` is yes) |
| `weekday(d)` | 1 (Monday) to 7 |
| `monthday(d)`, `monthdays(d)`, `month(d)`, `year(d)` | day of the month; days in that month; month 1 to 12; year |
| `dayname(d)`, `monthname(d)` | `"Mon"`; `"November 2026"` |
| `hour(t)`, `minute(t)`, `second(t)` | parts of a time, a date and time, or a length of time |
| `addmonths(d, n)` | the same day n months later (or earlier, with a minus) |
| `hue(n)` | a colour from 0 to 360 (section 8.2) |
| `random(n)`, `random(TABLE ...)` | a whole number from 1 to n, or a random row; only inside actions (`tap set roll = random(6)`) |
| `nth(TABLE ..., n)` | the nth row (from 1) in the query's order (`nth(card sort front, 1)`) |
| `pow(x, y)` | x to the power y |
| `join(a, b, ...)` | the parts joined with no spaces: `join(runs, "/", wickets)` |
| `fixed(x, n)` | x with n decimals (otherwise the phone formats numbers: separators, currency, short forms) |
| `plural(n, "day")` | `1 day`, `3 days` |
| `words(formula)` | the formula read out in plain English (used for default captions) |

A function's result can be followed by a field: `last(item).name`, `random(card).front`.

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
| `"text" formula "text" ...` | a text line: parts are texts in quotes or formulas, joined by one space (no space before a text that starts with `, . ; : ! ? % ) /`, none after one ending in `( / #`). A line that starts with a quote, a number, a function, a bracket or a name is a text line (`total big`, `it faint`, `it.name grow`), **unless the name is a component** (std or your own `def`): `list card` calls `list` with the table `card`. To show a value whose name is a component, write `text NAME` |
| `text name ...` | the same, for a line that starts with a bare name |
| `button PART ... tap ACTION` | a button (a `tap` is required) |
| `icon NAME` | an icon by name (section 8.4), or a formula giving a name |
| `image FORMULA` | a picture from an `image` field |
| `space [N]`, `divider` | empty space; a thin line |
| `field TARGET ["Label"]` | an input for a setting, a state, a field of a new row (`d.note`) or a field of a row (`it.qty`). `field d` (a whole new row) shows one input per field |
| `toggle TARGET` | a tick box for a yes/no setting, state or row field |
| `toggle TABLE [window] [where field = value ...]` | a tick box that is on when the table has a row in the window (default today); tapping adds or removes that row. With `all` the mark does not depend on the day (a favourite: `toggle it.fav all`); tapping it off removes every matching row. Inside `each`, `toggle it.check` links the new row to `it`. `where` values are copied into the new row |
| `choice TARGET` | tap chips for a `pick`, `ref` or yes/no value |
| `slider TARGET LO..HI` | a slider for a number |

### 6.3 Charts and drawing

```
plot X0..X1, Y0..Y1 [axes] [gridlines]   # a chart frame in data units (y grows upward); the ranges may be formulas
  rect X, Y, W, H                        # in data units: rect index + 0.15, 0, 0.7, value is a bar standing on the axis
  poly                                   # pt X, Y in data units: a line chart
  tick X, PART ...                       # a label under the x axis at X
  ytick Y, PART ...                      # a label beside the y axis at Y (without any, y labels come from the range)
```

`axes` draws both axes with labels; `gridlines` draws lines at the y labels. Inside a plot, rows of a table come oldest first (time left to right) unless you sort them. The std `daybars`, `bars` and `trend` are plots.


```
draw [W, H] [mods]        # a canvas W wide and H tall in its own units (default 100, 100), scaled to fit
  rect X, Y, W, H
  circle CX, CY, R        # or circle R: centred in the canvas
  arc CX, CY, R, FROM, TO # or arc R, FROM, TO; degrees, 0 at the top, clockwise; with fill it is a pie wedge
  line X1, Y1, X2, Y2
  path "M6 4h44l-6 100H12z"
  label X, Y, PART ...    # text centred at X, Y
  poly                    # a line through the points below it
    pt X, Y
```

Every number can be a formula, so sizes, positions and colours follow the data. `each`, `if` and `let` can be used inside `draw` and `poly`. Shapes take `fill`, `stroke`, `thick`, `radius`, `opacity` and `tap`.

## 7. Repetition and conditions

### 7.1 each

```
each SOURCE [as NAME]
  ...children, repeated for every item...
```

| Source | Items |
|---|---|
| `TABLE [window] [where ...] [by GROUP] [sort FORMULA [desc] \| shuffle] [top N]` | rows (newest first unless sorted). `sort` takes any formula of the row (`sort count(it.goal) desc`); `shuffle` gives a random order that stays the same while the app runs (each row gets its place when it is added). With `by day\|week\|month\|FIELD\|LINK.FIELD` the items are groups: `it.key`, `count(it)`, `sum(it.amount)`, and `each it` for the group's rows |
| back link `it.check ...` | rows linked to `it` |
| `days WINDOW` | dates, oldest first, for calendars and charts (`each days last 70 days`) |
| `options T.field` | the options of a `pick` field |
| `[250, 500, 1000]` | the listed values |
| `1..9`, `1..n` | whole numbers (at most 1000) |

`each SOURCE ... empty "No entries yet"` shows that text when there are no items.

Inside the block, `it` is the item and `index` its position from 0. **`as NAME` names the item and leaves `it` alone**, so an inner `each` (or a chart's own loop) can still reach the outer item: `each habit as h` then `daybars last 7 days, count(h.check on it)`.

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
| `tiny` / `small` / `large` / `huge`, `bold` | text size and weight |
| `color C`, `fill C`, `stroke C` | text colour; background or shape fill; outline |
| `thick N`, `radius N`, `opacity N` | line width; corner radius; 0 to 1 |
| `width N`, `height N` | size in screen points; `grow` takes the free space in a row |
| `pad N`, `gap N`, `span N` | inner space; space between children (both 0 to 6); columns to span in a grid |
| `align start\|center\|end` | alignment |
| `card` | a raised surface |
| `ratio N`, `middle`, `full` | keep width / height at N (`ratio 1` makes square cells); centre the block in the free space; take the full screen height |
| `tap ACTION`, `swipe ACTION` | what a tap or a sideways swipe does |
| `alt "words"` | what a screen reader says for this line (a drawing, an icon, a chart); text lines and buttons already say their text |
| `bar` | on a `row`: the app bar (the title and the main action), drawn at the top by the phone |

### 8.2 Colours

Theme roles `accent ink muted soft good warn bad bg surface edge`; named colours `red orange yellow green teal blue purple pink grey black white`; and `hue(N)` for any hue from 0 to 360. The theme picks the exact shade of every colour for light and dark mode and keeps text readable. A colour can be a formula: `fill if(it.qty <= it.low, warn, soft)`. Raw colour codes are not part of v0.

### 8.3 Themes

`ocean mint slate ink plum`, the third word of `app`. Locale numbers, currency, dates and dark mode come from the runtime.

### 8.4 Icons

`drop check wallet dumbbell book clock heart star moon sun leaf cart list calendar pill money user users bell timer calc home cup bed scale smile note pen gift tag package chart flame bolt target trophy coin bag phone pin flag music map car bus plane bike walk run baby paw plant tree cloud rain snow fire coffee food apple bread fish egg milk tooth eye brain mosque beads school pencil alarm hourglass dice cards ball game board shield key lock seat plus minus tool box grid`

## 9. Actions and events

### 9.1 Actions (after `tap`, `swipe`, `every`, `when`; chain with `then`)

| Action | Does |
|---|---|
| `add TABLE [field = formula, ...]` | adds a row (`at` is now unless set) |
| `set TARGET = formula` | changes a state, a setting or a row field (`set it.qty = it.qty - 1`) |
| `set all TABLE.field = formula [where condition]` | changes that field in every matching row, with one undo |
| `toggle TABLE [window] [where ...]` | adds or removes the matching row, like the `toggle` line |
| `remove ROW` | removes a row; the user gets an Undo, and nothing is deleted for good |
| `remove all TABLE [window] [where ...]` | removes every matching row, with one undo |
| `edit ROW` / `edit NAME` | opens the editor sheet for a row, a setting or a state |
| `save NAME` | saves a new row (`state NAME new TABLE`), checks required fields, then clears it (unless `keep`) |
| `go SCREEN` | opens a screen |
| `notify PART ...` | shows a notice (and a phone notification if the app is closed) |
| `remind "Text" in DURATION` | schedules one reminder |
| `after DURATION ACTION` | does the action later, while the app is open (`tap set flash = yes then after 2s set flash = no`); in a chain each `after` counts from the previous step and the actions after it wait too |

Values written to a field are kept inside its range (a stock count cannot go below `0..`).

### 9.2 Events

```
every DURATION [if condition] ACTION ...     # repeats while the app is open (at least 1s), e.g. a timer tick
when condition ACTION ...                    # runs once each time the condition turns from no to yes
remind "Text" at 8:00, 21:00 [on mon wed fri] [if condition]
remind "Text" at TABLE.field                 # one reminder per row: daily at a time field, once on a date field (9:00)
remind "Text" at TABLE.field - 3d [at 9:00]  # before (or + after) a date field, at a time
remind "Text" monthly on 1, 15 at 10:00      # every month on those days (a day past the end of a month, like 31 in November, fires on its last day)
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

Kinds: values `num money text bool date time dur color icon`; `table` (a table name), `name` (a field, setting or state name), `src` (any `each` source), `win` (a time window), `act` (actions). A default may use earlier parameters (`caption text = words(value)`).

A use **substitutes the values by name**, like filling in a template, and the result is checked as ordinary level 1. So a value can mention `it`, meaning the item of the component's own `each`: in `daybars last 7 days, sum(drink.ml on it)` the `it` is each day of the chart. To reach an outer item from inside, name it with `each X as NAME`. `state` inside a def is private to each use. A component cannot use itself, and nesting stops at 8.

## 11. The standard library (level 2)

Written in MoldeScript in `lang/std/*.mo`; read those files to see exactly what each one draws. Where the table says "`it` =", a value you pass that says `it` means that item.

| Use | Shows |
|---|---|
| `stat value [, caption]` | a big number with a caption (default: the value read out, for example "total ml of drink today") |
| `goal value, target [, caption, suffix]` | "value of target" and a progress bar (turns `warn` above the target) |
| `daybars WINDOW, value` | a bar per day of the window (`it` = the day) |
| `bars SOURCE, value [, key]` | a bar per item of any source (`it` = the item) |
| `trend SOURCE, value` | a line through the items (`it` = the item) |
| `heat WINDOW, value [, peak]` | a 7-column heat map of the days (`it` = the day); darker as value nears peak |
| `share SOURCE, value, key` | labelled bars comparing items: `share spend month by category, sum(it.amount), it.key` |
| `list SOURCE` | rows (tap to edit, swipe to remove), with an empty message |
| `list SOURCE by day` | the same rows grouped by day, newest day first (the source may not use `sort` or `top`) |
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

To change an app, the model writes the whole new program. `node lang/mo.mjs diff OLD NEW` (or with the whole history of earlier versions) lists the changes and gives a verdict. The verdict uses **every earlier version**, not only the last one: every table, field and setting that ever held data keeps its stored type, visible or hidden.

- a new table or field is **safe** (old rows get the default or stay empty; a new required field without a default gets a note);
- a table, field or setting that disappears is **hidden, never dropped**; adding it back with the same (or a wider) type shows the old data again; adding it back with another type is **refused**;
- a **rename** must be written with `was` (`table drinks was drink`, `amount num was ml`, `pick Meals was Food|...`) and moves the data. A table or field that disappears while one of the same shape appears in the same edit is **refused** as "looks like a rename";
- a stored type may only **widen**: `text` to `long`, `pick` to `text`/`long`, `num` to/from `money`, `date` to `when`; a `ref` keeps its target table (a renamed target is followed);
- a `pick` option that disappears stays on the rows that have it (they keep showing it); it is no longer offered for new rows and formulas cannot name it (write `NEW was OLD` to rename it);
- a narrower range keeps old values that fall outside it;
- going back to an earlier version (chat Undo) is an explicit restore and is never refused: data entered since stays, and pick options renamed since are renamed back.

There is no statement that deletes data.

## 15. Deliberately impossible in v0

- loops other than `each` over data, a range or a window; recursion (a component or formula cannot use itself);
- deleting data for good, or changing a field's stored type;
- network, internet, accounts, sync between phones, messaging, maps, printing and PDF; camera (including QR and barcode scanning), microphone, sensors, location, other apps; files other than the app's own export;
- drag and drop; text splitting and parsing (no substring or split), regular expressions;
- raw colour codes, fonts, animation;
- heavy algorithms (search over many options, optimisation, prediction).

## 16. Errors

`node lang/mo.mjs check FILE` prints each problem as `line N: CODE: what is wrong. Fix: what to do.`, ready to paste into a repair prompt. When a declaration line fails, later uses of that name are reported once ("unknown because line N failed").

| Code | Meaning |
|---|---|
| `E_SYNTAX` | the line does not match any statement, with one targeted fix for common slips: a line that starts with a bare name (start it with `text`), shape or component values without commas or with one missing, a capital letter in a name, a window after `where`, `?` in the wrong place, a theme word, text parts inside `if()`, a field without a type |
| `E_RESERVED` | one of the 12 reserved words used as a name, or a built-in field (`at`, `id`) redeclared |
| `E_HEADER`, `E_ASK` | the first line is not `app`/`ask`; an `ask` program has more lines |
| `E_INDENT`, `E_CHILD` | indentation is off; a line that cannot have children has some |
| `E_UNKNOWN_TABLE`, `E_UNKNOWN_FIELD`, `E_UNKNOWN_NAME`, `E_UNKNOWN_COMPONENT` | a name that is not declared above |
| `E_TYPE` | a value of the wrong type |
| `E_WINDOW` | a bad time window |
| `E_REF` | a `ref` to a table not declared above, or an unclear back link |
| `E_DUP` | a name, field, option or modifier used twice; a `was` that clashes |
| `E_CONTEXT` | a statement in the wrong place (`it` outside `each`, a shape outside `draw`, `table` inside a block, `else` without `if`, `random` outside an action) |
| `E_ARGS`, `E_KIND`, `E_RECURSION` | wrong values for a component or formula; a component that uses itself |
| `E_OPTION`, `E_DEFAULT`, `E_RANGE` | a value that is not one of a `pick`'s options, or an option that is a colour word or a name you declared (write it with a capital); a bad default; a bad range |
| `E_ICON`, `E_ACTION`, `E_TARGET`, `E_REQUIRED` | unknown icon (the hint names the closest); button without `tap`; something that cannot be changed; an `add` missing a required field |
| `E_SELF_COMPARE` | a `where` that compares a field with itself because the field hides your state or setting |
| `E_INTERNAL` | a checker bug (never expected; the fuzz tests count it as a crash) |

## 17. Version

This is **MoldeScript v0**. The version is the first word of the program: `app` (and `ask`) mean v0. A later version that changes meaning will start programs with a new first word (for example `app1`); the runtime keeps a reader for every version it has shipped, and stores the language version next to every saved program.

## 18. More examples

`lang/examples/` has 30 programs (`INDEX.json` says which are std-style and which draw their main visual from level 1), `lang/examples/edits/` has 20 edits (`before.mo`, `request.txt`, `after.mo`), and `lang/corpus/` has 300 programs other agents wrote from this spec. A custom one, a tasbeeh counter with a ring:

```
app "Tasbeeh" beads mint
table zikr phrase pick SubhanAllah|Alhamdulillah|AllahuAkbar = SubhanAllah
setting target num = 33 "Count to"
state ph text = SubhanAllah
let n = count(zikr today where phrase = ph)
row gap 1
  each options zikr.phrase
    button it fill if(ph = it, accent, soft) tap set ph = it
draw width 240 tap add zikr phrase = ph
  circle 44 stroke soft thick 8
  arc 44, 0, 360 * (n % target) / target stroke accent thick 8
  label 50, 46, n % target big
  label 50, 64, "Round" floor(n / target) + 1 faint
when n > 0 and n % target = 0 notify "Round complete"
```

And a formula with values (tic-tac-toe's win check, written once):

```
app "Tic tac toe" board ink
table move game num, cell num 1..9, mark pick X|O
setting cur num = 1 "Game"
let win(m text) = count([123, 456, 789, 147, 258, 369, 159, 357], count(move where game = cur and mark = m and (cell = floor(it / 100) or cell = floor(it / 10) % 10 or cell = it % 10)) = 3) > 0
if win("X")
  "X wins!" big
```
