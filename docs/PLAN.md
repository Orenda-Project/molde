# Molde plan v2: a very tiny model that writes one small language

Written 2026-11-23. Replaces the v1 plan (README of 12 Nov and `docs/plan/01` to `04`), which stays in the repo as history.

## 1. What changes, in one paragraph

In v1 a 2B model wrote HTML and JavaScript. That is about 1,000 tokens per app from a 1.3 GB model, which means minutes of waiting on a cheap phone. In v2 the model writes **MoldeScript**, a small language we design for exactly this job, and a program we write (the runtime) turns it into the app. An app becomes about 100 tokens instead of 1,000, and because the language is small and strict, a model of about 100 to 300 million parameters can learn it. Fewer tokens times a much smaller model is where the speed comes from.

| | v1 | v2 target |
|---|---|---|
| What the model writes | HTML + Alpine + SDK calls | MoldeScript |
| Tokens per app | 400 to 1,100 (measured on our fixtures) | 150 or fewer (to measure in Phase 0) |
| Model | Qwen3.5-2B, 1.27 GB at Q4 | 100M to 300M class, about 100 to 300 MB |
| Speed reference | 13.8 tok/s for the 2B on Kamal's laptop (measured in offline-teacher-coach) | unknown until Phase 2; my estimate is 20 to 60 tok/s on a low-end phone |
| Time to a working app | minutes on a mid-range phone (estimate) | 2 to 5 seconds (target) |
| Can output be broken code? | yes, needs a repair loop | syntax cannot be wrong (grammar); meaning is checked by a type checker |
| Does model-written code run? | yes, in a sandbox | no. Only our runtime runs. |

The phone numbers in the v2 column are targets and estimates, not measurements. Phase 2 exists to replace them with real numbers before we spend on data.

## 2. The idea stays the same

Kamal's idea does not change: the user says what they want, one small offline model plans it, builds it inside the app, keeps track of it, fixes its own errors, and changes it when asked. What changes is the "one particular code" the model is trained on. We stop borrowing a big general language (HTML/JS) and give the model a language made for it.

## 3. MoldeScript: the one language the model learns

### 3.1 Design rules

1. **Short.** Every keyword is one token in the model's vocabulary. Target: median app 150 tokens or fewer.
2. **Line by line.** One statement per line. Any program cut at a line end is still a valid program, so the screen can build while the model is still writing.
3. **No free code.** No loops, no functions, no JavaScript. Only data, formulas, views and actions. Every formula always finishes.
4. **Typed.** Fields have types (`text`, `num`, `date`, `time`, `bool`, `pick`, `ref`). A checker rejects a program that uses a field that does not exist.
5. **Made of parts, not a menu of apps.** There is no `habit_tracker` keyword. There are tables, formulas, views and drawing primitives, and apps come from combining them. This keeps the rule Kamal set in v1: generic building blocks, the model writes the app.
6. **Data is never at risk.** The language can add or hide fields and tables. It has no "delete data" statement.

### 3.1b Kamal's correction (2026-11-23): the model is generic

The model must be able to create any type of UI. The app must not hard-code every possible screen piece. So MoldeScript has two levels:

- **Level 1, the core.** A small general UI language: layout, text, shapes bound to formulas, input controls, repetition over data, conditions, local state, data, formulas, events and actions, screens. With only this, a calendar, a chart, a water glass, a scoreboard, a quiz or a simple board game can be built. The runtime implements level 1 and nothing else.
- **Level 2, the standard library.** Common pieces (bar chart, calendar, list with actions, form, timer) are written in MoldeScript itself and shipped as library files. They are shorthand, not built-in features. A program can use them for a few tokens, or build its own piece from level 1 when nothing fits, and can define new components.

Section 3.2 below was the first sketch (a fixed list of views). It is replaced by this two-level design; the Phase 0 spec in `lang/SPEC.md` is the source of truth. The limit in 3.4 becomes narrower: any 2D data-and-UI tool is in scope; the internet, the camera, files and heavy algorithms are not.

### 3.1c Scope for now: English only (Kamal, 2026-11-23)

The first version works in plain English: requests, labels and training data. Urdu and Roman Urdu come back later as their own step. Wherever this plan mentions Urdu or Roman Urdu (data mix, eval gates, risks), read it as "later". The loop to prove first: the user says what they want in English, it is built inside the app, and it is tracked.

### 3.2 The four layers (first sketch, superseded by 3.1b)

