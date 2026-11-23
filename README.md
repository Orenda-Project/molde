# Molde

An offline phone app that moulds itself to whatever you need. Say "track my exercise" or "log my thoughts", and one very tiny model running fully on the phone plans the tool, builds it inside the app, keeps track of it, fixes its own errors, and changes it when you ask.

Status: plan v2 (2026-11-23). A generic UI kit exists in PR #33; the language, runtime and model are not built yet. Owner: Kamal (Orenda-Project). Android first. Planned package name: `com.oyekamal.molde`.

**The current plan is [`docs/PLAN.md`](docs/PLAN.md).** This page is the short version.

## The idea (Kamal's words, tidied)

The user types or says what they want. One small model, fully offline, does all of the work:

1. **Understand and plan.** It reads the idea and decides what screens and data the tool needs.
2. **Build inside the app.** The tool appears right there and the user starts using it.
3. **Keep track of everything.** The plan, every version, the change history and the errors are stored, not lost in a chat.
4. **Fix its own errors** without ever disturbing the user's saved data.
5. **Change by asking.** "Add a rest timer", "show weekly progress".

## How v2 makes it fast enough for a small phone

The model no longer writes HTML and JavaScript. It writes **MoldeScript**, a small strict language made for this one job, and a runtime we write once turns that into the app.

- An app is about 100 tokens instead of about 1,000.
- A language this small can be learned by a model of roughly 100 to 300 million parameters (about 100 to 300 MB) instead of a 2B model (1.3 GB).
- A grammar guides the model while it writes, so the syntax cannot be wrong. A type checker catches the rest.
- Nothing the model writes is ever executed as code. Only our runtime runs, which removes most of the sandbox risk.
- Target: a working app in 2 to 5 seconds on a low-end phone. This is a target, not a measurement; Phase 2 of the plan measures it on a real phone before any large spend.

```
app "Water" theme ocean
table drink: ml num, at time
setting goal = 2000
stat sum(drink.ml today) of goal unit "ml" draw glass
quick drink.ml 250 500
chart bar sum(drink.ml) by day last 7
list drink today show ml at
```

(Draft syntax. Phase 0 fixes the real one.)

## The honest limit

A closed language builds only what its parts can express: trackers, logs, lists, planners, counters, timers, reminders, simple calculators. It will not make a game or call the internet. The plan tests this first: if fewer than 90% of 300 varied requests can be written in MoldeScript, the language grows before anything is trained.

## Phases

| Phase | What | Gate |
|---|---|---|
| 0 | Language spec and coverage test | 90% of requests expressible, median program 150 tokens or fewer |
| 1 | Runtime on the existing kit | 30 programs render; fuzzed edits never lose data |
| 2 | Model spike on a real phone | a model under 1B reaches 80% and builds an app in 10 s or less |
| 3 | Full data, training, distillation, quantization | the eval gates in the plan |
| 4 | Phone app and 10 testers | testers keep using their tools |
| 5 | Closed beta | clean Play pre-launch report |

## Repo map

- `docs/PLAN.md`: plan v2 (current).
- `docs/plan/01` to `04`: plan v1 (model writes HTML; superseded, kept as history; the product flows in `04` still apply).
- `docs/process/`, `tools/`: the builder and critic process tools.
- `docs/research/`: the first research write-up.
- PR #33 (`task-02-kit`): the generic kit that becomes the runtime engine.

Related work in Orenda: `offline-teacher-coach` (small on-device model, fine-tuning, a Flutter shell that already runs a GGUF on a phone).
