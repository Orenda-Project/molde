#!/usr/bin/env python3
"""Mark the chat-turn markers as CONTROL tokens in a GGUF (in place) and verify that a chat prompt tokenises to the training ids.
llama.cpp b12144 reads <start_of_turn>/<end_of_turn> of a converted Gemma file as plain text (token type NORMAL), so the server's chat
template fed the model 7 text tokens instead of the id the model was trained on (found by the decode agent, 2026-11-24).
  fix_gguf_control.py FILE.gguf [--hf TOKENIZER_DIR]    (verifies with llama-tokenize when --hf is given)"""
import argparse, json, os, subprocess, sys
for p in (os.environ.get("LLAMA_SRC", "/content/llama.cpp") + "/gguf-py", os.path.expanduser("~/Documents/free_work/molde-model/train-setup/llama-src/gguf-py")):
    if os.path.isdir(p): sys.path.insert(0, p)
from gguf import GGUFReader
MARKERS = ["<start_of_turn>", "<end_of_turn>", "<|im_start|>", "<|im_end|>"]
ap = argparse.ArgumentParser(); ap.add_argument("gguf"); ap.add_argument("--hf"); a = ap.parse_args()
r = GGUFReader(a.gguf, "r+")
f, t = r.fields["tokenizer.ggml.tokens"], r.fields["tokenizer.ggml.token_type"]
changed = []
for i, idx in enumerate(f.data):
    s = bytes(f.parts[idx]).decode("utf8", "replace")
    if s in MARKERS and int(t.parts[t.data[i]][0]) not in (3, 4):
        t.parts[t.data[i]][0] = 3; changed.append((i, s))
r.data.flush() if hasattr(r.data, "flush") else None
print("set CONTROL:", changed)
if a.hf:
    from transformers import AutoTokenizer
    tok = AutoTokenizer.from_pretrained(a.hf)
    txt = "<start_of_turn>user\nRequest: track my water<end_of_turn>\n<start_of_turn>model\n"
    want = tok(txt, add_special_tokens=False)["input_ids"]
    binp = os.path.expanduser(os.environ.get("LLAMA_BIN", "~/llama.cpp-b12144/llama-b12144"))
    o = subprocess.run([binp + "/llama-tokenize", "-m", a.gguf, "--ids", "--no-bos", "-p", txt], capture_output=True, text=True, env={"LD_LIBRARY_PATH": binp})
    got = json.loads(o.stdout.strip().splitlines()[-1])
    print("hf ids  ", want); print("llama ids", got); print("IDENTICAL" if got == want else "DIFFERENT")
    sys.exit(0 if got == want else 1)
