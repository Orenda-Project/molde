# Molde web runtime (Phase 1)

The first real renderer for MoldeScript. `lang/eval.mjs` runs a program and hands over a UI tree (`lang/UITREE.md`); `render.mjs` draws that tree into the DOM, patches it on every change and sends taps, swipes and input changes back with `app.dispatch`. The renderer implements level-1 nodes only. Nothing app-specific lives here: a water glass, a habit heat grid or a budget pace line arrive already expanded into `draw`, `rect`, `grid`, `box` and `text` nodes.

## Files

| Path | What |
|---|---|
| `render.mjs` | the renderer: `mount(element, app, { mode })` returns a controller (`setMode`, `toast`, `destroy`) |
| `molde.css` | the design system for level-1 nodes: 5 themes x light/dark, spacing, type, radii, focus, targets |
| `icons.mjs` | the 84 MoldeScript icon names (one Lucide icon each; a few names share one) plus runtime chrome, as Lucide line icons (ISC licence) |
| `demo/` | the demo page: `index.html` (development), `main.mjs`, `demo.css`, `catalog.mjs` (15 programs), `seed.mjs` (deterministic history), `requests.mjs` (scripted chat requests), `programs/` (richer water, habits, budget, workouts and journal programs) |
| `build.mjs` | writes `dist/molde-demo.html`: one file, all JS, CSS and program sources inlined |
| `tests/check.mjs` | Playwright machine checks and interaction tests on the built file (208 checks) |
| `shots/` | every demo program at 412x915, light and dark, app only |

## Run and build

No install step for the runtime. The tests need `playwright-core` and a Chromium.

```
node runtime/web/build.mjs                       # -> runtime/web/dist/molde-demo.html (about 320 KB)
ln -s /path/to/node_modules node_modules         # anything that contains playwright-core
CHROMIUM_PATH=/path/to/chrome node runtime/web/tests/check.mjs --shots
```

Open `dist/molde-demo.html` straight from disk. It makes no network requests, uses system fonts only, and carries a strict Content-Security-Policy (`default-src 'none'`, the one inline module script and the one style block allowed by hash), so it also runs in a sandboxed iframe. For development, serve the repo root with any static server and open `/runtime/web/demo/`. `#ex=habits&view=app` opens one program full screen (used for screenshots).

## The demo

The page has the picker, the program source and a **Reset demo data** button outside the phone frame. Inside the frame is only the app and, in a strip of its own at the bottom, one round chat button: the product shell Kamal described. **The chat is scripted, because the model is not trained yet.** Each request maps to a hand-written program change (`demo/requests.mjs`). The change itself is real: the evaluator applies it (`app.applyEdit`, data kept by storage slot), the reply says in a sentence what changed, the changed lines are marked in the source, and chat Undo (`app.revert`) puts back the previous program while keeping everything entered since. Every change message keeps its own Undo in turn. "Make me a new app" switches to another program; each app keeps its own data for the session, so going back, or asking for that app again, finds it as it was left. The picker never reseeds an app; only Reset demo data does.

All fifteen programs are written for the demo in `demo/programs/` (plain level 1 plus the standard library; `node lang/mo.mjs check` passes on each). Each opens with a few weeks of lived-in data: `demo/seed.mjs` adds rows through the evaluator's public `addRow` with a fixed seed and clock (Thursday 26 November 2026, 15:30 UTC).

## Level-1 nodes implemented

`app` (an app bar with the name and, when the program has settings, a settings button), `screen` (tab bar), `stack`, `row`, `grid`, `box`, `scroll`, `text` (roles, sizes, `bold`, `color`, `align`, tappable text), `button`, `icon`, `image`, `space`, `divider`, `input` (text, long, num, money, date, time, when, dur, bool, pick and ref as chips, image), `form`, `toggle`, `choice`, `slider`, `draw` with `rect`, `circle`, `arc` (stroke arc or filled wedge), `line`, `path`, `label`, `poly`; `plot` (a chart frame in data units: axes, grid lines at the y ticks, x and y tick labels, bars, lines, round dots and point labels); `error`. Every style key in UITREE.md, including `ratio`, `middle` and `full`; `toggle.label` and `choice.label` as accessible names; `action` (a `save` button is primary); `text.empty` messages. Apps load with `currency: 'Rs'`, so money carries its sign from the runtime.