- **Data:** `table`, fields with types, `setting` (a goal or limit the user can edit).
- **Formulas:** `sum`, `count`, `avg`, `min`, `max`, `streak`, with a time window (`today`, `week`, `month`, `last 7 days`), `by` grouping, `where` filters, and plain arithmetic.
- **Views:** `stat`, `list`, `form`, `quick` (one-tap add buttons), `chart` (bar, line, pie), `calendar`, `heat`, `timer`, `text`, `each` (repeat a block per row), and `draw` (shapes whose size or colour follows a formula, for custom visuals like a filling glass).
- **Actions:** on tap or on add: add a row, toggle, set a value, start a timer, remind at a time.

Plus two special statements: `theme` and `ask` (the model may ask the user one short question with tap answers when the request is unclear).

### 3.3 Draft examples (syntax is not final; Phase 0 fixes it)

```
app "Water" theme ocean
table drink: ml num, at time
setting goal = 2000
stat sum(drink.ml today) of goal unit "ml" draw glass
quick drink.ml 250 500
chart bar sum(drink.ml) by day last 7
list drink today show ml at
```

```
app "Habits" theme mint
table habit: name text
table check: habit ref, on date
stat count(check today) of count(habit) label "done today"
each habit: row name, toggle check on today, streak(check)
calendar check by habit month
form habit
```

An edit is the same program with one line added, for example `table drink: ml num, at time, note text`.

### 3.4 The honest limit

A closed language can only build what its parts can express. It will not make a game, call the internet, use the camera or run a new algorithm. Three things keep this from becoming a trap:

- **Coverage gate before any training (Phase 0):** take 300 varied requests, have a big model try to write each in MoldeScript, and count how many cannot be expressed. Gate: 90% or more expressible. If it fails, the language grows before we go on.
- **Growth loop:** requests the app cannot build are saved on the phone (the user can choose to share them). They decide what the next language version adds.
- **Versions:** every program records its language version, and the runtime keeps reading old versions.

## 4. The model

### 4.1 Why tiny can work here

The model has one job: read a short request (Urdu, Roman Urdu or English) and write about 100 tokens of a strict language. It does not need world knowledge or long reasoning. Published work on small models writing domain languages reports that fine-tuning plus grammar-constrained decoding is the pattern that works, though those studies use 1B to 7B models; nothing I found tests the 100M to 300M range, so that part is our experiment.

### 4.2 Candidates (a ladder, smallest that passes wins)

| Rung | Base | Why | To verify |
|---|---|---|---|
| A | from-scratch transformer, 30M to 50M, own tokenizer | fastest and smallest possible | whether it can understand free-form Roman Urdu at all |
| B | Gemma 3 270M | built by Google for task fine-tuning; 100M of its parameters are the transformer and 170M are the vocabulary table; has QAT checkpoints | licence terms, phone speed |
| C | a 135M to 360M Apache-licensed model (SmolLM class) | permissive licence | current versions and quality |
| D | Qwen3.5-0.8B | Apache 2.0, strong for its size, same family we already ship in offline-teacher-coach | still about 3x smaller than v1 |

Rung D is the safety net: even if nothing smaller passes, a 0.8B model writing 100 tokens is far faster than a 2B model writing 1,000.

### 4.3 Tricks that make it smaller and faster

- **Vocabulary pruning.** Most of Gemma 3 270M is a table for 256k tokens in 140 languages. We only need Latin letters, Urdu script, digits and MoldeScript keywords. Keeping about 30k tokens would cut the model to roughly 120M parameters (my arithmetic, to confirm), with no change to the transformer.
- **Keyword tokens.** About 150 new single tokens for MoldeScript keywords, so `table`, `sum(`, `last 7 days` cost one token each.
- **Full fine-tune, not LoRA.** The model is small enough to train all weights on a free Colab T4 or the GTX 1070 laptop.
- **Distillation.** Train rung D first as a teacher, let it label a large pile of unlabelled requests, keep only outputs that pass the checker, and train the smaller rungs on that.
- **Quantization with care.** Tiny models lose more from 4-bit. Offline-teacher-coach saw about 3 points lost between fp16 and Q4. Compare Q8, Q4 and the QAT route, and judge only the file that ships.

### 4.4 Decoding on the phone

- **Grammar-constrained sampling** (llama.cpp GBNF or its llguidance backend): the model can only emit tokens that keep the program valid, so syntax errors cannot happen.
- **Type check after each line:** unknown field or table gives one retry with the error; a second failure falls back to the nearest gold program.
- **Fixed prompt cached once.** The instructions never change, so their state is computed once and reused; each request only processes its own few words.
- **Greedy decoding, 300-token cap, stop at end of program.**
- **Render as lines arrive.** Target: first visible part of the app within 1 second.

## 5. The runtime (the part we write once)

