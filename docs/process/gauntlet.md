# The gauntlet loop (how every Molde issue gets done)

One builder agent does the work. A different critic agent judges it against a real reference, blind. They loop until the critic picks our work over the reference, in both orders. Nobody grades their own work. Source: `docs/plan/04-product-process.md` section 6.

## Roles
- **Builder**: works one issue on a branch, opens a draft PR (`Refs #N`, never `Closes #N`), runs the machine check, posts the artifact. Cannot post a verdict.
- **Critic**: a separate agent with fresh context. Gets the issue text, the acceptance lines, the bar (fetched fresh) and two artifacts, A and B. Never sees the builder's reasoning. Use a cheap model for mechanical checks and a stronger one where the bar is subjective.
- **Machine check**: the commands in the issue's Acceptance list. They must pass BEFORE the critic runs.

## One-time setup
```bash
gh auth login                                # needs repo + issues write
pip install --user jsonschema                # verdict check; jq and gh must be installed too
bash tools/sync-labels.sh --dry-run          # preview
bash tools/sync-labels.sh                    # create labels and gate milestones
```
Labels: `type:*`, `state:ready|building|critic|won|needs-human|blocked`, `needs:*`, `ui`, `urdu-rtl`, `round:1`..`round:5`. Gates are milestones (`Gate 1: Prove it` ... `Gate 4`), not `gate:` labels.

## The loop, per issue
1. **Create the issue** from `.github/ISSUE_TEMPLATE/task.md`. The Bar must be named, fetchable and pinned (URL or repo path at a commit, plus the aspect compared). No bar, no `state:ready`.
2. **Builder** claims it: `git checkout -b task-NN-name`, set `state:building`, build, then run every Acceptance command and paste the real output in the PR. Fix failures. Then set `state:critic`.
3. **Make the blind A/B pair.** Put the candidate and the bar's artifact (screenshots from the production build, output files, test logs) into two folders, `a/` and `b/`, named only `a` and `b`. Strip file names, titles, watermarks and commit hashes that reveal which is ours. Keep a private note of which letter is the candidate. Run it twice: first A=candidate, B=bar; then swap (A=bar, B=candidate) with fresh folders.
4. **Critic runs twice**, one agent session per order, each told: "Here is the goal and the acceptance lines. Which of A or B is better for that purpose, and why? Name the single biggest gap in the loser or in both (one sentence, concrete, fixable). Score each acceptance line 1-5. At most 3 other notes." Praise is not useful.
5. **Decide the result.** Candidate chosen in both orders = `WIN`. Bar chosen in both = `LOSS`. Different answers = `SPLIT` (order-sensitive, counts as a loss).
6. **Post the verdict.** The critic writes a JSON file matching `tools/verdict.schema.json` (see `tools/samples/verdict.valid.json`), then:
```bash
bash tools/post-verdict.sh --dry-run verdict.json     # prints the comment and the label commands
bash tools/post-verdict.sh --issue 7 verdict.json     # posts it and moves labels
```
The script rejects JSON without `biggest_gap`, a result that does not match the two orders, and round 5 without `needs-human`. State labels move on their own: WIN -> `state:won`; LOSS or SPLIT -> `state:building`; round 5 without a win -> `state:needs-human`. It also sets `round:N`.
7. **Builder fixes ONLY the named gap** (plus any failed machine check), sets `state:critic`, and the next round starts at step 3 with `round` + 1.
8. **Stop rules.** Round 5 without a win: `state:needs-human`, post the best artifact and the remaining gap, stop. Merge only when the last verdict is WIN, the machine check is green, the critic ticked the acceptance boxes, and the PR links the verdict comment.

## Worked example (round 1 of issue #1, this doc)
Builder finishes the kit, runs the three Acceptance commands, pastes outputs in the PR, sets `state:critic`. The candidate is `docs/process/gauntlet.md`; the bar is the gauntlet-loop skill text. Builder copies each to `a/doc.md` and `b/doc.md` (two orders), with titles removed. Critic session 1 (A=candidate) picks B, the bar. Critic session 2 (A=bar) picks the candidate. Orders differ, so `SPLIT`. The critic writes `verdict.json` (`tools/samples/verdict.valid.json` is exactly this verdict), runs `post-verdict.sh --dry-run`, reads the comment, then posts it. The issue now shows `round:1` and `state:building`. The builder reads only `biggest_gap` ("never says how to hand the critic two artifacts with the labels stripped"), adds step 3, sets `state:critic`. Round 2 returns WIN in both orders; the label becomes `state:won` and the PR can merge.

## UI issues
Issues labelled `ui` also follow `docs/process/ui-rules.md`: five-viewport screenshots from the production build, and an independent critic.
