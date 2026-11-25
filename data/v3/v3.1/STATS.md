# Dataset statistics (v3.1)

file: `v3.1.jsonl` pairs: **21668**  language commit `4698991` (round 14: accent themes, dark word, `topbar TABLE, "Button"`, statcard/section/goalbars/daygrid/weekdots, lesson std blocks)

v3.1 = v3.0 migrated to language round 14 (`topbar TABLE, "Button"`), re-checked with the current checker, plus more calculators, developer tools and rich creates, and a new edit set (add field, add option, rename button, reorder, remove, add chart on long programs). Colour, dark, title and size edits are not trained (the app does them itself).

## Counts per v3-SPEC row

| row | target | v3.1 delivered | note |
|---|---|---:|---|
| 1 relabel asks that name a thing as builds | all | 206 | v2 asks relabeled and given a build target (hand-written program, request kept); 220 v2 rows were relabeled, 206 survived the held-out similarity and judge filters; 194 unnamed asks remain |
| 1 multi-turn `Request/Question/Answer` -> build | 400 | 394 | request field = original + `\nQuestion: ..\nAnswer: ..` (the app format); `user_text` has the exact user message |
| 1 1-3 word named requests that build | at least 90% | 1123 of 1178 (95%) build | includes 757 new short-name pairs |
| 2 rich creates, demo style | 3,000 | 2804 | hand-written by Sonnet for their own request (no templates); look stats below |
| 3 requests list 3-6 needs, checked by a judge | all | 2804 with needs in `meta.needs` | judge: target meets checklist 293/335 (87%), request mentions the needs 291/335 (87%); 37 flagged programs dropped |
| 4 calculators / converters | 800 | 655 | hand-written (c1-c6) |
| 4 type-mistake apps | 300 | 220 | hand-written (t1-t2) |
| 5 developer / team tools | 600 | 532 | hand-written (d1-d5) |
| 6 long edits (25-90 lines) | 1,500 (at least 300 per kind) | 2983 | per kind: addchart 588, addfield 300, addoption 300, remove 595, renamebutton 300, reorder 600, setting 300 |
| 6 small edits on short programs (setting with `set`; colour/title dropped) | | 176 | setting 176 |
| 7 new app typed in change mode -> `ask "New app or change X?"` | 300 | 263 | |

## What is incomplete (v3.1)

- Rich creates: 2804 of 3,000; calculators 655 of 800; developer tools 532 of 600; type-mistake apps 220 of 300.
- Small-edit and long-edit programs are mechanical edits of real programs (the same operation on many bases); only the request wording is written by Haiku. Setting edits (176 small, some long) are fewer than 300 on short programs.
- Long base programs: the L2 writer padded about 50 programs with generic appended blocks to reach the line target (affects edit bases only).
- The 140 eval references, the 60 ask-test requests, the 40 change-test cases, `heldout_ids.txt` and `v2/heldout2.jsonl` are excluded; see `heldout_similarity.json`.

## By source

| source | n | share |
|---|---:|---:|
| v2 | 14291 | 66.0% |
| v3:long-edit | 2983 | 13.8% |
| hand3 | 2598 | 12.0% |
| v3:short-named | 757 | 3.5% |
| v3:multi-turn | 394 | 1.8% |
| v3:change-mode-new-app | 263 | 1.2% |
| v3:named-ask-build | 206 | 1.0% |
| v3:small-edit | 176 | 0.8% |

## Rich creates: look (new hand-written programs)

- median lines 15.0 (v2 programs: median 11); topbar 72%; chart or state UI 67%; always-open top-level form 5%; accent colour word 68%; dark 11%
- long edits: mean share of unchanged lines kept 1.000, minimum 1.000 (target at least 0.95)

## Tokens (planned tokenizer, target program)

median 147.0, p90 508, p99 620, max 749. Limit 500 for creates and small edits; 900 for long programs (`meta.long`), both before and after.

## Held-out similarity check

Every request was compared with 433 held-out requests (heldout_ids, heldout2, 140 eval-novel, 60 ask-test, 40 change-test; token Jaccard, and an identical-content-key test) and dropped at similarity >= 0.8.

- histogram of max similarity: {'<0.3': 19266, '0.3-0.5': 2148, '0.5-0.8': 292, '>=0.8': 38}
- dropped by set: {'ask_test': 20, 'heldout2': 5, 'heldout_ids': 1, 'change_test': 12}

## Judge sample files

- out-J1.jsonl: 31 judged, program meets checklist 30, request matches checklist 31
- out-J2.jsonl: 31 judged, program meets checklist 25, request matches checklist 14
- out-J3.jsonl: 46 judged, program meets checklist 40, request matches checklist 42
- out-J4.jsonl: 110 judged, program meets checklist 93, request matches checklist 100
- out-J5.jsonl: 20 judged, program meets checklist 16, request matches checklist 19
- out-J6.jsonl: 20 judged, program meets checklist 18, request matches checklist 18
- out-J7.jsonl: 23 judged, program meets checklist 22, request matches checklist 18
- out-J8.jsonl: 54 judged, program meets checklist 49, request matches checklist 49

## Build funnel

```json
{
 "candidates": 21744,
 "final": 21668,
 "drops": {
  "held_similar": 38,
  "change_test_pair": 0,
  "dup_request": 36,
  "too_long": 0,
  "verify_fail": 2,
  "diff_unsafe": 0,
  "bad_text": 0
 }
}
```

