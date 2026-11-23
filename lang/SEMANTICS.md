# MoldeScript v0 semantics

What every statement means when it runs. The reference evaluator `lang/eval.mjs` implements exactly this; `lang/tests/eval.test.mjs` and `lang/tests/gaps.test.mjs` check it on all 30 examples and on each feature. Where the phone runtime and the evaluator differ (local time, real notifications), it says so.

## Storage and edits (the contract the phone runtime must follow)

- **Data is keyed by storage slots, never by program names.** The schema history (`ever`, built by `diff.mjs`) gives every table, field, setting and top-level `state` a slot id when it first appears (its first name, plus `~2`, `~3` if that id was taken). The id never changes. A slot keeps its stored type and every name it has had, with the version each name was last seen.
- Stored rows are `{id, at, deleted?, <field slot id>: value}` in `data.tables[<table slot id>]`; settings are `data.settings[<setting slot id>]`; top-level states are `data.state["|" + <state slot id>]`. Values are stored in plain JSON: numbers and money as numbers, dates as `YYYY-MM-DD`, date-and-time as milliseconds, times of day and durations as seconds, links as row ids, options as their word.
- **On every edit** (a new program from the chat) the runtime runs `evolve(ever, newProgram)`:
  - `safe`: adopt the new program and the new `ever`; apply the returned `moves` (pick option renames written with `was`) to the stored rows; give new tables an empty row list and new settings their default. Nothing else in the stored data changes: renamed tables and fields keep their slots, hidden ones keep their values.
  - `refused`: keep running the old program; nothing changes.
  - `restore`: see below.
- **Going back (chat Undo, or any earlier version)** is always allowed. If the new program text equals an earlier version, the verdict is `restore`: that version's own name-to-slot map is used, data entered since stays in its slots, slots the old version does not know are hidden, and values that were widened since are read with the old declared type (money as a number, long text as text, a date and time as its date, a free text in an old pick field as the text itself).
- Reading a slot with a narrower declared type never changes what is stored; the next edit is judged against the widest type the slot has ever had.
- The evaluator implements this: `load(src, {data, history})`, `app.applyEdit(src)` (returns the diff result), `app.revert()` (back to the program before the last applied edit), and `app.snapshot()` (which includes `ever`). `app.addRow(table, values, atMs)` adds a row by program names (values in the field types, `atMs` optional) and returns the stored row, or null if a required field is empty.

## Time

- The evaluator runs on a fixed clock (`load(src, {now})`); `tick(ms)` moves it. Calendar days are UTC by default so tests are repeatable; `load(src, {tz: 'local'})` uses the device's local time and `{tz: 300}` a fixed offset in minutes east of UTC (the phone uses local time).
- `today` is the date of the clock; `now` the date and time. Weeks start on Monday (`weekday` 1 to 7).
- **A date compared with a date and time compares whole days**: `at <= today` includes every row of today, `at = d` is true all day, and `date - when` is whole days between the two dates.
- **`time - time` is the forward duration from the second time to the first, wrapping past midnight**: bed 23:00 to wake 07:00 is `07:00 - 23:00 = 8:00`, always between 0 and 24 hours.
- A row's `at` is the moment it was added. **Windows always filter on `at`'s date**: `today` matches rows whose `at` falls on today's date, `last 7 days` the 7 dates ending today, `month of d` the calendar month of `d`.
- `each days WINDOW` gives the window's dates oldest first (at most 400).
- `last N months` is the dates after the same day N months ago, up to today (`last 1 months` on 23 November is 24 October to 23 November).

## Values

- **Money** is stored as a decimal number rounded to 2 places in the currency's main unit (rupees, not paisa). Arithmetic with numbers keeps it money; the currency sign is a display setting of the runtime.
- **Durations** are whole seconds; **times of day** are seconds after midnight (they wrap at 24:00); **dates** are calendar days; **date and time** values are moments.
- **Empty**: an optional field nobody filled in, `last()`/`first()` of no rows, `min()`/`max()`/`avg()` of no values, `since()` of no rows and `gap()` with fewer than two days are empty. Empty plus, minus, times or divided by anything is empty. Every comparison with empty (`=`, `<`, `>=` ...) is no, and `!=` is yes only when exactly one side is empty. `sum()`, `sumof()`, `count()` skip empty values, so they are 0 for nothing.
- **`since(T)` with no rows is empty, never 0**, so a never-watered plant does not look "just watered". `since(water) >= 3` is no for it; write `due(water, 3)` when never should count as overdue.
- **Division by zero** gives 0. `x % 0` gives 0. `x % n` is never negative for a positive `n` (`-7 % 3` is 2).
- **`round(x)`** rounds half away from zero (`round(2.5)` is 3, `round(-2.5)` is -3); `floor` goes down.
- **`due(T, n)`** is yes when `T` has no rows at all or the last one is at least `n` days ago: the one-word way to treat never-done as overdue.
- Text shows empty as nothing inside a line with other parts, and as `–` when it is the only part.

## Aggregates

