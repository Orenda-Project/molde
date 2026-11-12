#!/usr/bin/env python3
"""Source of truth for the Molde task list. Merged from docs/plan/01..04 (2026-11-12).
Issue number == index in TASKS (repo starts empty). Run: python3 tools/issues.py [--dry-run]
Creates labels, milestones and issues in Orenda-Project/molde. Safe to re-run only on an empty repo."""
import json, subprocess, sys

REPO = "Orenda-Project/molde"
DRY = "--dry-run" in sys.argv
GATES = {
    1: "Gate 1: Prove it (contract, runtime, app, 10 testers)",
    2: "Gate 2: Build the data (5,000 verified examples)",
    3: "Gate 3: Train (>=85% first try on the GGUF)",
    4: "Gate 4: Go offline (closed beta)",
}
LABELS = {
    "type:sdk": "1d76db", "type:kit": "5319e7", "type:shell": "0e8a16", "type:model-data": "fbca04",
    "type:eval": "d93f0b", "type:docs": "c5def5", "type:process": "bfd4f2",
    "state:ready": "0e8a16", "state:building": "fbca04", "state:critic": "d93f0b", "state:won": "0e8a16",
    "state:needs-human": "b60205", "state:blocked": "e99695",
    "needs:sdk-frozen": "cfd3d7", "needs:device": "cfd3d7", "ui": "c2e0c6", "urdu-rtl": "c2e0c6",
}
PLAN = {"c": "docs/plan/01-contract.md", "t": "docs/plan/02-training-eval.md",
        "a": "docs/plan/03-app-runtime.md", "p": "docs/plan/04-product-process.md"}

