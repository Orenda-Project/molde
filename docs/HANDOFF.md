# Molde handoff (updated 2026-11-24, 06:30 PKT)

Read this first when resuming. The plan is `docs/PLAN.md` (plan v2).

## Owner's rules (Kamal)

- The model is **generic**: it creates any UI. Nothing app-specific is hard-coded in the app or the runtime.
- **English only** for the first version.
- Shell: the whole screen is the user's app; **one chat button bottom-right** to create or change apps.
- The orchestrating session only **manages and reviews**; builders and critics are Opus, Sonnet or Haiku agents.
- **Gauntlet loop**: builder, then separate blind critics, both orders, loop until ours wins. Post verdicts with `tools/post-verdict.sh` (verdict JSONs archived in `~/Documents/free_work/molde-design/archive-2026-11-23/`).
- Do not ask Kamal questions. Delete without asking when sure; keep a manifest (`molde-design/cleanup-2026-11-24/MANIFEST.md`).
- Colab allowed for training (r2 cap 8 units). Flow: free images only, never `flow_retry`.
- Standing goal: "a working model and app, fully tested, ready for real use". At most 3 or 4 heavy agents at once.

## Where everything is (all branches pushed; heads as of this file)

| Track | Branch @ head | Worktree | State |
|---|---|---|---|
| Language (MoldeScript) | `phase-0-language` @ `4daa3a3` (round 12) | `/tmp/molde-p0` | Rounds 1-11 LOSS (issue #34, PR #35). Round 12 built: 583 tests, lockstep fuzz 3,000 chains 0 violations. **Next: run the round 12 critic** (same brief as round 11, see the round 11 verdict). |
| Renderer (web) | `phase-1-renderer` @ `2054ba4` (round 4) | `/tmp/molde-p1` | Rounds 1-3 LOSS (issue #37, PR #36). Round 4 built: 218 checks, all 8 fix items done. Blind packs ready in `/tmp/p1r4/out` (key `/tmp/p1r4/out.KEY.private.txt`: critic1 A=candidate, critic2 A=bar). **Next: rerun the two critics** (they died on the weekly usage limit). Demo: `molde-design/demo/molde-demo-r4.html`. |
| Training | `phase-2-train` @ `a21e55d` | `/tmp/molde-p2` | r1 done (report `molde-model/r1/REPORT.md`). r2 on dataset v2: Gemma trained in two Colab sessions; the eval step aborted (`jobs-r2-gemma-s2/runner.log`, 05:57). **Next: get the r2 Gemma model from Drive, export GGUF on the laptop, evaluate; then Qwen 2 epochs.** No Colab runtime is attached. About 9.5 units spent in r1 + setup. |
| Dataset v2 | outside git: `molde-model/data-v2/` | | 14,538 verified pairs, 68% real wording; new test set `heldout2.jsonl` (149). |
| Constrained decoding | `phase-2-decode` @ `b063210` | `/tmp/molde-dec` | Done. Line-stepped decoding with a per-line name grammar lifts r1 Gemma Q8_0 from 50% to 77% valid on real wording (Q4_K_M 43% to 75%); intent unchanged. Report `decode/REPORT.md`. |
| Android app | `phase-4-app` @ `7a6ee6f` | `/tmp/molde-app` | Works end to end on the emulator with the real model (create, change, Undo, persistence, switcher, backup). About 100 s per app in the emulator (2.7 s on the host). arm64 APK never run on a phone. APK: `molde-design/app-r1/apk/`; screenshots `molde-design/app-r1/`. |
| Hugging Face | `oyekamal/molde-tiny` (private) | | r1 Gemma uploaded. |

## Key numbers

- r1 Gemma 270M on the 149-item heldout2 (Q8_0, plain grammar): checker pass 63.8%, intent score 0.746; creates 50%, edits 100%, ask 90%, out-of-scope 70%.
- Same model on the old 44 real-wording requests: 50% plain grammar, 77% with constrained decoding.

## Open items to do next

1. Language round 12 critic; renderer round 4 critics (packs ready).
2. r2 Gemma: export, evaluate on heldout2 with plain grammar and decoder arm E; Haiku-judged intent; upload; then Qwen r2.
3. App: bundle renderer `2054ba4` (adds "Show N more" for long lists), language `4daa3a3`; swap in the r2 model; test on Kamal's phone (`adb install` the arm64 APK, `adb push` the GGUF to `/sdcard/Android/data/com.oyekamal.molde/files/models/model.gguf`).
4. Renderer asks for two language features: `alt` with formula parts, typed parts on plot ticks.
5. Close v1 issues #2-#31 as superseded once the language passes.

## How to resume

1. `git fetch origin` in `~/Documents/free_work/molde` and compare heads with the table.
2. Recreate missing worktrees: `git worktree add /tmp/molde-p0 origin/phase-0-language` (and p1, p2, dec, app).
3. Read the newest comments on issues #34 and #37.
