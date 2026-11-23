# Token counts (MoldeScript v0, round 3)

Measured on 2026-11-23 with `python3 lang/tokens.py` (also `node lang/mo.mjs tokens`). Two counts per program:

- **stock**: the Qwen3.5-2B `tokenizer.json` from the local Hugging Face cache, unchanged (the same file the v1 kit tests use).
- **planned**: a copy of that tokenizer with the MoldeScript tokens added, then the real encoder run on the program. Added: every grammar literal or std component name that the stock tokenizer would split (with and without a leading space), and newline plus indentation per depth (99 tokens, printed by the script). Literals that are already one stock token are not added, because adding them only breaks merges such as `.ml`.

Qwen's BPE already spends one token on almost every English keyword, so "keywords as one token" saves only 3 to 6 percent; the saving comes from the language being short. Numbers are expensive (Qwen splits digits) and quoted labels are content the user asked for.

Round 3 cuts: `time - time` wraps past midnight (the 40-token sleep expression is now `it.woke - it.slept`), and a setting or field label that only repeats its name is dropped (the default label is the name). Round 2 cuts that did not hurt clarity: a line that starts with a quoted text, a number, a function, a bracket or a dotted name is a text line (no `text` keyword); option values are bare; std captions default to the value read out; `circle R` / `arc R, FROM, TO` sit at the centre; tic-tac-toe's win check is a `let` formula written once. Not done: putting short children on the parent's line (it would give the same thing a second spelling, against the one-spelling rule, for about one token per child).

## The 30 examples

| program | style | lines | stock Qwen3.5 | planned (keywords as 1 token) |
|---|---|---:|---:|---:|
| 01-water.mo | custom | 16 | 204 | 198 |
| 02-habits.mo | std | 19 | 221 | 212 |
| 03-exercise.mo | std | 11 | 150 | 141 |
| 04-budget.mo | std | 24 | 338 | 325 |
| 05-journal.mo | std | 15 | 193 | 192 |
| 06-habits-plus.mo | custom | 32 | 374 | 357 |
| 07-exercise-plus.mo | std | 21 | 330 | 311 |
| 08-budget-plus.mo | custom | 37 | 459 | 433 |
| 09-journal-plus.mo | std | 27 | 376 | 368 |
| 10-prayer-log.mo | std | 10 | 156 | 151 |
| 11-medicine.mo | std | 12 | 106 | 101 |
| 12-study-timetable.mo | custom | 17 | 192 | 182 |
| 13-reading-list.mo | std | 15 | 155 | 149 |
| 14-shop-stock.mo | std | 12 | 155 | 151 |
| 15-khata.mo | std | 14 | 172 | 165 |
| 16-expense-split.mo | std | 13 | 130 | 123 |
| 17-sleep-log.mo | std | 11 | 169 | 163 |
| 18-weight.mo | std | 9 | 107 | 104 |
| 19-cricket-score.mo | custom | 24 | 303 | 292 |
| 20-quiz.mo | custom | 17 | 200 | 191 |
| 21-grocery.mo | std | 13 | 97 | 95 |
| 22-todo.mo | std | 14 | 177 | 173 |
| 23-quran-progress.mo | std | 14 | 178 | 177 |
| 24-savings-thermometer.mo | custom | 17 | 217 | 208 |
| 25-period.mo | std | 8 | 83 | 84 |
| 26-tictactoe.mo | custom | 20 | 347 | 338 |
| 27-tasbeeh.mo | custom | 15 | 228 | 224 |
| 28-pomodoro.mo | std | 8 | 80 | 79 |
| 29-zakat-tip.mo | custom | 29 | 317 | 301 |
| 30-attendance.mo | custom | 20 | 229 | 219 |

| set | count | keyword median | p90 | max | stock median | p90 | max |
|---|---:|---:|---:|---:|---:|---:|---:|
| all | 30 | 186.5 | 339.9 | 433 | 192.5 | 349.7 | 459 |
| std | 19 | 151 | 313.8 | 368 | 156 | 331.6 | 376 |
| custom | 11 | 224 | 357 | 433 | 229 | 374 | 459 |

| v1 fixture | v1 app.html+app.json (stock) | MoldeScript stock | MoldeScript keyword | ratio stock | ratio keyword |
|---|---:|---:|---:|---:|---:|
| water | 559 | 204 | 198 | 2.74x | 2.82x |
| habits | 1231 | 221 | 212 | 5.57x | 5.81x |
| exercise | 1266 | 150 | 141 | 8.44x | 8.98x |
| budget | 1271 | 338 | 325 | 3.76x | 3.91x |
| journal | 1184 | 193 | 192 | 6.13x | 6.17x |
| **total** | 5511 | 1106 | 1068 | 4.98x | 5.16x |


`std` = the main visual comes from standard-library shorthands; `custom` = the main visual is built from level 1. See `examples/INDEX.json`.

## The 300-program corpus (the gate)

`lang/corpus/` holds the 300 programs that three other agents wrote from SPEC.md for the coverage test (requests in `corpus/requests.jsonl`, verdicts in `corpus/COVERAGE.md`), migrated to the current spelling with `node lang/mo.mjs migrate`. I did not write them, so this is the honest size measure.

| set | count | keyword median | p90 | max | stock median | p90 | max |
|---|---:|---:|---:|---:|---:|---:|---:|
| all | 300 | 132 | 240.2 | 821 | 136 | 248.6 | 847 |


## Gates

| Gate | Target | Measured | Result |
|---|---|---|---|
| median program, the 300-program corpus (planned tokenizer) | 150 or fewer | 132 (stock 136), p90 240, max 821 | **met** (this is the gate) |
| median program, std-style examples | 150 or fewer | 151 (stock 156) | missed by 1 (reported, not tuned) |
| median program, custom level-1 examples | report; target 350 or fewer | 224 (stock 229), max 433 | median met; budget-plus (433) and habits-plus (357) are over 350 |
| v1 HTML fixtures vs MoldeScript, the 5 shared apps | 5x fewer | 5.16x total planned (4.98x stock); per app 2.8x to 9.0x | met in total with the planned count; missed on stock and for water (2.8x) and budget (3.9x) |
