results/ : raw outputs of the failure hunt (one JSON object per line). Nothing here is hand edited.
gemma-r3.jsonl, gemma-r4ep2.jsonl     407 creates + 148 chains each (the main run); *.hangs.jsonl the native hangs (90 s); gemma-r3.log run log
ctrl-en-r3.jsonl                      control: Roman Urdu requests translated to English, typos corrected (REPORT section 7)
ctrl-k12-r3.jsonl, ctrl-ask-r3.jsonl  controls stopped early: 12 tries per line on 26 failed creates; raw asks on 87 creates
proof-fresh.jsonl                     identical-output proof: 39 steps replayed with the model restarted before every case
forced-v1-*.jsonl                     forced edit suite, first version (352 steps, options not matched to the app); kept for history
forced2-*.jsonl                       forced suite v2, the 131 steps of the kinds that were rebuilt (add option 46, rename button 40, remove totals/goal 45); these rows are copied into forced-*.jsonl
forced-r3.jsonl, forced-r4ep2.jsonl   forced suite v2, all 296 steps = 165 unchanged v1 steps (reorder 85, remove chart/list 80) + the 131 rebuilt ones. Cases: controls/forced_cases.jsonl. Table: controls/forced_v2_summary.txt
                                      22 of the 131 ("take away the total", no total in the program) were reworded ("remove the number at the top / that is shown") and rerun; tools/check_forced.mjs now verifies every step's target.
