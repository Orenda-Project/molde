# Molde handoff (written 2026-11-23, end of session)

Read this first when resuming. It says what exists, what was running, and the next step for each track. The plan is `docs/PLAN.md` (plan v2).

## Owner's rules (Kamal)

- The model is **generic**: it must be able to create any UI. Nothing app-specific is hard-coded in the app or the language runtime.
- **English only** for the first version. Urdu and Roman Urdu come later.
- Shell shape: the whole screen is the user's app; **one chat button bottom-right** opens a chat to create or change apps. One app replaces basic to-do, tracker and list apps.
- The orchestrating session (Fable) only **manages and reviews**. Builders and critics are Opus, Sonnet or Haiku agents.
- Use the **gauntlet loop**: builder, then separate blind critics against a named reference, both orders, loop until ours wins. Post verdicts on the GitHub issue with `tools/post-verdict.sh`.
- Do not ask Kamal questions; decide, say so in one line, continue. Never run `rm`; use new uniquely named folders.
- Colab is allowed for training. Flow: free images only, never spend credits, never `flow_retry`.

## Tracks and state

| Track | Branch / place | State | Issue / PR |
|---|---|---|---|
| Language (MoldeScript v0) | `phase-0-language` @ `f473464`, worktree `/tmp/molde-p0`, folder `lang/` | Round 2 judged LOSS (close). Round 3 fixes in progress by the Opus builder. | #34, PR #35 |
| Runtime (web renderer + live demo) | `phase-1-renderer` @ `948f3c6`, worktree `/tmp/molde-p1`, `runtime/web/` | Round 1 LOSS. Round 2 built (192 checks pass); two blind critics were judging it. | #37, PR #36 |
| Local model baseline (no training) | `~/Documents/free_work/molde-model/phase2a/` | Sonnet agent running; result will be `REPORT.md` there. | none yet |
| Training pipeline + Colab smoke run | `phase-2-train` (worktree `/tmp/molde-p2`, `train/`), Drive folder `molde-train/` | Sonnet trainer running; cap 3 Colab units; not pushed yet when this was written. | none yet |
| Hugging Face | `oyekamal/molde-tiny` (private) | Repo and card exist; first upload will be `smoke-r0/` (pipeline test). | |
| App screen designs (Google Flow) | `~/Documents/free_work/molde-design/flow-r1/`, `flow-r2/` | Round 1 won blind vs a Things 3 + Keep mix (weak bar). Round 2 in progress vs Things 3 alone. | |
| v1 kit | `task-02-kit` @ `7af42f8` | Paused. Round 8 never judged. Superseded by the language + runtime; its CSS ideas were reused. | #2, PR #33 |

Live demo files Kamal has opened: `~/Documents/free_work/molde-design/demo/molde-demo-r1.html` and `molde-demo-r2.html` (round 2, he liked round 1). Preview artifact (round 1 numbers): https://claude.ai/artifact/Vvc7jRrZge9xJZN34NzE9u . Old v1 progress page: https://claude.ai/artifact/3qG9F9j9CTcegjCJ39W7T5 .

Archived inputs (copied out of `/tmp`): `~/Documents/free_work/molde-design/archive-2026-11-23/` holds the 300 English requests, the first mixed-language set, the coverage results, the no-kit baseline apps and the posted verdict JSON files.

## Language: what is true now

- Two levels: level 1 is a general core (layout, text, shapes, inputs, each/if, state, data, formulas, actions); level 2 is a standard library written in MoldeScript (`lang/std/`). The runtime implements level 1 only.
- Round 2 numbers (critic-verified): 411 tests pass; 4,639 prefix checks pass; 0 crashes in 20,000 mutations and in an interaction sweep of 330 programs; corpus of 300 programs written by other agents has a median of 133 tokens (planned tokenizer); builder's std-style examples 151; about 5 times fewer tokens than v1 HTML; 2.4 to 3.4 times fewer than Google A2UI.
- Coverage (round 1, 300 blind English requests): 237 full, 50 partial, 13 no; 92% of the 257 in-scope requests full.
- Open faults sent to the builder for round 3:
  - Data safety: a rename followed by drop and re-add can orphan stored values while the diff says safe; the evaluator does not move rows on `was`; `mo.mjs diff` must take the full history; option and setting renames under-checked. Needed: a storage-slot contract in `SEMANTICS.md`, implemented and fuzzed in `eval.mjs`, plus a "restore previous program, keep current data" rule for Undo.
  - Wrong results: `at <= today` excludes today; `time - time` negative across midnight; sum/avg of a time column silently 0.
  - Error hints for likely model slips (bare-name text line, comma slips, colour-word options).
  - New `lang/constrain.mjs`: a dynamic name constraint for decoding, because the grammar cannot know which names exist (96.8% of name swaps pass the grammar but fail the checker).
  - Generic holes: power, nth or random row, delay action, row-valued formula parameters.
  - The renderer's 15 needs (chart frame with axes, join and number format, `each ... empty`, aspect ratio and centre/fill, labels on toggle/choice, action kind, public editor API, local time).
  - Store `lang/corpus/requests.jsonl` and `COVERAGE.md` in the repo.
