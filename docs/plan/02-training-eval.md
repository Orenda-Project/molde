# 02 - Training and evaluation (planner 2 of 4, 2026-11-12)

Scope: data, verifier, training, eval, fallback for the one tiny model that does `plan`, `create`, `edit`, `repair`. The SDK and kit contract is written by another planner; everything below that touches it says "needs: SDK contract frozen".

Tags: [V] = read this session on the cited page. [E] = my estimate, unmeasured. [P] = from prior Orenda work (offline-teacher-coach).

## 0. What changed or was confirmed in the model landscape (Nov 2026)

| Candidate | State | Evidence |
|---|---|---|
| Qwen3.5-2B / 0.8B / 4B | Released (Feb-Mar 2026), Apache 2.0, Gated DeltaNet. Unsloth fine-tunes them: bf16 LoRA needs about 3 GB (0.8B) and 5 GB (2B) VRAM, free Colab notebooks exist. Unsloth says do NOT use QLoRA on Qwen3.5 (quantization gap), use bf16 LoRA. Custom Mamba/Triton kernels make the first compile slow on a T4. Thinking is off by default for 0.8B-9B. GGUF repos exist and run in llama.cpp; not in Ollama (mmproj split). Export caveat: bad results in another runtime are usually a wrong chat template or EOS. [V] | https://unsloth.ai/docs/models/qwen3.5/fine-tune , https://unsloth.ai/docs/models/qwen3.5.md , https://huggingface.co/unsloth/Qwen3.5-2B-GGUF |
| Gemma 4 E2B-it | Unsloth guide: trains in 8 GB VRAM, free Colab, GGUF export for llama.cpp supported. Apache 2.0, 2.3B effective [P]. Urdu not named in its language list [P]. [V] | https://unsloth.ai/docs/models/gemma-4/train |
| Qwen2.5-Coder-1.5B | Older (2024), Apache 2.0 at 1.5B, plain transformer, safest toolchain, code-native. Not re-verified this session [E]. Keep as the "boring control". |  |
| Newer small models | LFM2.5-2.6B (4 Aug 2026) and LFM2.5-8B-A1B (28 May 2026) exist; PrismML Bonsai 2 (2B/4B/9B, 15 Oct 2026) exists. Licences NOT confirmed; LFM uses a custom licence [P]. Not in the bake-off v1; revisit only if all three base models fail Gate 3. [V] for existence | https://liquid.ai/blog/lfm2-5-2-6b , https://digg.com/tech/z269245k |
| Execution-verified UI precedent | UICoder (SwiftUI, compile + vision-model feedback, ~1M programs over 5 rounds) and Thesys OUI-1 (rejection-sampled self-training with repair, 13.0% -> 71.7% on their benchmark). Same recipe as ours: generate, run, keep passes, train, repeat. [V] | https://arxiv.org/html/2406.07739v1 , https://webkul.com/blog/oui-1-the-generative-ui-model/ |

Decision: bake-off arms = **Qwen3.5-2B (primary), Gemma 4 E2B, Qwen2.5-Coder-1.5B**, plus **Qwen3.5-0.8B** trained on the same data as the lite-tier probe (not in the 3-way vote). Qwen3.5-2B's language list does not name Urdu either [P], so Urdu stays an eval question, not an assumption.

Hardware [P]: Colab free T4 (16 GB, no bf16 hardware: use fp16 compute or Colab Pro L4/A100 for bf16; the `colab-gpu` MCP exists, see memory `tool_colab_gpu_mcp`). GPU laptop `ssh gpu` = GTX 1070 8 GB, 7 GB RAM, Pascal (no bf16, torch cu126): fine for serving the GGUF and running the verifier, NOT for training Qwen3.5 (Triton kernels, no bf16). Round 2 of the coach found: the Q4_K_M GGUF scored clearly lower than the adapter (0/80 vs 2/80 wins), and imitation fixed format but not rules. Lessons carried here: **evaluate the GGUF itself, never the adapter; verifier-based rewards over imitation.**

