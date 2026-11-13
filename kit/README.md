# Molde kit

`kit/molde.js` is the runtime a mini-app page loads: Alpine 3.17.5 (vendored, no CDN) + the Molde SDK (16 calls) + four generic
components (`m-stat`, `m-chart` bar | line | pie, `m-list`, `m-form`) + the `x-edit` / `x-remove` directives and the magics `$day` `$days` `$fmt`. `.cols` lays cards out in 1, 2 or 3 columns by screen width. Without a host adapter the page keeps its data in localStorage (`kit/adapters/local.cjs`).
`kit/kit.css` and `kit/themes.css` are the design tokens and generic classes. Everything app-specific lives in each
`kit/fixtures/<app>/app.html`, written the way the model should write it. Contract: `docs/plan/01-contract.md` (sections 4 and 4b).

## Commands

```bash
npm ci                 # installs dev dependencies (playwright-core, better-sqlite3, esbuild, alpinejs, a tokenizer)
npm run build          # kit/src/*  ->  kit/molde.js (our code minified, Alpine as vendored)
npm test               # CI=1 makes a missing SQLite native module a failure (fix: npm rebuild better-sqlite3), not a skip; 180+ tests: SDK (memory + SQLite) and the formatter again under America/Los_Angeles and Asia/Karachi, contrast, 5 fixtures x 5 viewports, hardening, tokens
npm run shots          # re-shoot kit/shots/ (production molde.js, deterministic demo data at 21 Nov 2026)
node kit/tests/mutate.mjs   # SDK mutation check (about 100 mutants, run under America/Los_Angeles, needs >= 90% killed)
node kit/fixtures/gen-seeds.mjs   # regenerate the demo data (deterministic)
```

## Requirements and known snags

- CI: `npm ci && npm test` on Node 20 or 22 with a C++ toolchain (or a prebuilt better-sqlite3), a Chromium (`npx playwright install chromium` or `MOLDE_CHROME`), and optionally the Qwen tokenizer; a failed native build prints how to fix it and skips only the SQLite tests locally; with `CI=1` the missing module FAILS the run.
- Node 20 or newer. The tests that open pages need a Chromium: Playwright 1.65 wants its own build, so `kit/tests/lib.mjs`
  uses the newest `~/.cache/ms-playwright/chromium-*` it finds (override with `MOLDE_CHROME=/path/to/chrome`).
- **better-sqlite3 is a native module.** `npm ci` installs a prebuilt binary when one exists for your Node and platform.
  If `npm test` says `better-sqlite3` cannot be loaded, run `npm rebuild better-sqlite3` (needs a C++ toolchain and python3);
  `package.json` runs that automatically in `postinstall` and the SQLite tests are skipped, with a message, if it still fails.
  Node 22.5+ also has `node:sqlite`, which has the same shape and can be passed to `sqliteAdapter` instead.
- Token counts use the Qwen3.5-2B `tokenizer.json` from the local Hugging Face cache (`~/.cache/huggingface/hub/models--Qwen--Qwen3.5-2B`),
  or `QWEN_TOKENIZER_DIR`. Without it the token test is skipped.
- `npm test` sets `TZ=UTC`; the SDK tests also run in `America/Los_Angeles` and `Asia/Karachi` (see the timezone tests).

## Layout

```
kit/src/sdk.cjs         the 16 calls, memoryAdapter, MoldeError, limits (text 1000, long 20000, notes 200, numbers +-1e12)
kit/src/components.js   m-stat, m-chart (bar|line|pie), m-list, m-form, x-edit, x-remove, $day, toast host
kit/adapters/sqlite.cjs generic records/kv tables, corrupt rows skipped and recorded
kit/format.mjs          canonical formatter (whitespace is meaning; malformed input is a FormatError)
kit/fixtures/<app>/     app.html + app.json + seed.json (demo data) for exercise, journal, water, habits, budget
kit/tests/              node:test suites, Playwright helpers (lib.mjs), mutation runner (mutate.mjs)
kit/shots/              screenshots of the fixtures at 5 viewports, plus theme and dark variants of habits
```
