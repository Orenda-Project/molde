# MoldeScript v0 (Phase 0 of plan v2)

The language the tiny on-device model writes. The reference is [`SPEC.md`](SPEC.md); this page says how to run things and what the language cannot do.

## Files

| Path | What |
|---|---|
| `SPEC.md` | the language reference (level 1 core, level 2 std library, runtime defaults, errors, version) |
| `grammar/moldescript.grammar` | **the one grammar source** (llama.cpp GBNF syntax, one statement per line) |
| `gen-gbnf.mjs` | writes `moldescript.gbnf` (adds the root and the indentation structure) and `grammar/added-tokens.json` |
| `moldescript.gbnf` | generated; use it for grammar-constrained decoding |
| `engine.mjs`, `grammar.mjs`, `lex.mjs` | the parser runs the grammar file itself, so parser and GBNF cannot drift |
| `parse.mjs` | text to typed AST with line numbers |
| `expand.mjs` | component (`def`) expansion; loads the std library |
| `check.mjs` | type checker; errors as `line N: CODE: message. Fix: hint.` |
| `format.mjs` | canonical formatter (idempotent; its output is what the GBNF accepts) |
| `describe.mjs` | fixed-template English summary of a program (the plan shown to the user) |
| `diff.mjs` | old program vs new: changes and a data-safety verdict |
| `mo.mjs` | the CLI |
| `std/*.mo` | the standard library, written in MoldeScript |
| `tokens.py`, `TOKENS.md` | token counts (stock Qwen3.5 and planned tokenizer) and the gates |
| `examples/NN-name.mo`, `examples/INDEX.json` | 30 programs; `edits/NN-name/{before.mo,request.txt,after.mo}`: 20 edits |
| `tests/` | `node --test lang/tests/` |
| `tools/gbnf-check.cpp` | a 60-line checker that runs llama.cpp's own grammar engine on files |

## Run

Node 20, no npm install needed. From the repo root:

```
node --test lang/tests/                         # 340 tests
node lang/gen-gbnf.mjs                          # regenerate moldescript.gbnf after editing the grammar
node lang/mo.mjs check lang/examples/*.mo       # OK, or errors with line, code and fix
node lang/mo.mjs format FILE [--write]
node lang/mo.mjs describe lang/examples/01-water.mo
node lang/mo.mjs diff lang/examples/edits/16-add-table/before.mo lang/examples/edits/16-add-table/after.mo
node lang/mo.mjs expand lang/examples/28-pomodoro.mo   # the level-1 program after std expansion
python3 lang/tokens.py                          # or: node lang/mo.mjs tokens  (needs the `tokenizers` package)
UPDATE_SNAPSHOTS=1 node --test lang/tests/describe.test.mjs   # after changing describe.mjs on purpose
```

