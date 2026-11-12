# 03 - Phone app shell and on-device runtime

Date: 2026-11-12. Scope: app shell, runtime, sandbox, storage, download, essentials. Not in scope: SDK/kit design, training data, model choice.
Legend: **[V]** verified on the web (URL given). **[E]** estimate or anecdote, not a lab number. **[PHONE]** must be tested on a real phone before we trust it.

## 1. Decisions (short)

| # | Decision | Why |
|---|---|---|
| D1 | **React Native (Expo dev build, New Architecture) + llama.rn** for v1. | llama.rn gives streaming token callback, GBNF + JSON-schema to GBNF, OpenCL (Adreno 700+) and experimental Hexagon NPU, session save/load, and an Expo config plugin **[V]** https://github.com/mybigday/llama.rn . The SDK, kit, validator and bridge are all TypeScript/JS; one language across app, headless validator and generated code. |
| D2 | Put the runtime behind a small TS interface `Engine { load, generate(stream, abort, grammar), saveSession, unload }`. | Lets us swap in a LiteRT-LM native module if Gemma 4 wins the bake-off, without touching the pipeline. |
| D3 | Generated mini-apps run in **one sandboxed WebView, no network, bridge only**. | The shell UI toolkit is irrelevant to the generated UI, which is HTML anyway. That is why Flutter vs RN is a low-stakes choice. |
| D4 | User data = SQLite, **JSON-document collections**, not typed tables. Code versions = files on disk + metadata rows. | No schema migrations to break; repair/edit can never drop columns. |
| D5 | Model is downloaded on first launch over Wi-Fi, resumable, sha256-checked, stored outside backup. | See section 6. |
| D6 | Constrain output with grammar only where it is cheap: **plan (JSON schema)** and **edit/repair (patch ops JSON)**. Do not grammar-constrain whole HTML. | Grammar sampling costs speed **[PHONE]**; HTML validity is better enforced by the validator + repair loop. |

### Flutter vs RN (open question, decided)
Evidence for parity: Flutter has `flutter_litert_lm` 0.3.0 (CPU/GPU OpenCL/NPU, Apr 2026), `llamadart` 0.15.0 (GGUF via llama.cpp and .litertlm), `flutter_gemma` 1.6.0 (Gemma 4, Qwen, Phi) **[V]** https://pub.dev/packages/flutter_litert_lm/changelog , https://pub.dev/documentation/llamadart/0.15.0/ , https://pub.dev/documentation/flutter_gemma/1.6.0/ . So Flutter is viable, and it is the better path if LiteRT-LM wins.
Tie-breakers for RN: (a) llama.rn is the most featureful llama.cpp binding I found (grammar, schema, HTP, session cache); the Flutter llama.cpp wrappers are smaller projects; (b) shared TS code for SDK + validator + bridge; (c) `react-native-webview` is mature, though see risk R3.
**Reversal trigger:** if the bake-off winner only converts to `.litertlm` (fine-tuned Gemma 4) and constrained decoding is not needed, add a thin Kotlin native module to the RN app first (D2); only move to Flutter if that module costs more than ~3 days.

