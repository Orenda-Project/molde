# 01 - The contract (format, kit, SDK, patch, validator, sandbox)

Planner: contract area. Date: 2026-11-12. Status: proposal, to freeze after Task 1-3 below.
Principle: the model writes glue, the kit does the work. Every choice below is judged by "tokens the 2B model must emit" and "what can be checked by a machine".

## 0. Measured facts (what I actually ran)

Tokenizer: Qwen3.5-2B (the planned base model, local HF cache). Same 5 mini-apps (exercise log, journal, water counter with goal, habit check-in with streak, budget with balance), same SDK semantics, written five ways:

| Style | exercise | journal | water | habits | budget | mean tokens |
|---|---|---|---|---|---|---|
| **Alpine + kit components (A2)** | 116 | 72 | 160 | 161 | 112 | **124** |
| Alpine + kit CSS only (A1) | 224 | 200 | 163 | 193 | 245 | **205** |
| Arrow.js | 270 | 236 | 179 | 222 | 295 | 240 |
| Vanilla JS | 267 | 218 | 200 | 238 | 267 | 238 |
| Preact + htm | 291 | 259 | 193 | 240 | 328 | 262 |

- Alpine with plain kit CSS is about 20% cheaper than Arrow/vanilla and 22% cheaper than Preact+htm. Adding kit components (`m-form`, `m-list`, `m-stat`, `m-chart`) halves it again (124). So the kit, not the framework, is the big lever; the framework just must not add noise (no `useState` boilerplate, no `render(...)` calls, no event-handler plumbing).
- The Arrow/Preact files assume an SDK that exposes reactive tables to them (`useTable`, reactive `rows`); that is extra SDK work Alpine does not need.
- Library sizes (npm tarballs, measured): alpinejs 3.17.5 `cdn.min.js` 55.9 KB raw / 19.9 KB gzip; petite-vue 0.4.1 16.9 KB / 7.1 KB; preact 10.26 11.2 KB / 4.8 KB + htm 1.3 KB / 0.7 KB; @arrow-js/core 1.0.6 (young). Size is irrelevant here (bundled offline, loaded from the app bundle); token cost and failure modes matter.
- Maintenance (npm registry `time.modified`): alpinejs last published 2026-10-20 (active); petite-vue 0.4.1 last published 2022-05-12 (dead, rejected); @arrow-js/core 1.0.6 last published 2026-04-01 (new, one team). Links: https://www.npmjs.com/package/alpinejs · https://www.npmjs.com/package/petite-vue · https://www.npmjs.com/package/@arrow-js/core
- Alpine's standard build compiles attribute expressions with `new Function`, so it needs `unsafe-eval` in the CSP. Its CSP build avoids that but forbids inline `x-data` object literals and method calls with arguments, which kills the token saving: https://alpinejs.dev/advanced/csp (summary via search; I could not fetch the page directly, WebFetch was blocked). Decision below accepts `unsafe-eval` inside a no-network sandbox.
- Patch formats: Aider found unified diffs made GPT-4 Turbo less lazy (20% to 61% on its laziness benchmark, strong model only). JetBrains Diff-XYZ (https://arxiv.org/abs/2510.12487) finds search/replace the best representation for stronger models, and small open models struggle with every format (one version notes modified udiff variants do best for small models). No published number isolates a 2B model, so patch format is decided by our own ablation (Task 5), with S/R as the default.
- Android WebView: file-access settings must all be off and assets served through a virtual https origin (WebViewAssetLoader) with requests intercepted: https://developer.android.com/privacy-and-security/risks/webview-unsafe-file-inclusion

Reproduce the token table: the five apps in four+one styles were scripted in the planning scratchpad (`.../scratchpad/proto/apps.py`, `count.py`). Task 4 re-creates them under `kit/fixtures/` so the numbers stay checkable.

A finding that changes the edit design: at this app size (median ~125-205 tokens) a whole-file rewrite (134 tokens) is cheaper than a unified diff (201) and about as cheap as a search/replace patch (113). Patches only win in tokens above ~250-token apps. We still make S/R the edit format, because the product promise is "edit, don't rebuild": untouched parts stay byte-identical, so the user's app does not drift. Whole-file stays as the fallback (see section 5).

## 1. Framework decision: Alpine.js 3.17.x (standard build), pinned, plus our `molde.js`

Why: fewest tokens of the real options (205 vs 238-262), directives are declarative so the model mostly writes HTML it already knows, state lives in one `x-data` expression, no build step, no render call, active maintenance, huge web prior in the base model's pretraining. Runners-up kept as Task 5/8 fallbacks only if Alpine's silent failures cost too many repairs: Preact+htm (explicit JS errors, but +27% tokens), Arrow.js.

Known weakness and the answer: Alpine reports bad expressions with `console.error`/warnings and keeps rendering the rest. The validator therefore treats any Alpine console output as failure (section 6). Needs `unsafe-eval`; accepted because the sandbox has no network, no file access and no host bridge except the SDK (section 7).

`molde.js` (one file, loaded by the host before the app, not generated): Alpine + SDK + kit components. Budget: <= 60 KB gzip total. Kit CSS `kit.css` <= 8 KB gzip.

## 2. Mini-app format and where each part lives

A mini-app = 2 model-written texts + host-owned history. The generated code never declares the data model; the plan does. That removes the biggest destructive-change risk (code redeclaring or dropping tables) and saves tokens.

```
app.json   manifest + plan + schema   (written by `plan`, patched by `edit`)
app.html   body fragment, Alpine + kit (written by `create`, patched by `edit`/`repair`)
```

Host storage: ONE SQLite file `molde.db`, outside the WebView:

| Table | Columns | Rule |
|---|---|---|
| `apps` | id, slug, name, current_v, created_at | |
| `versions` | app_id, v, kind (`create/edit/repair/undo`), ask, patch, html, manifest, ok, ts | full snapshots (a few hundred bytes), never deleted; `undo` = move `current_v`, so one tap |
| `errors` | app_id, v, ts, kind (`validate/apply/runtime/hang`), code, msg, loc, fixed_in_v | append-only; feeds repair prompts and the training logs |
| `records` | app_id, tbl, id, data (JSON), created_at, updated_at, deleted_at | the USER DATA. Generic rows, no per-app DDL |
| `kv` | app_id, key, val | settings such as goals |

Answer to the open question "SQLite table per app or a JSON file": SQLite, ONE generic `records` table with JSON data. No `CREATE/ALTER/DROP` ever runs for a mini-app, so no rewrite, repair or schema change can touch data; adding a column is only a manifest change. At personal-tracker scale (thousands of rows) `json_extract` is fast enough. Export/share = `app.json` + `app.html` (+ optional `records.json`).

`app.json`:
```json
{
  "name": "Exercise", "icon": "dumbbell", "theme": "mint", "dir": "auto",
  "plan": "Log workouts (what, minutes). Week total with a goal. 7-day chart. List below, newest first.",
  "tables": { "log": { "what": "text", "mins": "num" } },
  "kit": 1, "sdk": 1
}
```
Column types (closed set): `text, long, num, bool, date, pick:a|b|c`. Every row also gets `id`, `at` (ms timestamp) automatically. The `plan` is <= 400 characters on purpose (plan step must stay tiny). The `plan` string is what `edit` and `repair` read to know intent; the model updates it by patch when behaviour changes.

Generated code rules (the whole language): body fragment only (one root `<main>`), no `<head>`, no `<html>`, no external URLs, `<script>` allowed only for one `Alpine.data(...)` block <= 40 lines (escape hatch for logic that does not fit an attribute; the median app has none). The host runs a canonical formatter on every saved version (2-space indent, one element per line, attributes unchanged), so patch anchors are short and unique lines.

### Example (the whole mini-app, `app.html`, 7 lines)
```html
<main x-data="{log: store.t('log'), goal: store.kv('goal', 150)}">
  <h1>Exercise</h1>
  <m-stat label="This week" :value="log.sum('mins',{since:'week'})" :of="goal.v" unit="min"></m-stat>
  <m-chart :data="log.series('mins',{by:'day',last:7})"></m-chart>
  <m-form :table="log"></m-form>
  <m-list :table="log" title="what" sub="mins"></m-list>
</main>
```
(The token table used `goal` without `.v` in a few spots; the kv box is `goal.v`. That is +1-2 tokens per use and does not change the ranking.)

## 3. SDK surface: 16 callables, hard cap 20

Globals `store`, `ui`, `app`. `t` = a table handle from `store.t(name)`. `t.rows` is a reactive array (Alpine re-renders on change, no subscribe calls).

| # | Call | Does |
|---|---|---|
| 1 | `store.t(name)` | table handle; `name` must exist in `app.json` or it errors with code `E_TABLE` |
| 2 | `store.kv(key, default)` | reactive box `{v}`; persisted in `kv` |
| 3 | `t.add(row)` | insert (coerces and clips to the schema), returns id |
| 4 | `t.set(id, patch)` | update fields |
| 5 | `t.remove(id)` | SOFT delete (tombstone) plus a 10-second "Undo" toast built in |
| 6 | `t.sum(col, opts)` | `col` null = count; `opts`: `since:'day'/'week'/'month'`, `where:{}` |
| 7 | `t.series(col, opts)` | `[{k,v}]`; `by:'day'/'week'/'month'`, `last:n`, `op:'sum'/'count'/'avg'` |
| 8 | `t.group(col, valCol)` | `[{k,v}]` totals per category |
| 9 | `t.has(keyObj)` | does a row match (habit done today) |
| 10 | `t.toggle(keyObj)` | add or soft-remove the matching row (check-ins) |
| 11 | `t.streak(keyObj)` | consecutive days |
| 12 | `ui.toast(msg)` | |
| 13 | `ui.timer(sec, cb)` | countdown/rest timer, returns reactive `{left, running, start(), stop()}` |
| 14 | `app.notify(when, text)` | schedule a local notification (host permission prompt on first use) |
| 15 | `app.fmt(ts, how)` | `'date'/'time'/'rel'` in the user's locale (incl. Urdu digits) |
| 16 | `app.today()` | `YYYY-MM-DD` in local time |

Components (kit, not SDK; attributes are the API): `<m-form :table fields>` auto-builds inputs from the schema (so adding a column in `app.json` adds an input, zero code), `<m-list :table title sub order>`, `<m-stat label :value :of unit>`, `<m-chart :data type>` (bar default, `line`, `pie`; canvas, ~2 KB), `<m-timer>` wraps #13. This is where the 124-token mean comes from.

### Data survival rules (enforced in host code, not in the prompt)
1. There is no SDK call that drops a table, drops a column, truncates, or hard-deletes. Not exposed = cannot be emitted.
2. Schema lives only in `app.json`. On every manifest change the host runs `migrate(old, new)`:
   - add table / add column: allowed.
   - remove column or table: allowed but only HIDES it (`archived`); the data stays and `app undo` or re-adding it brings it back.
   - rename: only with `"from": "oldname"` on the new column/table; otherwise it is "remove + add" (old data hidden, not moved), and the validator warns `W_RENAME`.
   - type change: allowed only if lossless (`num`->`text`, `text`->`long`, `pick`->`text`); otherwise blocked with `E_MIGRATE`, which becomes a repair/edit retry message.
3. `rows` are never rewritten by version changes. create/edit/repair/undo swap `html`+`manifest` only.
4. Invariant checked after every version change and in tests: for each `(app_id, tbl)`, count of `records` (including tombstones) after >= before, and checksum of untouched rows equal.
5. Model prompts never include user row contents (only schema and synthetic sample rows). This blocks "stored text becomes an instruction to the model" and keeps data private from the prompt log.

## 4. Design kit

One stylesheet `kit.css` plus element defaults (so `h1`, `p`, `small`, `button`, `input`, `progress` look right with zero class tokens). House rules from `.claude/rules/ui-design.md` are built into the CSS, not left to the model: 4 px spacing scale, one gap per kind of thing, nested radius, text contrast >= 4.5:1, touch targets >= 44 px, visible focus, no state by color alone, logical properties so Urdu/RTL mirrors for free.

Classes (20): layout `row` `col` `grid2` `grow` `scroll` (horizontal) · surfaces `card` `sheet` · actions `btn` `btn ghost` `btn danger` `fab` · inputs `field` `check` · info `chip` `stat` `muted` `ok` `warn` · nav `tabs` `tab` · empty `empty`. Anything not in this list fails validator check V2 (class allowlist). Elements: `main` root only once.

Themes (set in `app.json` `theme`, never in code; contrast pre-verified light and dark, auto dark via `prefers-color-scheme`): `mint`, `ocean`, `plum`, `slate` (mono), `ink` (dark default). No brown/parchment (Kamal's no-brown rule). Variables: `--bg --fg --muted --card --accent --accent-fg --radius`. The model chooses a theme name; it cannot write color values (validator blocks `style=` colors and `<style>` entirely in v1).


## 4b. As built in T1 (kit 1, sdk 1): everything the kit adds beyond the contract above

The 16 calls and the 5 components are unchanged in number. Round 2 of the gauntlet (PR #33) added optional attributes and options, listed here so the validator (Task 3) and the prompt card (Task 8) can allowlist exactly these.

SDK options (no new calls):
- `t.group(col, valCol, opts)`: third argument takes `since` and `where`, like `t.sum`.
- `t.series(col, {by, last, op, where})`: `where` filters rows; `last` is clamped to 1..366.
- Dates: if a table has a `date` column, that column is the row's day for `since`, `series` and `streak`. `has`, `toggle` and `streak` default a missing date key to today.
- Numbers are clamped to +-1e12 (NaN becomes 0). Dates must be real (`2026-02-31` is `E_ARG`). Unknown column or table names are `E_COL` / `E_TABLE`. Bad arguments always raise a `MoldeError` with `E_ARG`; nothing returns silently. `store.t` / `store.kv` with `constructor`, `__proto__`, `toString` or any `Object.prototype` name raise `E_TABLE`.
- Rows read from storage are filled with type defaults for columns that did not exist when the row was written (num 0, pick first option, bool false, text empty, date the row's own day), so adding a column never shows NaN or undefined.
- `t.rows` is a frozen read-only copy; generated code cannot mutate the store through it. `Object.keys(store|ui|app|t)` is exactly the 16 calls; `ui.toasts`, `_schema`, `_dismiss` and `_notifications` are kit-internal (`sdk.internal`) and not on the globals.
- `today()` is reactive across midnight (refreshed on visibility change, every 30 s and on every table action).

Component attributes:
- `m-stat`: `label`, `:value`, `:of`, `unit`; `left` (lead shows `of - value`, "Over budget" when negative); `glass` (fill-level glass instead of the bar). Always flat (no card).
- `m-chart`: `:data` or `:table` + `col` (+ `by`, `last`, `op`); `type` bar (default) | line | pie | rows; `label`. Pie keeps 4 slices and folds the rest into "Other"; percentages sum to 100. Categorical colours are `--c1..--c5` from the theme. Draws SVG (not canvas), values are sanitised, negative bars hang below a zero line.
- `m-list`: `:table`, `title`, `sub` (a column, or a template such as `{kg} kg x {reps}`), `unit`, `meta` (comma list of columns), `order`, `max` (chunk size for "Show more", default 30), `by="day"` (day headers), `face="col"` (mood face + timeline rail), `group="col"` (groups with last-session line; needs `sub` template), `:log="table"` + `key="col"` (checklist grid: tap any recent day, streak lead; the number of day columns follows the width).
- `m-form`: `:table`, `fields`, `submit`, `hint` (placeholder of the first text field), `quick="250,500"` (one-tap add buttons for the first number column), `faces` (a pick column named with great/good/okay/low/awful is shown as mood faces). Placeholders replace labels. Required: the first text column (whitespace-only is rejected) and every number column (an empty number is never stored as 0). A second submit within 500 ms is ignored.
- `m-timer`: `sec`, `label`.

Left to other tasks, on purpose (these are visible to generated code in this build): `window.Alpine`, `window.MoldeSDK` and the SDK module are reachable, `localStorage` is not blocked here, and the CSP does not stop navigating away. The sandbox (issue 10, section 7) must freeze or hide them and block navigation; the validator (issue 4, V2) must ban the identifiers. The kit does not rely on them being available to app code.

## 5. Patch format: search/replace blocks, whole-file fallback

Compared:

| Format | Tokens on the example edit (2 changes) | Failure mode for a 2B model |
|---|---|---|
| **Search/replace blocks** | **113** | must copy the SEARCH text exactly; mitigated by canonical one-element-per-line formatting, whitespace-normalised matching, and 1-3 line searches |
| Unified diff (3 ctx) | 201 | must emit correct `@@ -a,b +c,d @@` counts and context lines; line counts are the classic small-model slip |
| Whole file / whole section | 134 (whole file), grows with app | no copy risk, but drifts untouched parts and costs full length on large apps |

Decision: **S/R blocks**, 1-3 line SEARCH, each SEARCH must match exactly once. A header line `## app.json` switches target file (default `app.html`). Insertion = SEARCH the anchor line, REPLACE with anchor + new lines.

```
<<<<
x-data="{log: store.t('log')}"
====
x-data="{log: store.t('log'), goal: store.kv('goal', 150)}"
>>>>
<<<<
  <m-stat label="This week" :value="log.sum('mins',{since:'week'})" unit="min"></m-stat>
====
  <m-stat label="This week" :value="log.sum('mins',{since:'week'})" :of="goal.v" unit="min"></m-stat>
>>>>
```
(I applied exactly this to the example app with a 15-line applier: it produces the 7-line result above, 113 tokens.)

Apply rules: exact match first, then whitespace-normalised; 0 or >1 matches = `E_PATCH` with the offending search echoed; one retry with that message; a second failure falls back to `edit-full` (model emits the whole file given the ask). Always validate the result like a fresh build. Because the host normalises formatting, patches compose with history: the patch text is stored in `versions.patch` for the change log. Task 5 runs the ablation (S/R vs udiff vs whole-file) on 100 edits and may flip the default if the data says so; the interface (`apply(src, patch) -> src | error`) does not change.

## 6. Validator (runs before any version is saved; same code in the data pipeline)

Returns `{ok, errors:[{code, msg, loc}]}`; the same JSON is the repair input. Stages in order, first failing stage returns (cheap checks first):

| Check | Rule | Code |
|---|---|---|
| V1 size | `app.html` <= 3 KB and <= 700 tokens (hard cap 1200 for `create`, edits may not grow it > 40% in one step), `app.json` <= 1 KB, plan <= 400 chars, <= 6 tables, <= 12 columns each | `E_SIZE` |
| V2 static | parse HTML; tag and attribute allowlist; class allowlist; one root `<main>`; no `on*=` attributes, `style=`, `<style>`, `<iframe>`, `<form action>`, `href` except `#`; Alpine expressions and the optional script parsed with acorn; banned identifiers (`fetch XMLHttpRequest WebSocket eval Function import window.open location document.cookie localStorage sessionStorage indexedDB navigator postMessage parent top constructor __proto__ setTimeout(string)`) | `E_TAG E_CLASS E_JS E_BANNED` |
| V3 schema | `app.json` valid against JSON Schema; every `store.t('x')` and `<m-* :table>` references a declared table; columns in `.add({...})` literals and `m-list title/sub` exist; `migrate(prev, next)` has no blocked change | `E_TABLE E_COL E_MIGRATE` (`W_RENAME` warning) |
| V4 headless run | real Chromium (Playwright) in the pipeline; jsdom-level fast path in on-device CI. Load `molde.js` + app on a SCRATCH DB seeded with 5 synthetic rows from the schema. Fail on: any `console.error`/`pageerror`, any Alpine warning text, any blocked network attempt, any `m-*` element not upgraded, visible text < 10 chars, horizontal overflow at 360 px, any button/field < 44 px, > 3 s to first render. Then a smoke interaction: click each `.btn`/`.fab`, type synthetic values into each `.field`, submit, re-check errors (<= 20 actions) | `E_RUN E_ALPINE E_NET E_EMPTY E_LAYOUT E_HANG` |
| V5 data safety | on the scratch DB: row counts and checksums of seeded rows unchanged by load; for edit/repair, `records` of the real DB are never opened by the validator | `E_DATA` |

Error `msg` is written for the model: short, names the line and the fix ("L3: `store.t('logs')` not in tables [log]. Use one of: log"). Task 3 measures this: repair success with these messages vs raw console text.

## 7. WebView sandbox (Android first; iOS mapped in the same rules)

1. Load from a virtual origin (`https://molde.local/` via WebViewAssetLoader) and nothing else; `setAllowFileAccess(false)`, `setAllowFileAccessFromFileURLs(false)`, `setAllowUniversalAccessFromFileURLs(false)`, `setAllowContentAccess(false)`, geolocation off, mixed content off, cookies off, `setDomStorageEnabled(false)` (SDK owns storage).
2. No network: `setBlockNetworkLoads(true)` plus `shouldInterceptRequest` returns an empty 403 for anything not on the virtual origin; `usesCleartextTraffic=false`. CSP meta: `default-src 'none'; script-src 'self' 'unsafe-eval'; style-src 'self'; img-src data: blob:; connect-src 'none'; form-action 'none'; frame-src 'none'; base-uri 'none'`. `unsafe-eval` is for Alpine only; scripts come from our own origin, inline script tags are not allowed (the optional `Alpine.data` block is re-injected by the host with a nonce after V2 passes).
3. No `addJavascriptInterface`. One `postMessage` JSON-RPC channel, allowlist = the 16 SDK calls; the host takes `app_id` from its own WebView instance, never from the page; messages schema-validated, <= 64 KB each, <= 50/s; per-app storage quota 5 MB.
4. No navigation or new windows: `shouldOverrideUrlLoading` returns true (block), `onCreateWindow` denied, `target=_blank` banned statically.
5. Isolation: one WebView per mini-app, destroyed on close; no shared origin storage.
6. Watchdog: no heartbeat for 2 s = kill and log `hang` (infinite loop in generated code); render timeout 3 s.
7. Remaining risk, stated plainly: a generated app can only read/write its own app's tables through the SDK and burn CPU until the watchdog fires. Because `eval` is on, defence is "nothing worth reaching", not "cannot run code". Therefore the bridge and the network block are the controls that get tested (Task 7).

## Task list (dependency order, each about one session)

Bars: "blind critic" = an independent haiku critic with both orders against the named reference, plus the machine check, per `.claude/rules/ui-design.md` item 5. Do not self-grade.

**T1. Runtime + kit + themes** (no model, no phone)
- Goal: `molde.js` (Alpine + SDK with in-memory/SQLite adapters + the 5 components) and `kit.css` with 5 themes, in a plain HTML test page.
- Deliverable: `kit/molde.js`, `kit/kit.css`, `kit/themes.css`, `kit/format.mjs` (canonical formatter), `kit/fixtures/{exercise,journal,water,habits,budget}/{app.html,app.json}` (the 5 apps above), `kit/tests/`.
- Accept (machine): all 5 fixtures render with no console output at 360x640, 412x915, 600x960, 800x1280, 1440x900; zero horizontal overflow; all targets >= 44 px; computed contrast >= 4.5:1 for every theme x text role (script); bundle <= 60 KB gzip; SDK unit tests cover all 16 calls; `format.mjs` is idempotent on all fixtures; Qwen3.5 token count per fixture <= 210 (A2 mean <= 130).
- Bar: screenshots of the 5 fixtures vs the same apps as polished real apps (Daylio-style journal, Strong-style workout log, Loop-style habit tracker); critic must not rank the fixtures last on 4 of 5 and must find no unslop-ui "signs" violations.

**T2. Store, migration and history layer** (depends on T1 SDK interface)
- Goal: SQLite `records/kv/versions/errors` with `migrate(old,new)` and undo; the data-survival invariants.
- Deliverable: `host/store.ts` (or `.mjs`), `host/migrate.ts`, `host/tests/migrate.fuzz.test`.
- Accept (machine): fuzz of 10,000 random sequences of create/edit/repair/undo with random manifest changes: record count never decreases, untouched-row checksums equal, every blocked change returns its code; no SQL DDL is ever issued for app tables (grep of the SQL log); undo restores html+manifest byte-for-byte; `records` of one app unreachable from another app's handle.
- Bar: a naive per-app-table ALTER/DROP implementation run through the same fuzz (must lose data, showing the test has teeth) and Room auto-migration limits as the reference for "what a migration may do"; critic reviews the rule table for any hole.

**T3. Validator** (depends on T1, T2)
- Goal: V1-V5 as one CLI/function with JSON output; Playwright headless run on a scratch DB.
- Deliverable: `validator/validate.mjs`, `validator/schema/app.schema.json`, `validator/fixtures/good/` (40) and `bad/` (60, each labelled with its expected code), `validator/README.md` (code table).
- Accept (machine): 40/40 good pass; 60/60 bad rejected with the labelled code; median run <= 1.5 s, p95 <= 3 s; network attempt and infinite loop fixtures are caught; the validator never opens the real DB (test with a read-only temp dir).
- Bar: ESLint + a raw Playwright "no console errors" check as the baseline; compare the catch rate on the 60 bad apps (ours must catch everything the baseline catches plus Alpine warnings, bad table names, banned identifiers). Blind critic compares error message usefulness on 20 failures.

**T4. Gold set and token budget** (depends on T3)
- Goal: 40 hand-written, validator-clean apps (+ plan JSON each) covering exercise, journal, prayer, budget, study, medicine, water, habits, reading list, shop stock; 10 requests in Urdu and Roman Urdu.
- Deliverable: `data/gold/NN-slug/{request.txt,app.json,app.html}`, `data/gold/STATS.md` (generated).
- Accept (machine): 40/40 pass the validator; median app <= 250 Qwen tokens, p95 <= 600; every request has all of: plan, create, and one edit pair; 10 Urdu/Roman Urdu requests with correct `dir`; no row contents in any prompt.
- Bar: the same 40 requests written by a strong cloud model WITHOUT the kit (free HTML + vanilla JS + own CSS): compare tokens, first-run pass rate, and visual look in a blind critic. We should win on tokens by >= 2x and not lose on look.

**T5. Edit format ablation** (depends on T3, T4)
- Goal: pick the edit format with data. Implement `apply(src, patch)`; generate 100 edit tasks from gold (add field, add stat, rename label, change theme, remove chart, add timer); have a cloud model and, if available, Qwen3.5-2B few-shot via llama.cpp produce each in 3 formats (S/R, udiff, whole-file).
- Deliverable: `edit/apply.mjs`, `edit/tasks.jsonl`, `edit/results.csv`, `edit/DECISION.md`.
- Accept (machine): S/R apply rate >= 95% (cloud model), result passes the validator, all unrelated lines byte-identical (diff check), user data intact 100%; table of apply rate, validate rate, output tokens per format; decision recorded with numbers.
- Bar: whole-file regeneration (drift measured by lines changed outside the ask) and unified diff; blind critic judges 20 edit results on "did it change only what was asked".

**T6. Repair contract** (depends on T3, T4)
- Goal: error taxonomy to repair prompt, with 2 rounds then nearest-template fallback.
- Deliverable: `repair/mutate.mjs` (injects bugs into gold: wrong table name, missing column, bad Alpine expression, unclosed tag, banned call, empty render, overflow), `repair/cases.jsonl` (100), `repair/run.mjs`, `repair/REPORT.md`.
- Accept (machine): with a cloud model as repairer, >= 95% fixed within 2 rounds; 100% keep data and `records` counts; the fallback template path always yields a rendering app; structured error messages beat raw console text by >= 10 points fixed-in-1-round.
- Bar: raw `console.error` text as the repair input (baseline); blind critic compares 20 repaired apps vs originals for intent preserved.

**T7. WebView sandbox and bridge** (depends on T1; can run parallel with T4-T6)
- Goal: Android RN WebView hardened as in section 7 with the SDK bridge.
- Deliverable: `app/webview/Sandbox.tsx`, `app/webview/bridge.ts`, `sandbox-tests/attacks/` (25 hostile mini-apps).
- Accept (machine): all 25 attacks fail safely and log: fetch, XHR, WebSocket, image/script src to http(s), `file://`, `content://`, `window.open`, `location=`, `target=_blank` link, localStorage/IndexedDB/cookies, `postMessage` flood and oversize, forged `app_id`, calling a non-allowlisted bridge method, `eval` of fetch, prototype tricks, infinite loop (killed <= 3 s), memory blow-up (killed), form submit, `<meta refresh>`. Legit fixtures still pass. Run on 2 real devices including a 4-6 GB mid-range.
- Bar: Android WebView hardening guidance and OWASP MASVS-PLATFORM WebView items as a checklist; critic audits the bridge for any method that takes a path, URL or SQL string (there must be none).

**T8. Prompt card and zero-training baseline** (depends on T4, T6; this is the "prove it" gate)
- Goal: freeze the contract as a <= 700-token SDK/kit cheat sheet + 3 few-shot gold examples, and measure a general model with no fine-tuning on plan, create, edit, repair.
- Deliverable: `contract/CARD.md` (generated from the code: function list, class list, column types, patch format), `contract/baseline.csv`, `contract/FREEZE.md` (version `sdk 1, kit 1`).
- Accept (machine): card <= 700 Qwen tokens; with a cloud model and the card, first-run validator pass >= 85% on 100 unseen requests; with Qwen3.5-2B base few-shot, pass rate recorded (expect lower; this is the number fine-tuning must beat); every callable and class in the card exists in code and vice versa (diff test).
- Bar: the same requests with no card and no kit (free-form app); blind critic compares 20 apps on look, usefulness, and intent fit. Freeze only if the kit path wins on pass rate and tokens.

Out of scope here (other planners): model choice and training, on-device runtime and speed, product flows (plan confirmation, templates while generating).
