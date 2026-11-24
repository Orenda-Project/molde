# Molde data, reports and verdicts

Everything the model work depends on that does not live in code branches. Updated 2026-11-24.

| Path | What |
|---|---|
| `v1/v1.jsonl` | Dataset v1: 5,469 request/program pairs (63% templated wording). Built against language `6801a61`. `gen/` rebuilds it, `hand/` holds the hand-written sources. |
| `v2/v2.jsonl` | Dataset v2: 14,538 pairs, 68% real-user wording written by Haiku from programs, 10% templated. Language `96d8aa7`; edit `program_before` in stored form. |
| `v2/heldout2.jsonl` | Main test set: 149 requests (100 create, 29 edit, 10 ask, 10 out-of-scope), written independently; never used for training. |
| `v2/items/`, `v2/judge/` | Inputs and outputs of the Haiku writers and the judge sample (90.8% yes on 872 items). |
| `heldout_ids.txt` | The 40 corpus ids and 4 edit pairs held out from v1 and v2. |
| `reports/` | r1 and r2 training reports, the constrained-decoding report, the untrained baseline report. |
| `verdicts/` | Every gauntlet verdict JSON posted on issues #34 (language) and #37 (renderer). |

Record fields: `id, task, request, before, program_before, program, source, meta`.

Models trained on this data: huggingface.co/oyekamal/molde-tiny (public; Gemma terms of use for the Gemma-based files).
