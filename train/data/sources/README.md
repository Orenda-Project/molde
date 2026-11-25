# Drop-in sources (schema)

One JSON object per line in `data/sources/<name>.jsonl`. `build_dataset.py` picks up every `*.jsonl` here.

```json
{"id": "g00001", "task": "create", "request": "track my daily water intake", "program": "app \"Water\" ...\n", "meta": {"style": "short", "lang": "en"}}
{"id": "g00002", "task": "edit", "request": "add a note field", "before": "<current program>", "program": "<updated program>", "meta": {}}
```

- `program` = the target MoldeScript (it is re-checked with `lang/mo.mjs check` and re-formatted; rows that fail are dropped and listed in `dataset_card.json`).
- ids must be unique across all sources and must NOT be `e001..e300` or `ed-*` / `x*` (those are the corpus, examples, edits).
- Held-out test ids: `/home/oye/Documents/free_work/molde-model/heldout_ids.txt` (40 corpus ids + 4 edit pairs). Rows whose request text equals a held-out request are dropped automatically; do not generate near-copies of those 40 requests.
- Language syntax change: `python3 train/data/build_dataset.py --lang lang --migrate` runs `mo.mjs migrate` over every target first.
- Build: `python3 train/data/build_dataset.py --lang lang [--out DIR]` (about 0.25 s per program; 5,000 programs take about 20 min because each is checked by a Node process; pass `--out` for a scratch dir).