Runtime pieces from SPEC section 12: editor sheets for rows and settings (built from the evaluator's `app.fields()` and saved with `app.setField()`), remove with an Undo toast that names the row ("Removed Petrol, Rs 5,740"), `notify` as a toast, swipe to remove (or Delete on a focused row), timers (`app.tick` once a second), focus and scroll kept across updates (keyed patching by node id; a focused or pressed control is never replaced).

## Generic rules the renderer applies (and why each is generic)

None of these names an app, a table or a field; each reads only node types and styles from the tree.

1. **Points follow the system text size** (16 points = 1rem), so a drawing grows with its labels.
2. **Numbers in the runtime's locale** (SPEC 12 says the runtime formats numbers): thousands separators from 1,000 (the evaluator starts at 10,000), never inside a year after a month name, a time or a date; a 1 to 3 letter word before a number and a unit after it do not wrap away ("Rs 5,322", "250 ml"); a number never breaks inside.
3. **A first row of small controls joins the app bar** (at most 4 buttons, short texts, icons, empty boxes): the month switcher, the app's one main action.
4. **`<` and `>` buttons are drawn as chevrons** named Previous and Next.
5. **Centring comes from the program** (`middle`, used by tic-tac-toe); everything else starts at the top. The screen fills the free height so a `middle` block can centre. A drawing on its own line is centred across.
6. **Strips and columns**: a row whose children are all growing stacks is a strip and keeps its columns; a growing column beside other things keeps about 8 characters so rows wrap at large text; grid cells that hold words keep 4.5rem.
7. **Invisible text is read aloud only**: a `text` with `opacity 0` becomes screen-reader text (used to name heat-map cells and board squares).
8. **Big grids are one tab stop**: a grid with more than 12 tappable cells has one tab stop and arrow keys (roving tabindex).
9. **`stroke` on a block is an outline ring** (inset, so the layout does not move).
10. **Labels in drawings** are HTML with real sizes; their colour follows the shape under them.
11. **Primary button**: a button with `fill accent`, or a `save` action with no fill, is primary; others are quiet.
12. **Even stat rows**: a row of two or more stacks with no `grow` shares the width.
13. **Drawing height caps**: a canvas with no width fills its column but stays under 120 points for a tall canvas, 280 for a wide one.
14. **Scroll cue**: a sideways row fades on the side that has more.
15. **Reserved inset**: a host can reserve a strip at the bottom (`mount(..., { insetBottom })`) for its own controls; the app never draws under it.

## Design system

Direction: personal tools on a cheap phone; calm, exact, a little warm. Surfaces stay neutral; colour goes into what the program draws. Spacing on a 4 px scale (`gap`/`pad` 0 to 6 = 0, 8, 12, 16, 24, 32, 48 px), one type scale in rem (14, 16, 18, 22, 32, 44 px at 100%; weights 400 to 600), nested radii (cards 16, controls 10), a visible focus ring, targets of at least 44 px, no text under 14 px, text contrast of at least 4.5:1 in all five themes, light and dark. No gradients, glows, emoji or brown.

## Checks (tests/check.mjs, 208 plus any added since; the last run is in the PR)

- every program at 360x640, 412x915, 600x960, 800x1280 and 1440x900, light and dark (and with the chat sheet open): no console output or network request, no overflow, targets of at least 44 px, text of at least 14 px, contrast of at least 4.5:1;
- 200% system text at 360 px (no overflow, no letter-per-line, numbers whole, drawing labels inside their drawings) and 300 px wide;
- the chat button is never over any control at the top, middle and end of every app (`elementFromPoint`);
- sheets: Done closes on the first real mouse click after typing, also at its right edge; Tab then Enter works;
- data: chat Undo keeps data entered after a change; a hidden field comes back on redo; undoing a new-app request keeps that app's data; the picker never reseeds; Reset demo data does; a second Undo is reachable;
- the app bar (chevrons, main actions), act-first order, heat grid (one tab stop, arrows, named cells, ring selection, legend), one-row exercise picker, number format, chart ticks and month names, warnings in words, named board cells, toast phrases, empty states without noise, plurals, primary actions, centring, dates and times as text;
- interactions: quick add, tasbeeh, tic-tac-toe win, undo toast, swipe, timer, row editor, form, tabs, chat changes, every scripted request checks, sandboxed iframe with CSP.

## What still looks weak (honest list)

- **The number rule is a heuristic** (rule 2): a 4-digit year that does not follow a month name would get a comma ("in 2026" would show as "in 2,026"); no demo program shows one. `grouped()` exists, but programs would have to call it on every number.
- **Heat-map cells and board squares are named with invisible text** (rule 7); there is no accessible name for a box.
- **The mood chart keeps hand-placed labels**: `plot` makes numeric y ticks, and the journal wants the words Great, Okay, Rough there.
- **Empty states** are still `if count(...) = 0` blocks in most programs; only new code would use `each ... empty`.
- The heat grid needs 44 px cells to be tappable, so it shows 6 weeks, not 10.
- Dates are UTC in the evaluator; the demo does not pass `tz: 'local'` so screenshots stay fixed.

## Language and evaluator needs (after round 3 parts 1 to 6)

Merged and used: `applyEdit`/`revert` (chat changes and Undo), storage slots, public `addRow`, `fields()`/`setField()` (editor sheets), `plot`/`tick` (budget and workout charts), `plural()`, `monthshort()`, `middle`, labels on `toggle`/`choice`, `action`, `text.empty`, `currency`. Still needed:

1. An accessible name for any node (for example `say "..."`), to replace rule 7.
2. Named y ticks on `plot` (`ytick V, "Great"`), so a scale of words needs no hand-placed labels.
3. Typed text parts in the tree (number, money, date), so the runtime formats numbers without guessing (rule 2), or grouping from 1,000 as the evaluator's default.
4. A way to tell the renderer which row is the app bar (rule 3 guesses from "a first row of small controls").