- `count(T)` counts rows; `count(T.f)` counts rows where `f` is not empty.
- `last(T.f)` / `first(T.f)` use `at` order (ties: the row added later is later). `last(T)` is the row itself.
- `streak(T)`: count back day by day from today (or from yesterday if today has no row yet) while each date has at least one row. `best(T)`: the longest such run in all the rows.
- `gap(T)`: (last date − first date) / (number of distinct dates − 1), in days, to two decimals.
- Paths through links: `p.dish` follows a `ref` to one row; `p.dish.ingredient` is the rows of `ingredient` that link to that dish (a back link); `sum(p.dish.ingredient.cost)` adds their `cost`. A column path `T.f.g` (where `f` is a ref) gives `g` of each linked row.

## Rows, order and groups

- A table query lists rows **newest first** (by `at`, then by id). `sort FORMULA` orders by the formula evaluated for each row (`it` is the row, and bare names are its fields), smallest first, empty values last; `desc` reverses. `top N` keeps the first N after sorting.
- `by` groups rows in the order their first row appears; the group's `key` is the date (day, the Monday of the week, the 1st of the month), the field value, or the value at the end of a link path (`by dish.cuisine`).
- A row shown as text lists its filled fields joined by ` · ` (a link shows the linked row's first field; a ticked `bool` shows its name; an untouched row shows when it was added).

## Toggle

- `toggle T [window] [where f = v and ...]` is **on** when at least one row of `T` matches the window (default `today`) and the `where`.
- Tapping when on **removes every matching row** (soft delete, undo restores them). Tapping when off **adds one row** with: the link to `it` for a back link (`toggle it.check`), every `f = v` from the `where`, and `at` = **now if the window's day is today, otherwise noon of that day** (`toggle t on d`, `toggle t yesterday`). With `week`/`month` windows the row is dated the first day of that period.
- A `toggle` on a yes/no target flips it.

## Actions

- Every `dispatch` (a tap, swipe or change) is **one undo step**: `undo()` restores all data as it was before that event, however many rows it touched (`remove all`, `set all`).
- `add` fills defaults, keeps numbers inside the field's range, and is **refused** (nothing added, an `error` entry in the log) when a required field is empty.
- `set` on a field or setting keeps the value inside its range.
- `remove` and `remove all` are soft deletes: rows are hidden and kept; undo brings them back.
- **`edit ROW`** opens the editor sheet for **that row**: inside `each X as r` it is `r`; with `edit it` it is the current item; `edit last(t)` is the latest row. `edit NAME` edits a setting or state. The evaluator records `{kind: 'edit', target}` in the log; the phone shows the sheet.
- `save d` adds the new row from `state d new T` (refused like `add` if required fields are empty) and then clears `d` to defaults, or keeps its values with `keep`.
- `notify` and `remind ... in` are recorded in the log with their time; the phone shows notices and schedules notifications.
- `random(n)` is only allowed inside actions, so the screen never changes on its own; the evaluator uses a seeded generator (`load(src, {seed})`).

## Events

- `every D [if c]` runs while the app is open, every D after the previous run, only while `c` is yes. The evaluator steps the clock by the shortest active period and jumps when nothing is active.
- `when c` runs its actions once each time `c` changes from no to yes (checked after every event and every tick). A `when` cannot trigger itself more than 5 times in a row.
- Hidden screens still run their `state`, `every` and `when` lines.
- `remind` lines are listed by `app.reminders()` with their resolved times: `at T.f - 3d at 9:00` gives one moment per row (a date field without a time uses 9:00); `at T.f` on a time field is daily at that time; `monthly on 31` fires on the last day of shorter months.

## Drawing

- A canvas of `W, H` units is drawn at its width (`width` if set, else full width) keeping the ratio.
- `circle R` and `arc R, FROM, TO` are centred in the canvas.
- **`arc` with `stroke`** draws the arc line `thick` wide; **`arc` with `fill`** draws a pie wedge from the centre between the two angles (0 is the top, clockwise); with both, the wedge is filled and outlined.
- **Tap hit area:** a shape with `tap` is hit inside its filled shape, or within the stroke width (at least 12 points) for lines, outlines and stroked arcs; a tap on a `draw` with `tap` that misses every tappable shape goes to the `draw`. Where shapes overlap, the one drawn last wins.

## Components and formulas

- A component use is replaced by its body with the values written in (by name). The body's `state` is private to that use; inside `each`, private to each item.
- A `let` with values is replaced by its formula with the values written in, as whole sub-formulas: `sq(a + 1)` is `(a + 1) * (a + 1)`.
- `words(f)` is `f` read out in plain English (the same reading as `describe`), used for default captions.

## Text

Numbers show up to 2 decimals, with thousands separators from 10,000 up (`2000`, `80,000`); dates `Mon 23 Nov`; date and time `Mon 23 Nov 10:00`; times `08:30`; durations `1:30` (m:ss) under an hour and `1:05` (h:mm) from an hour up; yes/no as `Yes`/`No`; an option word with `_` shows it as a space. Parts join with one space, except before `, . ; : ! ? % ) /` and after `( / #`.