## 1. Data generation

### 1.1 Seed requests
- Source: 60 hand-written themes x variants. Themes (from README): exercise, journal/thoughts, prayer, budget/expenses, study, medicine reminder, water, habits, plus shop stock, kids chores, Quran pages, fasting, savings goal, reading list, mood, sleep, steps, expense split, class attendance, small-shop udhaar ledger.
- Language mix of requests: 50% English, 25% Roman Urdu, 15% Urdu script, 10% mixed/typo-heavy/voice-style ("mujhe apni namaz track karni hai"). Mini-app UI strings follow the request language; code identifiers stay English.
- Expansion: the big model writes 10,000+ requests from a grid (theme x user type x vagueness x language x feature count 1-5), deduped by embedding cosine < 0.9. Hold out 300 requests (section 4) BEFORE expansion so they never leak (split by theme-variant family, not by row).
- Out-of-scope requests (needs internet, needs camera, harmful, nonsense): 5%, expected output = a short refusal/plan "cannot do offline, here is the nearest thing". Counted separately in eval.

### 1.2 Gold set (hand-checked, 150)
- 120 create (15 themes x 8 variants incl. 40 non-English), 30 multi-turn chains: create, then 2 edits, then 1 broken-code repair. Kamal reviews the 8 core themes by running them; the rest are verifier-passed plus a Claude critic read.
- Gold = style anchor: shown as few-shot in every generation prompt, and always included in training with weight 3x.
- needs: SDK contract frozen (gold is written against the frozen API and kit).

### 1.3 Volumes (target after verification)

| Task | Generated | Kept (~) | How examples are built |
|---|---|---|---|
| plan | 12,000 | 10,000 | request -> 3-8 line plan (screens, fields, charts). Verified by a schema check + the create step built from it passing; plan must name only SDK-supported pieces. |
| create | 16,000 | 8,000 (expect about half pass [README]) | plan -> full app. Kept only if verifier passes. Tiered by size: 60% under 400 tokens, 30% 400-600, 10% up to 900. |
| edit | 10,000 | 5,000 | take a PASSED create app, ask the big model for a realistic change request (language mix as above), it writes a unified-diff-style patch (see 1.5). Kept if patch applies, verifier passes, and the data-preservation check passes. |
| repair | 8,000 | 4,000 | Real errors, not invented: (a) harvest failures from the small model's and big model's own rejected create/edit outputs, (b) inject 12 mutation classes into passing apps (undefined var, bad SDK method name, wrong arg type, missing closing tag, store key typo, x-for without key, forbidden global, infinite loop, schema-destructive change, bad chart data shape, unclosed template string, stale reference after edit). Input = code + the verifier's error text exactly as the phone will produce it. Kept if the fix passes AND the diff is small. |
| Total | about 46,000 | about 27,000 | Train on ~15,000 after balancing (create 35%, plan 20%, edit 25%, repair 20%). Gate: at least 5,000 verified create+edit+repair [README gate 2]. |

15k rows of short code is about 12M tokens: 1 epoch of Qwen3.5-2B LoRA on a T4 is a few hours [E], on L4/A100 about 1 hour [E].

### 1.4 Which big model, rough cost [E, check live pricing before the run]
- Teacher for create/edit/repair: **Claude Sonnet-class** (strong code, cheap enough). Plan + request expansion + critic: **Claude Haiku-class** (Kamal rule: cheap models for mechanical work, memory `feedback_cheap_models_for_skill_work`). Gold references for the blind eval: **Opus-class**, only ~300 outputs.
- Budget guess: about 46k generations x (about 2.5k input incl. cached SDK docs + few-shots, about 700 output). With prompt caching on the SDK doc and batch API discount, roughly 120M input (mostly cached) + 32M output tokens: **about USD 250-600 total** [E]. Run a 500-row pilot first and extrapolate the real number. Do not fan out at Opus effort (memory `feedback_workflow_spend_and_caching`).
- Terms check: Anthropic terms on training a model on Claude outputs are an open question already noted in offline-teacher-coach [P]. Resolve before the public release; the cheapest fix is generating with an open-weight teacher for the shipped data if the terms forbid it.

