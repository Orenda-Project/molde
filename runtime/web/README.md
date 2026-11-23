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
| `tests/check.mjs` | Playwright machine checks and interaction tests on the built file |
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

- **Money has no currency sign.** The tree gives money as a bare number (UITREE says the sign is a locale setting). The demo budget writes "Rs" as text in the program; a real runtime should add it.
- **Text arrives pre-joined.** A text node is one string, so the renderer cannot style a number apart from its unit except by a pattern (`1,480 ml` in a `big` text); times like `14:05` cannot be built from `hour` and `minute` because parts join with spaces.
- **Charts have no axes or value labels** unless the program draws them; programs written by a tiny model will rarely do that, so its charts will look thinner than the baseline's.
- **The heat grid is rectangles, not squares**: a `box` has a height but no aspect ratio.
- **Tap targets inside tight drawings**: a shape with `tap` smaller than 44 px fails the target rule; the habits program had to drop per-day taps on its week strip for that reason.
- **No dates or times in the user's time zone**: the evaluator works in UTC.
- The edit sheet and the settings sheet read declarations from the `App` object because the tree has no "describe this row's fields" call (see contract gaps below).
- Rows in a plain `each` list (no `card`) have only 12 px between them, which reads loose next to card lists.
- The date input shows the browser's own format (`mm/dd/yyyy` in Chromium in English).

## Contract gaps found (for lang/UITREE.md)

1. `edit` logs a target, but there is no public way to list a row's or a setting's fields and change them; the renderer's `bridge` reads `app.env`, `app.prog` and `app.data` and calls `app.pushUndo` directly.
2. `app.restore(snapshot)` replaces data wholesale, so a program that adds a table after an edit crashes on `addRow` for it; `demo/main.mjs` `loadWithData` adds the missing tables and settings.
3. `toggle` and `choice` nodes carry no label, so a tick box's accessible name is a guess ("Done").
4. A `button`'s action kind is not in the tree, so the renderer cannot tell a save button from any other; it uses `fill accent`.
5. Every `dispatch` pushes an undo step, including each input change, so `app.undo()` after typing undoes keystrokes rather than the last remove; the renderer removes the Undo toast as soon as anything else is dispatched.
6. Seeding history needs `app.addRow(table, values, atMs)`, which is not in the documented API.
