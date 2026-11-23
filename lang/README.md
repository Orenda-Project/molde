# MoldeScript v0 (Phase 0 of plan v2)

The language the tiny on-device model writes. The reference is [`SPEC.md`](SPEC.md); what each statement means when it runs is [`SEMANTICS.md`](SEMANTICS.md); what a renderer receives is [`UITREE.md`](UITREE.md). This page says how to run things and what the language cannot do.

## Files

| Path | What |
|---|---|
| `SPEC.md` | the language reference (level 1 core, level 2 std library, streaming rules, runtime defaults, data safety, errors, version) |
| `SEMANTICS.md` | the meaning of every statement (time, empty values, toggle, actions, events, drawing) |
| `UITREE.md` | the UI tree contract a renderer draws from |
| `grammar/moldescript.grammar` | **the one grammar source** (llama.cpp GBNF syntax, one statement per line) |
| `gen-gbnf.mjs` | writes `moldescript.gbnf`, `sources.gen.mjs` (grammar and std embedded for the browser) and `grammar/added-tokens.json` |
| `moldescript.gbnf` | generated; use it for grammar-constrained decoding |
| `engine.mjs`, `grammar.mjs`, `lex.mjs` | the parser runs the grammar file itself, so parser and GBNF cannot drift; keywords are contextual |
| `parse.mjs` | text to typed AST with line numbers |
| `expand.mjs` | component (`def`) and formula (`let f(x)`) expansion; loads the std library |
| `check.mjs` | type checker; errors as `line N: CODE: message. Fix: hint.`; never throws |
| `format.mjs` | canonical formatter (idempotent; writes the one spelling of each idea; its output is what the GBNF accepts) |
| `describe.mjs` | plain-English summary of a program for non-programmers (the plan shown to the user) |
| `diff.mjs` | edit verdict against the whole schema history: hide, never drop; renames only with `was`; type changes refused |
| `constrain.mjs` | the dynamic name constraint for decoding: which names may come next, given the text so far |
| `eval.mjs` | the reference evaluator: runs a program headless and builds the UI tree (plain ES modules, no Node APIs: runs in a browser) |
| `mo.mjs` | the CLI |
| `std/*.mo` | the standard library, written in MoldeScript |
| `tokens.py`, `TOKENS.md` | token counts (stock Qwen3.5 and planned tokenizer) and the gates |
| `examples/` | 30 programs (`INDEX.json`), `edits/`: 20 edits (`before.mo`, `request.txt`, `after.mo`) |
| `corpus/` | the 300 coverage programs other agents wrote from SPEC.md, migrated to the current spelling; `requests.jsonl` (the requests), `coverage-results.jsonl` and `COVERAGE.md` (the verdicts) |
| `tests/` | `node --test lang/tests/`; `fuzz-diff.mjs` and `fuzz-check.mjs` also run on their own |
| `tools/gbnf-check.cpp` | a small checker that runs llama.cpp's own grammar engine on files |

## Run

Node 20, no npm install needed. From the repo root:

```
node --test lang/tests/                          # all tests
node lang/gen-gbnf.mjs                           # after editing the grammar or std/*.mo
node lang/mo.mjs check lang/examples/*.mo        # OK, or errors with line, code and fix
node lang/mo.mjs format FILE [--write]
node lang/mo.mjs migrate FILE... --write         # rewrite older text into the current spelling
node lang/mo.mjs describe lang/examples/01-water.mo
node lang/mo.mjs diff V1 V2 ... NEW              # verdict against the whole history, oldest first (exit 1 if refused)
node lang/mo.mjs diff --history LIST NEW         # the same, the earlier files listed one per line in LIST
node lang/mo.mjs expand lang/examples/28-pomodoro.mo   # the level-1 program after expansion
node lang/mo.mjs tree lang/examples/01-water.mo [--now=2026-11-23T10:00:00Z]   # the UI tree
node lang/tests/fuzz-diff.mjs 5000               # data-safety fuzz over random edit chains (slots, reachability, restores)
node lang/tests/fuzz-eval.mjs 2000               # the same on real rows in the evaluator (applyEdit, revert)
node lang/tools/coverage.mjs                     # rebuild corpus/COVERAGE.md from the coverage results
node lang/tests/fuzz-check.mjs 20000             # checker crash fuzz (+ checker vs GBNF)
python3 lang/tokens.py [FILES]                   # token counts (needs the `tokenizers` package)
UPDATE_SNAPSHOTS=1 node --test lang/tests/describe.test.mjs   # after changing describe on purpose
```

