# Molde app (Android, phase 4)

An offline phone app where a tiny on-device model turns a typed request into a small app that appears at once and keeps its data. Package `com.oyekamal.molde`, app name Molde. No `INTERNET` permission in the release manifest (Flutter adds one to debug builds only, for its tooling; the WebView refuses every address except the bundled page).

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

## Known limits

See the final report in the PR: speed in the emulator, memory on a 3 to 4 GB phone, renderer and evaluator being on different language rounds.