- Next: when round 3 is pushed, run a fresh Sonnet critic (same brief as round 2: data-safety attack, evaluator truth, stranger test, learnability, genericity, tokens) and post the verdict on #34.

## Runtime: what is true now

- `runtime/web/render.mjs` draws only level-1 nodes (both round 1 critics confirmed generic). `dist/molde-demo.html` is one self-contained file with 15 example apps, the chat-button shell and scripted chat requests (labelled as scripted; the model is not trained).
- Round 1 faults: chat Undo lost data entered after a change (fixed in round 2 per the builder's tests), unlabeled charts, left-stuck custom screens, chat button over content, fixed px fonts.
- Round 2 critics were launched with packs in `/tmp/p1r2/out` (key in `/tmp/p1r2/out.KEY.private.txt`: critic1 A=candidate, critic2 A=bar). If their reports are lost, rerun two Sonnet critics with the same brief: blind strips (ours `runtime/web/shots/{habits,exercise,budget,journal}-412x915.png` vs `archive-2026-11-23/baseline-nokit/shots/`), then hands-on with emphasis on Undo and data.
- Next: post the round 2 verdict on #37; after the language round 3 lands, rebase the renderer onto it and replace hand-placed chart labels with the new chart frame.

## Model: plan and next steps

1. Read `molde-model/phase2a/REPORT.md` when it exists: checker pass rate, intent match, tokens per second and RAM for 270M, about 500M, 0.8B and 2B models with no training, with and without the grammar.
2. Check the trainer's branch `phase-2-train` and PR; confirm the smoke run (smallest model, a few hundred pairs), units spent (cap 3) and that the Colab runtime was released.
3. Build the pilot dataset (about 20k pairs): program-first generation (mutate real programs, have Haiku or Sonnet agents write the request), edit pairs from mutations, every target checked with `mo.mjs check` and run in `eval.mjs`; hold out the 40 test requests. Only start after the language round 3 verdict, and run `mo.mjs migrate` on old targets.
4. Train the ladder (270M, 360M class, 0.8B) on Colab, evaluate on the quantised GGUF with the grammar and the name constraint, upload each round to `oyekamal/molde-tiny` in its own folder.
5. A real 3 to 4 GB Android phone is still needed for true speed numbers.

## Design: next steps

- Round 2 screens land in `molde-design/flow-r2/` with `contact.png`. Judge blind against five Things 3 screens (`molde-design/bar-r1/things-*.png`, crop the top 23% headline band), two Haiku critics, both orders, then per-screen scores.
- The Flow tool fix is on branch `fix/composer-selectors-2026-11` in `~/flow-mcp` (commit 41db30c, not pushed); it needs `npm run build` and an MCP restart. Until then the agent drives Flow over CDP with scripts in `flow-r1/tools/`.

## How to resume

1. `git fetch origin` in `~/Documents/free_work/molde`; compare branch heads with the table above to see what landed after this file was written.
2. Read the newest comments on issues #34 and #37.
3. Recreate worktrees if `/tmp` was cleared: `git worktree add /tmp/molde-p0 origin/phase-0-language` (and `-p1`, `-p2` for the other branches). The worktrees hold no unpushed work except what the agents were doing when the session ended.
4. Continue each track from its "Next" line. Old v1 issues #2 to #31 are still open and should be closed as superseded once Phase 0 passes.
