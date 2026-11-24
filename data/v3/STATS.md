# Dataset v3.0 statistics

file: `v3.jsonl` pairs: **20827**  language commit `07f253b` (round 13: accent themes, dark word, topbar/statcard/section/goalbars/daygrid/weekdots)

Freeze: v3.0 was frozen at 02:2x on 2026-11-25 from what was verified; v3.1 continues toward the full spec.

## Counts per v3-SPEC row

| row | target | v3.0 delivered | note |
|---|---|---:|---|
| 1 relabel asks that name a thing as builds | all | 206 | v2 asks relabeled and given a build target (hand-written program, request kept); 220 v2 rows were relabeled, 206 survived the held-out similarity and judge filters; 194 unnamed asks remain |
| 1 multi-turn `Request/Question/Answer` -> build | 400 | 395 | request field = original + `\nQuestion: ..\nAnswer: ..` (the app format); `user_text` has the exact user message |
| 1 1-3 word named requests that build | at least 90% | 867 of 922 (94%) build | includes 769 new short-name pairs |
| 2 rich creates, demo style | 3,000 | 2045 | hand-written by Sonnet for their own request (no templates); look stats below |
| 3 requests list 3-6 needs, checked by a judge | all | 2045 with needs in `meta.needs` | judge: target meets checklist 244/281 (87%), request mentions the needs 242/281 (86%); 32 flagged programs dropped |
| 4 calculators / converters | 800 | 438 | hand-written (c1-c4) |
| 4 type-mistake apps | 300 | 220 | hand-written (t1-t2) |
| 5 developer / team tools | 600 | 312 | hand-written (d1-d3) |
| 6 long edits (25-90 lines) | 1,500 (at least 300 per kind) | 2093 | per kind: addchart 300, bigger 300, colour 293, remove 300, reorder 300, setting 300, title 300 |
| 6 small edits on short programs (colour word, title, setting with `set`) | (freeze priority 2) | 970 | colour 394, setting 176, title 400 |
| 7 new app typed in change mode -> `ask "New app or change X?"` | 300 | 264 | |

## What is incomplete (v3.0)

- Rich creates: 2045 of 3,000; calculators 438 of 800; developer tools 312 of 600; type-mistake apps 220 of 300.
- Small-edit and long-edit programs are mechanical edits of real programs (the same operation on many bases); only the request wording is written by Haiku. Setting edits (176 small, some long) are fewer than 300 on short programs.
- Long base programs: the L2 writer padded about 50 programs with generic appended blocks to reach the line target (affects edit bases only).
- The 140 eval references, the 60 ask-test requests, the 40 change-test cases, `heldout_ids.txt` and `v2/heldout2.jsonl` are excluded; see `heldout_similarity.json`.

## By source

| source | n | share |
|---|---:|---:|
| v2 | 14291 | 68.6% |
| v3:long-edit | 2093 | 10.0% |
| hand3 | 1839 | 8.8% |
| v3:small-edit | 970 | 4.7% |
| v3:short-named | 769 | 3.7% |
| v3:multi-turn | 395 | 1.9% |
| v3:change-mode-new-app | 264 | 1.3% |
| v3:named-ask-build | 206 | 1.0% |

## Rich creates: look (new hand-written programs)

- median lines 15 (v2 programs: median 11); topbar 74%; chart or state UI 66%; always-open top-level form 5%; accent colour word 69%; dark 10%
- long edits: mean share of unchanged lines kept 1.000, minimum 1.000 (target at least 0.95)

## Tokens (planned tokenizer, target program)

median 139, p90 357, p99 617, max 754. Limit 500 for creates and small edits; 900 for long programs (`meta.long`), both before and after.

## Held-out similarity check

Every request was compared with 433 held-out requests (heldout_ids, heldout2, 140 eval-novel, 60 ask-test, 40 change-test; token Jaccard, and an identical-content-key test) and dropped at similarity >= 0.8.

- histogram of max similarity: {'<0.3': 18662, '0.3-0.5': 1881, '0.5-0.8': 335, '>=0.8': 52}
- dropped by set: {'ask_test': 20, 'heldout2': 6, 'change_test': 25, 'heldout_ids': 1}

## Judge sample files

- out-J1.jsonl: 31 judged, program meets checklist 30, request matches checklist 31
- out-J2.jsonl: 31 judged, program meets checklist 25, request matches checklist 14
- out-J3.jsonl: 46 judged, program meets checklist 40, request matches checklist 42
- out-J4.jsonl: 110 judged, program meets checklist 93, request matches checklist 100
- out-J5.jsonl: 20 judged, program meets checklist 16, request matches checklist 19
- out-J6.jsonl: 20 judged, program meets checklist 18, request matches checklist 18
- out-J7.jsonl: 23 judged, program meets checklist 22, request matches checklist 18

## Build funnel

```json
{
 "candidates": 20930,
 "final": 20827,
 "drops": {
  "held_similar": 52,
  "change_test_pair": 0,
  "dup_request": 16,
  "too_long": 35,
  "verify_fail": 0,
  "diff_unsafe": 0,
  "bad_text": 0
 }
}
```

