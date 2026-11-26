# Failure hunt progress

Status 2026-11-26 (first deliverable for the critic): DONE = harness, test set, r3 and r4 ep2 runs, hand labels, blind A/B, judge, spec examples, APP_BUGS, DATA_SPEC_r5. REPORT text delivered in the hand-off message (the Write tool refused to create a file named REPORT.md in this run; save the message text as REPORT.md). RUNNING on Spark (tmux failctrl, failctrl2, failctrl3, results in ~/kamal/molde/failhunt/out): raw-ask control, 3 sampled creates per request, replay of 126 unchanged edit steps with samples. Collect: `scp spark:kamal/molde/failhunt/out/ctrl-*.jsonl results/ && python3 tools/controls_summary.py > controls/summary.txt`.

Counts so far
- cases.jsonl: 407 creates (18 candidates dropped as duplicates of v3.1), 148 chains, 686 steps. sha256 c0a9816c...854c82d.
- r3 Gemma creates: 357/407 pass the checker (87.7%); hand labels on all 407: strict 150 (36.9%), partial 138, wrong 119.
- r4 Gemma ep2 creates: 367/407 (90.2%); 147 hand-labelled paired: strict 28% vs r3 36%; blind A/B 30 English pairs: r3 19, r4 9, tie 2.
- Edits (model path, definite kinds): r3 82/321 right (25.5%), unchanged 126 (39%), long programs 1/70; r4 ep2 88/358 (24.6%), unchanged 160 (45%), long 1/70. Direct app edits 74/74 and 81/81.
- Native core hangs: 3 (r3 one, r4 ep2 two), 90 s, no output.
- Controls done: English translation of 81 Roman Urdu/mixed requests -> topic right 79/81, checker 79/81 (originals: 47% topic right, 65/81 checker); 23 typo requests corrected -> topic right 23/23; 12 tries per line on failed creates -> 9 of the first 24 (38%) now pass.

Current biggest failure classes (r3 Gemma): (1) edit returns the program unchanged (39%), (2) checker failure on creates (12%), (3) meaningless formulas (15% of creates), (4) misses an explicit specific (13.5%), (5) Roman Urdu drift (53% wrong on 81 requests).

Second pass (after the critic): identical edit outputs proven to be model behaviour (fresh-core replay, 39/39 prompts carry the request, 37/39 outputs byte-identical); the 120 n/a chain steps explained and replaced by a forced suite of 352 applicable steps (r3 23 right = 7%, r4 ep2 83 = 24%); spec rewritten (71 examples, 0 test-request leaks, 56 shapes, cap 2, honest ask refusals, plain-English); estimates withdrawn (about 45% create strict from data alone, the rest hypotheses); taxonomy gained silent-rewrite and skeleton-collapse classes; APP_BUGS gained #11 (DSL text shown to the user), #12 (guards blind to meaning), #13 (silent no-op). The raw-ask, three-sample and unchanged-replay controls were stopped to free the threads; `controls/summary.txt` holds what finished.

Third pass (critic round 2): ask edits redesigned (the answer is one ask line, the app keeps the program; `kind: edit_ask` + `app_effect`; `tools/validate_asks.mjs`; 4 ask pairs, 7 follow-up pairs); all spec edit rows now carry patch-op answers (`tools/patch_ops_ref.mjs`, round trip asserted); "measured ceiling" reworded to baseline/hypothesis H9; forced suite v2 (context-fit options, unique button labels, single-referent removals; add option, button, removal kinds rerun): r3 26/296 (9%), r4 ep2 78/296 (26%). Trainer's E1 (patch ops) result folded into DATA_SPEC L1.
