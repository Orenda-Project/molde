# 04 Product, UX, templates and process (planner 4)

Date 2026-11-12. Scope: who it is for, the flows, templates, visual direction, and the gauntlet protocol for every GitHub task. Assumes the README plan (one ~2B model, Alpine HTML + our kit + SDK, SQLite per mini-app, Android first).

## 1. First user and the 8 flagship use cases

**First user (decision):** a Pakistani Android owner aged 18-35 who already "tracks" things in WhatsApp self-chat, Notes or paper: university students, gym/calisthenics beginners, and people building a daily routine (prayer, water, habits). They type Roman Urdu or mix Urdu and English, own a 4-6 GB phone, and often have patchy or costly data. Reasons: (a) the offline, free, private pitch is strongest where data is costly; (b) these tasks are the narrow, repeatable shapes a 2B model can learn; (c) Kamal can test with this group in person. Shop owners (stock, udhaar ledger) are v2: money records raise the bar on data safety and bigger schemas.

Evidence and its limits: Urdu keyboards that convert Roman typing to Urdu script and have voice typing are popular (one listing shows ~510K installs, self-reported), so Roman Urdu input is the real default. Android held ~83% of Pakistan mobile in an old (2017) Statcounter figure. I found NO data on RAM tiers in Pakistan; the 4-6 GB assumption comes from the brief and must be checked against the 2-3 real test phones (open question in README).

**8 flagship use cases** (also the gold-example set, each with 5 phrasings: English, Roman Urdu, Urdu script, one vague, one over-specified):

| # | Request (example) | Shape | Template |
|---|---|---|---|
| 1 | "track my exercise" / "meri workout log karo" | log rows: date, exercise, sets, reps, weight; weekly chart | `logger-chart` |
| 2 | "log my thoughts" / "roz ki diary" | dated text entries, mood chip, search | `journal` |
| 3 | "habits" / "daily habits tracker" | checklist per day, streak count | `habits` |
| 4 | "prayer tracker" / "namaz ka hisab" | 5 daily checks, missed-prayer (qaza) count, week grid. Never show times as religious ruling; user-entered only | `habits` (preset 5 items) |
| 5 | "water" / "pani track karo" | counter with goal ring, daily total | `counter-goal` |
| 6 | "budget" / "kharcha" | amount, category, income/expense, month total, category bars | `ledger` |
| 7 | "study" / "exam preparation" | subject list, study timer, minutes per subject | `timer-log` |
| 8 | "medicine reminder" | list of doses, times, taken checkbox, local notification | `reminders` |

Safety note for #8: label as a reminder, not medical advice; notifications can be killed by Android battery savers, so show a one-time "allow alarms / exempt from battery saver" prompt and state it plainly.

## 2. Core flows

**2.1 First run + model download.** Screen 1: one sentence of what Molde does and one button. Screen 2: "Download the brain, 1.2 GB, once. Wi-Fi recommended" with size, a progress bar with bytes and time left, pause/resume, survive app kill, checksum check. While it downloads, the user can already open the 10 starter templates as normal apps (no model needed); this is the main fix for the long wait. Device check first: under 4 GB RAM picks the lite 0.8B model, says so in one line. Low-storage check before starting. Failure: "Download stopped at 63%. Resume" (never restart from 0).