# (title, gate, labels, plan_ref, depends, goal, deliverable, acceptance[], bar)
TASKS = [
 ("Process kit: labels, issue template, verdict script", 1, ["type:process"], "p T1", [],
  "The gauntlet loop is runnable on any issue: a stranger can follow the doc, and every critic round posts a fixed-format comment.",
  "`.github/ISSUE_TEMPLATE/task.md`, `.github/labels.yml`, `tools/sync-labels.sh`, `tools/post-verdict.sh`, `tools/verdict.schema.json`, `docs/process/gauntlet.md` (1 page)",
  ["`bash tools/sync-labels.sh --dry-run` lists every label in docs/plan/04 section 6",
   "`bash tools/post-verdict.sh --dry-run sample.json` prints a comment matching the format and fails when `biggest_gap` is missing",
   "schema validates one valid and one invalid sample via `python -I -m jsonschema`"],
  "Kamal's `gauntlet-loop` skill text plus GitHub's issue-form docs (https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests). Critic: could a stranger run the loop from the doc alone?"),
 ("Kit: Alpine runtime, 16-call SDK, 20-class design kit, 5 themes", 1, ["type:sdk", "type:kit", "ui"], "c T1", [1],
  "`molde.js` (Alpine + SDK + 5 components) and `kit.css` with 5 themes render the 5 fixture apps (exercise, journal, water, habits, budget) in a plain HTML page.",
  "`kit/molde.js`, `kit/kit.css`, `kit/themes.css`, `kit/format.mjs`, `kit/fixtures/<app>/{app.html,app.json}` x5, `kit/tests/`",
  ["all 5 fixtures render with no console output at 360x640, 412x915, 600x960, 800x1280, 1440x900",
   "0 horizontal overflow; all targets >= 44 px; contrast >= 4.5:1 for every theme x text role (script)",
   "bundle <= 60 KB gzip; SDK unit tests cover all 16 calls; `format.mjs` idempotent on all fixtures",
   "Qwen3.5 token count per fixture <= 210 (mean with components <= 130)"],
  "The same 5 apps as polished real apps: Daylio-style journal, Strong-style workout log, Loop Habit Tracker (https://github.com/iSoron/uhabits). Critic must not rank ours last on 4 of 5 and must find no unslop-ui `signs.md` violations."),
 ("Store, migration and history layer (data survives every rewrite)", 1, ["type:sdk"], "c T2", [2],
  "SQLite `records/kv/versions/errors` with `migrate(old,new)` and undo; user data can never be lost by an edit or repair.",
  "`host/store.mjs`, `host/migrate.mjs`, `host/tests/migrate.fuzz.test.mjs`",
  ["fuzz of 10,000 random create/edit/repair/undo sequences with random manifest changes: record count never decreases, untouched-row checksums equal, every blocked change returns its error code",
   "no SQL DDL is ever issued for app tables (grep of the SQL log)",
   "undo restores html+manifest byte-for-byte; records of one app are unreachable from another app's handle"],
  "A naive per-app ALTER/DROP implementation run through the same fuzz (it must lose data, proving the test has teeth) and Android Room auto-migration limits for what a migration may do. Critic reviews the rule table for any hole."),
 ("Validator V1-V5 (size, static, schema, headless run, data safety)", 1, ["type:sdk", "type:eval"], "c T3", [2, 3],
  "One CLI/function that checks a generated mini-app and returns JSON with error codes written for the repair prompt.",
  "`validator/validate.mjs`, `validator/schema/app.schema.json`, `validator/fixtures/good/` (40), `validator/fixtures/bad/` (60, labelled), `validator/README.md`",
  ["40/40 good pass; 60/60 bad rejected with the labelled code",
   "median run <= 1.5 s, p95 <= 3 s; network-attempt and infinite-loop fixtures are caught",
   "the validator never opens the real DB (test with a read-only temp dir)"],
  "ESLint + a raw Playwright 'no console errors' check as the baseline: ours must catch everything it catches plus Alpine warnings, bad table names and banned identifiers. Blind critic compares error-message usefulness on 20 failures."),
 ("Gold set (40 apps + plans) and token budget", 1, ["type:model-data", "needs:sdk-frozen", "urdu-rtl"], "c T4", [4],
  "40 hand-written validator-clean apps with plan JSON covering exercise, journal, prayer, budget, study, medicine, water, habits, reading list, shop stock; 10 requests in Urdu/Roman Urdu.",
  "`data/gold/NN-slug/{request.txt,app.json,app.html}`, `data/gold/STATS.md` (generated)",
  ["40/40 pass the validator; median app <= 250 Qwen tokens, p95 <= 600",
   "every request has plan, create and one edit pair; 10 Urdu/Roman Urdu requests with correct `dir`",
   "no row contents in any prompt"],
  "The same 40 requests written by a strong cloud model WITHOUT the kit (free HTML + vanilla JS + own CSS). We must win on tokens by >= 2x and not lose on look (blind critic)."),
 ("Edit-format ablation: search/replace vs unified diff vs whole file", 1, ["type:eval", "type:sdk"], "c T5", [4, 5],
  "Pick the patch format with data, so edits change only what was asked.",
  "`edit/apply.mjs`, `edit/tasks.jsonl` (100 edit tasks), `edit/results.csv`, `edit/DECISION.md`",
  ["search/replace apply rate >= 95% (cloud model), result passes the validator, unrelated lines byte-identical, user data intact 100%",
   "table of apply rate, validate rate and output tokens per format; decision recorded with numbers"],
  "Whole-file regeneration (measure drift as lines changed outside the ask) and unified diff. Blind critic judges 20 edit results on 'did it change only what was asked'."),
 ("Repair contract: error taxonomy -> repair prompt, 2 rounds, template fallback", 1, ["type:eval", "type:sdk"], "c T6", [4, 5],
  "Structured validator errors drive a repair loop that always ends with a rendering app.",
  "`repair/mutate.mjs` (bug injector), `repair/cases.jsonl` (100), `repair/run.mjs`, `repair/REPORT.md`",
  ["with a cloud model as repairer: >= 95% fixed within 2 rounds; 100% keep data and record counts",
   "the fallback template path always yields a rendering app",
   "structured error messages beat raw console text by >= 10 points fixed-in-1-round"],
  "Raw `console.error` text as the repair input (baseline). Blind critic compares 20 repaired apps vs originals for intent preserved."),
 ("Prompt card, zero-training baseline and CONTRACT FREEZE (sdk 1, kit 1)", 1, ["type:sdk", "type:eval"], "c T8", [5, 6, 7],
  "Freeze the contract as a <= 700-token cheat sheet + 3 few-shot gold examples and measure a general model with no fine-tuning. This is the 'prove it' gate for the contract.",
  "`contract/CARD.md` (generated from code), `contract/baseline.csv`, `contract/FREEZE.md`",
  ["card <= 700 Qwen tokens; with a cloud model and the card, first-run validator pass >= 85% on 100 unseen requests",
   "Qwen3.5-2B base few-shot pass rate recorded (the number fine-tuning must beat)",
   "every callable and class in the card exists in code and vice versa (diff test)"],
  "The same requests with no card and no kit (free-form apps). Blind critic compares 20 apps on look, usefulness and intent fit. Freeze only if the kit path wins on pass rate and tokens."),
 ("Spike: GGUF -> WebView streaming with measured numbers on real phones", 1, ["type:shell", "type:eval", "needs:device"], "a T1", [1],
  "Prove llama.rn + WebView streaming and replace every estimated speed with a measurement.",
  "`app/` Expo dev build, `app/src/spike/*`, `docs/plan/spike-results.md`, `app/scripts/bench.json` schema",
  ["`npx tsc --noEmit` clean; build installs and launches via adb",
   "`bench.json` validates for 2 models x 2 phones: load_ms, prefill_tps, decode_tps_first50, decode_tps_last50, peak_rss_mb, battery_delta, thermal_status, grammar on/off",
   "`zipalign -c -P 16` passes on all `.so`; 5 consecutive builds with no crash"],
  "Section 2 table of docs/plan/03-app-runtime.md (estimates) and Google's published Gemma 4 numbers. Critic checks every claim in spike-results.md has a raw log line behind it. Needs a real 4-6 GB phone."),
 ("Sandboxed WebView host + bridge + 25 hostile-app attack suite", 1, ["type:shell", "type:sdk", "needs:sdk-frozen", "needs:device"], "c T7 + a T2", [8, 9],
  "A WebView that can only talk to the SDK bridge: no network, no files, no stray storage, with a watchdog.",
  "`app/src/sandbox/{SandboxWebView.tsx,csp.ts,bridge.ts,validator.ts}`, `app/e2e/escape.html`, `sandbox-tests/attacks/` (25 apps), `app/__tests__/bridge.test.ts`",
  ["all 25 attacks (fetch, XHR, WebSocket, http(s) src, file://, content://, window.open, location=, target=_blank, localStorage/IndexedDB/cookies, postMessage flood/oversize, forged app_id, non-allowlisted method, eval tricks, infinite loop <= 3 s, memory blow-up, form submit, meta refresh) fail safely and log",
   "escape page prints PASS 11/11 on a real phone (adb logcat); legit fixtures still pass",
   "Jest bridge tests incl. 1,000 fuzzed messages with zero native exceptions"],
  "Android WebView hardening guidance + OWASP MASTG/MASVS-PLATFORM WebView items as a checklist. Separate security-critic agent tries to break out with its own page; no bridge method may take a path, URL or SQL string."),
 ("On-device storage: versions, pointer-flip undo, snapshots", 1, ["type:shell", "needs:sdk-frozen"], "a T3", [8, 10],
  "Per-app SQLite + versioned code files on the phone; undo is a pointer move; a crash mid-write leaves the old version live.",
  "`app/src/storage/*`, `app/__tests__/storage.test.ts`",
  ["create 20 versions, undo to 3, identical data rows",
   "simulated crash between file write and pointer flip leaves the old version live; quota errors return E_QUOTA",
   "`PRAGMA user_version` migration test; delete app removes its folder; data.db rows never change during edit/repair (hash compare); passes on-device too"],
  "The test list passing on-device (jest-expo + one instrumented run); undo screen is judged later in the UX issues."),
 ("Visual direction: tokens, 5 kit themes, static specimen", 1, ["type:kit", "ui"], "p T2", [1],
  "Shell tokens, themes and a static HTML specimen of home grid, ask field, plan card, change sheet and repair bar.",
  "`design/tokens.css`, `design/specimen.html`, `design/direction.md`, `tools/contrast_check.py`, `tools/layout_check.mjs`",
  ["`python -I tools/contrast_check.py design/tokens.css` exits 0 (text >= 4.5:1, UI >= 3:1, all themes)",
   "layout check at 360x640, 412x915, 600x960, 800x1280, 1440x900: 0 overflow, 0 targets < 44 px, 0 text < 13 px",
   "no brown hue in tokens; unslop-ui signs.md audit attached with 0 open items"],
  "Google Keep + Material 3 Expressive (https://m3.material.io) for calm utility; Things 3 for restraint. Critic compares screenshots blind, both orders: 'designed, not AI-made'."),
 ("Ten starter templates as parameterised mini-apps", 1, ["type:kit", "needs:sdk-frozen", "urdu-rtl"], "p T3", [8, 12],
  "10 templates working in the sandbox with the frozen SDK and kit; they show instantly while the model generates and are the fallback.",
  "`templates/<name>/{app.html,params.schema.json,example.json}` x10, `tools/run_template.mjs`",
  ["`node tools/run_template.mjs --all` headless, no network: 0 console errors, each renders < 1 s, adds a row and persists through reload, adds a field via migration without losing rows",
   "passes contrast check; each < 6 KB; Urdu RTL screenshot diff against golden"],
  "Notion habit tracker and journal templates and Loop Habit Tracker (https://github.com/iSoron/uhabits). Critic compares screenshots plus a 30-s scripted interaction blind."),
 ("Model manager and first-run flow: tiers, resumable download, verify, unload", 1, ["type:shell", "ui", "needs:device"], "a T4 + p T5", [12],
  "First launch survives bad networks: welcome, download with pause/resume/checksum, device tier, home with ask field and templates usable while downloading.",
  "`app/src/model/{manifest,download,tier,memory}.ts`, `app/scripts/range-server.js`, screens `Welcome/Download/Home/Ask`, Maestro `e2e/first-run.yaml`",
  ["resumes after 3 forced disconnects; checksum mismatch deletes .part; low-space refuses; Wi-Fi-only blocks mobile data; tier map returns T1/T2/T3 for 4/6/8 GB",
   "Maestro: kill app at ~30%, relaunch, download completes, home opens; airplane mode still opens templates; layout check at 4 viewports",
   "unload fires on background idle and on trim-memory (instrumented log)"],
  "Google AI Edge Gallery model download flow (https://github.com/google-ai-edge/gallery, pinned release) and Play large-asset download. Critic compares recorded flows blind: 'never leaves the user stuck'."),
 ("Generation engine: Engine interface, llama.rn, stub engine, plan/create/edit/repair pipeline", 1, ["type:shell", "needs:sdk-frozen"], "a T5", [8, 9, 10, 11],
  "The pipeline that turns a request into a plan, a streamed mini-app, repairs and patches, behind a swappable Engine interface.",
  "`app/src/engine/{Engine,LlamaEngine,StubEngine,flush,pipeline}.ts`, plan/patch JSON schemas, tests",
  ["StubEngine replays 20 recorded outputs deterministically; flusher tests (balanced tags, split tokens, unterminated tag, 600-token app) pass",
   "plan JSON-schema grammar yields 100% parseable plans over 200 sampled on-device runs",
   "repair loop stops at 2 rounds then falls back to nearest template; abort frees the context within 1 s; first visible UI <= 1 s after submit"],
  "Claude Artifacts / v0 streaming preview feel: no full-document flicker, no layout jump > 8 px after first paint (screenshot-diff script at 412x915)."),
 ("Shell UI: home, ask, plan card, streaming build view, template swap", 1, ["type:shell", "ui", "needs:sdk-frozen"], "a T6 + p T6", [12, 13, 14, 15],
  "The real screens: calm, on-brand, build starts immediately with a collapsible plan and an instantly visible template.",
  "`app/src/ui/**`, `app/src/screens/Build.tsx`, fake streaming engine at 3 tok/s, production-build screenshots at 4 viewports in `docs/shots/`",
  ["with the fake engine at 3 tok/s: template visible < 1000 ms, plan card < 10 s, swap keeps scroll position, cancel leaves template and no half-written code",
   "`ui-check.mjs`: 0 overflow, 0 text < 12 sp, 0 targets < 44 dp, contrast >= 4.5:1, visible focus, no colour-only state; empty/loading/error states on every screen; RTL smoke"],
  "Google Keep (grid), Claude and ChatGPT Android composers (create box), Apple Shortcuts (my tools), Lovable/v0 build views (a LOSS on any blank screen > 1 s). Follow `.claude/rules/ui-design.md` rules (house rules copied into docs/process). No brown palette."),
 ("Edit-by-asking: plain-language diff, preview, one-tap undo, 20-version history", 1, ["type:shell", "ui", "needs:sdk-frozen"], "p T7", [11, 16],
  "A non-programmer sees what changed in plain words and can undo in one tap.",
  "`app/src/screens/Change.tsx`, `app/src/lib/{versions,summarize_patch}.ts`, tests",
  ["apply patch then undo restores byte-identical code; data rows unchanged after apply and after undo (200-row seeded DB)",
   "summary built from patch ops (no model): 8 patch kinds, <= 3 bullets, < 20 words each; preview runs on a data copy; undo < 1 s on emulator"],
  "Cursor/Copilot-style 'review changes then accept' plus Google Docs version history. Critic compares recordings blind: 'would a non-programmer understand what changed and feel safe'."),
 ("Calm auto-repair UI with fallback to template", 1, ["type:shell", "ui", "needs:sdk-frozen"], "p T8", [15, 16],
  "Errors are repaired quietly: last good screen stays, a calm bar shows progress, max 2 rounds, then Go back / Use basic version.",
  "`app/src/lib/repair.ts`, `app/src/components/RepairBar.tsx`, `fixtures/broken/*.html` (10), e2e test",
  ["last good screen stays visible throughout (screenshot hash); max 2 rounds enforced; both failure options work and keep data",
   "no 'error', 'exception' or stack frame text in the UI (grep rendered text); every repair appears in History"],
  "Counter-example: Chrome 'Aw, Snap' and Android 'App isn't responding'. Calm example: Notion offline banner. Critic compares blind for tone (blame, alarm, lost work)."),
 ("Home grid, export/import (.molde), backup, delete with undo", 1, ["type:shell", "ui"], "p T9", [17],
  "All mini-apps on a home grid; export and import round trip loses nothing; deletion is recoverable.",
  "`app/src/screens/HomeGrid.tsx`, `app/src/lib/{export,import}.ts` (.molde zip), CSV export",
  ["export then import into a clean install reproduces plan, code versions, theme and all rows (hash equal); data-stripped export has 0 rows",
   "delete has 5 s undo and 30-day Trash; weekly backup nudge shows once; layout check at 5 viewports"],
  "Obsidian vault-as-files portability and Google Keep grid density. Export round trip by script (data loss = automatic LOSS)."),
 ("Seed requests (10k) + sealed held-out (300) + real-phrasing gold requests", 2, ["type:model-data", "urdu-rtl"], "t T1 + p T4", [8],
  "The request grid for training and eval: Urdu, Roman Urdu, English, vague and over-specified; the held-out set is sealed before any generation.",
  "`data/seeds/requests.jsonl`, `eval/heldout/requests.jsonl` + `SHA256SUMS`, `data/seeds/build_seeds.py`, `data/gold/requests.jsonl` (>= 40), `tools/check_gold.py`",
  [">= 10,000 train requests; language shares 50/25/15/10 +-3; 0 exact or cosine > 0.9 duplicates between train and held-out; held-out split 100/100/60/40; checksums verify",
   "gold: 8 use cases x 5 phrasings, >= 10 Roman Urdu and >= 10 Urdu script with Roman + English gloss"],
  "Real phrasing: 30 real messages Kamal collects from 5 friends (he provides the file) mixed with ours; critic must not tell ours apart better than 60% and finds >= 80% buildable offline."),
 ("Verifier harness (extends the validator) with mutation self-test", 2, ["type:model-data", "type:eval", "needs:sdk-frozen"], "t T2", [4, 8],
  "`run.mjs` that decides keep/reject for every generated training row, generated from the same contract as the real SDK.",
  "`verify/run.mjs`, `verify/rules.json`, `verify/mock-sdk.js`, `verify/selftest/{good,bad}/` (30+30), `verify/README.md`",
  ["selftest 60/60; 100 samples in < 4 min on 8 workers; flake rate < 1%; mock-vs-real SDK conformance green; JSONL output with `stage_failed`"],
  "Harsh reviewer given 20 'passing' apps must not find more than 1 that visibly breaks in a phone-sized Chromium screenshot."),
 ("Gold set (150) and cached teacher prompts", 2, ["type:model-data", "needs:sdk-frozen", "urdu-rtl"], "t T3", [21],
  "Hand-checked gold + cached system prompts (SDK docs + 8 gold few-shots) for plan/create/edit/repair.",
  "`data/gold/*.jsonl` (120 create, 30 chains), `data/prompts/{plan,create,edit,repair}.md`, `data/gold/REVIEW.md` (Kamal sign-offs on the 8 core)",
  ["150/150 pass the verifier; 40+ non-English; every gold app <= 600 tokens; 8 core themes each run by a human and signed"],
  "Fresh Opus-written apps for the same requests: gold must tie or win >= 60% in both orders (blind)."),
 ("Pilot generation (500 rows/task) and real cost per kept row", 2, ["type:model-data", "needs:sdk-frozen"], "t T4", [20, 21, 22],
  "Run the whole generate-verify-keep pipe small and measure pass rate and real USD per kept row before spending the budget.",
  "`data/gen/generate.py`, `data/gen/pilot_report.md`, `data/pilot/*.jsonl`",
  ["pass rate per task and language; USD per kept row; create pass rate >= 40%; repair rows carry real verifier error text",
   "Urdu-script pass rate within 15 points of English; extrapolated full cost within the budget Kamal approves"],
  "30 random kept create rows vs fresh Opus references, blind: >= 40% win/tie in both orders. Kamal approves the budget here (open item)."),
 ("Eval harness, Opus reference set and judge calibration", 2, ["type:eval", "needs:sdk-frozen"], "t T6", [20, 21],
  "Everything the README targets measure, runnable in one command against any GGUF.",
  "`eval/run_model.py`, `eval/metrics.py`, `eval/reference/*.jsonl`, `eval/judge_ab.py`, `eval/calibration/` (40 human-labelled pairs), `eval/README.md`",
  ["run on the reference outputs themselves: first-try >= 95%, A/B about 50% (sanity)",
   "critic agrees with Kamal's 40 labels >= 80%, length bias <= 55%; full run <= 60 min with CI; a long broken app loses to a short working one in both orders"],
  "This is the judge. Calibrated against Kamal's labels."),
 ("Bulk data build (>= 5,000 verified, aim 15,000)", 2, ["type:model-data", "needs:sdk-frozen"], "t T5", [23, 24],
  "Run the full volumes, balance, dedup, and build chat-template train/val files.",
  "`data/train/{plan,create,edit,repair}.jsonl`, `data/train/stats.md`, `data/train/dataset_card.md`",
  [">= 5,000 verified create+edit+repair rows; 100% re-verify on a second pass; task mix 35/20/25/20 +-3; no held-out or near-duplicate leakage; edit rows 100% data-preserving; median create <= 600 tokens"],
  "Same blind check as the pilot on 100 rows; 20 edit rows: patch smaller than the file and exactly the asked change."),
 ("Pilot bake-off: 4 base models x 2,000 rows", 3, ["type:model-data", "type:eval", "needs:device"], "t T7", [24, 25],
  "Find which base models are alive: Qwen3.5-2B, Gemma 4 E2B, Qwen2.5-Coder-1.5B, Qwen3.5-0.8B.",
  "`train/notebooks/*.ipynb` (Unsloth), `train/export_gguf.sh`, `train/results/pilot.md`",
  ["each Q4_K_M GGUF loads in llama.cpp with the training chat template; adapter-vs-GGUF gap reported",
   "table: first-try, after-repair, tokens, tok/s; at least 2 arms alive (first-try >= half of best)"],
  "40 create outputs of the best arm vs Opus references, blind both orders (report only) + the 10 worst read by a human."),
 ("On-device bake-off harness and 10-build soak test", 3, ["type:eval", "needs:device"], "a T8", [9, 26],
  "A phone-truth scoreboard that sets tier defaults without further measuring.",
  "`app/src/bench/*`, `app/scripts/run-bench.sh`, `docs/plan/device-matrix.md`",
  ["one command runs the 8 gold prompts x each candidate GGUF on each attached phone: run-without-error rate, tok/s curve, peak RSS, thermal events, battery",
   "10-build soak tok/s drop reported and tier defaults adjusted; results reproducible within 10%"],
  "Critic: could someone choose tier defaults from the matrix alone; every number has a raw log."),
 ("Full training, rejection round and winner pick (the Gate 3 model)", 3, ["type:model-data", "type:eval", "needs:sdk-frozen"], "t T8", [26, 27],
  "Full SFT of survivors, a verifier-based rejection round on the leader, the final GGUF.",
  "`train/results/bakeoff.md`, `models/molde-v1-q4_k_m.gguf` (+sha256, not committed), `data/stage2/*.jsonl`, `train/DECISION.md`",
  ["on the Q4_K_M GGUF: held-out first-try >= 85%, after-repair >= 95%, edit-keeps-data = 100%, median tokens <= 600; Urdu/Roman Urdu within 10 points of English; size <= 1.6 GB; 0.8B lite-tier report",
   "a missed threshold applies the fallback table in docs/plan/02 section 5"],
  "Blind A/B on 100 create + 40 edit vs Opus: not-worse >= 50%, order-robust loss <= 25%; Kamal runs 10 of his own requests and signs."),
 ("Hybrid fallback: 15 templates + phone-side validator + template-fill path", 4, ["type:model-data", "needs:sdk-frozen"], "t T9", [13, 28],
  "The template-first path and the repair-loop contract the on-device engine calls; a short check if Gate 3 passes, the main path if it missed.",
  "`docs/plan/02b-hybrid-fallback.md`, >= 15 `templates/*.html`, `verify/validator-phone.js`, `eval/hybrid_results.md`",
  ["15/15 templates pass the verifier and data-preservation; hybrid first-try >= 95% on held-out 100; phone validator and Node verifier agree on 200 samples (>= 99%)"],
  "Hybrid vs Claude reference, blind: not-worse >= 40%."),
 ("App-essentials P0/P1: updates, privacy, crash reporting, store-ready build", 4, ["type:shell", "needs:device"], "a T7", [14],
  "Store-ready baseline for Play.",
  "Sentry opt-in + scrubber, update check, privacy.md at a public URL, backup rules, flavours, R8/AAB, CI workflow, `docs/plan/store-listing.md`",
  ["`python3 .claude/skills/app-essentials/app_audit.py app/` (run from personal-agent-v2) shows 0 MISSING P0; targetSdk 36 and minSdk >= 24 in the built AAB manifest",
   "privacy URL 200; Sentry test event has no prompt/code/data fields; update-over-install keeps app data; `allowBackup` rules exclude models/"],
  "Pixel Settings and Obsidian Mobile first-run; Play pre-launch report has no crashes."),
 ("Tester kit and 10-person closed test (Gate 1 evidence)", 1, ["type:docs", "needs:device"], "p T9 + README gate 1", [19],
  "Ten real people use the app (with the cloud-model stand-in) and we learn whether they keep using their tracker.",
  "`docs/testing/tester-kit.md` (tasks, consent note, 10-question interview, success measure), results log",
  ["kit renders; 10 testers recruited; results table of who kept using their tracker after 7 days"],
  "README gate 1: testers keep using their tracker. Needs Kamal to recruit."),
]

