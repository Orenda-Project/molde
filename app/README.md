# Molde app (Android, phase 4)

An offline phone app where a tiny on-device model turns a typed request into a small app that appears at once and keeps its data. Package `com.oyekamal.molde`, app name Molde. The release manifest now has the `INTERNET` permission, used only by the model downloader and the catalogue fetch (see Network and privacy). The WebView refuses every address except the bundled page.

## Network and privacy

The only network use is in `lib/src/catalogue.dart` (fetch `models.json` from `huggingface.co/oyekamal/molde-tiny`, falling back to the copy bundled as `assets/models.json`) and `lib/src/downloader.dart` (the model file). Both send a plain GET: no user id, no app names, no program text, no data. Nothing about the user's apps, requests or data is ever sent. The WebView that shows the user's app is locked to the bundled page: navigation to anything but `file:///android_asset/` is refused (`allowNavigation` in `lib/src/web.dart`, tested), and the page's Content-Security-Policy is `default-src 'none'`, so it cannot fetch or load anything from the network either. The text users read is in Settings > Privacy (`kPrivacy` in `lib/src/ui_models.dart`): "Molde works offline. Your apps and everything you enter stay on this phone and are never sent anywhere. The only things this app downloads are the list of available models and the model file you choose, from Hugging Face. Nothing about you, your requests or your data is sent with those downloads. The screen that shows your app is locked to the page inside this app and cannot open other addresses."

## Chat rules (version 0.3.0)

