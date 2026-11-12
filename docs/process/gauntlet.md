# The gauntlet loop (how every Molde issue gets done)

A builder agent does the issue. A different critic agent judges the result against a real reference, blind. They loop until the critic picks our work in both orders. Nobody grades their own work. Source: `docs/plan/04-product-process.md` section 6.

## Roles
- **Builder**: works one issue on a branch, opens a draft PR (`Refs #N`, never `Closes #N`), runs the machine check, moves the issue to `state:critic` when the work is ready. Cannot post a verdict.
- **Critic**: a separate agent, fresh context. Sees the issue text, the acceptance lines and two artifacts, A and B. Never the builder's reasoning. Cheap model for mechanical checks, stronger one where taste decides.
- **Dispatcher** (a human or the planner): creates issues, adds `state:ready` once the bar exists, runs `make-blind.sh`, starts the critics, merges their replies into `verdict.json`, posts it.
- **Machine check**: the commands in the issue's Acceptance list. They must pass BEFORE the critic runs.

## Setup (once)
Needs `gh` (logged in, issue write), `jq`, `python3`, and the `jsonschema` package. Modern Linux blocks `pip install --user` (PEP 668) and `python3 -I` ignores user installs, so use a venv inside the repo (it is git-ignored):
```bash
python3 -m venv .venv && .venv/bin/pip install jsonschema
export PYTHON="$PWD/.venv/bin/python"      # optional: the tools also find ./.venv on their own
bash tools/sync-labels.sh --dry-run        # preview
bash tools/sync-labels.sh                  # labels + gate milestones; safe to re-run
```
`post-verdict.sh` uses `$PYTHON`, else `./.venv/bin/python`, else `python3`. With no jsonschema it prints `jsonschema not installed, see docs/process/gauntlet.md` and exits 3. Scripts default to repo `Orenda-Project/molde`; in a fork add `--repo OWNER/NAME` to `sync-labels.sh` and `post-verdict.sh`.
Labels: `type:*`, `state:ready|building|critic|won|needs-human|blocked`, `needs:*`, `ui`, `urdu-rtl`, `round:1`..`round:5`. Gates are milestones (`Gate 1: Prove it` to `Gate 4`), not labels.

## One round
1. **Issue** from `.github/ISSUE_TEMPLATE/task.md`. The Bar needs a name, a fetchable URL or repo path pinned to a commit or date, the aspect compared, and how the A/B artifacts are made. When it has all of that, the dispatcher adds `state:ready`.
2. **Build**: start work and open the draft PR early, then do the work, run every Acceptance command and paste the real output in the PR. Fix failures, then hand over.
```bash
gh issue edit 7 -R Orenda-Project/molde --add-label state:building --remove-label state:ready
git checkout -b task-07-short-name && git push -u origin HEAD
gh pr create -R Orenda-Project/molde --draft --base main --title "Task 07: short name" --body "Refs #7"
# ... build, run the Acceptance commands, commit, push ...
gh issue edit 7 -R Orenda-Project/molde --add-label state:critic --remove-label state:building
```
Use `Refs #7`, never `Closes #7`: the issue closes only after a WIN. The dispatcher marks the issue ready with `gh issue edit 7 --add-label state:ready` once the bar exists.
3. **Fetch the bar fresh** on the day of the round, never from memory. Git: `git -C <clone> show <sha>:<path> > bar.md`, or `gh api "repos/OWNER/REPO/contents/PATH?ref=SHA" --jq .content | base64 -d > bar.md`. Web page or file: `curl -L <url> -o bar.html`. Live site or app: screenshot it at the same viewport as ours. Put the date or commit in `bar.pin` of the verdict.
4. **Blind packs.** Each artifact must be ONE file (folders are refused). Save the issue text, then build the packs in a temp folder OUTSIDE the repo so no repo `CLAUDE.md` loads. `ISSUE.md` includes the Bar section, which names the reference; if you do not want the critic to be able to recognise the bar from it, delete that section from the copy first.
```bash
gh issue view 7 -R Orenda-Project/molde --json title,body -q '"# " + .title + "\n\n" + .body' > /tmp/issue7.md
OUT="$(mktemp -d)/pack"
bash tools/make-blind.sh --issue-file /tmp/issue7.md our-artifact.md bar.md "$OUT"
```
This makes `$OUT/critic1/{A,B,ISSUE.md}` and `$OUT/critic2/{A,B,ISSUE.md}` with swapped order, and the key at `$OUT.KEY.private.txt`, next to the packs, not in them. Same file type is kept; two different text types both become `.txt`; mixed types such as `.png` and `.jpg` are refused because the extension would give us away.
5. **Two critics, fresh sessions, swapped order**, started from inside their own pack (absolute paths, so the redirect works):
```bash
PROMPT='Read ISSUE.md for the goal and acceptance lines. A and B are two candidates for that goal. Reply in EXACTLY this format and nothing else:
PICK: A or B
BIGGEST_GAP: one sentence, concrete, fixable (about the one you did NOT pick)
LINE 1: PASS or FAIL | score 1-5 | one-sentence evidence
LINE 2: ... (one LINE per acceptance line, in the order of ISSUE.md)
MACHINE_CHECK: PASS or FAIL | link   (only if ISSUE.md gives you a run; else write: dispatcher fills in)
NOTES: up to 3 short notes, or none
Do not guess which one is ours. Praise is not useful.'
for c in critic1 critic2; do
  (cd "$OUT/$c" && claude -p --strict-mcp-config --model haiku "$PROMPT" > "$OUT/$c.reply.txt")
done
```
`claude -p` from a folder outside the repo loads no repo `CLAUDE.md`, and `--strict-mcp-config` stops your MCP servers dropping log files into the pack; add `--bare` too if your CLI has it and an API key is set. Any other agent works if it sees only one pack folder.
6. **Build `verdict.json`.** Read `$OUT.KEY.private.txt`: it says which critic had A=candidate. Turn that critic's pick into `order_ab` (A means `candidate`, B means `bar`) and the other critic's pick into `order_ba` (A means `bar`, B means `candidate`). Take `biggest_gap` from a critic that picked the bar, else either. For each acceptance line use FAIL if either critic said FAIL, the lower score, and one evidence sentence. The machine-check result comes from the PR run. Result: both orders candidate AND machine check PASS AND every line PASS = `WIN`; both orders bar = `LOSS`; orders differ = `SPLIT`; both candidate with any failure = `LOSS`.
```json
{"issue": 7, "round": 1,
 "bar": {"name": "<bar name>", "pin": "<commit or date>"},
 "order_ab": "candidate", "order_ba": "bar", "result": "SPLIT",
 "biggest_gap": "<one sentence>",
 "acceptance": [{"line": "<criterion text from the issue>", "status": "PASS", "score": 4, "evidence": "<one sentence>"}],
 "machine_check": {"status": "PASS", "link": "<run url>"},
 "other_notes": [], "artifacts": ["<link or path>"], "next": "builder fixes the biggest gap"}
```
7. **Check and post.** Plain schema check, then the full check that `post-verdict.sh` runs for you:
```bash
"${PYTHON:-python3}" -I -m jsonschema -i verdict.json tools/verdict.schema.json     # structure only
bash tools/post-verdict.sh --dry-run --issue 7 verdict.json             # + cross-field rules; prints the comment and label commands
bash tools/post-verdict.sh --issue 7 verdict.json                       # posts, creates missing labels, sets round:N, moves state labels
```
The cross-field rules (result matches the orders and checks, `next` matches the result, `needs-human` only at round 5, visible text of at least 8 characters for `biggest_gap`, whole-number `round` and `issue`) live in `tools/check-verdict.py`, which `post-verdict.sh` calls; the schema alone does not enforce them. WIN -> `state:won`. LOSS or SPLIT -> `state:building`. Round 5 without a win -> `state:needs-human`. The script refuses to post a second comment for the same round (exit 6) unless you pass `--force-repost`. Labels it has to remove that do not exist in the repo are skipped, and labels it has to add are created on demand. If the comment posts but the label edit fails, the script prints `COMMENT POSTED, LABELS NOT MOVED: run <command>` and exits 4.
8. **Fix only the named gap** (plus failed checks), set `state:critic`, repeat from step 3 with the next round (`state:critic` again with the `gh issue edit` above). Round 5 without a win: `state:needs-human`, post the best artifact and the remaining gap, stop. Merge only when the last verdict is WIN, the PR links its comment, and the machine check is green.

