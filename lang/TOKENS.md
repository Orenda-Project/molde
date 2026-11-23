# Token counts (MoldeScript v0)

Measured on 2026-11-23 with `python3 lang/tokens.py` (also `node lang/mo.mjs tokens`). Two counts per program:

- **stock**: the Qwen3.5-2B `tokenizer.json` from the local Hugging Face cache, unchanged (the same file the v1 kit tests use).
- **planned**: a copy of that tokenizer with the MoldeScript tokens added, then the real encoder run on the program. Added: every grammar literal or std component name that the stock tokenizer would split (with and without a leading space), and newline plus indentation per depth. Literals that are already one stock token (`table`, ` each`, `=`, `.`) are not added, because adding them only breaks merges such as `.ml`. The list is printed by the script (80 tokens).

Finding: Qwen's BPE already spends one token on almost every English keyword, so "keywords as one token" saves only 3 to 6 percent. The real saving comes from the language being short, not from the tokenizer. Numbers are expensive (Qwen splits digits), and labels in quotes are content the user asked for.

| program | style | lines | stock Qwen3.5 | planned (keywords as 1 token) |
|---|---|---:|---:|---:|
| 01-water.mo | custom | 16 | 205 | 199 |
| 02-habits.mo | std | 19 | 225 | 216 |
| 03-exercise.mo | std | 11 | 151 | 142 |
| 04-budget.mo | std | 24 | 342 | 329 |
| 05-journal.mo | std | 15 | 195 | 195 |
| 06-habits-plus.mo | custom | 32 | 382 | 365 |
| 07-exercise-plus.mo | std | 21 | 334 | 315 |
| 08-budget-plus.mo | custom | 37 | 468 | 442 |
| 09-journal-plus.mo | std | 27 | 382 | 374 |
| 10-prayer-log.mo | std | 10 | 159 | 154 |
| 11-medicine.mo | std | 12 | 109 | 104 |
| 12-study-timetable.mo | custom | 17 | 200 | 190 |
| 13-reading-list.mo | std | 15 | 165 | 159 |
| 14-shop-stock.mo | std | 12 | 158 | 154 |
| 15-khata.mo | std | 14 | 181 | 174 |
| 16-expense-split.mo | std | 13 | 133 | 126 |
| 17-sleep-log.mo | std | 11 | 218 | 212 |
| 18-weight.mo | std | 9 | 108 | 105 |
| 19-cricket-score.mo | custom | 24 | 309 | 298 |
| 20-quiz.mo | custom | 17 | 209 | 200 |
| 21-grocery.mo | std | 13 | 102 | 100 |
| 22-todo.mo | std | 14 | 181 | 177 |
| 23-quran-progress.mo | std | 14 | 181 | 180 |
| 24-savings-thermometer.mo | custom | 17 | 219 | 211 |
| 25-period.mo | std | 8 | 85 | 86 |
| 26-tictactoe.mo | custom | 19 | 433 | 423 |
| 27-tasbeeh.mo | custom | 15 | 247 | 243 |
| 28-pomodoro.mo | std | 8 | 81 | 80 |
| 29-zakat-tip.mo | custom | 29 | 323 | 308 |
| 30-attendance.mo | custom | 20 | 236 | 226 |

| set | count | keyword median | p90 | max | stock median | p90 | max |
|---|---:|---:|---:|---:|---:|---:|---:|
| all | 30 | 197 | 365.9 | 442 | 202.5 | 382 | 468 |
| std | 19 | 159 | 317.8 | 374 | 165 | 335.6 | 382 |
| custom | 11 | 243 | 423 | 442 | 247 | 433 | 468 |

| v1 fixture | v1 app.html+app.json (stock) | MoldeScript stock | MoldeScript keyword | ratio stock | ratio keyword |
|---|---:|---:|---:|---:|---:|
| water | 559 | 205 | 199 | 2.73x | 2.81x |
| habits | 1231 | 225 | 216 | 5.47x | 5.70x |
| exercise | 1266 | 151 | 142 | 8.38x | 8.92x |
| budget | 1271 | 342 | 329 | 3.72x | 3.86x |
| journal | 1184 | 195 | 195 | 6.07x | 6.07x |
| **total** | 5511 | 1118 | 1081 | 4.93x | 5.10x |

`std` = the main visual comes from standard-library shorthands; `custom` = the main visual is built from level 1 (drawing, grids, boxes). See `examples/INDEX.json`.

## Gates

| Gate | Target | Measured | Result |
|---|---|---|---|
| median program, std-style apps (planned tokenizer) | 150 or fewer | 159 (stock 165) | **missed by 9** |
| same, without the 5 fixtures and 4 baseline apps (13 apps) | 150 or fewer | 154 (stock 158) | **missed by 4** |
| median program, custom level-1 apps | report; target 350 or fewer | 243 (stock 247), max 442 | met |
| v1 HTML fixtures vs MoldeScript, the 5 shared apps | 5x fewer | 5.10x total (stock 4.93x); per app 2.8x to 8.9x | **met in total (planned count), missed on stock and for water (2.8x) and budget (3.9x)** |

Why the misses (not tuned away): the 30 examples carry the full feature set of the v1 fixtures and the richer baseline apps (summaries, streaks, heat maps, filters, empty states). Water's v1 fixture is already small (559 tokens) and its MoldeScript version draws the glass in level 1 (about 40 tokens for the shapes). Budget keeps the pace line, the month navigator and the category filter, all written in level 1. The simplest std apps are 80 to 110 tokens.
