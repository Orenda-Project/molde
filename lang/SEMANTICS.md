# MoldeScript v0 semantics

What every statement means when it runs. The reference evaluator `lang/eval.mjs` implements exactly this; `lang/tests/eval.test.mjs` and `lang/tests/gaps.test.mjs` check it on all 30 examples and on each feature. Where the phone runtime and the evaluator differ (local time, real notifications), it says so.

## Storage and edits (the contract the phone runtime must follow)

- **Data is keyed by storage slots, never by program names.** The schema history (`ever`, built by `diff.mjs`) gives every table, field, setting and top-level `state` a slot id when it first appears (its first name, plus `~2`, `~3` if that id was taken). The id never changes. A slot keeps its stored type and every name it has had, with the version each name was last seen. **Pick options are slots too**: each option of a table field, a setting or a top-level state gets an option slot id (`#` + its first name) when it first appears. A rename onto the name of another option of the same pick, listed or dropped, is refused (it would mix two groups under one name); a dropped option listed again without `was` comes back with its values.
- Stored rows are `{id, at, deleted?, <field slot id>: value}` in `data.tables[<table slot id>]`; settings are `data.settings[<setting slot id>]`; top-level states are `data.state["|" + <state slot id>]`. Values are stored in plain JSON: numbers and money as numbers, dates as `YYYY-MM-DD`, date-and-time as milliseconds, times of day and durations as seconds, links as row ids, **options as a reference object `{"o": "#Food"}`** (a value no typed text can look like), in rows, settings and states, so renaming an option changes no stored value; the program reads it as the option's current name. A form or `setField` given an option name stores the reference of the option listed under that name, else of the option last seen under it; a name no option ever had is rejected.
- **On every edit** (a new program from the chat) the runtime runs `evolve(ever, newProgram)`:
  - `safe` or `warn`: adopt the new program and the new `ever`; give new tables an empty row list and new settings their default. Nothing in the stored rows changes: renamed tables, fields and options keep their slots, hidden ones keep their values. `warn` carries `warnings` for the person (an option dropped while rows use it, a table name used again after it was removed, a `was` that changes nothing so the field starts empty).
- **`was` acts once (rules 1 and 2).** `X was Y` is an instruction of one edit: it gives the slot that the *previous stored program* calls `Y` the name `X`. All clauses of an edit apply at once, so swaps and rotations work. A `Y` the previous program does not have makes the clause a no-op (said in a note, or a warning when `X` therefore starts empty). After the edit the **stored program is the new text with every `was` removed** (`format.strip`, `mo.mjs strip`); that is `app.source` and what the model sees and edits next. So a `was` in a later edit is always a new rename: writing a swap again swaps back. Loading never renames: `load(stored text, {data})` only reads the map (a text that is the stored text with `was` still in it is read as the stored text).
- **Versions (rule 3).** Every version records its stored text, its name-to-slot map (tables, fields, pick options, settings, states) and, for an edit, the text as written (`edit`); a restore records the version it came from (`from`).
  - `refused`: keep running the old program; nothing changes.
  - `restore`: see below.
