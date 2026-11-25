#!/usr/bin/env python3
"""Upload full-precision weights (HF format: safetensors + config + tokenizer) of a round to oyekamal/molde-tiny/<round>/hf/ and add a
'Fine-tune from these weights' section to the round's README.md (once).
  upload_hf_weights.py ROUND HF_DIR [--adapter ADAPTER_DIR] [--base-id ID]   (never prints tokens)"""
import argparse, os, pathlib, sys, tempfile
from huggingface_hub import HfApi, hf_hub_download
ap = argparse.ArgumentParser(); ap.add_argument("round"); ap.add_argument("hf_dir"); ap.add_argument("--adapter"); ap.add_argument("--base-id", default="")
a = ap.parse_args(); REPO = "oyekamal/molde-tiny"; api = HfApi()
d = pathlib.Path(a.hf_dir); assert (d / "model.safetensors").exists() or list(d.glob("model-*.safetensors")), "no safetensors in " + a.hf_dir
api.upload_folder(repo_id=REPO, folder_path=str(d), path_in_repo=f"{a.round}/hf", commit_message=f"Add full-precision weights for {a.round}",
                  ignore_patterns=["optimizer*", "opt.pt", "state.json", "*.gguf"])
if a.adapter:
    api.upload_folder(repo_id=REPO, folder_path=a.adapter, path_in_repo=f"{a.round}/adapter", commit_message=f"Add LoRA adapter for {a.round}")
p = hf_hub_download(REPO, f"{a.round}/README.md", force_download=True); txt = open(p).read()
if "## Fine-tune from these weights" not in txt:
    txt += f"""
## Fine-tune from these weights

The full-precision (bf16) weights in Hugging Face format are in [`hf/`](hf/) (safetensors, config, tokenizer with the MoldeScript keyword tokens already added{', plus the LoRA adapter in `adapter/`' if a.adapter else ''}).
Load with `AutoModelForCausalLM.from_pretrained("oyekamal/molde-tiny", subfolder="{a.round}/hf")` and continue training with the scripts in the Molde repo (`train/train.py`, config `init_weights` or `model:` pointing at this folder). The GGUF files in this folder are quantised exports of the same weights for llama.cpp.
"""
    tmp = tempfile.mkdtemp() + "/README.md"; open(tmp, "w").write(txt)
    api.upload_file(path_or_fileobj=tmp, path_in_repo=f"{a.round}/README.md", repo_id=REPO, commit_message=f"{a.round}: card mentions full weights")
print("UPLOADED weights", a.round)
