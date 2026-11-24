# Judge instructions (features + looks)

You judge small phone apps written in MoldeScript (language: /tmp/molde-eval/lang/SPEC.md; skim sections 4 to 11 if a line is unclear). Each unit in your batch file is one app made for one user request. You do not know who wrote it; some are good, some are poor, some do not match the request at all. Judge each unit on its own.

Each unit has: `request` (what the user typed), `checklist` (numbered items; `must` true = a must-have, false = nice-to-have), `program` (the app), `describe` (a plain-English reading of the program), `screenshot` (a PNG of the first screen at 412x915, or null), and for change requests `program_before` (the app before the change: the request asks to change it, and the `program` is the app after the change).

About the screenshot: a test robot opened the app, filled every form twice with dummy values ("Sample ...", "Second ...", numbers like 25 or 250, dates 26 and 28 Nov 2026, the first option of each choice) and pressed save. That dummy data is not a bug. Form inputs keep the last values typed (that is the runtime's normal behaviour). Only the first tab is shown when the app has tabs; the program tells you what the other tabs hold.

## 1. Features (every checklist item, musts and nices)

For each item answer `yes`, `partly` or `no` with a one-line reason that points at the program line or the screen.
- `yes`: clearly there and it would work as the user expects (right data, right formula, reachable on screen).
- `partly`: there but incomplete or wrong in a way the user would notice (a field missing, a total that sums the wrong thing, a chart of the wrong value, a reminder at a fixed time instead of per item, a count that never resets when it should).
- `no`: absent, unreachable, or the code is about something else.
Be strict and literal. Passing the checker means nothing here. A tidy app that does a different job gets `no` on everything it does not do. Do not give `yes` for intent: the program must actually do it. For change requests: the change itself must be present in `program` compared to `program_before`, and "the rest still works" items need the old parts to still be there.

## 2. Looks (one score per unit)

Look at the screenshot (open it with the Read tool) and score 1 to 5 for "would I use this screen on my phone for this job":
5 clean, clear, well organised; I would use it daily. 4 good, small issues. 3 usable but plain, cluttered or awkward. 2 confusing or partly broken-looking (empty or meaningless chart, garbled or wrong labels, nonsense numbers, important things missing from view). 1 unusable or nonsense.
Name the single worst problem in a few words. If `screenshot` is null, give looks null.

## Output

Write a JSON array to the results path given in your task, one object per unit, in the batch's order:
`{"uid": "...", "checks": [{"n": 1, "v": "yes"|"partly"|"no", "why": "..."}, ...], "looks": 1-5 or null, "worst": "..."}`
Every checklist item of every unit must have a verdict. Validate with python3 -c "import json;print(len(json.load(open('RESULTS_PATH'))))". Reply with only the count.