## Verdict fields (`tools/verdict.schema.json`)
Text fields need visible characters (max 300; `biggest_gap` at least 8). When posted, newlines are flattened, and `@`, `#123`, `GH-123`, markdown links and images, and bare `http://`, `https://`, `ftp://` and `www.` URLs are defused with an invisible character. Other forms (for example `mailto:` or bare domain names) are not.

| Field | Meaning |
|---|---|
| `issue` | whole number; optional if you pass `--issue N` (if both are given they must match) |
| `round` | whole number 1 to 5 |
| `bar.name`, `bar.pin` | the bar and its commit or date |
| `order_ab` / `order_ba` | `candidate` or `bar`: who won when A=candidate / when A=bar |
| `result` | `WIN`, `LOSS` or `SPLIT` as defined in step 6 |
| `biggest_gap` | the single gap: one sentence, concrete, fixable |
| `acceptance[]` | one per issue checklist line, in order: `line` (criterion text), `status` PASS/FAIL, optional `score` 1-5, `evidence` |
| `machine_check` | `status` PASS/FAIL, `link` to the run |
| `other_notes` | optional, max 3 |
| `artifacts` | links or paths |
| `next` | `ready to merge` (WIN only), `builder fixes the biggest gap`, or `needs-human` (only valid, and required, at round 5 without a win) |

Samples: `tools/samples/verdict.valid.json` (a SPLIT), `verdict.win.json` (a WIN), `verdict.invalid.json` (rejected: no `biggest_gap`, bad status).

## Worked example (issue #1)
Round 1: the builder finishes the kit, pastes the three Acceptance outputs, sets `state:critic`. The dispatcher runs `make-blind.sh` on `docs/process/gauntlet.md` and the bar text. The key shows critic 1 had A=candidate and critic 2 had A=bar. Critic 1 replies `PICK: B`, the bar, so `order_ab` is `bar`. Critic 2 replies `PICK: B`, the candidate, so `order_ba` is `candidate`. Orders differ: `SPLIT`. The dispatcher writes `tools/samples/verdict.valid.json`, dry-runs it, posts it. Issue now has `round:1`, `state:building`. The builder fixes only the biggest gap; round 2 returns candidate in both orders with all checks green: `verdict.win.json`, `state:won`, merge.

## UI issues
Issues labelled `ui` also follow `docs/process/ui-rules.md`.
