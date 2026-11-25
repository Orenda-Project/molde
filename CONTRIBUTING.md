# Contributing to Molde

Thanks for helping. Molde is early, so the most useful help is testing and data.

## Ways to help

- **Try the app or the model and report what happened.** Open an issue with the exact request you typed, what you expected, what you got (a screenshot or the program text), the model (r1/r2, Q4 or Q8) and your phone or computer. Failures are just as useful as successes.
- **Write data.** Request and program pairs in the format described in [TRAINING.md](TRAINING.md). Every program must pass `node lang/mo.mjs check`. Real wording (the way people actually type, typos included) helps most.
- **Train or evaluate a model.** Follow TRAINING.md and post your numbers on the same test sets and decoder so they compare.
- **Language and runtime.** Bugs, missing features (with a real request that needs them), and runtime fixes.

## Pull requests

1. Open or find an issue first for anything larger than a small fix, so work is not duplicated.
2. One topic per pull request, on a branch from `main` (language work: from `phase-0-language`; app: from `phase-4-app`).
3. Run the tests that cover your change: `node --test lang/tests/` for the language, `python3 -m pytest train/tests` for the pipeline.
4. Say in the description what you changed, why, and how you checked it. For model or data changes include the before and after numbers.
5. Never commit secrets, tokens, signing keys or model weights (`.gguf`, `.safetensors`). Models go to Hugging Face.

## Ground rules

- Keep the language small. A new feature needs real requests that cannot be written without it.
- Data safety comes first: a change must never lose a user's saved data (`mo.mjs diff` checks this).
- Be honest with numbers: report failures, use the fixed test sets, and score the quantized file you would ship.
- Be kind in issues and reviews.

By contributing you agree that your contribution is licensed under the Apache License 2.0 (code and language) or CC BY 4.0 (data), as described in the [README](README.md#licence).
