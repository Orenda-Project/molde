# Dataset v3 spec (2026-11-24)

Every problem found so far, and the training data that answers it. Sources: `reports/diag-2026-11-24.md` (Kamal's phone test), `reports/eval-novel-summary.json` (140 unseen ideas), r2 report.

| # | Problem (evidence) | What v3 adds or changes |
|---|---|---|
| 1 | Keeps asking. v2 labels 95% of one-word and 73% of two-word requests as ask; 143 asks name a thing; no ask -> answer -> build example. 80% of short requests asked first; 27 of 32 asked again after an answer. | Relabel every ask that names a thing as a build. Ask only when nothing to track or do is named. 400 multi-turn pairs in the app's exact format `Request: ...\nQuestion: ...\nAnswer: ...` -> build. 1 to 3 word named requests build in at least 90% of pairs. |
| 2 | Generic look. v2 targets: median 11 lines, 2.8% with 2+ custom pieces, 0% app bar, 77% always-open form. Demo apps: 42 lines, 93% custom, 53% app bar. Blind pairs vs hand-written: lost 30 of 30. | 3,000 rich create targets in the demo style using the round 13 std pieces (chart with goal line, app bar with add button and sheet form, stat card, habit grid, empty-state text). At least 30% with a chart, app bar or state UI; always-open form at most 30%. |
| 3 | Half apps. Unseen ideas: 42% of must-haves met, 7% complete; "half-app" is the top failure (48 of 140 for r1). | Every create request lists 3 to 6 concrete needs and the target covers all of them; the request writer writes the checklist first, then the program is verified against it by a judge. |
| 4 | Calculators and formulas weak (21% must-haves; E_TYPE operator mistakes). | 800 calculator/converter/bill-split/tax/zakat/tiles/EMI pairs with formulas, percent, rounding, money. 300 pairs aimed at type mistakes (date vs number, text vs number). |
| 5 | Developer and team tools weak (58% valid, 21% must-haves). | 600 pairs: bug lists with severity, standups, deploy checklists, on-call logs, API key expiry, sprint points, PR queues, uptime notes. |
| 6 | Small changes fail: 11 of 40; long programs lose sections; reorder never taught; colour words map to nothing. | 1,500 edits on 25 to 90 line programs that keep every other line; at least 300 each of colour (red/green/purple/dark...), title rename, reorder, bigger, remove section, add chart, setting change with `set`. Edit targets checked for keep-rate >= 95% of unchanged lines. |
| 7 | New-app request sent as a change came back unchanged. | 300 pairs where a change-mode request is really a new app: the target is an ask `New app or change X?` (the app also handles this). |

Held out, never trained on: `heldout_ids.txt`, `v2/heldout2.jsonl`, the 140 eval-novel items, the 60 ask-test requests and the 40 change-test cases from the diagnosis.

Bars for the model trained on v3 (checked by an independent critic): ask first on at most 10% of 30 named short requests; at least 28 of 30 answered asks build; at least 36 of 40 small changes correct with 95% of other lines kept; unseen ideas: must-haves met at least 65% and complete apps at least 25%; blind judge prefers or ties the model app vs the hand-written one on at least 10 of 15 demo requests.
