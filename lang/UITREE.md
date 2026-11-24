# The UI tree (renderer contract)

Changes (newest first):
- 2026-11-24 (round 13): **new property** `app.mode` (`dark`/`light`/null; wins over the phone setting). `app.theme` may now be an accent colour (`red orange yellow green teal blue purple pink grey`); shades in Themes below. No new node types. Nothing was removed.
- 2026-11-24 (round 11): **new node `more`** (`count`, `tap`): an `each` shows its first 200 items and then a `more` node; tapping it shows the next 200 (view state, not saved; a renderer may also page on scroll). Trees are shared while nothing changes: treat them as read-only (`load(src, {freezeTree: true})` freezes them). `snapshot()` also has `every` (how far each `every` is into its period).
- 2026-11-24 (round 10): `tree()` returns the same object while nothing changed (render cache); a renderer should not mutate it. `load(src, {data, now})` uses `now`; `restore` keeps the clock. `tick(ms)` catches up fires within a time budget (about 150 ms) and logs `{kind: 'skipped'}` for the rest; the std timer is timestamp-based (its Start/Pause buttons are two buttons now, one shown at a time). Node ids are unchanged; state inside an `each` no longer depends on them.
- 2026-11-24 (round 9): `form` fields carry `name` (the field's current name); a refused Add sets `form.error` ("Fill in name first.") and `error: 'needed'` on each missing field. `dispatch(id, 'change', v)` ignores values that are not of the input's kind. `snapshot()` has `when` (conditions already true).
- 2026-11-24 (round 8): no option reference ever appears in the tree, `fields()` or `cell()` (option names only; `cell(..., {raw: true})` for the stored form). `dispatch(id, 'change', v)` with an object or an unknown option name is ignored. `restore` also returns `replaced: {before, after}` counts and clears data Undo. `each options NAME` works for a pick setting or state.
- 2026-11-24 (round 7, data contract): `app.restore(snapshot)` adopts the backup's program, map and versions (returns `{ok, program}`); `{keepProgram: true}` keeps the running program when it is one of the backup's versions; another app's backup is refused. Stored choices (rows, settings, states) are `{o: slotId}` objects; read cells with `app.cell`. `load` with a different program text runs the stored program and sets `app.edit.verdict = 'warn'`. `setField` returns false for a name that is no option.
- 2026-11-23 (round 6, data contract): `app.source` is now the **stored** program: canonical, with every `was` removed (an edit's renames act once). Rows store pick options as option slot ids (`#Food`); the tree is unchanged (inputs, choices and texts still carry option names, and `dispatch(id, 'change', name)` still takes the name); read a raw cell with `app.cell(table, row, field)`. `applyEdit` may return verdict `warn` (applied, with `warnings` to show). `app.setProgram(app.ever.versions[i].src, {restore: true, version: i})` goes to any recorded version. Old backups load (rebuilt) or are refused with a reason; `load(src, {data, history})` always uses the history when given.
- 2026-11-23 (round 4): **new properties**: `a11y` (the accessible name) on any node: the text of a text or button, the label of a toggle, choice or input, the name of an icon, or what the author wrote with `alt "..."`; `bar: true` on the one `row` that is the app bar (title plus main action; draw it at the top); `parts` on a `text`/`button` that shows values: `[{t, v, text}]` with `t` one of `text num year money date when time dur bool` and `v` the plain value (`num`/`money` full numbers, `date` `YYYY-MM-DD`, `when` ISO, `time` `HH:MM`, `dur` seconds) so the renderer formats them for the phone's locale (a `year` never gets separators; `text` is still the evaluator's own formatting); `ticks.y` comes from `ytick` lines when a plot has any (word labels on the y axis); `tick` children carry `axis`. `reminders()` monthly entries carry `next` (ISO; a day past the end of a month fires on its last day). The sum of no money values is money (`{t: 'money', v: 0}`). **Syntax the renderer may see in programs** (no tree change): bare-name text lines, `tiny`/`small`/`large`/`huge` without `size`, `count/sum/min/max(source, formula)`, `list X by day` (same tree as the old `log X`), `toggle X all`, date literals. `ring` is gone from std (programs use `goal`). Nothing else was removed.
- 2026-11-23 (round 3, part 5): **new node `plot`** (a chart frame in data units, y up: `x`, `y` ranges, `axes`, `gridlines`, `ticks.x` and `ticks.y` as `[{v, label}]`; children are shapes in data units); std `daybars`, `bars` and `trend` now produce `plot` nodes. **New properties**: `toggle.label` and `choice.label` (accessible names); `action` on tappable nodes (`add`, `set`, `toggle`, `remove`, `edit`, `save`, `go`, `notify`, `remind`, `setall`, `removeall`, `after`); `style.ratio` (width / height), `style.middle` (centre the block in the free space), `style.full` (take the full height); `text.empty: true` on the message of an empty `each`; `input.unit`. **API**: `app.fields(target)` and `app.setField(target, field, value)` for editor panels (target `{table, id}` or a setting name; one undo step per call); consecutive `change` events on one node are one undo step; `load(src, {currency: 'Rs'})` puts the sign before money. An edit that changes a setting's starting value now sets the stored value too. Nothing was removed.
- 2026-11-23 (round 3, part 1): **API** `load(src, {data, history, tz})`; `app.applyEdit(src)` applies a chat edit (returns the diff result: `safe`, `restore` or `refused`; refused keeps the old program); `app.revert()` is chat Undo (back to the previous program, data kept); `app.snapshot()` now includes `ever` (the schema history; pass the whole snapshot back to `load` or `restore`); `restore()` adds tables and settings the program declares but the snapshot lacks; `app.addRow(table, values, atMs)` is public. **Stored data is keyed by storage slots** (see SEMANTICS.md, "Storage and edits"): for programs that never renamed anything the slot ids equal the names. **Formatting**: money with cents shows 2 decimals (`12.50`); a date outside the current year shows the year (`Mon 3 Nov 2025`). `tz: 'local'` makes days and times local.
- 2026-11-23 (later): numbers show thousands separators only from 10,000 up (`2000`, `80,000`); an empty value is left out of a multi-part text; with several screens and no main content, `screens` no longer lists `_main`; `input` may carry `unit`; `circle`/`arc` written with one or three values arrive already centred (`cx`, `cy` filled in). No node type or property was removed.
- 2026-11-23: first version.

`lang/eval.mjs` is the reference evaluator. It runs a program and hands a renderer one plain JSON tree. The renderer only draws this tree and sends events back; it never reads MoldeScript, never evaluates formulas, and never sees standard-library components (they are expanded to level-1 nodes before the tree is built).

```js
import { load } from './lang/eval.mjs';           // plain ES modules, no Node APIs: works in a browser
const app = load(sourceText, { now: '2026-11-23T10:00:00Z', seed: 1, data: savedSnapshot });
app.ok, app.errors                                 // checker result (strings "line N: CODE: ...")
app.tree()                                         // the tree below; call again after every event
app.dispatch(nodeId, 'tap' | 'swipe' | 'change', payload)   // true if the node takes that event
app.tick(ms)                                       // move the clock; runs every/when events
app.undo()                                         // undo the last dispatch (data only)
app.snapshot() / app.restore(snapshot)             // all data as JSON (tables, settings, state)
app.log                                            // [{kind: 'notify'|'remind'|'edit'|'removed'|'undo'|'error', text?, due?, target?, at}]
app.reminders()                                    // the program's remind lines, resolved (past ones skipped)
app.fields({table, id} | 'setting') / app.setField(target, field, value)   // editor panels (one undo step per call)
app.applyEdit(src) / app.revert()                  // chat edits and chat Undo (see SEMANTICS.md)
```

`now` (ms or ISO text) fixes the clock; all dates are UTC in the evaluator (the phone runtime uses local time). `seed` fixes `random()`.

## Common properties

Every node has `id` (stable across renders: built from the statement position and, inside `each`, the item key such as `r12` for row 12 or `2026-11-23` for a day) and `t` (its type). Most have `style` and some have `children`. Any node may have `a11y` (its accessible name) and a `row` may have `bar: true` (the app bar).

| Property | Meaning |
|---|---|
| `style.role` | `big` (the main number), `head` (a heading) or `faint` (small quiet text) |
| `style.size` | `tiny`, `small`, `large`, `huge` |
| `style.bold`, `style.card`, `style.grow` | true when set |
| `style.color`, `style.fill`, `style.stroke` | a theme role (`accent ink muted soft good warn bad bg surface edge`), a named colour (`red orange yellow green teal blue purple pink grey black white`), `hue:N` (0 to 360; the renderer picks lightness for contrast), or null |
| `style.thick`, `style.radius`, `style.opacity`, `style.width`, `style.height` | numbers (points; opacity 0 to 1) |
| `style.pad`, `style.gap` | 0 to 6 on the theme's spacing scale |
| `style.span` | grid columns to span |
| `style.align` | `start`, `center`, `end` |
| `tap: true`, `swipe: true` | the node takes that event: `dispatch(id, 'tap')` |
| `action` | on tappable nodes: the kind of the first action (`add`, `set`, `toggle`, `remove`, `edit`, `save`, `go`, `notify`, `remind`, `setall`, `removeall`, `after`), so the main action can be found |
| `style.ratio`, `style.middle`, `style.full` | keep width / height at `ratio`; centre the block in the free space; take the full screen height |

## Node types

| `t` | Properties | Draw it as |
|---|---|---|
| `app` | `name`, `icon`, `theme`, `mode` (`dark`, `light` or null: null follows the phone, otherwise it wins over the phone setting), `screens` (`[{id, name, label, icon}]`, empty for one screen), `screen` (current), `children` | the app; with screens, a tab bar (tap a tab with `dispatch(screens[i].id, 'tap')`) |
| `screen` | `name`, `label`, `children` | the current tab's content |
| `stack`, `row`, `box`, `scroll` | `children` | children top to bottom; side by side (wrap on small screens); one plain area; a sideways-scrolling row |
| `grid` | `cols`, `children` | children in `cols` columns |
| `text` | `text` (already formatted), maybe `parts` (typed values, see the change notes) | text in its role; to format for the locale, join `parts` with the same spacing rule |
| `button` | `text`, `tap` | a button |
| `icon` | `name` | an icon by name |
| `image` | `src` | a picture the user picked |
| `space` | `size` | empty space |
| `divider` | | a thin line |
| `input` | `kind` (`text long num money bool date time when dur image pick ref`), `label`, `value`, optional `options`, `labels` (for `ref`), `min`, `max`, `unit`, `required` | one input; send `dispatch(id, 'change', value)` with plain JSON (`date` as `YYYY-MM-DD`, `time` as `HH:MM`, `dur` in seconds, `ref` as the row id) |
| `form` | `table`, `fields` (a list of `input` nodes, each with its own id `formId:field`) | the inputs of a new row; the save button is a separate `button` |
| `toggle` | `on`, `label`, `tap` | a tick box (use `label` as its accessible name) |
| `choice` | `label`, `value`, `options`, `labels` | tap chips; `dispatch(id, 'change', option)` |
| `slider` | `value`, `min`, `max` | a slider; `dispatch(id, 'change', number)` |
| `draw` | `w`, `h` (its own units), `children` (shapes), maybe `tap` | a canvas scaled to its width (`style.width` if set, else the full width) keeping `w:h` |
| `plot` | `x` and `y` (`[lo, hi]` in data units), `axes`, `gridlines`, `ticks` (`{x: [{v, label}], y: [{v, label}]}`; labels may be words from `tick`/`ytick`), `children` (shapes in data units) | a chart: map data units to the plot area (y grows upward: a `rect` with `y: 0, h: 40` stands on the x axis), draw the axes with the tick labels when `axes` is true and grid lines at the y ticks when `gridlines` is true |
| `rect` | `x`, `y`, `w`, `h` | a rectangle (`style.radius` rounds it) |
| `circle` | `cx`, `cy`, `r` | a circle |
| `arc` | `cx`, `cy`, `r`, `from`, `to` (degrees, 0 at the top, clockwise) | with `style.stroke`: an arc line of width `thick`; with `style.fill`: a pie wedge from the centre |
| `line` | `x1`, `y1`, `x2`, `y2` | a line |
| `path` | `d` | an SVG path in canvas units |
| `label` | `x`, `y`, `text` | text centred at x, y |
| `poly` | `points` (`[[x, y], ...]`) | a line through the points |
| `more` | `count`, `tap` | the rest of a long list: show "N more"; tapping it shows the next page |
| `error` | `text`, `line` | only if the evaluator hit a bug on that line; show it small |

A shape with `tap` is hit when the tap lands inside its shape (for `arc` with a stroke: within the stroke width; for `line` and `poly`: within 12 points). A `draw` with `tap` is hit anywhere on the canvas. If shapes overlap, the last one drawn wins.

## Themes

`app.theme` is one of `ocean mint slate ink plum` (tuned themes) or an accent colour `red orange yellow green teal blue purple pink grey`. An accent theme uses the default neutrals and only sets `accent`. Shades for `accent` (the five tuned themes are the web renderer's own; the tuned themes also set their own neutrals), with text drawn on it white in light mode and the last column's colour in dark mode (contrast checked by `tests/spec.test.mjs`, at least 4.5:1):

| theme | light accent | dark accent | text on dark accent |
|---|---|---|---|
| ocean | #1A5CA8 | #74AFEF | #061829 |
| mint | #0B6E51 | #5CC6A0 | #062219 |
| slate | #2E5470 | #8DB8D6 | #0A1823 |
| ink | #3A3F9A | #A5ABF2 | #12143A |
| plum | #763A8C | #C99BE0 | #1F0D29 |
| red | #C62828 | #FF8A80 | #111318 |
| orange | #B3471B | #FFB074 | #111318 |
| yellow | #8A6100 | #FFD54F | #111318 |
| green | #2E7D32 | #7FD68A | #111318 |
| teal | #00796B | #5FD4C4 | #111318 |
| blue | #1E5FD0 | #8AB4FF | #111318 |
| purple | #6D3FC9 | #C3A6FF | #111318 |
| pink | #C2185B | #FF8FBF | #111318 |
| grey | #5F6368 | #BDC1C6 | #111318 |

### What a renderer needs for round 13

- The accent table above, and `app.mode` honoured over the phone's dark setting.
- Nothing else: the new standard components (`topbar statcard section goalbars daygrid weekdots`, and the empty text of `list`/`log`) expand to node types already in this file. Over the 15 demos and the new components the tree uses only `app row stack box grid scroll text button input draw circle arc plot rect line label poly`: the stat ring is a `draw` with a `circle` and an `arc`, the goal line is a `line` in a `plot` with x `ticks` labelled by day name, dots and grid cells are filled `box` nodes, and the add form is `input` nodes. An empty `each` gives a `text` node with `empty: true`.

## Text formatting (done by the evaluator)

Numbers: up to 2 decimals, with thousands separators from 10,000 up (`2000`, `80,000`, `2.5`). Money: the same (the currency sign is the runtime's locale setting, not in the tree). Dates `Mon 23 Nov`; date and time `Mon 23 Nov 10:00`; time of day `08:30`; durations `1:30` (minutes:seconds) or `1:05` (hours:minutes from one hour up); yes/no `Yes`/`No`; a row shows its filled fields joined by ` · `; an empty value is left out of a text with other parts and shows as `–` alone. Text parts join with one space, except before `, . ; : ! ? % ) /` and after `( / #`.
