# Critic brief: are the round 6 edit rows sensible request/answer pairs?

You are an independent reviewer. Do not read the builder code first; judge the rows as a user would.

## What you get
- `critic/sample60.md`: 60 random training rows (stratified over the edit kinds). Each shows the request a user typed, the lines of the app's program near the change (numbered), and the answer the model should write.
- `data/r6_train_rows.jsonl`: the same rows with the whole `before` program, the `after` program and the `spec`, if you need more context (`id` matches the heading).
- Run `node sample_for_critic.mjs 60 <seed>` for a fresh sample (use a seed the builder author did not see).

## The language in one minute
MoldeScript is a one-statement-per-line language for phone apps (`lang/SPEC.md`). Indented lines belong to the block above. The answer is a list of operations on the numbered lines: `insert after N`, `replace N` or `replace N-M`, `delete N` or `N-M`, `move N-M after K`; lines to write start with `+ `. To see the result, apply the ops by hand or run `node -e "import('./lib6.mjs').then(m=>console.log(m.applyOps(before, ops)))"`. A refusal row's answer is `none` (nothing to change) or an `ask "Molde apps cannot ..."` line (the app cannot do it; it offers a close alternative).

## For each of the 60 rows answer these, yes/no, then one line of reason if any is "no"
1. Request: is it natural English that a person could type for this app (not garbled, not a template with a hole, no stray words)?
2. Match: does the answer do exactly what the request asks (right thing, right place, right words/number)?
3. Minimal: does it change nothing else (no other lines touched, nothing lost)?
4. Valid and sensible result: would the app after the change look right (the chart uses real fields of the app, the moved block lands at a block boundary, a deleted block leaves nothing orphaned, a renamed label keeps the other option of the same line)?
5. For refusals: is `none` / `ask` the right response for the request?

## Report
- Table: row number, kind, 1-5 as y/n, reason.
- Totals per kind: rows judged sensible (all of 1-4 yes, 5 for refusals) out of rows in the kind.
- The 5 worst rows and what pattern they share (wording, wrong anchor, odd label, redundant chart, etc.).
- Anything systematically unnatural in the requests (repeated phrases, grammar glitches).
Pass bar for the data to be used as is: at least 54 of 60 sensible, and no kind below 80%. Otherwise list the exact fixes.