### 1.5 Output formats (the model must emit these; needs: SDK contract frozen for exact tags)
- `plan`: plain short text, fixed headings (Screens / Data / Shows), max about 120 tokens.
- `create`: one `<app>` HTML with Alpine directives, kit classes, SDK calls. No comments, no CSS beyond kit classes unless a token budget remains.
- `edit` and `repair`: SEARCH/REPLACE blocks (`<<<<` old `====` new `>>>>`), applied by exact match. Fallback to whole file only if the app is under 250 tokens. Reason: patches cut output tokens 3-8x, the key speed lever [README]. Edit rows teach the model to quote the old lines exactly; the applier rejects non-matching blocks (counts as failure).
- Chat template fixed once, thinking off (Qwen3.5 2B loops in thinking [P]); same template in training, GGUF and phone runtime.

## 2. Verifier harness (the keystone; build before bulk data)

One Node script `verify/run.mjs` using **Playwright Chromium headless** (jsdom cannot run Alpine layouts, CSS, canvas charts or overflow checks reliably). Per sample about 1-2 s; 46k samples = about 20 CPU-hours across 8 workers, fine on the dev laptop.

Load: serve the candidate HTML in a page with the **real kit CSS + Alpine + a mock SDK** (`store` backed by in-memory SQLite-like map, `ui.chart`/`ui.timer` as recording stubs, `app.notify` recorder). Network blocked (Playwright `route.abort`), `page.on` listeners for pageerror, console.error, requestfailed.

Pass rules (all must hold), in order:
1. Static: size <= budget (tokens and bytes), parses as HTML, no forbidden globals (`fetch`, `XMLHttpRequest`, `eval`, `Function`, `localStorage`, `window.open`, `import`, external `src`/`href`), only allowed SDK members and kit classes (allow-list from the contract), no `<script src>`.
2. Load: no pageerror, no console.error, Alpine initialised (`window.Alpine` started, no "x-data" expression errors) within 2 s.
3. Render: visible text height > 0, at least one interactive element, nothing wider than 360 px viewport (no horizontal scroll), no element under 44 px tap target among buttons/inputs (warn at v1, fail later).
4. Behaviour smoke: an auto-driver fills each input with type-appropriate values (number 5, text "test"/Urdu string), clicks each button/submit, 2 s each. Pass if no error AND at least one of: `store` write recorded, DOM change, chart call. Then reload page with the same store: the written row must reappear (persistence round trip).
5. Intent check (cheap, keyword-free): plan lists N data fields; the app's `store` schema must contain all N (parsed from the SDK's schema declaration).
6. For `edit`: apply patch; run 1-5 on the result; **data-preservation check**: seed the store with 20 rows from the OLD app's schema, load the NEW app, assert all 20 rows still readable and schema migration additive only (SDK refuses destructive changes; a refusal = fail). For `repair`: the original errors must be gone and no new error class appears.
7. Flake guard: run twice, keep only if both pass. Record error text (first 300 chars) for the repair dataset.

Output per sample: `{pass, stage_failed, error_text, tokens, bytes, ms}` in a JSONL. Also a **mutation self-test**: 30 deliberately broken apps and 30 known-good must be classed 60/60 before any data is trusted (otherwise the harness is the bug).
Known limit: passes "runs without errors", not "is a good app". Quality comes from the teacher prompt, the gold style anchors, and the blind A/B (section 4). The same verifier runs on the phone side as the production validator and drives the repair loop (error text format identical to training).
needs: SDK contract frozen (allow-lists, schema declaration, mock SDK parity: the mock must be generated from the same contract file as the real SDK, with a conformance test).

