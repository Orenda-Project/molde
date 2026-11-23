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
| `tests/check.mjs` | Playwright machine checks and interaction tests on the built file (192 checks) |
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

The page has the picker and the program source outside the phone frame. Inside the frame is only the app and one round chat button, the product shell Kamal described: tap it, ask for a change or a new app. **The chat is scripted, because the model is not trained yet.** The requests offered come from real edit pairs in `lang/examples/edits` where the program matches, or from small hand-written patches. The change itself is real: the new program is diffed with `lang/diff.mjs`, explained in plain words, swapped in live with the user's data kept, the changed lines are marked in the source, and Undo puts the old program and data back. "Make me a new app" requests switch to another example (described with `lang/describe.mjs`).

Each program opens with a few weeks of lived-in data. `demo/seed.mjs` adds rows through the evaluator's own `addRow` with a fixed seed and a fixed clock (Thursday 26 November 2026, 15:30 UTC), so the screens are the same every time.

## Level-1 nodes implemented

`app` (header with the app's icon, date and a settings button when the program has settings), `screen` (tab bar), `stack`, `row` (wraps), `grid`, `box`, `scroll`, `text` (roles `big`, `head`, `faint`; sizes; `bold`; `color`; `align`; tappable text), `button`, `icon`, `image`, `space`, `divider`, `input` (text, long, num, money, date, time, when, dur in minutes, bool, pick and ref as chips, image), `form`, `toggle`, `choice`, `slider`, `draw` with `rect`, `circle`, `arc` (stroke arc or filled wedge), `line`, `path`, `label`, `poly`, and `error`. Every style key in UITREE.md: theme roles, the named colours, `hue:N`, `thick`, `radius`, `opacity`, `width`, `height`, `pad`, `gap`, `span`, `grow`, `card`, `tap`, `swipe`.

Runtime pieces from SPEC section 12: an editor sheet for rows (`edit it`) and settings (`edit goal`, the header's settings button), remove with an Undo toast, `notify` as a toast, required-field messages, swipe to remove (pointer drag, or Delete on a focused row), timers (the renderer calls `app.tick` once a second while the page is visible), focus and scroll kept across updates (keyed patching by node id).

Generic layout rules the renderer adds, none app-specific:

- a `row` with two or more `stack` children and no `grow` shares the width evenly (stat rows);
- a `draw` with no width fills its column but never grows taller than 120 points for a tall canvas (a bar in a chart) or 280 for a wide one (a chart);
- a `box` with no width fills its column;
- `label` text inside a drawing is HTML, so it keeps real sizes, and its colour follows the shape under it (white on an accent circle, ink on a soft one);
- a `button` with `fill accent` is the primary button; every other button is a quiet neutral one.

## Design system

Direction: personal tools on a cheap phone; calm, exact, a little warm; a pocket notebook and a pen. Surfaces stay neutral; colour goes into what the program draws. Spacing on a 4 px scale (`gap`/`pad` 0 to 6 = 0, 8, 12, 16, 24, 32, 48 px), one type scale (14, 16, 18, 22, 32, 44 px; weights 400, 500, 600), nested radii (cards 16, controls 10), a visible focus ring, touch targets of at least 44 px, no text under 14 px, text contrast of at least 4.5:1 in all five themes in light and dark (checked by the tests). No gradients, glows, emoji or brown. The `ink` theme of the v1 kit was lime on black; here it is indigo on near-white, and a calm dark navy in dark mode.

## Checks (tests/check.mjs)

- every demo program at 360x640, 412x915, 600x960, 800x1280 and 1440x900, light and dark: no console output and no network request, no horizontal overflow, every visible interactive element at least 44x44, no text under 14 px, computed text contrast at least 4.5:1 (also for labels over drawn shapes); at 412x915 the same with the chat sheet open;
- interactions: water quick add raises the total and the glass; tasbeeh tap counts and the arc grows; tic-tac-toe detects a win; a removed row comes back from the Undo toast; a swipe removes a row; the focus timer counts down in real time; the row editor saves a change; a form adds a row; tabs switch after a chat edit adds a screen; a chat request swaps the program, keeps data and undoes; a new-app request switches programs; every scripted request yields a program that checks; the file runs in a sandboxed iframe with its CSP.

## What still looks weak (honest list)

- **Axis labels cost a lot of program text.** Every label, gridline and latest-point dot is placed by hand with `label`, `line` and `circle`, repeating the chart's formulas; a tiny model will rarely write that.
- **Number formatting:** no "80k" (text parts always join with a space), no thousands separator under 10,000 ("Rs 5322"), no currency sign from the runtime, no short month name for month bars.
- **Plurals and empty states are written by hand** in each program; std `list` and `log` still say "Nothing here yet."
- Reading, to-do, attendance and medicine (the unchanged language examples) keep the plainer round 1 look.
- The heat grid needs 44 px cells to be tappable, so it shows 6 weeks, not 10, and sits outside a card.
- Dates are UTC in the evaluator.
- The editor and settings sheets read declarations from the `App` object (gap 1 below).

## Round 2 changes (after the round 1 verdict, issue #37)

- **Chat Undo never loses data.** It puts back the previous *program* and keeps every row and setting the user has now. Values in a field the older program lacks stay stored (hidden) and come back when the field returns; the reply says so. Edits are diffed against every earlier version of the app; only a data action's own Undo toast reverts data.
- **Charts are labelled** in the demo programs with plain `label` nodes: budget (y values, days 1/15/30, a legend, the current point), workouts (best and lowest kg, first date and Today, the latest point), journal (Great/Okay/Rough, first date and Today), water, savings and focus (value over each bar). The habits heat grid has weekday headers and shows the value of a tapped day.
- **Generic renderer rules:** a short screen sits in the middle of the free height; a `draw` on its own line is centred; a `scroll` shows a fade on the side that has more; grid cells that hold words keep at least 4.5rem (large system text drops a column instead of breaking names); `align` on a row is the cross axis only.
- **Shell:** the chat button hides under sheets and scrims, while a field is being typed in, and while the user scrolls down (it returns on the way up); the Undo toast has its own place beside it, on one line.
- **One primary action per app**, the only accent button: Log exercise, Add expense, Save entry, Add habit, + 250 ml, + 1,000, Start, New game.
- **Replies are sentences** written per request; "Everything you saved is still here." appears only when the change touched stored data; new apps are described in plain words; the button says Undo.
- **Empty states and plurals** in every demo program; the quiz shows the right answer after a wrong one and can start again (`remove all`); budget cannot page into future months.
- **Font sizes in rem**, tested at 200% root size at 360 px and at 300 px wide.
- **Date and time inputs** read "Thu 26 Nov 2026" and "08:30"; the browser's picker opens on tap.
- **Less template:** the runtime bar is just the app's name (and settings); each program leads with its own element.

## Contract gaps and language needs

1. `edit` logs a target, but there is no public way to list a row's or setting's fields and change them; the renderer's `bridge` reads `app.env`, `app.prog`, `app.data` and calls `app.pushUndo` directly.
2. `app.restore(snapshot)` replaces data wholesale; `demo/main.mjs` `loadWithData` adds new tables and settings itself.
3. `toggle` and `choice` nodes carry no label, so a tick box's accessible name is a guess.
4. A button's action kind is not in the tree; programs mark the primary button with `fill accent`.
5. Every `dispatch` (each keystroke too) is one undo step; the renderer drops the Undo toast as soon as anything else is dispatched.
6. Seeding history needs `app.addRow(table, values, atMs)`, which is not documented.
7. A changed setting default does nothing for a user who already has the setting stored, so "count to 100" cannot be done as an edit.