### Runtimes compared (Nov 2026)
| Runtime | Verdict | Notes |
|---|---|---|
| **llama.rn** (llama.cpp, GGUF) | **Primary** | RN New Architecture required since v0.10; Android arm64-v8a and x86_64 only; OpenCL needs Adreno 700+ and only Q4_0/Q6_K types; Hexagon needs SM8450+ and is experimental **[V]** repo above. Latest npm I saw: 0.12.9 stable with 0.13.0 rc, via a mirror **[E]** https://www.pkgstats.com/pkg:@pocketpalai/llama.rn - check npm before pinning. Qwen3.5 0.8B/2B GGUFs exist and work with llama.cpp-compatible backends **[V]** https://unsloth.ai/docs/models/qwen3.5.md |
| LiteRT-LM | Only if Gemma 4 wins | Google's numbers for Gemma 4 E2B on S26 Ultra: CPU 557 prefill / 47 decode tok/s, GPU 3,808 / 52 tok/s **[V]** https://developers.google.com/edge/litert-lm/models/gemma-4 . Flagship only. No RN binding found; constrained decoding support unknown; fine-tune to `.litertlm` is an unproven conversion step (our offline-coach notes flagged export as a known risk). |
| react-native-executorch | Rejected for v1 | Supports Qwen 2.5/3 (v0.4.0), claims for Qwen3.5/Gemma 4 only from a secondary source; needs Expo 54+, Android API 33+ **[V]** https://swmansion.com/blog/react-native-executorch-release-v0-4-0-262d4013ac10 . Needs `.pte` export of our fine-tune and has no GBNF path I could confirm. |
| MLC-LLM | Not evaluated | Needs per-model compiled libs; heavy for a fine-tune-and-iterate loop. I did not research it in depth, so treat as unknown, not rejected on evidence. |

## 2. Speed: what is measured and what is not
| Data point | Value | Status |
|---|---|---|
| Gemma 4 E2B, S26 Ultra (flagship) | CPU 47 decode / 557 prefill tok/s; GPU 52 / 3,808; TTFT 0.3-1.8 s (1,024 prefill, 256 decode, 2,048 ctx) | **[V]** Google, link above |
| Gemma 4 E2B, Galaxy A35 (mid-range) CPU | 5-7 tok/s | **[E]** single dev post https://dev.to/baiju_rajyaguru_a70384dfd/i-ran-gemma-4-on-a-mid-range-android-phone-heres-what-actually-happened-40ge |
| Qwen3.5 0.8B, 2019 Galaxy S10e, llama.cpp in Termux | ~12 tok/s | **[E]** anecdote https://localguy-theta.vercel.app/posts/qwen-3-5-legacy-hardware-deployment-s10e/ |
| 3B Q4 on Snapdragon 7 Gen 3 / 6 Gen 3 | 7-11 / 4-7 tok/s | **[E]** table, not measured https://www.ertas.ai/blog/llm-android-benchmarks-snapdragon-tensor |
| Qwen3.5-2B on any phone | none reliable found | **[PHONE]** |

Conclusion: nobody has published a trustworthy number for our exact model on mid-range phones. **Plan on 5-10 tok/s for 2B Q4 on 6 GB mid-range, 10-20 for 0.8B, and measure.**

Latency budget (600-token app): 5 tok/s = 120 s, 10 = 60 s, 20 = 30 s, 50 = 12 s.
**Prefill is the hidden cost.** A 1.5k-token system prompt (SDK docs) at mid-range prefill (unknown, likely under 100 tok/s) is 15+ s before the first token, and edit/repair prompts carry the whole current app. Mitigations, in order: (1) fine-tune so the SDK is in the weights and the system prompt is under 150 tokens (cross-team ask to the training planner); (2) `saveSession`/`loadSession` to cache the fixed prefix on disk **[V]** repo above (not fully supported on Android OpenCL unless `kv_unified: true`, `flash_attn_type: 'off'`); (3) edit prompt sends only the changed region plus a symbol index, not the whole file.

## 3. Runtime behaviour on the phone
- **Device tiers** (use `expo-device` total RAM, then confirm by a one-time 20-token benchmark at first launch and store tok/s):
  - T1, 4 GB: Qwen3.5-0.8B Q4_K_M, `n_ctx` 2048, 4 threads, no GPU. Show "slow phone" copy + templates first.
  - T2, 6 GB: 2B Q4_K_M, `n_ctx` 3072.
  - T3, 8 GB+: 2B Q4_K_M (Q5/Q6 if the bake-off shows quantisation damage), `n_ctx` 4096, try OpenCL/HTP if Adreno 700+/SM8450+, fall back silently on failure; check `reasonNoGPU`.
  - **Quantisation warning:** our own offline-coach run scored the Q4_K_M GGUF lower than the bf16 LoRA (0/80 vs 2-4%). Treat Q4 as a risk; evaluate Q5_K_M and Q6_K on the phone eval, not just on the PC.