## 3. Training recipe and bake-off

Same data, same split, same eval, same chat template for every arm.

- Recipe per arm: Unsloth LoRA r=32, alpha=32, all linear layers, lr 2e-4 cosine, 2 epochs, max seq 2048, loss on assistant tokens only, packing off for edit/repair rows. bf16 LoRA on Colab Pro L4/A100 for Qwen3.5 (Unsloth: no QLoRA for Qwen3.5 [V]); Gemma 4 E2B LoRA (Unsloth says 8 GB) and Coder-1.5B QLoRA are fine on free T4 [V/E]. Mix: 85% task rows, 10% general Urdu/Roman-Urdu/English instruct to avoid forgetting [P], 5% refusals.
- Stage 2 (only for the winner, the coach lesson: imitation alone left rule failures): **rejection-sampling round**: sample the SFT model k=4 on 5,000 fresh requests, run the verifier, add its passing outputs (self-distilled, style-matched) and for failures add the teacher's fix as repair rows ("on-policy repair"). Retrain. Optional round 3 = GRPO with reward = verifier pass (precedent: Thesys OUI-1; Unsloth Qwen3.5-4B GRPO notebook exists [V]) only if first-try is still under 80%.
- Export: merge LoRA to 16-bit, convert with llama.cpp, quantize **Q4_K_M** plus Q5_K_M and Q8_0 as references. **All eval numbers are measured on the GGUF through llama.cpp** with the exact phone sampling (temperature 0.2, top_p 0.9, repetition penalty 1.05, same max tokens) [P lesson].
- Bake-off protocol: (a) pilot on 2,000 rows, 1 epoch, all 4 arms, pick/kill at Gate A: kill any arm with first-try rate less than half of the best arm; (b) full run for survivors; (c) final table = eval metrics (section 4) on the GGUF + tok/s and RSS on a real mid-range phone (needs a phone; if not available, use `llama-bench` on the GTX 1070 laptop CPU-only as a proxy and mark it so) + file size. Winner rule: highest after-repair run rate subject to Q4_K_M size <= 1.6 GB and speed fit; ties broken by Urdu A/B and edit-keeps-data. Tokenizer note: Qwen3.5 and Gemma 4 handle Urdu script at different token costs; measure tokens per task, it feeds the speed budget.
- Runtime check for Gemma 4: only counts if its fine-tuned GGUF loads in llama.rn; the LiteRT path is out of v1 unless Gemma wins by more than 5 points.

## 4. Evaluation

### 4.1 Held-out set (fixed, never trained on, frozen before data generation)
- **300 requests**: 100 create/plan (40 EN, 25 Roman Urdu, 20 Urdu, 15 mixed/vague), 100 edit (from 100 gold apps, mixed edit sizes), 60 repair (from injected + real failures), 40 stress (out-of-scope 10, very long request 10, add a field to an app with 500 existing rows 10, two simultaneous changes 10).
- Reference for every create/edit: written by the best Claude (Opus-class) against the same SDK, verified by the same harness (references that fail are rewritten). Kept in `eval/reference/`.
- Sealed: SHA-256 of the files committed on day 1; a second, smaller "canary" set of 40 is kept private and run only at the end.

### 4.2 Metrics (machine, per task, with 95% bootstrap CI; n=300 gives about +-5 points)
| Metric | Definition | v1 threshold (README) |
|---|---|---|
| First-try run rate | verifier pass on first output, create | >= 85% |
| After-repair rate | pass after at most 2 repair rounds using verifier error text | >= 95% |
| Edit-keeps-data | edit passes AND 20 seeded rows survive | 100% (hard; any miss blocks release) |
| Edit applies | patch blocks match exactly and apply | >= 95% [E] |
| Plan valid | plan names only supported pieces, matches create | >= 95% [E] |
| Median tokens | create output tokens (model tokenizer) | <= 600 |
| p90 tokens, edit | edit output tokens | <= 250 [E] |
| Language fidelity | UI strings in the request's language and script | >= 95% [P: wrong script was a real failure before] |
| Speed | first visible UI (starter template shows at 0 s; first generated tokens) and full-app time | <= 5 s first UI on mid-range [README] |
| Refusal accuracy | the 10 out-of-scope get a clean refusal, no broken app | >= 9/10 |