- Parser, type checker, formatter and the GBNF grammar are generated from one grammar file, so they cannot drift apart.
- The renderer turns a MoldeScript program into screens. It reuses the kit from PR #33: the data layer (SQLite, soft delete, undo tray), components (stat, list, form, chart), five themes, locale-aware numbers, Urdu and RTL support, and its 233 tests. That work is not wasted; it becomes the engine under the language.
- Because the model no longer writes JavaScript, nothing the model writes is ever executed. The big sandbox problem of v1 (25 attack cases, CSP gaps, reachable globals) mostly disappears.
- **Data safety by construction:** the runtime compares the old and new program. Added fields get defaults, removed fields are hidden (never dropped), and a changed type is refused. Every version is kept, so undo is one tap.

## 6. Plan, track, repair, edit: how the five jobs map

| Kamal's step | v2 mechanism |
|---|---|
| Understand and plan | The program is the plan. The app shows a plain-language summary generated from it by fixed templates ("Tracks: ml, time. Shows: today's total, 7-day chart"), so no extra model tokens. |
| Build inside the app | The model writes MoldeScript; the runtime renders it at once. |
| Keep track of everything | Per app: every program version, the request that caused it, and any errors, stored in SQLite next to the user's data. |
| Fix its own errors | Syntax errors cannot occur. Type errors trigger one retry with the error text, then a fallback. Runtime errors are our bugs, fixed in the runtime for everyone. |
| Change by asking | The model reads the current program plus the request and writes the whole new program (it is only about 100 tokens). The runtime works out what changed, checks data safety, shows the change in words, and offers undo. No patch format is needed. |

## 7. Training data

A strict language makes data cheap and clean, because a machine can check every example exactly.

1. **Gold set (hand-checked):** 60 programs covering exercise, journal, habits, water, budget, study, medicine, prayer, shop stock, reading list, plus 40 edits.
2. **Program-first generation:** sample thousands of valid programs from the grammar, then ask a big model to write the request a person would have typed for each one, in Urdu, Roman Urdu and English, in several styles (short, vague, detailed, with typos). The label is correct by construction.
3. **Request-first generation:** a big model writes realistic requests and their programs; the checker keeps only valid ones. This adds realism.
4. **Edit pairs:** apply a random change to a program (add a field, add a chart, change the theme, add a reminder) and have a big model phrase the request. Exact labels again.
5. **Unclear requests:** examples where the right output is an `ask` line.
6. **Checks on every example:** parses, type checks, renders in the headless runtime, survives a property test (add rows, reload, edit), and is not a near-duplicate.
7. **Held-out set sealed first:** 500 requests, including real messages collected from people Kamal knows, never used in training.

Volume target: 300k to 500k examples. Cost guess: 100 to 300 USD using a cheap model for phrasing; a 5k pilot in Phase 2 gives the real figure. Open point carried from v1: check the model provider's terms on training with its outputs before any public release.

## 8. Evaluation and gates

All numbers are measured on the quantized file that ships, on a real phone.

| Metric | Gate |
|---|---|
| Valid syntax | 100% (by construction) |
| Type-valid on first try | 97% or more |
| Intent match on create (fields and views compared with the reference, plus a judged sample) | 85% or more |
| Edit does exactly what was asked | 90% or more |
| Edits that lose user data | 0 (by construction) |
| Urdu and Roman Urdu vs English | within 5 points |
| First visible UI | 1 second or less |
| Full app | 5 seconds or less on the target phone |
| Model file | 300 MB or less (stretch: 150 MB) |
| Peak memory | 700 MB or less |

## 9. The phone app

**Shell shape (Kamal, 2026-11-23):** the whole screen is the user's app. One chat button sits in the bottom-right corner. Tapping it opens a chat where the user asks for a new app or a change to the current one. Everything else on screen is what the user asked for. The goal is one app that replaces the many basic to-do, tracker and list apps.

- **Shell:** reuse the Flutter shell and the `llama_flutter_android` setup that already runs a GGUF on Kamal's phone in offline-teacher-coach, plus a WebView for the kit runtime. v1 chose React Native on paper; reusing a shell that already works on the real phone is cheaper. After every model export, run a load test with the bundled llama.cpp (the lesson from the coach's GGUF metadata bug).
- **Model delivery:** small enough to ship with the app as a Play asset pack, so there is no 1 GB first-run download. To verify against Play size limits.
- **Screens:** ask box, building view with lines appearing, the app itself, change box with a "what changed" line and undo, home grid, history, export and backup. The flows from `docs/plan/04` still apply.
- **Device tiers (targets):** 2 GB RAM phones get the smallest rung; 3 to 4 GB the main model; 6 GB and up may offer rung D as a "smarter" option.
- **Baseline app features** (updates, privacy policy, crash reports) come from the `app-essentials` checklist as before.

## 10. Phases, gates and stop rules

