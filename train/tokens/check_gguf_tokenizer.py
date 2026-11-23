#!/usr/bin/env python3
"""Does llama.cpp tokenize MoldeScript exactly like the training tokenizer? (train/inference mismatch check)
  check_gguf_tokenizer.py HF_MODEL_DIR GGUF [--files GLOB ...]   (GGUF may be a --vocab-only file)
Prints the share of programs with identical ids; exit 1 if any differ and --strict."""
import argparse, glob, json, os, subprocess, sys
from transformers import AutoTokenizer
ap = argparse.ArgumentParser(); ap.add_argument("hf"); ap.add_argument("gguf"); ap.add_argument("--glob", default="/tmp/molde-p2/lang/corpus/*.mo"); ap.add_argument("--strict", action="store_true")
a = ap.parse_args()
t = AutoTokenizer.from_pretrained(a.hf)
binp = os.path.expanduser(os.environ.get("LLAMA_BIN", "~/llama.cpp-b12144/llama-b12144"))
files = sorted(glob.glob(a.glob))[:150] + sorted(glob.glob(a.glob.replace("corpus", "examples")))
bad = []
for f in files:
    hf = t(open(f).read(), add_special_tokens=False)["input_ids"]
    o = subprocess.run([binp + "/llama-tokenize", "-m", a.gguf, "--ids", "--no-bos", "-f", f], capture_output=True, text=True, env={"LD_LIBRARY_PATH": binp})
    ids = json.loads(o.stdout.strip().splitlines()[-1])
    if ids != hf: bad.append(os.path.basename(f))
print(json.dumps({"files": len(files), "identical": len(files) - len(bad), "differ": bad[:8]}))
sys.exit(1 if bad and a.strict else 0)