### 4.3 Blind A/B quality vs Claude reference
- For the 100 create requests (and 40 edits): the candidate app and the Claude reference are rendered (same kit, same seeded data, 360x640 screenshot after the auto-driver runs) and the critic sees code + screenshot of A and B, labels stripped.
- Critic = separate model from the generator and from the teacher (Haiku-class, harsh persona, as in `offline-teacher-coach/eval/judge.py`: no hooks/tools, neutral cwd, JSON output). Run **both orders**; a win counts only if the candidate wins both orders ("order-robust win"); report order-robust wins, ties, losses.
- Criteria in the critic prompt, in order: runs and keeps data; does what the request asked (fields, charts, reminders); correct language and script; usable on a phone (tap size, readability, no clutter); simpler is better; code length does not count.
- Calibration before use: 40 human-labelled pairs by Kamal (10 min), critic must agree >= 80% and must not prefer the longer side more than 55% of the time. Else fix the critic prompt first.
- Threshold: **candidate not worse than the reference (win+tie both orders) in >= 50% of create pairs** and **order-robust loss <= 25%**; reference is a much bigger model so a 2B winning is not expected [P: Qwen3.5-2B won only 2-4% vs Claude in the coach]. The bar is "good enough that testers keep the tracker", plus Gate 1 of the README (10 testers keep using it). If this misses but machine metrics pass: ship with the hybrid (section 5).
- Absolute gates apply regardless of A/B (the coach lesson: add per-answer gates): data-loss = 0, forbidden API = 0, wrong script <= 5%.

### 4.4 Eval hygiene
Report the adapter vs GGUF Q4_K_M gap every run; never compare numbers produced with different sampling; log every failure to `eval/failures.jsonl` with its stage_failed (this is the training signal for stage 2). Regression run on every new checkpoint takes about 40 minutes, costs critic tokens only.

## 5. Fallback if the model misses

Decision table (measured on the Q4_K_M GGUF):
| Result | Action |
|---|---|
| First-try 70-85%, after-repair >= 95% | Ship. Loop A hides it; the user sees 1 extra spin. Keep improving with stage-2 data. |
| First-try < 70% OR after-repair < 95% | **Hybrid**: template-first. Plan on device picks the nearest of about 15 hand-built templates (the 8 gold themes + more) and the model only fills a spec/fields (JSON config) rather than writing HTML; creation of brand-new structure via optional cloud call when the user is online and consents; edits stay on device but restricted to patch types that passed in eval. |
| Edit-keeps-data < 100% | Block the model from editing schema: edits limited to UI code; schema changes go through an SDK migration API with explicit add-field calls (so the model emits an `addField` call, not new tables). Needs: SDK contract frozen. |
| 2B too slow | Lite tier (0.8B) writes plan+template-fill only; 2B only on >= 6 GB phones. |
| All 3 bases miss | Move to the next base only after: bigger data (x2), stage-2 rejection rounds, GRPO on verifier reward; then try LFM2.5-2.6B / Bonsai 2 if licences are OK. Fallback of last resort: 4B model on 8 GB flagship phones only. |
Rule: do not start the on-device engine work (README phase 4) until Gate 3 numbers exist on the GGUF.

## 6. TASK LIST (each one session; dependency order)

