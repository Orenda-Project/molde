#!/usr/bin/env python3
"""bf16 copy of a checkpoint's weights (one file under 900 MB for models up to about 0.4B) for a per-epoch Drive save.
  save_bf16.py CKPT_MODEL_DIR OUT.safetensors"""
import sys
from safetensors.torch import load_file, save_file
import torch
sd = load_file(sys.argv[1] + "/model.safetensors")
save_file({k: v.to(torch.bfloat16).contiguous() for k, v in sd.items()}, sys.argv[2], metadata={"format": "pt"})
print("saved", sys.argv[2])