The llama.cpp grammar test compiles `tools/gbnf-check.cpp` against `libllama.so` from `LLAMA_LIB_DIR` (default: Kamal's `~/llama.cpp-b12144/llama-b12144`) and is skipped when g++ or the library is missing. The same GBNF file is always also checked by our own engine.

## What the tests check

- all 30 examples and all 40 edit programs parse, type-check and are already in canonical form; the formatter is idempotent;
- prefix-valid: every one of those programs cut after every line still parses and type-checks;
- the GBNF is up to date, accepts every valid program (in llama.cpp and in our engine) and rejects broken syntax;
- 52 invalid programs, each rejected with the expected error code and line;
- every std component expands to level-1 statements only, and the expansion checks on its own; user `def` with `slot`; two timers do not share state;
- 15 diff cases (added field safe, removed field hidden, type change refused, widenings allowed, pick options) and every edit pair is safe;
- describe snapshots for all 30 examples; every complete program in SPEC.md checks.

## Design decisions (short)

- **Two levels, one runtime.** The runtime implements level 1 only. Charts, lists, forms, timers and calendars are MoldeScript components (`def` with typed parameters, call-by-name substitution, `slot`), so the model can use a shorthand or build its own UI from the same parts.
- **Lines and indentation.** One statement per line and declare-before-use make every prefix a valid program, so the screen can build while the model writes. Indentation gives nesting without closing brackets (a closing line would break prefix validity).
- **One grammar file drives both the parser and the GBNF.** The parser is a small engine that runs the GBNF rules directly; the generator only adds the root and the depth-bounded indentation rules.
- **`let` and text roles** (`big`, `head`, `faint`) were added after measuring: repeated formulas and repeated style words were the largest avoidable token cost.
- **Keywords as single tokens, measured honestly.** Qwen's tokenizer already encodes nearly every English keyword as one token; only bracketed function words (`sum(`), two std names and indentation needed adding. That saves 3 to 6 percent; the rest of the saving comes from the language itself.
- **Data is never at risk.** No statement deletes data; `remove` is a soft delete with undo; `diff` hides removed fields and refuses type changes.
- **Typed and checked.** The checker knows tables, fields, refs and back links, windows, pick options, required fields and where each statement may appear, and writes errors meant to be pasted into a repair prompt.
- **English only for now.** Strings are Unicode-safe; Urdu and Roman Urdu come later.

## Gates (details in TOKENS.md)

| Gate | Result |
|---|---|
| 30/30 examples valid | met |
| prefix-valid property | met (every line cut of 70 programs) |
| formatter idempotent | met |
| median 150 tokens or fewer, std-style apps | **missed**: 159 with the planned tokenizer (165 stock) |
| 5x fewer tokens than the v1 HTML fixtures | **met in total** with the planned tokenizer (5.10x; stock 4.93x); water 2.8x and budget 3.9x miss on their own |
| custom level-1 apps (target 350 or fewer) | median 243, max 442 (tic-tac-toe 423, budget-plus 442 are over 350) |

The coverage gate (300 blind requests) is run later by other agents from SPEC.md and the CLI.

## What MoldeScript v0 cannot express (honest list)

Outside a 2D data-and-UI app, by design:

- network and internet, accounts, sync or sharing between phones, cloud backup;
- camera, microphone, location, sensors, other apps' data, files other than the app's own export;
- heavy algorithms: searching over many possibilities, optimisation, statistics beyond sum/avg/min/max/streak/gap, prediction.

Inside the app's domain, but not in v0:

- loops other than over rows, days, pick options, a literal list or a bounded range; recursion; functions that return values (a `def` draws UI);
- deleting data for good, bulk actions ("clear all", "reset the quiz"), moving data when a field is renamed;
- text building: no joining without spaces except around punctuation, no substrings, no number-to-text formatting choices;
- sorting by a formula (only by a field), joins other than `ref` and back links, more than one link between the same two tables via `it.T` (use `where`);
- prayer times or anything that needs outside data; reminders whose time is computed from a formula;
- raw colours, fonts, images bundled with the app, animation, drag and drop, gestures other than tap and swipe;
- timers keep running only while the app is open (a `remind ... in` covers the notification).

Weak spots I know about:

- The GBNF accepts a superset: it cannot tell keywords from names, so a constrained model can still write `text` as a component name or `table set ...`; the checker catches these and the repair step fixes them.
- Call-by-name arguments are powerful but subtle: an argument that says `it` means the component's loop item. A model must learn which std pieces bind `it` (SPEC section 11 says so per component).
- `each ... as NAME` keeps `it` for the outer item; this is useful but easy to get wrong.
- Some custom apps are long (tic-tac-toe's win check is two dense lines).
- Text parts are joined with spaces, so "3/5" needs the `/` as a text part.
- Three topics from the brief were swapped to cover Kamal's custom-UI list: mood (covered by the journal apps), gratitude (same shape as the journal) and kids' pocket money (same shape as khata and savings) were replaced by a cricket scoreboard, a quiz and tic-tac-toe.