T1 - Seed requests + held-out split
- Goal: the request grid, 10k+ requests, 300 sealed held-out, language mix as in 1.1.
- Deliverable: `data/seeds/requests.jsonl`, `eval/heldout/requests.jsonl`, `eval/heldout/SHA256SUMS`, `data/seeds/build_seeds.py`.
- Accept: `jq` counts: >= 10,000 train requests; language shares within +-3 points of 50/25/15/10; 0 exact or cosine>0.9 duplicates across train and held-out (script prints 0); held-out has 100/100/60/40 split; checksum file verifies.
- Critic bar: a blind critic given 30 requests (15 ours, 15 real phrasing written by Claude Opus cold) must not tell Roman-Urdu/Urdu ones apart better than 60% (natural phrasing) and must find at least 80% are buildable as an offline mini-app.
- needs: nothing (but read the SDK scope doc for what "buildable" means; weak dependency).

T2 - Verifier harness
- Goal: `run.mjs` per section 2, with mutation self-test.
- Deliverable: `verify/run.mjs`, `verify/rules.json` (generated from contract), `verify/mock-sdk.js`, `verify/selftest/{good,bad}/` (30+30), `verify/README.md`.
- Accept: selftest classifies 60/60 correctly; 100 samples verify in under 4 minutes on 8 workers; flake rate (two runs disagree) < 1%; mock-vs-real SDK conformance test green; prints JSONL with stage_failed.
- Critic bar: a harsh reviewer given 20 apps that "pass" must not find more than 1 that visibly breaks on a real phone-sized Chromium screenshot.
- needs: SDK contract frozen.

T3 - Gold set (150) and teacher prompts
- Goal: hand-checked gold + cached system prompt (SDK docs + 8 gold few-shots) for plan/create/edit/repair.
- Deliverable: `data/gold/*.jsonl` (120 create, 30 chains), `data/prompts/{plan,create,edit,repair}.md`, `data/gold/REVIEW.md` (Kamal sign-offs on the 8 core).
- Accept: 150/150 pass the verifier; 40+ non-English; every gold app <= 600 tokens (count printed); 8 core themes each run by a human and signed.
- Critic bar: gold create outputs compared blind against fresh Opus-written apps for the same requests: gold must tie or win >= 60% in both orders.
- needs: SDK contract frozen, T2.

T4 - Pilot generation + cost measurement (500 rows per task)
- Goal: run the whole generate-verify-keep pipe on a small scale, measure pass rate and real USD per kept row.
- Deliverable: `data/gen/generate.py`, `data/gen/pilot_report.md`, `data/pilot/*.jsonl`.
- Accept: report lists pass rate per task and per language, USD per kept row, token stats; create pass rate >= 40%; repair rows have real verifier error text; Urdu-script pass rate within 15 points of English (else fix prompt before scaling); extrapolated full cost within the budget Kamal approves.
- Critic bar: 30 random kept create rows judged blind vs fresh Opus references: >= 40% win/tie in both orders.
- needs: T1, T2, T3.

T5 - Bulk data build (>= 5,000 verified, aim 15,000 balanced)
- Goal: run section 1.3 volumes, balance, dedup, build chat-template train/val files.
- Deliverable: `data/train/{plan,create,edit,repair}.jsonl`, `data/train/stats.md`, `data/train/dataset_card.md` (sources, teacher model, prompts, terms note).
- Accept: >= 5,000 verified rows of create+edit+repair (README gate 2); 100% re-verify on a second pass; task mix 35/20/25/20 +-3; no held-out request or its near-duplicate (script check); edit rows 100% pass data-preservation; median create tokens <= 600.
- Critic bar: same blind check as T4 on 100 rows; also 20 edit rows: the patch must be smaller than the file and do exactly the asked change.
- needs: T4 (and SDK contract frozen via T2/T3).