**2.2 Say what you want.** Home has one text field and a mic button, bottom-anchored (thumb reach). Under the field: 4 tappable example requests that rotate (real ones from section 1, in the user's script). Accept English, Roman Urdu, Urdu script. Input is sent as typed; no translation step.

**2.3 Plan: build immediately, plan shown as a summary (recommendation).** No yes/no gate. Reasons: at 2-5 tok/s every extra round trip costs 15-60 s; one-tap undo and edit-by-asking make a wrong build cheap; real products show that the damaging case is a wrong build that cannot be reverted, not an unconfirmed plan. Behaviour: the plan (3-5 lines: name, what you log, screens) streams first (about 60-100 tokens, under 10 s), appears as a collapsed card "Making: Exercise log. Logs: exercise, sets, reps. Shows: weekly chart" with a "Change" action; the matching template mounts at once under it; code streams after. Exception: if the model's plan confidence is low or the ask is under 4 words and ambiguous ("tracker"), ask ONE question with 2-3 tappable answers, then build. Hard limit of one question per build.

**2.4 Streaming build with a template visible instantly.** Within 1 s of submit the nearest template renders with the user's title and the data fields from the plan, fully usable and with a quiet "Tailoring..." line. When the generated app passes validation it swaps in with a 150 ms fade, keeping the same scroll position. Progress is shown as three plain steps (Planned, Writing, Checking) not a spinner. Cancel is always one tap and leaves the template as the app. Show estimated time honestly from measured tok/s on this phone after the first build.

**2.5 Edit by asking.** Open a mini-app, tap "Change" (pill at the bottom), type or speak "add a rest timer". Result sheet: "Changed: added Rest timer card under Sets. Kept: all 214 entries." plus a diff summary in plain words (max 3 bullets, generated from the patch operations, not by the model), `Undo` and `Keep`. Undo restores the previous code version in under 1 s; the last 20 versions are kept. Data is never touched by code undo; if a change adds a field, old rows show it empty. Preview before commit: the edit renders in a preview on a COPY of the data; Keep makes it live.

**2.6 Error auto-repair, calm.** On a runtime error, the app keeps showing the last good screen. A single quiet bar: "Fixing a problem... (1 of 2)". Never show stack traces or the word "error" in large text. After 2 failed rounds: "This change could not be made. Your data is safe." with two buttons: `Go back` (undo to last good) and `Use basic version` (nearest template with the same data). Log every repair in the change log (visible under "History"). Never auto-repair silently more than 2 rounds.

**2.7 Home grid.** 2-column grid of mini-app cards: name, a one-line live stat from the app's own data ("3 workouts this week"), and a 4 px accent bar. Sorted by last opened. Long-press: rename, duplicate, export, delete (delete needs typing nothing but a 5-second undo toast, plus a hidden Trash for 30 days). "+" tile opens the ask field. Empty state shows the 4 example asks, not a mascot.

**2.8 Backup and export.** Per app: `Export` makes one `.molde` file (zip: plan, code versions, data as JSON, theme) shareable by WhatsApp or file manager; `Export data as CSV` for logs. Import by opening the file. Whole-phone backup: a manual "Back up everything" to a file in Downloads, plus a weekly nudge. No account, no cloud in v1. Sharing a mini-app without data is the same file with data stripped (answers README open question: yes, as file only).

**2.9 Voice input that works offline.** Ranked options, v1 uses the first two:
1. The keyboard's own mic (Gboard offline voice typing, Urdu pack downloaded by the user in Gboard settings). Zero cost to us; show a one-time hint with exact steps.
2. Android `SpeechRecognizer` with `EXTRA_PREFER_OFFLINE`; works only if the offline Urdu pack is present, otherwise falls back silently to online or fails. Detect with `isRecognitionAvailable`/offline-pack check and show the hint if missing.
3. On-device Whisper (whisper.cpp via a React Native binding), tiny or base multilingual (tens to a couple hundred MB). Urdu accuracy of the small sizes is known to be weak; test before promising. Ship as an optional download in v1.1 only if a 20-phrase Urdu test reaches an agreed word error rate.
Never record or send audio over the network; the model sees text only.

## 3. Starter templates (fast fallback + instant first paint)

Each template is a complete, validated mini-app in the SDK, parameterised by a small JSON (title, fields, goal, theme). The model can pick a template and fill parameters (cheapest path) or write new code.

1. `counter-goal` (water, steps, glasses; ring + daily total)
2. `habits` (checklist per day, streak; prayer preset)
3. `logger-chart` (row log with typed fields + one weekly chart; exercise, weight, sleep)
4. `journal` (dated entries, mood chips, search)
5. `ledger` (income/expense, categories, month total, bars)
6. `timer-log` (stopwatch/countdown + session log; study, workout rest)
7. `reminders` (items with time, repeat, taken checkbox, local notification)
8. `flashcards` (front/back, flip, known/unknown, due count)
9. `checklist-list` (shopping, packing, todo; reorder, clear done)
10. `notes-form` (free form with named fields and a list of saved records; fallback for "anything else")

Fallback rule: if two repair rounds fail, the nearest template by plan keywords with the plan's fields. Each template has an Urdu/RTL-correct layout and a tested data migration for adding a field.

## 4. What similar products teach us (scan; sources are mostly blogs and reviews, treat as anecdotal)

- Lovable and Replit reviews: the top complaint is credits burned on loops where the AI says "fixed" but is not; small tweaks that rewrite unrelated parts (reported: a micro-interaction change broke auth); one widely cited incident of a deleted database. Source: Trustpilot pages and a 2026 survey post on designrevision.com; also the TechSpot and CPO Magazine write-ups of the Replit incident. Lessons for Molde: show a diff and one-tap undo; data lives outside code; never claim "fixed" without a run check; edits are patches; no credit meter (offline and free is our edge).
- Shortcuts and Tasker: Tasker's learning curve is the consistent complaint; Shortcuts is easier but is "learning to code" for most; many people only use shortcuts others made (starter templates and gallery matter). Lesson: start from a working template and one sentence, never a blank canvas or a variable editor.
- Glide: complaints are about limits rather than learning. Lesson: say plainly what Molde cannot do (no accounts, no internet data, no sharing live) so the model does not overpromise.
- Caveat: I found no mobile-specific review data and no Pakistan RAM data; run 10 tester interviews (README gate 1) and treat all of the above as hypotheses.

What to avoid: blank screens; chat transcripts as the main UI; "magic" and sparkle copy; surprise rewrites; silent data loss; long waits with no usable thing on screen; teaching prompt engineering; notifications that nag (ties to the house rule: never push users for usage).

## 5. Visual direction

Applying `.claude/rules/ui-design.md` and unslop-ui (signs.md audit, Direction, 9 passes). Direction: **"Workshop notebook, cool paper"**. Product = a tool that makes tools; character = calm, practical, a little craft; world = a clean drafting table: graph-paper hairlines and ink, not a chat bot. Signature: the 4 px accent bar on each mini-app card and a thin "ruled line" under headings. One accent used once or twice per screen. No brown, no purple-blue gradients, no sparkle, no glow, no emoji as icons, no uppercase tracked labels.

Shell tokens (checked for 4.5:1 body, 3:1 UI parts):
- Light: surface `#F6F8FA`, raised `#FFFFFF`, hairline `rgba(15,23,32,.10)`, text `#0F1720`, secondary `#475467` (7.6:1 on surface), accent `#0F6B5C` (deep teal, 6.1:1 on white).
- Dark: surface `#0E1317`, raised `#161D23`, text `#E8EEF2`, secondary `#9AA7B2`, accent `#4FC3AE`.
- Type: one sans family with Urdu support (Noto Sans + Noto Nastaliq Urdu for Urdu text, bundled offline), weights 400 and 500, sizes from a 5-step scale (13/15/17/22/28), tabular figures for numbers. Urdu needs +10% line height.
- Spacing 4 px scale; one page gutter 16; one card padding 16; card gap 12. Radius nested: card 16, inner control 8 (16 minus 8 padding). Touch targets at least 44 px. Visible focus ring 2 px. State never by color alone (icon or text too). One line-icon set, 1.5 px stroke.
- Motion: one ease-out 150-200 ms; fade and 8 px rise; template-to-generated swap is a fade; no pulsing except the live "Writing" status.

**Design kit themes for generated apps** (kit chosen by the model with one word; default follows the shell): `paper` (light, teal), `slate` (dark), `sage` (soft green accent), `ink` (high contrast, accessibility), `coral` (warm accent on cool neutral; not brown). Each is 8 CSS variables; contrast pre-checked by a script so the model cannot generate an unreadable pair. Cards, buttons, stats, chips, charts all inherit; a mini-app may pick a theme but not raw colors.

Layout check at 360x640, 412x915, 600x960, 800x1280 and wide desktop from the production build; independent critic plus machine check (overflow, tiny text, small targets) per house rule 5. Urdu/RTL checked at every viewport.

## 6. Process: gauntlet-loop on every GitHub task

**Roles.** Builder agent does the issue on a branch. Critic agent is separate (fresh context, haiku for mechanical checks, a stronger model for judgment where the bar is subjective), harsh, never sees the builder's reasoning, only the artifact and the bar. A third step is the machine check (tests, linters, scripts named in the issue), which must pass BEFORE the critic runs.

**Protocol (per issue, per round).**
1. Issue is created from the template (below) with a NAMED, FETCHABLE bar: a URL, repo path or file at a pinned commit/version, with the exact aspect compared. No bar means the issue is not `ready`.
2. Builder works one session, opens a draft PR linking the issue, runs the machine check, posts the artifact (screenshots from the production build, test output, or file paths).
3. Critic gets: the issue text, the acceptance criteria, the bar (fetched fresh), and two artifacts labelled A and B (candidate and bar). It judges blind: which is better for the stated purpose, and why, without knowing which is ours.
4. Run both orders (A/B then B/A). Win means the candidate is chosen in both orders. A split verdict is a loss ("order-sensitive").
5. Critic must name the SINGLE biggest gap (one sentence, concrete, fixable) and give a score 1-5 on each acceptance line. It may not list more than 3 secondary notes.
6. Critic's verdict is posted as an issue comment in the format below (every round, wins and losses).
7. Loop: builder fixes ONLY the named gap (and any failed machine check), then a new round. Cap 5 rounds; at round 5 without a win, label `needs-human`, post the best artifact and the remaining gap, stop. Never self-grade; the builder cannot post a verdict.
8. Merge only when: last verdict is WIN in both orders, machine check green, issue acceptance boxes ticked by the critic's checklist, and the PR links the final verdict comment.

**Labels.** Type: `type:sdk`, `type:kit`, `type:shell`, `type:model-data`, `type:eval`, `type:docs`, `type:process`. State: `state:ready` (has bar), `state:building`, `state:critic`, `state:won`, `state:needs-human`, `state:blocked`. Gate: GitHub milestones (`Gate 1: Prove it` ... `Gate 4: Go offline`), not labels, as in `.github/labels.yml`. Flags: `needs:sdk-frozen`, `needs:device`, `ui` (triggers 5-viewport check), `urdu-rtl`. Round counter via `round:1`..`round:5`.

**Issue template** (`.github/ISSUE_TEMPLATE/task.md`):
```
## Goal
One sentence, user-visible outcome.

## Deliverable
Files/paths that will exist.

## Acceptance (machine-checkable)
- [ ] command or script, expected output
- [ ] ...

## Bar (named, fetchable, pinned)
Name:
URL or repo path @ commit:
Aspect compared:
How A/B artifacts are produced:

## Needs
Depends on: #n   |   needs: SDK contract frozen? yes/no

## Out of scope
```

**Critic comment format** (every round):
```
### Critic verdict, round N
Bar: <name> @ <pin>
Order A/B: <candidate|bar chosen> | Order B/A: <candidate|bar chosen>
Result: WIN | LOSS | SPLIT
Biggest gap: <one sentence, concrete, fixable>
Acceptance: line 1 "<criterion text>" PASS/FAIL score/5 (evidence) ; line 2 ...
Machine check: PASS/FAIL (link to run)
Other notes (max 3): ...
Artifacts: <links>
Next: builder fixes the biggest gap | ready to merge | needs-human
```
A small script (`tools/post-verdict.sh`) posts it with `gh issue comment` from the critic's JSON, so the format cannot drift. State labels move automatically from the verdict.

---

## TASK LIST (5-9 small tasks, dependency order; one session each)

Common rule for all: the gauntlet protocol of section 6; the verdict comment is posted per round.

**T1. Process kit: labels, issue template, verdict script**
- Goal: the gauntlet loop is runnable on any issue.
- Deliverable: `.github/ISSUE_TEMPLATE/task.md`, `.github/labels.yml` (+ `tools/sync-labels.sh`), `tools/post-verdict.sh`, `docs/process/gauntlet.md` (section 6 distilled, 1 page), `tools/verdict.schema.json`.
- Acceptance: `bash tools/sync-labels.sh --dry-run` lists all labels from section 6; `bash tools/post-verdict.sh --dry-run sample.json` prints a comment matching the format and fails on JSON missing `biggest_gap`; schema validates 2 sample files (one valid, one invalid) via `python -I -m jsonschema`.
- Bar: Kamal's own `gauntlet-loop` skill text (`personal-agent-v2/.claude/skills/gauntlet-loop/`) plus GitHub's own issue-form docs; critic judges whether a stranger could run the loop from the doc alone.
- needs: nothing.

**T2. Brand and shell visual direction: tokens and component sheet**
- Goal: shell tokens, 5 kit themes, and a static HTML specimen of the home grid, ask field, plan card, change sheet and repair bar.
- Deliverable: `design/tokens.css` (light, dark, 5 themes), `design/specimen.html`, `design/direction.md` (Direction, signature, adaptations), `tools/contrast_check.py`.
- Acceptance: `python -I tools/contrast_check.py design/tokens.css` exits 0 (all text pairs >= 4.5:1, UI >= 3:1, all themes); a script `tools/layout_check.mjs` loads specimen at 360x640, 412x915, 600x960, 800x1280, 1440x900 and reports 0 horizontal overflow, 0 targets under 44 px, 0 text under 13 px; no brown hue (H 20-45 with S>20 and L<60) in tokens; unslop-ui signs.md audit list attached with 0 open items.
- Bar: Google Keep + Material 3 Expressive app screens (fetch from m3.material.io) for calm utility, and Things 3 for restraint; critic compares screenshots blind (both orders) for "does it look designed, not AI-made", naming the biggest sign from signs.md still present.
- needs: nothing (runs parallel to T1).

**T3. Ten starter templates as parameterised mini-apps**
- Goal: the 10 templates of section 3 working in the sandbox with the frozen SDK and kit.
- Deliverable: `templates/<name>/app.html` + `params.schema.json` + `example.json` for each; `tools/run_template.mjs`.
- Acceptance: `node tools/run_template.mjs --all` runs each in a headless browser with no network: 0 console errors, each renders under 1 s, adds a row and persists it through reload, adds a field via migration without losing rows, passes the contrast check, size under 6 KB each; each template renders correctly in Urdu RTL text (screenshot diff against golden).
- Bar: Notion's habit tracker and journal templates and Loop Habit Tracker (open source, github.com/iSoron/uhabits) for the habits and counters; critic compares screenshots plus a 30-s scripted interaction blind.
- needs: SDK contract frozen; T2 tokens.

**T4. Gold request set (the 8 use cases x 5 phrasings) + expected plans**
- Goal: the seed for training data and the product eval, covering Urdu, Roman Urdu, English, vague, over-specified.
- Deliverable: `data/gold/requests.jsonl` (>= 40 rows: id, text, lang, use_case, expected_template, expected_fields), `data/gold/plans.jsonl` (hand-written 3-5 line plans), `tools/check_gold.py`.
- Acceptance: `python -I tools/check_gold.py` exits 0: >= 40 rows, all 8 use cases x 5 phrasings, >= 10 Roman Urdu and >= 10 Urdu script, every expected_template exists in `templates/`, every plan under 100 tokens, no duplicate texts; Urdu script rows have a Roman and English gloss for review.
- Bar: how real Pakistani users write: compare against a held-out sample of 30 real messages Kamal collects from 5 friends (a file he provides); critic judges naturalness blind of phrasing mixed with 30 real ones (can the critic tell which are ours?).
- needs: T3 template names (not the SDK freeze).

**T5. First-run, download and ask-field flow (shell screens)**
- Goal: welcome, download (pause/resume/checksum, device check), home with ask field, examples and template browsing while downloading.
- Deliverable: Expo screens in `app/src/screens/{Welcome,Download,Home,Ask}.tsx`, `app/src/lib/download.ts` with a unit-tested resumable downloader, Maestro flows `e2e/first-run.yaml`.
- Acceptance: unit tests pass (resume at offset, checksum mismatch rejected, low-storage refuses); Maestro flow on an emulator: install, start download, kill app at ~30%, relaunch, download resumes and completes, home opens; layout check at the 4 viewports passes (reuses T2 `layout_check`); airplane-mode flow shows templates still open.
- Bar: the Google Play "Download model" flow of Google AI Edge Gallery (github.com/google-ai-edge/gallery, pinned release) for resumable model downloads and honest sizes; critic compares recorded flows blind for "never leaves the user stuck".
- needs: T2; SDK contract frozen only for the template-opening part.

**T6. Plan card, streaming build view, template swap**
- Goal: sections 2.3 and 2.4: plan card, three-step progress, instant template, swap on validation, cancel.
- Deliverable: `app/src/screens/Build.tsx`, `app/src/lib/buildStream.ts` with a fake streaming engine (`engine.fake.ts` replays a recorded token stream), e2e flow.
- Acceptance: with the fake engine at 3 tok/s: template visible within 1 s (measured in the test, assert < 1000 ms); plan card visible within 10 s; swap keeps scroll position (assert); cancel leaves template and no half-written code in storage; one-question exception triggers only for the ambiguous fixtures and at most once; layout check passes.
- Bar: Lovable's and v0's streaming build views (public screen recordings, pinned URLs in the issue) for perceived-speed, but a LOSS if any blank screen longer than 1 s; critic compares timed recordings blind.
- needs: SDK contract frozen; T3; T5.

**T7. Edit-by-asking: diff summary, preview, one-tap undo, version history**
- Goal: section 2.5.
- Deliverable: `app/src/screens/Change.tsx`, `app/src/lib/versions.ts` (20 versions per app), `app/src/lib/summarize_patch.ts` (plain-language diff from patch ops, no model), unit tests.
- Acceptance: tests: apply patch then undo restores byte-identical code; data rows unchanged after apply and after undo (assert on a seeded DB of 200 rows); summary is generated from ops (snapshot tests for 8 patch kinds, each at most 3 bullets, under 20 words each); preview runs on a data copy and Keep/Undo both work; undo completes in under 1 s on emulator.
- Bar: GitHub Copilot Workspace/Cursor-style "review changes then accept" plus Google Docs version history for undo clarity; critic compares screen recordings blind for "would a non-programmer understand what changed and feel safe".
- needs: SDK contract frozen; T6.

**T8. Calm auto-repair UI + fallback to template**
- Goal: section 2.6.
- Deliverable: `app/src/lib/repair.ts` (state machine: running, repairing 1/2, failed), `app/src/components/RepairBar.tsx`, fixtures `fixtures/broken/*.html` (10 broken apps), e2e test.
- Acceptance: on each of the 10 fixtures with a fake engine that fixes N of them in 1 or 2 rounds: last good screen stays visible throughout (assert via screenshot hash before/after bar appears); max 2 rounds enforced; failure path offers Go back and Use basic version, both work and keep data; no string "error", "exception" or stack frames appears in the UI (grep rendered text); every repair appears in History.
- Bar: Chrome's "Aw, Snap" and Android's "App isn't responding" dialogs as the counter-example, and Notion's offline banner as the calm example; critic compares blind for tone (does it blame the user, alarm them, or lose work).
- needs: SDK contract frozen; T6.

**T9. Home grid, export/import, and the 10-tester kit**
- Goal: sections 2.7-2.8 plus a real user test.
- Deliverable: `app/src/screens/HomeGrid.tsx`, `app/src/lib/export.ts` (`.molde` zip), `app/src/lib/import.ts`, `docs/testing/tester-kit.md` (tasks, consent note, 10-question interview, success measure from README gate 1), CSV export.
- Acceptance: export then import into a clean install reproduces plan, code versions, theme and all rows (hash equal); data-stripped export has 0 rows (assert); delete has 5-second undo and 30-day Trash; weekly backup nudge appears once; tester kit renders; layout check at 5 viewports passes.
- Bar: Obsidian's vault-as-files portability and Google Keep's grid for density; critic compares the home screen blind and the export round trip by script (data-loss = automatic LOSS).
- needs: SDK contract frozen; T7.
