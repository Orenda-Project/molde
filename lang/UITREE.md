# The UI tree (renderer contract)

Changes (newest first):
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
app.reminders()                                    // the program's remind lines, resolved
```

`now` (ms or ISO text) fixes the clock; all dates are UTC in the evaluator (the phone runtime uses local time). `seed` fixes `random()`.

## Common properties

Every node has `id` (stable across renders: built from the statement position and, inside `each`, the item key such as `r12` for row 12 or `2026-11-23` for a day) and `t` (its type). Most have `style` and some have `children`.

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

## Node types

| `t` | Properties | Draw it as |
|---|---|---|
| `app` | `name`, `icon`, `theme`, `screens` (`[{id, name, label, icon}]`, empty for one screen), `screen` (current), `children` | the app; with screens, a tab bar (tap a tab with `dispatch(screens[i].id, 'tap')`) |
| `screen` | `name`, `label`, `children` | the current tab's content |
| `stack`, `row`, `box`, `scroll` | `children` | children top to bottom; side by side (wrap on small screens); one plain area; a sideways-scrolling row |
| `grid` | `cols`, `children` | children in `cols` columns |
| `text` | `text` (already formatted) | text in its role |
| `button` | `text`, `tap` | a button |
| `icon` | `name` | an icon by name |
| `image` | `src` | a picture the user picked |
| `space` | `size` | empty space |
| `divider` | | a thin line |
| `input` | `kind` (`text long num money bool date time when dur image pick ref`), `label`, `value`, optional `options`, `labels` (for `ref`), `min`, `max`, `unit`, `required` | one input; send `dispatch(id, 'change', value)` with plain JSON (`date` as `YYYY-MM-DD`, `time` as `HH:MM`, `dur` in seconds, `ref` as the row id) |
| `form` | `table`, `fields` (a list of `input` nodes, each with its own id `formId:field`) | the inputs of a new row; the save button is a separate `button` |
| `toggle` | `on`, `tap` | a tick box |
| `choice` | `value`, `options`, `labels` | tap chips; `dispatch(id, 'change', option)` |
| `slider` | `value`, `min`, `max` | a slider; `dispatch(id, 'change', number)` |
| `draw` | `w`, `h` (its own units), `children` (shapes), maybe `tap` | a canvas scaled to its width (`style.width` if set, else the full width) keeping `w:h` |
| `rect` | `x`, `y`, `w`, `h` | a rectangle (`style.radius` rounds it) |
| `circle` | `cx`, `cy`, `r` | a circle |
| `arc` | `cx`, `cy`, `r`, `from`, `to` (degrees, 0 at the top, clockwise) | with `style.stroke`: an arc line of width `thick`; with `style.fill`: a pie wedge from the centre |
| `line` | `x1`, `y1`, `x2`, `y2` | a line |
| `path` | `d` | an SVG path in canvas units |
| `label` | `x`, `y`, `text` | text centred at x, y |
| `poly` | `points` (`[[x, y], ...]`) | a line through the points |
| `error` | `text`, `line` | only if the evaluator hit a bug on that line; show it small |

A shape with `tap` is hit when the tap lands inside its shape (for `arc` with a stroke: within the stroke width; for `line` and `poly`: within 12 points). A `draw` with `tap` is hit anywhere on the canvas. If shapes overlap, the last one drawn wins.

## Text formatting (done by the evaluator)

Numbers: up to 2 decimals with thousands separators (`2,000`, `2.5`). Money: the same (the currency sign is the runtime's locale setting, not in the tree). Dates `Mon 23 Nov`; date and time `Mon 23 Nov 10:00`; time of day `08:30`; durations `1:30` (minutes:seconds) or `1:05` (hours:minutes from one hour up); yes/no `Yes`/`No`; a row shows its filled fields joined by ` · `; an empty value is left out of a text with other parts and shows as `–` alone. Text parts join with one space, except before `, . ; : ! ? % ) /` and after `( / #`.