T6 - Eval harness + reference set + critic calibration
- Goal: everything in section 4 runnable with one command against any GGUF.
- Deliverable: `eval/run_model.py` (llama.cpp server driver with phone sampling), `eval/metrics.py`, `eval/reference/*.jsonl` (Opus refs, verified), `eval/judge_ab.py` (both orders, screenshots), `eval/calibration/` (40 human-labelled pairs), `eval/README.md`.
- Accept: running it on the Claude Sonnet reference outputs themselves scores first-try >= 95% and A/B about 50% (sanity); critic agreement with Kamal's 40 labels >= 80%, length bias <= 55%; full run <= 60 min and prints every metric in 4.2 with CI.
- Critic bar: n/a (this is the judge); check that a deliberately broken-but-long app loses to a short working one in both orders.
- needs: SDK contract frozen, T1, T2. Can run in parallel with T3-T5.

T7 - Pilot bake-off (2,000 rows x 4 arms)
- Goal: find which bases are alive: Qwen3.5-2B, Gemma 4 E2B, Qwen2.5-Coder-1.5B, Qwen3.5-0.8B.
- Deliverable: `train/notebooks/*.ipynb` (Unsloth, one per arm), `train/export_gguf.sh`, `train/results/pilot.md` with GGUF metrics table.
- Accept: each arm's Q4_K_M GGUF loads in llama.cpp with the training chat template; adapter-vs-GGUF gap reported; table shows first-try, after-repair, tokens, tok/s (laptop CPU proxy or phone); at least 2 arms alive (first-try >= half of best).
- Critic bar: 40 create outputs of the best arm vs Opus references, blind both orders; report only (no threshold at pilot), plus the 10 worst outputs read by a human.
- needs: T5 (at least the first 2,000 rows from T4/T5), T6.

T8 - Full training, stage-2 rejection round, winner pick
- Goal: full SFT of survivors, then verifier-based rejection round on the leader, final GGUF.
- Deliverable: `train/results/bakeoff.md`, `models/molde-v1-q4_k_m.gguf` (+ sha256, not committed), `data/stage2/*.jsonl`, `train/DECISION.md` (winner and why).
- Accept (README gates 3): on the GGUF Q4_K_M, held-out first-try >= 85%, after-repair >= 95%, edit-keeps-data = 100%, median tokens <= 600; Urdu/Roman-Urdu first-try within 10 points of English; Q4_K_M size <= 1.6 GB; also a 0.8B lite-tier GGUF report. If a threshold misses, the DECISION file applies the section 5 table and names the fallback.
- Critic bar: blind A/B per 4.3 on 100 create + 40 edit; not-worse >= 50%, order-robust loss <= 25%; and Kamal runs 10 of his own requests on the winner (the 8 core themes plus 2 free picks) and signs.
- needs: T7, T6; SDK contract frozen unchanged since T2 (a contract change means regenerating, record the contract version in every file).

T9 - Fallback hybrid spec and phone-side validator contract (only if T8 misses, else a short check)
- Goal: template-first path and the repair-loop contract that the on-device engine (another planner's area) calls.
- Deliverable: `docs/plan/02b-hybrid-fallback.md`, `templates/*.html` (>= 15, all pass the verifier), `verify/validator-phone.js` (the same rules in a phone-safe form), `eval/hybrid_results.md`.
- Accept: 15/15 templates pass the verifier and the data-preservation test; hybrid path on the held-out 100 create requests reaches first-try >= 95% with template-fill JSON; on-device validator and the Node verifier agree on 200 samples (>= 99% same verdict).
- Critic bar: blind A/B hybrid output vs Claude reference: not-worse >= 40% (templates trade variety for reliability); testers' "keeps using it" check is Gate 1 of the README.
- needs: SDK contract frozen, T8 results.

## Open items for Kamal
1. Approve the data budget after T4's real USD per row (my guess USD 250-600).
2. Colab Pro (about USD 10/month) for bf16 on L4/A100, or accept fp16 on free T4 (slower, Qwen3.5 kernel compile is slow on T4 [V]).
3. A real mid-range phone for the tok/s numbers; if absent, report CPU proxy and say so.
4. Anthropic terms on training with Claude output [P open question]: decide before the model is shipped publicly.