def sh(args, **kw):
    if DRY:
        print("DRY:", " ".join(args)[:140]); return ""
    r = subprocess.run(args, capture_output=True, text=True, **kw)
    if r.returncode: print("ERR", r.stderr.strip()[:300])
    return r.stdout.strip()

def body(i, t):
    title, gate, labels, ref, deps, goal, deliv, acc, bar = t
    dep = ", ".join(f"#{d}" for d in deps) or "nothing"
    acc_md = "\n".join(f"- [ ] {a}" for a in acc)
    sdk = "yes (needs `contract/FREEZE.md` from #8)" if "needs:sdk-frozen" in labels else "no"
    return f"""## Goal
{goal}

## Deliverable
{deliv}

## Acceptance (machine-checkable)
{acc_md}

## Bar (named, fetchable, pinned)
{bar}
How A/B artifacts are produced: the builder posts the artifact; a SEPARATE critic agent gets A and B with labels stripped, judges both orders, names the single biggest gap. Protocol: `docs/plan/04-product-process.md` section 6. Verdict posted as a comment every round; cap 5 rounds, then `state:needs-human`.

## Needs
Depends on: {dep}  |  needs SDK contract frozen: {sdk}

## Plan reference
Source task: {ref} (docs/plan/01..04). Gate: {GATES[gate]}.
"""

def main():
    for n, c in LABELS.items():
        sh(["gh", "label", "create", n, "-R", REPO, "--color", c, "--force"])
    for g, name in GATES.items():
        sh(["gh", "api", f"repos/{REPO}/milestones", "-f", f"title={name}"])
    for i, t in enumerate(TASKS, 1):
        title, gate, labels = t[0], t[1], t[2]
        lab = ",".join(labels + ["state:ready"])
        out = sh(["gh", "issue", "create", "-R", REPO, "--title", f"{i:02d}. {title}", "--body", body(i, t),
                  "--label", lab, "--milestone", GATES[gate]])
        print(i, out)

if __name__ == "__main__":
    main()