- **Going to any recorded version (chat Undo, or a restore backward or forward)** is always allowed and explicit: `app.revert()`, `app.setProgram(versions[i].src, {restore: true, version: i})`, `evolve(ever, src, {restore: true, version: i})` or `mo.mjs diff ... --restore`. The verdict is `restore`: that version's text and its own map are used as recorded; nothing is recomputed and nothing is deleted from other versions. Data entered since stays in its slots, slots the version does not name are hidden, options read under that version's names (rows hold option slots), and values widened since are read with the old declared type (money as a number, long text as text, a date and time as its date, a free text in an old pick field as the text itself).
- **Settings: the stored value always wins.** A setting's `= default` fills it only when nothing is stored yet; changing the default in an edit never changes a value the user saved. To change it on purpose, an edit writes `setting goal num = 3000 set`: the value is written once (when the `set` or its value is new), the diff lists it in `changes`, and `revert()` puts the earlier value back.
- **Loading a backup** (`app.restore(snapshot)`, rule 4): **a backup is a whole app**. It brings its data together with its own stored program, maps and versions (a backup from earlier, later, or another branch of edits); chat Undo starts again from there. `app.restore(snapshot, {keepProgram: true})` keeps the running program instead, which is allowed only when that program's text is one of the backup's versions; then that version's map reads the data. A backup of another app is refused. Every install gives its app an id (`ever.app`) at first load, so two installs of the same program are two apps; the phone app copies the id with the backup, and a backup always carries it. An app that is **untouched** may adopt any backup: `ever.touched` is set the first time a person's action (a tap, a change, `addRow`, `setField`) changes any stored value (rows, settings or states) or an edit is applied, and it is never inferred from the data. A backup without an id is refused unless this app is untouched. A refused restore changes nothing. `restore` returns `{ok, program, replaced: {before, after}}` with the counts of rows, settings and states, so the app can warn before data is replaced; it clears both the chat Undo and the data Undo steps.
- **The stored form stays inside.** An option reference `{"o": slot}` exists only in stored data. Everything that leaves the evaluator carries the option's name: the tree (inputs, choices, fields, forms, defaults), `fields()`, `cell()` (`cell(t, row, f, {raw: true})` gives the stored form), texts and joins; a field widened from pick to text reads an old choice as the option's name. Everything that enters (`dispatch` change, `setField`, `addRow`, `set`) takes a name and maps it to its option; an object, or a name no option ever had, is rejected and the stored value stays as it was. Sending an input its own current value changes nothing.
- Data Undo restores the data of one step; settings the program declares since then come back at their starting value. Consecutive changes to the same input are one step only while nothing else happens in between: any other operation (a tap, another input, `setField`, `addRow`, an edit, a restore, a tick, or Undo itself) ends the group. A write made by the clock (`every`, `after`, `when`) is its own step.
- **Form drafts** are kept by field slot: a field renamed with `was` keeps what was typed, a new field shows its default, a dropped field's value goes, and a value the field's new type cannot hold goes back to the default. An Add that is refused because a required field is empty shows on the form (`error`, and `error: 'needed'` on the field).
- **What enters is checked.** `setField` and a `change` accept only values of the field's kind: numbers for num, money and dur (finite, not text that is blank), `YYYY-MM-DD` for a date, `H:MM` or seconds for a time, true/false for a yes/no, the id of an existing row for a link, a name for a pick, text or a number for text. Anything else, and emptying a required field of a row, is rejected and the stored value stays. A slider never becomes empty. Sending an input its own current value changes nothing.
- `when`: conditions that are already true are saved with the data (`snapshot().when`), so they do not notify again after a reload.
- `touched` for saves made before the flag existed is derived once from the data (any row, a setting or a literal state off its default, or more than one version) and then recorded.
- Stored states are the top-level states and the states of a screen; their pick options are slots like a setting's.
- **State inside an `each`** is kept per (what the each goes over: a table, a link, the options of a pick, days or a list) and per item (a row's id, an option's slot, a day), not by the line it is written on: a heading added above the each, or an option renamed with `was`, keeps every value. `state NEW ... was OLD` inside an each moves its values. Keys saved by line position (before round 10) are converted once at load; values of rows that no longer exist are dropped.
- Data Undo steps store only what an operation changed (rows, settings, states, as they were), not a copy of all data; an operation that changes nothing records no step. After Undo a `when` whose condition is false again may fire again.
- An added time (`at`) must be a moment between the years 1900 and 3000; a date must exist (no 2026-02-30).
- **Older backups (rule 5)**: a snapshot without `ever.format` (rounds 4 and 5, or with its bookkeeping missing) is rebuilt by replaying its recorded versions in order (each edit applied to the one before, restores by index; the same text twice in a row is one version), and rows holding option names get option slot ids. If the replay fails, the backup is not loaded: `ok: false` with the reason, data untouched.
- **Loading never acts as an edit.** `load(src, {data})` runs the data's stored program. If `src` is not that program (after removing `was`), the stored program runs anyway and `app.edit` is a warning saying so; send the new program as an edit to change it.
- **History with a backup (rule 6)**: the snapshot's own maps win. `history` (programs as written, oldest first) is used only to add the steps after the snapshot's program (each replayed as an edit, `was` included); if it does not contain the snapshot's program it is not used, with a warning. A snapshot with no schema history is read with the schema the history builds.
- Saved data from a newer format, rows or values naming fields or options the history does not have, or values of an unknown shape are refused with a plain reason.
- **Every version must carry a usable map** (a program text, tables and fields maps that name slots the history has, a `from` that points at an earlier version); otherwise the data is refused with a plain reason and left untouched.
- **Damaged saved data** (a history that is not an object, has no versions while rows exist, damaged slots or option log, rows of a table it does not know, tables that are not lists, rows that are not records) is never read: `load` returns `ok: false` with the reason, and the data is left untouched.
- Reading a slot with a narrower declared type never changes what is stored; the next edit is judged against the widest type the slot has ever had.
- The evaluator implements this: `load(src, {data, history})`, `app.applyEdit(src)` (returns the diff result), `app.revert()` (back to the program before the last applied edit), and `app.snapshot()` (which includes `ever`). `app.addRow(table, values, atMs)` adds a row by program names (values in the field types, `atMs` optional) and returns the stored row, or null if a required field is empty.