- **Memory:** mmap the GGUF, `use_mlock` off, one context only. Unload on `AppState` background after 60 s idle and on `onTrimMemory`. Android's low-memory killer sends SIGKILL, which gives **no crash report**: on next launch read `ApplicationExitInfo` (API 30+, reason LOW_MEMORY) and a "generation in progress" flag, then log it as a non-fatal and drop one tier.
- **Thermal/battery:** generate only on user request; keep screen awake during a build (`expo-keep-awake`); a build is under 2 min so no foreground service is needed. Read `PowerManager.getCurrentThermalStatus()` (API 29) through a ~30-line native module; at SEVERE, lower threads and warn. Fallback signal: tok/s dropping more than 40% from the first 50 tokens. **[PHONE]** 10 builds back-to-back, record tok/s curve and battery %.
- **Streaming the UI:** the model emits `<plan>` JSON first, then HTML. Show the plan as soon as it closes (2-5 s). For HTML, flush to the WebView at **balanced top-level element boundaries** (a small tag-balance scanner on the token stream) and patch the DOM with morphdom, instead of re-writing the document per token. Alpine inits on each flushed chunk, so directive state must not depend on later chunks: the kit rule is "data model first, then markup". Fallback if progressive paint flickers: show a skeleton + token counter and paint once at the end (acceptable for apps under 600 tokens at 10+ tok/s). The spike measures both.
- **Starter template** paints immediately from the nearest of the 8 gold templates while the model runs.
- **Build off the UI thread:** llama.rn runs inference natively; the JS callback fires per token, so batch UI updates to 10 per second to avoid bridge jank.
- **Android 16 KB page size:** Play requires 16 KB-compatible native libs for apps targeting Android 15+; **[PHONE/CI]** verify llama.rn's prebuilt `.so` files (`zipalign -c -P 16`) or use `rnllamaBuildFromSource`.

## 4. Sandbox and SDK bridge
Goal: generated code can do nothing except call the SDK.

**Isolation layers (all must hold; test each):**
1. WebView loads host-built HTML via `loadDataWithBaseURL` with an opaque/dummy origin; `originWhitelist=['about:blank']`; `onShouldStartLoadWithRequest` returns false for everything else; `setSupportMultipleWindows` false; file/content access off; no `addJavascriptInterface` except react-native-webview's own channel.
2. Host injects a CSP meta before generated code: `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'`. Alpine, kit CSS and SDK are inlined by the host from local assets, never by URL. **Alpine needs `unsafe-eval` unless we use `@alpinejs/csp`**; decide with the SDK planner. With no network and a bridge-only exit, `unsafe-eval` is tolerable, `@alpinejs/csp` is better.
3. If react-native-webview cannot block sub-resource loads natively (it does not expose `shouldInterceptRequest`), add a small Expo config-plugin patch or own native view that returns an empty response for every request. **[PHONE]** with a test page that tries `fetch`, `img.src`, `WebSocket`, `navigator.sendBeacon`, `<form>` submit, `window.open`, `location=`, `intent://`, `tel:`, `mailto:`, CSS `url()`, and service workers. Every one must fail.
4. One WebView instance per open mini-app; the **native side** binds `appId` to that instance. The page never supplies its own appId.

**Bridge protocol** (JSON over `ReactNativeWebView.postMessage` / `injectJavaScript`):
```
page -> native: {v:1, id:"n", m:"store.insert", a:{collection:"workouts", doc:{...}}}
native -> page: {v:1, id:"n", ok:true, r:{...}} | {id:"n", ok:false, e:{code:"E_QUOTA", msg:"..."}}
```
- Whitelisted methods only (store.insert/get/query/update/remove/count, notify.schedule/cancel, haptic, clock.now, app.exportJson). Pure-UI helpers (`ui.chart`, `ui.timer`) live inside the WebView and never cross the bridge.
- Native validates: message size under 64 KB, collection name `^[a-z][a-z0-9_]{0,31}$`, doc size under 16 KB, rate limit 50 msg/s, per-app row quota (50k rows / 20 MB), unknown fields rejected. Reads are always scoped to the bound appId.
- Errors from the page (`window.onerror`, unhandled rejections, failed bridge calls) come back as `{type:"error", ...}` and feed the repair loop. A watchdog also reports blank render (empty `body` after 3 s) and long tasks.
- `needs: SDK contract frozen` for the exact method list and error codes; the transport and validator can be built first against a stub list.