In a browser: `import { load } from './lang/eval.mjs'` (see UITREE.md). The llama.cpp grammar test compiles `tools/gbnf-check.cpp` against `libllama.so` from `LLAMA_LIB_DIR` (default: Kamal's `~/llama.cpp-b12144/llama-b12144`) and is skipped when g++ or the library is missing; the GBNF is always also checked by our own engine.

## Constrained decoding

The GBNF fixes the syntax but cannot know which names exist, so a name that was never declared, or a field of the wrong table, passes the grammar and fails the checker. `constrain.mjs` closes that gap:

- `nameContext(textSoFar)` says whether the cursor is at a name position and, if so, which names may come: declared tables after `ref`, `add`, `options`; the fields of the row in scope after `it.` or `h.`; the queried table's fields first inside `where` and `sort`; your states and settings after `set`, `field`, `choice`, `slider`; components (or a dotted value) at the start of a line; the right kind for each component value (`form` takes a table, `quick`'s second value a field of its table). Declarations (`table NAME`, field names, `state NAME`, `as NAME` ...) are free.
- `allowedWords(textSoFar)` filters by what is already typed of the word; `tokenMask(textSoFar, vocab)` turns that into a `Mask` over the vocabulary (`mask.bits` is a `Uint8Array`, 1 = allowed; `mask.has(i)`; iterable as indices).
- Where only names can stand (after `ref`, `add`, `go`, `icon`, a dot, `set`, a component's table or name value) no keyword is allowed either; elsewhere keywords and numbers stay open and the GBNF decides.
- A token is read as `[boundary][word][rest]`. The boundary is a leading space, `Ġ` (GPT-2/Qwen byte BPE) or `▁` (SentencePiece): such a token starts a new word, so it is checked against the names allowed at the *next* position, and it is blocked right after a space. A dot after a name is blocked when nothing can follow it (a table with no links).

### How a phone runtime calls it

The decoding loop runs in a JS engine (Hermes or JSC on the phone, a WebView, or QuickJS next to llama.cpp):

```js
import { prepareVocab, tokenMask } from './lang/constrain.mjs';
const V = prepareVocab(vocab);           // once per model: vocab[i] = the token's text (Ġ/▁ markers allowed)
let text = '';
for (;;) {
  const mask = tokenMask(text, V);       // Mask: mask.bits[i] === 1 when token i may come next
  // native side: logits[i] = -Infinity where mask.bits[i] === 0, then the GBNF sampler, then sample
  const id = sampleNative(mask.bits);
  if (id === EOS) break;
  text += vocab[id];
}
```

`tokenMask` takes the full text so far; the runtime does not keep any other state. Inside it, the scope of the finished lines is computed once per new line (a checker pass over the lines above, kept in a small cache keyed by those lines), each line's parse is cached, the allowed names become a trie (cached by the name set), and the vocabulary is indexed by word, so a step costs the walk over the allowed names, not over the vocabulary. Measured on this laptop (Node 22, a 151,000-token vocabulary, decoding 11 corpus programs 3 characters at a time): **median 0.28 ms per step, p90 about 3 ms, p99 about 10 ms**; the slow steps are the first step of each new line (one checker pass over the program so far, about 20 lines). `prepareVocab` takes about 0.3 s once per vocabulary.

`tests/constrain.test.mjs` checks both directions on all 30 examples and all 300 corpus programs: the name each real program uses is always allowed (0 false refusals over about 6,700 name positions), and decoding left to right with a random allowed choice at every name position, the later text following the new choices (when a choice ends a dotted path, the rest of the path is dropped, as the mask forces), gives programs with no unknown-name or link errors (330 of 330).

## What the tests check

- all 30 examples, 40 edit programs and 300 corpus programs parse, type-check, are canonical and GBNF-valid; the formatter is idempotent;
- prefix-valid: every example and edit program cut after every line still parses and type-checks;
- behaviour: every example runs in the evaluator and is driven like a user (quick adds sum and fill the water glass, a habit tick moves the streak, 33 tasbeeh taps give round 2 and one notice, tic-tac-toe detects a win, timers count down and notify, undo, snapshot/restore); every corpus program runs with taps and a clock tick and no error nodes; each new feature (reminders before a date and monthly, sort by a formula, group through a link, time parts, random, sin/cos, colours, set all and remove all, pie wedges, formulas with values, default captions, empty `since`);
- data safety: every critic case (drop and re-add with another type, renames with and without `was`, swaps, option and setting renames, ref changes, narrowed ranges, slot reuse that would strand old values, restores) and a 200-chain fuzz (5,000 on its own); on real rows in the evaluator: renames keep totals, hide and re-add bring data back, chat Undo keeps data entered since, and a 150-chain fuzz (2,000 on its own);
- wrong-result fixes (day-level date comparisons, `time - time` past midnight, `due()`, rounding), model-facing error hints (one specific fix per slip), the dynamic name constraint, and the renderer's needs (plot, formatting, empty, layout, labels, editor API);
- learnability: everyday names are legal; at most 15 reserved words; self-compare is an error; a failed declaration is reported once; internal names never show; right hints for `it` and `each ... as`; clear errors for common slips; the checker never crashes (1,000 mutations in the suite, 20,000 on its own) and what it accepts the GBNF accepts once formatted;
- 52 invalid programs, each with the expected error code and line;
- every std component expands to level 1 only; describe snapshots read as plain English (no brackets or code words); SPEC programs check; the evaluator's import graph uses no Node-only API.

## Design decisions (short)

- **Two levels, one runtime.** The runtime implements level 1 only; charts, lists, forms, timers and calendars are MoldeScript components.
- **Lines and indentation**, declare before use: every prefix is a valid program, and SPEC 2.1 says how a half-written program or edit is handled.
- **One grammar file** drives the parser and the GBNF. **Keywords are contextual**: the parser prefers the keyword reading of a word and otherwise treats it as a name; only 12 words are reserved.
- **One spelling per idea**: the formatter rewrites the alternatives, so training data and model output stay uniform. Round 4 merged: bare-name text lines (no `text` unless the name is a component), bare sizes, `sum/count/min/max(source, formula)` instead of `sumof/countof/maxof/minof`, `goal` instead of `ring`, `list X by day` instead of `log X`, and dropped `compact/grouped/monthshort` (the phone formats numbers from typed text parts). `node lang/mo.mjs migrate` rewrites all of them. Size, before and after round 4: 170 to 169 keyword literals, 47 to 40 functions, 237 to 229 grammar literals, 37 statements (unchanged; `ytick` joined `tick`'s rule, `alt` and `bar` are line modifiers), 15 to 14 std defs, 13 of them documented components (`log` remains only as the body of `list X by day`).
- **Meaning is executable**: `eval.mjs` is the reference; the phone runtime must give the same UI tree.
- **Data is never at risk**: no statement deletes data; the diff uses the whole schema history; renames are explicit.

## Gates (details in TOKENS.md)

| Gate | Result |
|---|---|
| 30/30 examples valid | met |
| prefix-valid property | met |
| formatter idempotent | met |
| median 150 tokens or fewer, the 300 programs other agents wrote (the gate) | met: 132 planned (136 stock) |
| median 150 tokens or fewer, std-style examples | missed by 1: 151 planned (156 stock) |
| coverage of the 300 blind requests (round-1 language) | 237 full, 50 partial, 13 no; 92.6% of the 256 in-scope requests full (corpus/COVERAGE.md); most reported language gaps are now added |
| 5x fewer tokens than the v1 HTML fixtures | **met in total with the planned tokenizer** (5.16x; stock 4.98x); water 2.8x and budget 3.9x miss on their own |
| custom level-1 apps (target 350 or fewer) | median 224; budget-plus 433 and habits-plus 357 are over |
| checker crash fuzz, 20,000 mutations | 0 crashes, 0 accepted programs the GBNF rejects after formatting |
| diff fuzz, 5,000 edit chains (renames, swaps, drop and re-add, restores) | 0 lost, retyped or unreachable stored values |
| evaluator edit-chain fuzz, 2,000 chains over stored rows | 0 values lost or retyped; chat Undo never refused |

## What MoldeScript v0 cannot express (honest list)

Outside a 2D data-and-UI app, by design (out of scope for v0):

- network and internet, accounts, sync or sharing between phones, messaging (WhatsApp, SMS, email), maps and navigation, live outside data (prices, prayer times, scores);
- camera (including QR and barcode scanning), microphone, location, sensors, other apps' data;
- printing and PDF, QR codes, files other than the app's own export, bundled images;
- drag and drop; text splitting and parsing (no substring, split or pattern matching);
- heavy algorithms: searching over many possibilities, optimisation, prediction, AI.

Inside the app's domain, but still missing:

- loops other than over rows, days, pick options, a literal list or a bounded range; recursion;
- deleting data for good; moving data except by an explicit `was` rename;
- number-to-text formatting choices (decimals, padding), raw colour codes, fonts, animation;
- timers keep running only while the app is open (a `remind ... in` covers the notification);
- more than one link between the same two tables via `it.T` (use `where`).

Weak spots I know about:

- The GBNF accepts a superset (it cannot tell keywords from names); the checker catches the rest and the repair step fixes it.
- Call-by-name component values: a value that says `it` means the component's own item. The error message now says to use `each X as NAME`, but it is still a thing a model must learn.
- Contextual keywords make `text x bold` read `bold` as a style even if a state is called bold; write `(bold)` for the value. This is predictable but surprising.
- Dates in the evaluator are UTC unless `load(src, {tz: 'local'})`; the phone runtime uses local time.
- The evaluator is a reference, not the phone runtime; a renderer for the UI tree is being built separately.
