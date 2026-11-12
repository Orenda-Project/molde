# Molde

An offline phone app that moulds itself to whatever you need. Say "track my exercise" or "log my thoughts", and one tiny model running fully on the phone plans the tool, builds it inside the app, keeps track of it, fixes its own errors, and changes it when you ask.

Status: idea and research stage. Nothing is built yet. Owner: Kamal (Orenda-Project). Android first. Planned package name: `com.oyekamal.molde`.

## The idea (Kamal's words, tidied)
The user types or says what they want ("track my exercise", "log my thoughts"). One small model running fully offline on the phone does ALL of the work:

1. **Understand + plan.** It reads the idea and writes a short plan (what screens, what data, what it will track).
2. **Build inside the app.** It writes the code for the plan and the app runs right there, so the user starts using it at once.
3. **Keep track of everything.** The same model owns the app's record: the plan, the current code, a change history, and the errors seen. Nothing lives only in a chat.
4. **Fix its own errors.** When the code throws or renders wrong, the same model repairs it. Running the app never disturbs the user's saved data.
5. **Change by asking.** "Add a rest timer", "show weekly progress". The same model edits the existing code (a small patch), it does not rebuild from zero.

One model, one job, end to end: plan, build, track, repair, edit.

## Why the library choice is the whole game
A tiny model can only make big changes if few lines of code do a lot. So we pick the library and SDK FIRST, and the model is trained only against that fixed stack. Rule: the model writes glue; the kit does the heavy work.
- Output language: one small HTML file with Alpine.js directives (counter = one line), our own design kit (card, btn, stat, chip, themes), our own SDK (`store`, `ui.chart`, `ui.timer`, `app.notify`). Runs with no build step in a sandboxed WebView.
- Runner-ups if Alpine disappoints in tests: Preact + htm (~5 KB), Arrow.js (new, built for AI-written code). Rejected: native Kotlin/Swift (cannot compile on the phone), raw Tailwind (3 MB, token-heavy), A2UI JSON (too rigid for "any tool").

## Why we must train our own model
No off-the-shelf model does this narrow job (plan + write against OUR SDK + patch + repair, in a tiny size, offline). A small specialist beats a bigger general model on one narrow task (Temper-1-1.5B matched a model twice its size on 10k verified examples; UIGEN did the same for UI). So we fine-tune.

## Pipeline
request -> **plan** -> tiny model writes mini-app -> validator (size, schema, headless test run) -> sandboxed WebView -> SDK -> SQLite.
- Per mini-app, three things are stored OUTSIDE the generated code: `spec/plan`, `code versions + change log (one-tap undo)`, `user data (SQLite, one table per tracker)`. The SDK blocks destructive schema changes, so no rewrite or repair can lose logs.
- Loop A (repair): error + code -> model -> fixed code, up to 2 rounds, else fall back to nearest template.
- Loop B (edit): user ask + current code + plan -> model -> patch (only changed parts), logged to history.
- Starter template shows instantly while the model generates, so the user never stares at a blank screen.

## Training tasks (4, one model)
`plan` (request -> short plan) · `create` (plan -> full mini-app) · `edit` (code + ask -> patch) · `repair` (code + error -> fixed code).
Data: a big cloud model writes thousands of examples against the frozen SDK, a headless browser runs every one, only working ones are kept (expect about half). 100-200 hand-written gold examples first (exercise, journal, prayer, budget, study, medicine reminder, water, habits), 10,000+ varied requests including Urdu and Roman Urdu.
Fine-tune: Qwen3.5-2B (bake-off vs Gemma 4 E2B and Qwen2.5-Coder-1.5B), LoRA bf16 via Unsloth on free Colab, export GGUF Q4_K_M. Lite tier Qwen3.5-0.8B for 4 GB phones. Optional round two: reinforcement learning with reward = runs without errors.

## Stack
React Native (Expo) + llama.rn (llama.cpp, GGUF), react-native-webview with no network, SQLite. LiteRT-LM only if Gemma 4 wins the bake-off. Android first. Model downloaded once (~1-1.5 GB), resumable.

## Hard constraint: speed
2-5 tok/s on mid-range CPU vs 30-52 tok/s on flagship GPU. A 400-700 token app is 15-35 s fast, 2-4 min slow. Answers: very short code (the kit does the work), streaming UI, patches for edits, templates while generating, GPU/NPU where possible. Plan step must stay tiny too (a few lines).

## v1 targets (our own goals, not measured)
>=85% run first try · >=95% after 2 repair rounds · 100% of edits keep user data · median app <=600 tokens · first visible UI <=5 s on a mid-range phone.

## Roadmap (solo estimate, 4 gates)
1. **Prove it** (wk 1-3): shell, SDK, kit; a cloud model plays the tiny model; 10 real testers. Gate: testers keep using their tracker.
2. **Build the data** (wk 4-6): 200 gold, 10k generated, auto-tested. Gate: 5,000 verified.
3. **Train** (wk 7-9): LoRA on 3 models, phone bake-off, pick winner, quantize. Gate: >=85% first try on mid-range.
4. **Go offline** (wk 10-12): on-device engine, repair loop, lite tier, templates, closed beta. Fallback if the model misses: hybrid (cloud first build, device edits).

## Risks (short)
Slow phones · broken code from a tiny model · generated code misbehaving (offline sandbox, SDK-only access) · UI rewrite losing data (data kept apart from code) · 1-1.5 GB download · new model not supported by runtime (check in bake-off) · big players (compete on offline, private, free, local languages, in-app editing) · base-model licence (prefer Apache 2.0; check LFM) · battery and heat (generate only on request, unload when idle).

## Open questions
- [ ] First target user (students, gym-goers, prayer/habit trackers, shop owners)?
- [ ] Android only first, or Android + iOS?
- [ ] Which 2-3 real test phones (one 4-6 GB mid-range)?
- [ ] Which big model writes the training data, and the budget?
- [ ] Let users share a mini-app (HTML + empty data)?
- [ ] Product name.
- [ ] Should the plan be shown to the user for a yes/no before building, or built straight away? (speed vs control)
- [ ] Where does the "tracking record" live: SQLite table per app, or a plain JSON file per app?

## Next step
Phase 1 only. Decide the target user first (cheapest question, shapes the gold examples), then freeze the SDK + kit + mini-app format: everything else depends on it.

## Docs
- `docs/research/idea-and-research-2026-11-12.pdf`: first research write-up (model options, runtimes, UI languages, sources). It predates the plan step and the tracking record; this README is the current plan.
- Related work in Orenda: `offline-teacher-coach` shares the hard parts (small on-device model, Colab fine-tune, blind A/B eval).