## 5. Storage layout
```
filesDir/
  models/<name>@<sha8>.gguf          (excluded from backup, large)
  apps/<appId>/
    spec.json                        plan + schema declarations (what to track)
    versions/v0001.html ... vNNNN.html
    versions/vNNNN.meta.json         {parent, kind: create|edit|repair, prompt, patch, errors, model, sdk_version, ts}
    data.db                          SQLite, one per mini-app
    snapshots/pre-vNNNN.db           last 3 copies taken before an applied edit/repair
  molde.db                           app index, current_version pointers, settings, telemetry opt-in
```
- `data.db` table `docs(collection TEXT, id TEXT, json TEXT, ts INTEGER, PRIMARY KEY(collection,id))` + index on (collection, ts). `spec.json` declares fields (for charts/validation) but the store is schema-less, so no rewrite can lose a log. Deleting a mini-app = deleting its folder.
- **Undo = move the `current_version` pointer** (atomic update in `molde.db`); the old file is never edited. Data is not rolled back by code undo. A separate "restore data" screen can use the last 3 snapshots.
- Write order for a new version: write file, fsync, insert meta, then flip pointer in one SQLite transaction. A kill mid-way leaves the old version live.
- Every version stores `sdk_version`; the shell keeps shims for old SDK versions so an app update never breaks saved mini-apps. Run `data.db` migrations (if the `docs` table ever changes) with `PRAGMA user_version`.
- Library: `expo-sqlite` or `op-sqlite`; pick whichever supports WAL and a backup API on the pinned Expo SDK **[PHONE]**.
- Backup: `dataExtractionRules`/`fullBackupContent` include `apps/` and `molde.db`, exclude `models/`. Decide `allowBackup` on purpose (user data yes, because lost phone = lost logs).

## 6. Model download on first launch
- Host: HTTP range-capable origin (Hugging Face resolve URL or R2/GitHub release). Optional later: Play Asset Delivery pack so Play handles resume **[verify]** pack size limits and how an on-demand pack exposes a file path to llama.rn before building a native module for it.
- Flow: first-run screen shows size, tier and "Wi-Fi only" toggle (default on); `expo-network` check; free-space check (file x 1.2); download to `models/<name>.part` with `Range` resume (`expo-file-system` resumable download in foreground; `@kesha-antonov/react-native-background-downloader` if we want it to survive backgrounding **[PHONE]**); verify size + sha256 from a signed manifest JSON; atomic rename; keep the old model until the new one verifies.
- While waiting, the app is usable: browse the 8 templates (run with the SDK, no model). That also makes review in Play possible without waiting for 1 GB.
- Manifest is versioned (`min_app_version`, tier map, model sha, grammar/prompt version) so we can ship a better GGUF without an app release.
- Failure states with copy: no space, no network, hash mismatch, 403/404, killed mid-way, mobile data warning.