## Time

- **The clock belongs to the host.** `load(src, {now})` takes `now` (without it, the time the data was saved, else a fixed day for tests); `tick(ms)` moves it. Saved data only records when it was taken (`snapshot().clock`); `restore()` never changes the clock, and every new row is dated with the host clock. When the host clock is later than a snapshot's on load or restore, schedules catch up for the time in between. Calendar days are UTC by default so tests are repeatable; `load(src, {tz: 'local'})` uses the device's local time and `{tz: 300}` a fixed offset in minutes east of UTC (the phone uses local time).
- `today` is the date of the clock; `now` the date and time. Weeks start on Monday (`weekday` 1 to 7).
- **A date compared with a date and time compares whole days**: `at <= today` includes every row of today, `at = d` is true all day, and `date - when` is whole days between the two dates.
- **`time - time` is the forward duration from the second time to the first, wrapping past midnight**: bed 23:00 to wake 07:00 is `07:00 - 23:00 = 8:00`, always between 0 and 24 hours.
- A row's `at` is the moment it was added. **Windows always filter on `at`'s date**: `today` matches rows whose `at` falls on today's date, `last 7 days` the 7 dates ending today, `month of d` the calendar month of `d`.
- `each days WINDOW` gives the window's dates oldest first (at most 400).
- `last N months` is the dates after the same day N months ago, up to today (`last 1 months` on 23 November is 24 October to 23 November).

## Values

- **Money** is stored as a decimal number rounded to 2 places in the currency's main unit (rupees, not paisa). Inside formulas it keeps full precision (`1 / 3 * 3` is 1) and is rounded to cents only when shown or stored. Arithmetic with numbers keeps it money; the currency sign is a display setting of the runtime.
- **Durations** are whole seconds; **times of day** are seconds after midnight (they wrap at 24:00); **dates** are calendar days; **date and time** values are moments.
- **Empty**: an optional field nobody filled in, `last()`/`first()` of no rows, `min()`/`max()`/`avg()` of no values, `since()` of no rows and `gap()` with fewer than two days are empty. Empty plus, minus, times or divided by anything is empty. Every comparison with empty (`=`, `<`, `>=` ...) is no, and `!=` is yes only when exactly one side is empty. `sum()` (of a column or `sum(source, value)`) and `count()` skip empty values, so they are 0 for nothing.
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

- A table query lists rows **newest first** (by `at`, then by id), except **inside a `plot`, where rows go oldest first** so time runs left to right (the std `trend` and `bars` over a table read naturally). `sort FORMULA` orders by the formula evaluated for each row (`it` is the row, and bare names are its fields), smallest first; `desc` gives largest first. **Empty values always come last**, with or without `desc`. `top N` keeps the first N after sorting.
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

- `every D [if c]` runs while the app is open, every D after the previous run, only while `c` is yes. A tick does not step second by second: each `every` fires as many times as D fits into the time passed, each at its own time, with the `when` conditions checked after every fire (so a countdown that reaches zero during a long sleep fires its `when` once). Fires stop early when one changes nothing (a stopped timer) unless the rule reads the clock, and a tick spends at most about 150 ms on fires (about 300 fires per ms on a laptop); fires beyond that are skipped and logged (`{kind: 'skipped', fires}`). `after` actions run in due order; `when` is checked once more at the end. A tick is one Undo step. The std `timer` keeps the moment it ends, not a count of seconds, so it is right after a sleep of any length.
- In an action chain, **each `after D` is measured from the previous step, and the actions after it wait with it**: `tap set s = 1 then after 2s set s = 2 then set s = 3 then after 2s set s = 4` sets 1 now, 2 and 3 two seconds later, 4 after four seconds.
- `now` and everything computed from it are re-evaluated on every tick: a renderer calls `tree()` again after `tick()` and the clock-dependent texts repaint. The evaluator steps the clock by the shortest active period and jumps when nothing is active.
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