Each phase has machine-checked gates, one demo for Kamal, and one critic review at the end with at most two fix rounds. No per-task blind look contests; that is what made v1 slow.

| Phase | Work | Gate to pass | Time guess |
|---|---|---|---|
| 0. Language | MoldeScript spec, grammar file, 30 hand-written programs, coverage test on 300 requests, token counts | 90% or more of requests expressible; median program 150 tokens or fewer | 3 to 4 days |
| 1. Runtime | parser, checker, formatter, renderer on the PR #33 kit, version diff and data safety, streaming render | the 30 programs render and pass property tests; fuzzed edits never lose data | about 1 week |
| 2. Model spike | 20k pilot examples, fine-tune rungs A to D, measure accuracy and speed on the laptop and one real phone | at least one rung reaches 80% intent match, and its phone speed gives an app in 10 s or less | 4 to 5 days |
| 3. Full training | 300k+ examples, teacher then distilled student, vocabulary pruning, quantization study, per-language eval | all gates in section 8 | 1 to 2 weeks |
| 4. App | Flutter shell with the model inside, all flows, 10 real testers for a week | testers keep using their tools | 1 to 2 weeks |
| 5. Release | hardening, Play closed beta | no crashes in Play pre-launch report | about 1 week |

**Stop rules.** If Phase 0 fails coverage twice, the closed-language idea is wrong for this product and we return to a general-code model. If Phase 2 shows no rung under 1B reaching 80%, we ship rung D and treat smaller models as later work. Phase 2 is deliberately early and cheap: it answers "can a very tiny model do this" before the expensive data build.

## 11. What we keep from v1 and what we drop

- **Keep:** the kit and its tests (PR #33, becomes the runtime), the data-safety rules, the process tools in `tools/`, the product flows in `docs/plan/04`, the Opus-written baseline apps as a feature reference.
- **Drop:** model-written HTML and JavaScript, the 2B model, patch formats, the JavaScript repair loop, most of the sandbox attack work, and the look contest against other apps.
- **GitHub:** the 31 v1 issues get replaced by a shorter list cut from section 10 when work starts. PR #33 merges as the runtime base.

## 12. Risks

1. **The language is too narrow.** Mitigation: the Phase 0 gate and the growth loop.
2. **A tiny model cannot understand loose Roman Urdu.** Mitigation: the ladder up to 0.8B, and heavy Roman Urdu variety in the data.
3. **Labels in Urdu come out misspelled.** Mitigation: labels are mostly copied from the user's own words; measure it in the eval.
4. **Quantization hurts tiny models.** Mitigation: the Q8, Q4 and QAT comparison; judge the shipped file only.
5. **Phone speed is still an estimate.** Mitigation: Phase 2 measures it on a real phone.
6. **Licences.** Gemma has its own terms; Qwen3.5-0.8B is reported as Apache 2.0. Read the model cards before choosing.
7. **Big companies ship something similar.** Our edge stays offline, private, free, local languages and tiny size.

## 13. Open decisions (defaults I will use unless told otherwise)

- First user: young adults in Pakistan who type Roman Urdu, on phones with 3 to 4 GB RAM.
- Android only for v1.
- Target test phone: whichever 3 to 4 GB phone Kamal can test on; this is the one thing I cannot substitute.

## Sources checked on 2026-11-23

- [Introducing Gemma 3 270M (Google Developers Blog)](https://developers.googleblog.com/en/introducing-gemma-3-270m/): 170M embedding plus 100M transformer parameters, built for task fine-tuning, QAT checkpoints.
- [Gemma 3 270M tutorial (DataCamp)](https://datacamp.com/tutorial/gemma-3-270m): Q8 on-device file about 319 MB.
- [Gemma 4 vs Phi-4 Mini vs Qwen3.5 (tech-insider, secondary source)](https://tech-insider.org/gemma-4-vs-phi-4-mini-vs-qwen3-5-2026/): Qwen3.5-0.8B, Apache 2.0.
- [Fine-tuned small models for NL-to-DSL (arXiv 2604.09952)](https://arxiv.org/pdf/2604.09952) and [constrained decoding for a business-automation language (arXiv 2207.10648)](https://arxiv.org/pdf/2207.10648): fine-tuning plus constrained decoding works for domain languages; models there are larger than ours.
- [llguidance](https://github.com/guidance-ai/llguidance) and [llama.cpp grammar speedup PR 6616](https://github.com/ggerganov/llama.cpp/pull/6616): grammar-constrained sampling cost is small on servers; no phone numbers found.
- Internal: offline-teacher-coach results (2B at 13.8 tok/s on the laptop, Q4 about 3 points below fp16, GGUF load test lesson).