## 7. App-essentials (P0 first; checklist from `.claude/skills/app-essentials/SKILL.md`)
| P0 item | Plan for Molde |
|---|---|
| Crash reporting | Sentry RN, **opt-in at first run** (app promises "offline and private"); scrub: never send prompts, generated code or data rows. Local crash log + "Share report" as the no-consent path. Native llama.cpp crashes need the NDK symbol upload. |
| Force/soft update | Play in-app updates (flexible + immediate) plus a static `min-version.json` checked when online (GitHub Pages). Offline users cannot be forced; model manifest has `min_app_version` too. |
| Privacy policy | Public URL, in-app Settings and Play listing. Says: no account, data stays on device, optional crash reports. |
| Data-safety form | "No data collected" only if Sentry is off by default and consent-gated; re-check if analytics is added. |
| Target SDK | API 36 for new apps/updates (rule date to re-verify at developer.android.com/google/play/requirements/target-sdk). |
| Signing key | Upload keystore in `~/.kamil-harness/keys`, backed up; use Play App Signing. |
| Offline/error/empty/loading states | Every screen, incl. "model not downloaded", "generation failed, using template", "mini-app crashed, tap to repair or undo". |
| Data survives restart and update | Section 5 write order + `user_version`; test with an update-over-install. |
P1 to build in v1: settings (theme, language, about/version, privacy link, delete all data), onboarding of 3 screens, accessibility (44-48 dp targets, font scaling), Urdu/RTL strings, dev/staging/prod flavours, R8/AAB, CI. No accounts, so account-deletion does not apply (the in-app "delete all my data" covers the spirit).

## 8. Prototype spike (smallest thing that proves the stack)
Goal in 1 session: Expo dev build + llama.rn loads a Qwen3.5-0.8B and 2B Q4_K_M GGUF from `adb push`, streams tokens into a WebView, and logs numbers.
1. `npx create-expo-app`, dev build via EAS or local `expo prebuild`, add `llama.rn`, `react-native-webview`, `expo-device`, `expo-keep-awake`.
2. One screen: model path field, prompt box (fixed prompt asking for a counter app in the target HTML format), Run/Stop, a WebView below, a stats strip.
3. `initLlama({model, n_ctx:2048, n_gpu_layers:0})` then `completion` with the token callback; push tokens through the element-boundary flusher into the WebView; repeat with `response_format` JSON schema to measure grammar overhead.
4. Log JSON: load ms, prefill tok/s, decode tok/s (first 50 and last 50 tokens), peak RSS (`adb shell dumpsys meminfo`), battery delta, thermal status, repeat 5 builds.
5. Run on: the user's best phone, one 4-6 GB mid-range (needed, see open question), optionally one Adreno 700+ for the OpenCL path.
**Pass:** 2B Q4 loads on a 6 GB phone without LMK kill, tokens reach the WebView smoothly, and we have a real tok/s table to replace section 2's estimates.

## 9. Risks (ranked)
| ID | Risk | Mitigation / test |
|---|---|---|
| R1 | Mid-range decode is 2-5 tok/s and prefill 15+ s, so builds take minutes. | Spike numbers; short-code SDK; prefix cache; 0.8B lite tier; template-first UX; patches for edits. |
| R2 | Q4 quantisation of the fine-tune loses quality (seen in offline-coach). | Phone eval at Q4/Q5/Q6; QAT or higher-bit for T3. |
| R3 | RN WebView cannot hard-block sub-resource network loads. | Test page (section 4); native patch; or own WebView module. Blocker for the "no network" promise. |
| R4 | llama.rn lags upstream llama.cpp for a new Qwen3.5/Gemma 4 arch (hybrid attention). | Pin llama.rn version, test the exact GGUF at spike time, `rnllamaBuildFromSource` as escape hatch. |
| R5 | Android LMK kills the app on 4 GB phones during load. | Tier by RAM, 0.8B only on T1, small `n_ctx`, ApplicationExitInfo detection. |
| R6 | 16 KB page size or arm64-only (no x86 emulator image for CI). | CI check; arm64 emulator or device farm. |
| R7 | Sentry vs "offline/private" positioning. | Opt-in, scrubbing, local fallback. |
| R8 | Alpine CSP build + streaming partial DOM misbehaves. | Decide in SDK freeze; spike measures flicker. |
| R9 | Download of 1-1.5 GB fails on poor networks (Pakistan data costs). | Resume, Wi-Fi default, size shown, PAD or mirrored CDN, tier-down to 0.8B (~0.5-0.6 GB **[E]**). |

