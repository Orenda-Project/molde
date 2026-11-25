# What the app needs to run a Qwen3.5 model (not applied: the app is another agent's branch, phase-5-app)

1. `app/js/src/decode_loop.mjs` `promptFor(system, user, accepted)` is Gemma only. For Qwen3.5 the training prompt is ChatML with an empty think block:

```js
export function promptFor(system, user, accepted, template = 'gemma') {
  if (template === 'qwen')   // ids from the Qwen3.5 tokenizer: <|im_start|>=248045, <|im_end|>=248046
    return `<|tok:248045|>system\n${clean(system)}<|tok:248046|>\n<|tok:248045|>user\n${user}<|tok:248046|>\n<|tok:248045|>assistant\n<think>\n\n</think>\n\n${accepted}`;
  return `<|tok:2|><|tok:105|>user\n${clean(system)}\n\n${user}<|tok:106|>\n<|tok:105|>model\n${accepted}`;
}
```
   and `models/<file>.json` gets `{"template": "qwen"}` (read where `system` and `arm` are read, `entry.mjs` line ~115, then passed to `generate`). No BOS for Qwen.
2. Speed: Qwen3.5 has recurrent (linear attention) layers, so llama.cpp cannot roll the KV cache back: in the host core every line-step re-reads the whole prompt (`cached=0`, 831 prompt tokens = about 10 s per call on the laptop at 4 threads). A create of 8 lines took 8 s, but an edit of a long app took 180 s. Gemma reuses the cache and is 20 times faster per edit. Draft verification still works but gains little. This is the main reason the Qwen file is not practical in the app as the decoder is built today.
3. The GGUF declares an MTP layer (`block_count 25`, `nextn_predict_layers 1`, 24 blocks of tensors). llama.cpp b12144 (the app's version) loads it; the older loader in llama_flutter_android does not. `train/tokens/fix_qwen35_mtp.py IN OUT` rewrites the metadata (block_count 24, nextn 0) so both load; same file size.