- **Asks.** The model may ask one question per request (`ask "Q" "A" "B"` as line 1). The options become buttons; typed text answers too. The next prompt is exactly `Request: <original>\nQuestion: <q>\nAnswer: <a>` (an edit: `Edit request: ...` with the same two lines, then the current program). On that second turn the line-1 grammar drops `ask-stmt` (`allowAsk=false`, `noAsk()` in `js/src/decode_loop.mjs`), so a second ask is impossible. The decoder still accepts a model that asks; only the grammar changes. Until the retrained model lands, a request of 1 to 3 words that contains a word that is not filler (`namesAThing`, `kFiller` in `lib/src/controller.dart`) is built at once with `allowAsk=false`.
- **New app vs change.** The sheet header shows the mode (`New app` or `Changing <name>`). A New app choice made by the user stays selected after a create. In Change mode a request that reads like a new app (`a/an/make/build/create ... app/tracker/list/log/counter/timer...`) and names nothing of the current app is not sent as a change: the chat asks with two buttons, "New app" and "Change <name>".
- **Setting-only changes.** If an edit only changes a setting's default, `set` is added to that line before applying (`js/src/edit_prep.mjs`; a saved value otherwise beats a new default) and the chat says "Goal is now 3000". A truly empty diff says "This app already does that" and shows the closest line.
- **Edit safety.** An edit that removes more than 20% of the current lines is not applied unless the request says remove, delete, drop, hide or without; the chat lists what would have gone and offers Try again. Edits get a line budget of at least the old line count plus 40 (minimum 70), and the context is 4096 tokens.
- **Examples** open with sample data (the web demo's seeds, moved so the history ends today), marked "Sample data · Clear"; Clear reloads the same program with no rows.
- **Deadline.** The 6-minute limit also interrupts a line in progress (the native cancel flag is checked per token).
- **Gauntlet:** `tool/gauntlet_r3.py` (see its header) drives the emulator through the ask, flow, goal and green checks.

## Version 0.6.1: two-model picker, recovery from a stuck model, failure-hunt rule fixes

Gemma 270M is the recommended model, Qwen 0.8B the second (`assets/models.json` equals the live list). Settings > Model: recommended first with a label, in-use check mark, "Downloaded earlier" for models the list dropped, switching blocked while a build runs. A native call that does not return 20 s after cancel (8 min at most) is abandoned: fresh core and worker thread, honest message, app unchanged. Rules: "undo that" is Undo; dropsUnasked maps nouns (chart, totals, list...) to line kinds; the 20% guard ignores indent and in-place edits; wider direct edits (dark mode, theme, title, goal); plain-English data refusals; unasked rewrites need a decision. Evidence: `molde-design/app-r6/REPORT.md`, `tool/gauntlet_r6.py`.

## Version 0.6.0: Qwen3.5 in the app; 0.5.1 fixes

- **Progress text** now always has numbers ("Writing line 5… (31 s)"): the page forwards the seconds and the app also counts them between lines. **Ages** ("Changed 3 h ago") use a monotonic clock for apps changed in this session, so a device clock that jumps cannot age a new app; a time in the future reads "just now". **Unasked removals:** if a model edit drops lines the request does not name (`dropsUnasked`), the chat shows "This would also remove: ..." with **Keep my app** (default) and **Apply anyway**. **Machine check:** `tool/machine_check.py` (overflow, text under 12 sp, touch targets under 44 dp, on five screens at 360x640 and 412x915; results in the PR).
- **ChatML template.** `template` = `qwen` (sidecar json, a `template` field in models.json, or a GGUF architecture starting with `qwen`) selects `<|im_start|>` ... with an empty think block and no BOS.
- **Recurrent models** (Qwen3.5 DeltaNet): the native core saves the sequence state after the prompt and restores it instead of re-reading the prompt, and tokenises the next prompt incrementally. Qwen edits: 186 s -> 13.5 s (27 lines), 617 s -> 29.6 s (43 lines); Gemma is not slower (details: `molde-model/r4/app-qwen-speed.md`). The MTP metadata fix is not needed with this native build.

## Round 5 (version 0.5.0): fewer asks, faster edits

- **No asking when the request names something.** Any request with at least one non-filler word is built at once (`namesAThing`, `allowAsk=false`: the first-line grammar loses `ask-stmt`); a second ask after one answer is impossible. Measured on r3 Q4_K_M with the app's loop on the 60 short requests: ask rate 31.7% -> 0%, checker pass 65% -> 96.7%; the 19 asks that were answered all built (`js/tools/measure_asks.mjs`).
- **Draft verification for edits** (`android/app/src/main/cpp/molde_core.h`, option `draft` of `complete`): an edit re-emits the old program, so the old line expected next is offered as a draft and checked in one batch against what the grammar-constrained sampler would write; the first mismatch rolls the cache back and normal decoding continues. Greedy text is unchanged; median edit time on a 68 to 89 line app went from 56 s to 35 s wall (2x by CPU seconds) on the laptop with 4 threads (`js/tools/measure_edits.mjs`). The JNI file is now a thin wrapper; the same header builds as a host server (`js/tools/host/build.sh`) so the phone's core can be measured on a laptop.
- No line-range edit format: r3 was trained only on full re-emits.
- **The limit follows progress.** No fixed 6 minutes: generation continues while lines still arrive and stops after 150 s without a new line (300 s before the first line, which includes reading the prompt) or at a 30 minute cap (`stallMs`, `firstLineMs`, `hardCapMs` in `js/src/decode_loop.mjs`). The chat shows "Reading your request… (N s)" and then "Writing line N… (S s)"; Stop is always available.
- **Questions go stale.** A newer question, or any new request, disables the buttons of every older unanswered question (New/Change and ask options alike).
- **Chat list.** Reversed list anchored at the newest message; the sheet is about 45% of the screen with a floor of 330 dp so a 360x640 phone keeps room for the chat.
- **Default model.** The bundled catalogue (`assets/models.json`) recommends r3-gemma270m Q4_K_M. Gauntlet: `tool/gauntlet_r4.py` (results in `tool/gauntlet_r5_results.json`), five model edits: `tool/edits5.py`.

## Round 4 (version 0.4.0): never claim what did not happen

- **Honest replies.** A model program that equals the current one, or changes nothing that matters, is never reported as "already does that": the chat says "I couldn't make that change yet. Your app is unchanged." After an applied change `unmetClaims` (`lib/src/rules.dart`) checks what the request asked for where it can: a theme word, dark/light, a new title, a named field added or removed, a chart added or removed, a setting value. If the asked part is missing the chat does not say "Changed": it says what did change and that the asked part did not happen, with Undo.
- **Exact edits, no model.** Colour words (red orange yellow green teal blue purple pink grey, ocean mint slate ink plum), dark or light mode, bigger or smaller text and renaming the title are exact edits of line 1 (`appLineEdit`): instant, "Done: green". The same goes for "change the goal to 3000" (`settingEditProgram`). Everything else goes to the model.
- **Modes.** After a create the mode is "Changing <new app>". Requests that start with a change verb (change, rename, make it, add, remove, delete, hide, show, set, move, bigger, smaller, ...) are changes and never raise the new-app question; a bare noun phrase that names nothing of the open app ("sleep tracker", "kharcha", "gym log") does.
- **Chat.** One chat per app, kept across restarts (text only); buttons of an answered ask or clarifier are disabled; the sheet is at most 45% of the screen with the app visible above.
- **Titles and wording.** A model title that is a question or a sentence is replaced by the request's main noun; a new app is announced in one plain sentence from its program ("Made Savings: add deposit entries with amount, see your totals and a chart.").
- **Long apps.** Apps over 30 lines say up front "This app is long, changes can take a few minutes"; the developer menu lists the measured seconds of the last generations.
- **Bundle.** Language 4698991 (accent colours, dark mode, text size) and renderer fdbe5aa. The decoder copy (`phase-2-decode`) predates the newest grammar (`later-arg`); `js/build.mjs` patches the vendored copy and `js/tests/coverage.test.mjs` checks that every line of the 45 example programs is accepted by the per-line grammar.
- **Gauntlet:** `tool/gauntlet_r4.py` (direct edits, modes, create, the critic's cases, flows, asks).

## Getting the model (in the app)

First run with no model shows a setup screen: what the model is, its size, that Molde works offline after the download, a Wi-Fi hint on mobile data, the Gemma licence line with the link (as text too), and the buttons Download (recommended) and Other models. "Try the example apps first" skips it (the example apps need no model).

The downloader (pure Dart, `dart:io`, no new heavy dependency; only `crypto` for sha256) keeps running when the app goes to the background or the screen is off because `DownloadService` is a foreground service (type dataSync) with a progress notification and a partial wake lock. It follows redirects by hand so the `Range` header survives every hop, writes to `<name>.gguf.part` and resumes with `Range: bytes=<size>-`, retries with backoff (1, 2, 4, 8, 15, 30 s), supports pause, resume and cancel, checks free space first (size plus 10%) and says so in plain words, verifies the sha256 and deletes the file on a mismatch (nothing is loaded), then renames atomically to `<files>/models/<name>.gguf`. The choice is recorded in `<files>/molde/settings.json`. A model pushed by hand (`adb push`, see below) keeps working and shows as "Added by hand". Settings (gear in the chat sheet header) > Model shows the active model (name, size, source), the catalogue with Download / Use / Delete, and "A newer model is available" when the catalogue recommends another one.

Catalogue format (`models.json`): `version`, `models[]` with `id`, `name`, `file`, `url` (https only), `bytes`, `sha256`, `recommended`, `note`, and `licence`. Entries that are not https or have no valid sha256 are ignored.

## What is where

| Path | What |
|---|---|
| `lib/main.dart`, `lib/src/ui.dart` | the shell: the screen is the user's app, one chat button bottom-right, the chat sheet (create or change), the app switcher (list, new, delete with confirm), the developer menu |
| `lib/src/controller.dart` | the flows: create, change (verdict safe / warn / refused), Undo, failure path, backup export and import |
| `lib/src/store.dart` | storage: one JSON file per app (program, data snapshot with its schema history, Undo stack, request log), written to `.tmp`, flushed, then renamed over the old file (the old one is kept as `.bak`); a read takes the first of file, `.tmp`, `.bak` that parses |
| `lib/src/bridge.dart` | Flutter to WebView bridge (`rpc`, events: ready, reply, snapshot, progress, native, ask, log) |
| `lib/src/llm.dart` | model location, loading, sidecar settings, the call channel |
| `android/app/src/main/cpp/molde_jni.cpp` | our own JNI layer over llama.cpp b12144: per-call GBNF grammar, stop at newline, KV cache reuse, real special-token ids, cancel flag |
| `js/src/entry.mjs` | the page inside the WebView: evaluator + renderer for the app on screen, host clock, snapshot after every change |
| `js/src/decode_loop.mjs` | the generation loop (line-stepped decoding, per-line name grammar, checker, up to 3 resamples; arm D or E) |
| `assets/web/molde.js` | the bundle (generated; committed so the APK builds without Node) |
| `assets/examples/*.mo` | the 15 example programs of the web demo (developer menu), migrated to the current language spelling |
| `tool/sync-js.sh` | one command that updates the JS (language, renderer, decoder) from their branches |
| `tool/ui.py` | adb + uiautomator driver used for the emulator checks |

## Build

Needs: Flutter (`/home/oye/flutter/bin/flutter`), Android SDK with NDK 28.2.13676358 and CMake 3.22.1, Node 20+ (only to rebuild the JS), and a llama.cpp **b12144** source tree (default `~/Documents/free_work/molde-model/train-setup/llama-src`; elsewhere: `git clone https://github.com/ggml-org/llama.cpp && git -C llama.cpp checkout b12144`, then `-PllamaDir=/path` or `LLAMA_CPP_DIR=/path`).

One ABI per build (disk and time). The ABI is chosen with the `abi` Gradle property, passed as an environment variable:

```
cd app
ORG_GRADLE_PROJECT_abi=x86_64     flutter build apk --debug --target-platform android-x64     # emulator
ORG_GRADLE_PROJECT_abi=arm64-v8a  flutter build apk --debug --target-platform android-arm64   # phone
# -> build/app/outputs/flutter-apk/app-debug.apk
```

`android/gradle.properties` sets `disable-abi-filtering=true` so Flutter does not override the ABI. llama.cpp is built with `GGML_CPU_ALL_VARIANTS` and loadable backends: the CPU variant (sse42 to avx512 on x86, armv8.0 to armv9 on arm64) is chosen at run time by CPU features. The libraries are extracted at install (`useLegacyPackaging`) because ggml lists the library directory.

The first x86_64 build compiles llama.cpp (about 3 minutes on a busy laptop); later builds reuse it.

## Update the JavaScript (language, renderer, decoder)

```
app/tool/sync-js.sh      # git fetch; export lang/, runtime/web/, decode/ from origin/phase-0-language, phase-1-renderer, phase-2-decode
                         # into app/js/vendor (not committed); npm install esbuild once; bundle -> assets/web/molde.js, molde.css, examples
```

`js/VERSIONS.txt` (copied to `assets/web/VERSIONS.txt`) records the three commits. Other branches: `LANG_REF=origin/main RENDER_REF=... DECODE_REF=... tool/sync-js.sh`; another clone: `MOLDE_REPO=/path`. `NO_FETCH=1` skips the fetch. The build migrates the example programs to the current language spelling and fails if one does not pass the checker. Test the loop without a model: `cd app/js && node --test tests/`.

## Model: swap without a rebuild

The app looks for a model, in this order, in `<external files>/models/` = `/sdcard/Android/data/com.oyekamal.molde/files/models/` and then `<app files>/models/`: a file named `model.gguf`, else the newest `*.gguf`. Open the app once (it creates the folder), then:

```
adb push r1-gemma270m-Q4_K_M.gguf /sdcard/Android/data/com.oyekamal.molde/files/models/model.gguf
```

Then restart the app, or developer menu > Reload model. A file `model.json` (or `<name>.json`) next to the model may hold `{"system": "<the training system prompt>", "arm": "D"|"E", "name": "..."}`; without it the r1 system prompt and arm E are used. For a first-run copy instead of `adb push`, put the file at `assets/model/model.gguf` and add `- assets/model/` to `pubspec.yaml`; it is copied into the app files on first start. GGUFs are never committed (`*.gguf` is git-ignored).

The prompt is the training one: `<bos><start_of_turn>user\n{system}\n\nRequest: ...<end_of_turn>\n<start_of_turn>model\n{program so far}` with the real ids 2, 105, 106 (a `<|tok:ID|>` marker in the prompt text becomes that id natively). Edits use `Edit request: ...\n\nCurrent program:\n{program}`.

## Developer menu

Apps list (chat sheet, tap the app name) > long-press `Molde 0.1.0`. It has: last generation stats (seconds, tokens, tokens per second, model calls, resamples, fallback lines, prompt tokens and how many came from the cache, grammar build time), the model file, arm D / E, Reload model, the 15 example apps (no model needed), Export backup, Import backup, the page log. Backups are written to `/sdcard/Android/data/com.oyekamal.molde/files/backups/molde-backup-<time>.json` (`adb pull` works) and listed for import.

## Tests

```
cd app && flutter test                 # storage (crash-safe write, restore, backup) and bridge: 20 tests
cd app/js && node --test tests/        # generation loop with a fake model: 8 tests
```

Emulator checks (the steps and results are in the PR description): `app/tool/ui.py` drives the app with `adb shell input` and uiautomator.

## Binding spike (why our own JNI layer)

The three things the decode loop needs, checked first:

| Need | `llama_flutter_android` 0.2.6 (what offline-teacher-coach uses) | `molde_jni.cpp` (this app) |
|---|---|---|
| GBNF grammar that changes on every call | No. `generate` takes only sampling parameters (temperature, top-p/k, min-p, penalties, mirostat, seed); `jni_wrapper.cpp` never calls `llama_sampler_init_grammar` | Yes. Verified on the emulator: every program the model wrote passed the checker's name and syntax rules; grammar build is about 40 ms per line |
| Stop strings (stop at the newline) | No. It stops at end-of-generation, `maxTokens` or `stop()` | Yes. Stops at the first newline; the newline token is not evaluated |
| Prompt caching (reuse the cache for the common prefix) | Keeps one running context (`g_n_past`, `clearContext`) but cannot roll back to a common prefix, and the prompt is a plain string | Yes. Verified: after the first call each line evaluates 1 prompt token and reuses the rest (`prompt_eval=1 cached=224` in logcat tag `molde-llm`). A re-tokenisation that diverges rolls the cache back to the common prefix |

Also: the plugin ships arm64 only as used in the coach (its note says "no model runs" on the x86_64 emulator). Our layer builds llama.cpp b12144 for both ABIs, adds a cancel flag that is also checked every 32 prompt tokens, and passes the real turn-marker ids (2, 105, 106; the GGUF reads `<start_of_turn>` as plain text, decode REPORT finding 3).

## Known limits

See the final report in the PR: speed in the emulator, memory on a 3 to 4 GB phone, renderer and evaluator being on different language rounds, local notifications for `remind` lines not wired (the renderer shows them as toasts only).