## 10. What must be tested on a real phone
tok/s and prefill per tier; peak RAM and LMK behaviour on 4 GB; thermal curve over 10 builds; OpenCL/HTP actually engaging and being faster for Q4_K_M (OpenCL path only supports Q4_0/Q6_K types, so a Q4_K_M model may fall back to CPU); sandbox network-block test page; WebView streaming smoothness at 360x640; session cache load time; resumable download across airplane-mode toggles; update-over-install keeps data; 16 KB alignment; Urdu/RTL rendering in the WebView; battery % per build.

---

# TASK LIST (dependency order; one session each)

Common rules: Expo app lives in `/home/oye/Documents/free_work/molde/app/`; TypeScript strict; every task ends with a one-paragraph note appended to `docs/plan/runtime-log.md`. Do not self-grade the UI tasks: run an independent blind critic (haiku, both orders) against the named references and a machine check (overflow, text under 12 sp, targets under 44 dp).

### T1. Spike: GGUF to WebView with numbers
- **Goal:** prove llama.rn + WebView streaming and replace estimates with measurements.
- **Deliverable:** `app/` Expo dev build, `app/src/spike/*`, `docs/plan/spike-results.md`, `app/scripts/bench.json` schema.
- **Acceptance (machine-checkable):** `npx tsc --noEmit` clean; `adb install` build launches; `bench.json` validates for 2 models x 2 phones with fields load_ms, prefill_tps, decode_tps_first50, decode_tps_last50, peak_rss_mb, battery_delta, thermal_status, grammar_on/off; `zipalign -c -P 16` passes on all `.so`; 5 consecutive builds with no crash.
- **Bar:** numbers beat or are reported against the section 2 table; the critic checks that every claim in `spike-results.md` has a raw log line behind it.

### T2. Sandboxed WebView host and network-block proof
- **Goal:** WebView that can only talk to the bridge. needs: SDK contract frozen (for the method list; build with a stub list first).
- **Deliverable:** `app/src/sandbox/{SandboxWebView.tsx,csp.ts,bridge.ts,validator.ts}`, `app/e2e/escape.html`, `app/__tests__/bridge.test.ts`, optional config-plugin patch.
- **Acceptance:** escape page tries the 11 vectors in section 4 and prints `PASS 11/11` on a real phone (log captured via `adb logcat`); Jest bridge tests cover size cap, bad collection name, rate limit, forged appId, unknown method, 1,000 fuzzed messages with zero native exceptions; blank-render and `onerror` reports reach the host.
- **Bar:** a security critic (separate agent) tries to break out with its own page and fails; compare with the Android WebView hardening checklist in the OWASP MASTG.

### T3. Storage, versions, undo
- **Goal:** `docs` store, version files, pointer-flip undo, snapshots. needs: SDK contract frozen (store API and quotas).
- **Deliverable:** `app/src/storage/*`, `app/__tests__/storage.test.ts`.
- **Acceptance:** tests: create 20 versions and undo to 3 with identical data rows; kill the process (simulated throw) between file write and pointer flip leaves old version live; quota errors return `E_QUOTA`; `PRAGMA user_version` migration test; delete app removes its folder; `data.db` rows never change during edit/repair tests (hash compare).
- **Bar:** an undo/history screen is judged later in T6; here the bar is the test list passing on-device too (`jest-expo` + one instrumented run).

### T4. Model manager: tiers, resumable download, verify, unload
- **Goal:** first-launch download that survives bad networks.
- **Deliverable:** `app/src/model/{manifest.ts,download.ts,tier.ts,memory.ts}`, mock server `app/scripts/range-server.js`, tests.
- **Acceptance:** with the mock server: resumes after 3 forced disconnects; sha mismatch deletes `.part` and shows error; low-space check refuses; Wi-Fi-only blocks on mobile data; tier map returns T1/T2/T3 for 4/6/8 GB inputs; unload fires on background idle and on trim-memory (instrumented log).
- **Bar:** compare behaviour and copy with Google Play's own large-asset download and Signal's/WhatsApp's media download resume; screenshots at 360x640 and 412x915 of the progress, paused and error states.

