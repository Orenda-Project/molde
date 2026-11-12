# The gauntlet loop (how every Molde issue gets done)

A builder agent does the issue. A different critic agent judges the result against a real reference, blind. They loop until the critic picks our work in both orders. Nobody grades their own work. Source: `docs/plan/04-product-process.md` section 6.

## Roles
- **Builder**: works one issue on a branch, opens a draft PR (`Refs #N`, never `Closes #N`), runs the machine check, sets `state:critic`. Cannot post a verdict.
- **Critic**: a separate agent, fresh context. Sees the issue text, the acceptance lines, the bar and two artifacts, A and B. Never the builder's reasoning. Cheap model for mechanical checks, stronger one where taste decides.
- **Dispatcher** (a human or the planner): creates issues, adds `state:ready` once the bar exists, runs `make-blind.sh`, starts the critics, posts the verdict.
- **Machine check**: the commands in the issue's Acceptance list. They must pass BEFORE the critic runs.

## Setup (once)
Needs `gh` (logged in with issue write), `jq`, `python3` and `pip install --user jsonschema`. Scripts default to repo `Orenda-Project/molde`; in a fork add `--repo OWNER/NAME` to `sync-labels.sh` and `post-verdict.sh`.
```bash
bash tools/sync-labels.sh --dry-run        # preview
bash tools/sync-labels.sh                  # labels + gate milestones; safe to re-run
```
Labels: `type:*`, `state:ready|building|critic|won|needs-human|blocked`, `needs:*`, `ui`, `urdu-rtl`, `round:1`..`round:5`. Gates are milestones (`Gate 1: Prove it` to `Gate 4`), not labels.

## One round
1. **Issue** from `.github/ISSUE_TEMPLATE/task.md`. The Bar needs a name, a fetchable URL or repo path pinned to a commit or date, and the aspect compared. When it has one, the dispatcher adds `state:ready`.
2. **Build**: `git checkout -b task-NN-name`, set `state:building`, do the work, run every Acceptance command and paste the real output in the PR. Fix failures, then set `state:critic`.
3. **Fetch the bar fresh** on the day of the round, never from memory. Git: `git -C <clone> show <sha>:<path> > bar.md`, or `gh api "repos/OWNER/REPO/contents/PATH?ref=SHA" --jq .content | base64 -d`. Web page or file: `curl -L <url> -o bar.html`. Live site or app: screenshot it at the same viewport as ours. Write the date or commit into `bar.pin` of the verdict.
4. **Blind pack**: `bash tools/make-blind.sh <our-artifact> <bar-artifact> out/` makes `out/critic1/{A,B}` and `out/critic2/{A,B}` with swapped order and a private `out/KEY.private.txt`. File names carry no hint, but strip anything inside a folder that shows which side is ours.
5. **Two critics, fresh sessions, swapped order.** Each gets one pack, the issue text and nothing else. Example with Claude Code:
```bash
gh issue view 7 -R Orenda-Project/molde --json body -q .body > out/issue.md
for c in critic1 critic2; do
  (cd out/$c && claude -p 'Read ../issue.md for the goal and acceptance lines. A and B are two candidates. Which is better for that goal, A or B, and why? Name the single biggest gap in the loser (one sentence, concrete, fixable). Score each acceptance line 1-5. At most 3 other notes. Do not guess which is ours. Praise is not useful.') > out/$c.answer.txt
done
```
6. **Decide** with the key. Candidate in both orders with every check green = `WIN`. Bar in both = `LOSS`. Different answers = `SPLIT` (counts as a loss). Candidate in both orders but a machine check or acceptance line FAIL = `LOSS`, never `WIN`.
7. **Post**: write `verdict.json` (cheat sheet below), then
```bash
bash tools/post-verdict.sh --dry-run --issue 7 verdict.json   # prints the comment and label commands
bash tools/post-verdict.sh --issue 7 verdict.json             # posts, sets round:N, moves state labels
```
WIN -> `state:won`. LOSS or SPLIT -> `state:building`. Round 5 without a win -> `state:needs-human`. Invalid JSON, a blank field, a result that contradicts the orders or the checks, or a bad `--issue` stops the script before anything is posted.
8. **Fix only the named gap** (plus failed checks), set `state:critic`, repeat from step 3 with the next round. Round 5 without a win: `state:needs-human`, post the best artifact and the remaining gap, stop. Merge only when the last verdict is WIN, the PR links its comment, and the machine check is green.

## Verdict JSON cheat sheet (`tools/verdict.schema.json`)
Free-text fields must contain visible text, max 300 characters; newlines are flattened and `@` is defused when posted.

| Field | Meaning |
|---|---|
| `issue` | number; optional if you pass `--issue N` |
| `round` | 1 to 5 |
| `bar.name`, `bar.pin` | the bar and its commit or date |
| `order_ab` / `order_ba` | `candidate` or `bar`: who won when A=candidate / when A=bar |
| `result` | `WIN` = both orders candidate AND machine check PASS AND every acceptance PASS; `LOSS` = bar won both, or candidate won both but a check failed; `SPLIT` = orders differ |
| `biggest_gap` | the single gap: one sentence, concrete, fixable |
| `acceptance[]` | one per issue checklist line, in order: `line` (the criterion text), `status` PASS/FAIL, optional `score` 1-5, `evidence` |
| `machine_check` | `status` PASS/FAIL, `link` to the run |
| `other_notes` | optional, max 3 |
| `artifacts` | links or paths |
| `next` | `ready to merge` (WIN only), `builder fixes the biggest gap`, or `needs-human` (required at round 5 without a win) |

Samples: `tools/samples/verdict.valid.json` (a SPLIT), `verdict.win.json` (a WIN), `verdict.invalid.json` (rejected: no `biggest_gap`, bad status).

## Worked example (issue #1)
Round 1: the builder finishes the kit, pastes the three Acceptance outputs, sets `state:critic`. Dispatcher runs `make-blind.sh docs/process/gauntlet.md bar/skill.md out/`. Say the key shows critic 1 had A=candidate and critic 2 had A=bar. Critic 1 picks B, which is the bar, so `order_ab` is `bar`. Critic 2 picks B, which is the candidate, so `order_ba` is `candidate`. Orders differ: `SPLIT`. The dispatcher writes `tools/samples/verdict.valid.json`, dry-runs it, posts it. Issue now has `round:1`, `state:building`. The builder fixes only the biggest gap, then round 2 returns candidate in both orders with all checks green: `verdict.win.json`, `state:won`, merge.

## UI issues
Issues labelled `ui` also follow `docs/process/ui-rules.md`.