### T5. Generation engine, constrained output, pipeline wiring
- **Goal:** `Engine` interface + llama.rn implementation + stub engine + plan/create/edit/repair orchestration with streaming flush. needs: SDK contract frozen; validator package from the SDK/validator planner.
- **Deliverable:** `app/src/engine/{Engine.ts,LlamaEngine.ts,StubEngine.ts,flush.ts,pipeline.ts}`, JSON schemas for plan and patch, tests.
- **Acceptance:** StubEngine replays 20 recorded outputs through the pipeline deterministically; flusher unit tests (balanced tags, split tokens, unterminated tag, 600-token app) pass; plan JSON-schema grammar yields 100% parseable plans over 200 sampled runs on-device; repair loop stops at 2 rounds then falls back to nearest template; abort frees the context within 1 s; first visible UI (template) at most 1 s after submit.
- **Bar:** progressive paint is judged against the Claude Artifacts / v0 streaming preview feel: no full-document flicker, no layout jumps over 8 px after first paint (measured by a screenshot diff script at 412x915).

### T6. App shell UI: home, create, build progress, mini-app view, history
- **Goal:** the real screens, on-brand, calm. needs: SDK contract frozen (kit tokens) and T2, T3, T5.
- **Deliverable:** `app/src/ui/**`, screenshots in `docs/plan/shots/` from the **production build** at 360x640, 412x915, 600x960, 800x1280.
- **Acceptance:** machine check script (`app/scripts/ui-check.mjs`) reports 0 overflow, 0 text under 12 sp, 0 targets under 44 dp, contrast at least 4.5:1, visible focus, no state shown by colour alone; every screen has empty/loading/error states; RTL smoke screenshot passes.
- **Bar:** blind critic compares against Google Keep (home grid of cards), the Claude and ChatGPT Android composers (create box), Apple Shortcuts (my-tools grid) and Android Settings (settings). Follow `.claude/rules/ui-design.md` (unslop-ui audit first). No brown palette.

### T7. App-essentials P0/P1 pass
- **Goal:** store-ready baseline.
- **Deliverable:** Sentry opt-in + scrub (`app/src/telemetry/`), update check (`app/src/update/`), `privacy.md` published at a public URL, Settings screen additions, backup rules XML, flavours, R8/AAB config, CI workflow, `docs/plan/store-listing.md`.
- **Acceptance:** `python3 .claude/skills/app-essentials/app_audit.py app/` shows 0 MISSING P0; targetSdk 36 in the built manifest (`aapt dump badging`); release AAB size reported; privacy URL returns 200 (curl); Sentry test event contains no prompt/code/data fields (unit test on the scrubber); update-over-install keeps `apps/` data (instrumented script); `allowBackup` rules exclude `models/`.
- **Bar:** compare Settings and onboarding with Google Pixel Settings and Obsidian Mobile's first-run; Play pre-launch report has no crashes.

### T8. On-device bake-off harness and soak test
- **Goal:** give the training team a phone-truth scoreboard and set tier defaults.
- **Deliverable:** `app/src/bench/*` (hidden screen + adb intent), `app/scripts/run-bench.sh`, results JSON + `docs/plan/device-matrix.md`.
- **Acceptance:** one command runs the 8 gold prompts x each candidate GGUF (Qwen3.5-0.8B/2B, Gemma 4 E2B via GGUF, Qwen2.5-Coder-1.5B) on each attached phone and writes JSON with run-without-error rate, tok/s curve, peak RSS, thermal events, battery per build; 10-build soak shows tok/s drop under X% or the tier defaults are lowered in `tier.ts` accordingly; results reproducible within 10% across two runs.
- **Bar:** the matrix is judged by whether it lets someone choose tier defaults with no further measurement; critic checks every number has a raw log.
