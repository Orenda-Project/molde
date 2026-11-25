#!/usr/bin/env python3
"""Rewrite a Qwen3.5 GGUF whose metadata declares a multi-token-prediction layer that the file does not contain.
llama.cpp b12144 as bundled in the app (and llama_flutter_android) fails with "missing tensor blk.N.attn_norm.weight" on such files
(see memory project_coach_gguf_mtp_layer). Fix: block_count = number of block tensors present, nextn_predict_layers = 0,
attention.recurrent_layers cut to block_count. Tensors are copied unchanged; the output has the same size.
  fix_qwen35_mtp.py IN.gguf OUT.gguf   (OUT must differ from IN)"""
import os, sys
for p in (os.environ.get("LLAMA_SRC", "") + "/gguf-py", os.path.expanduser("~/Documents/free_work/molde-model/train-setup/llama-src/gguf-py")):
    if os.path.isdir(p): sys.path.insert(0, p)
import gguf
from gguf import GGUFReader, GGUFWriter, GGUFValueType
src, dst = sys.argv[1], sys.argv[2]
assert src != dst
r = GGUFReader(src)
arch = r.fields["general.architecture"].contents()
nblk = len({int(t.name.split(".")[1]) for t in r.tensors if t.name.startswith("blk.")})
declared = r.fields[f"{arch}.block_count"].contents()
if declared == nblk and r.fields.get(f"{arch}.nextn_predict_layers") is not None and int(r.fields[f"{arch}.nextn_predict_layers"].contents()) == 0:
    print("already consistent:", nblk, "blocks"); sys.exit(0)
print(f"declared block_count {declared}, tensors for {nblk} blocks: fixing")
w = GGUFWriter(dst, arch, endianess=r.endianess)
for k, f in r.fields.items():
    if k.startswith("GGUF.") or k == "general.architecture":
        continue
    v = f.contents()
    if k == f"{arch}.block_count": v = nblk
    elif k == f"{arch}.nextn_predict_layers": v = 0
    elif k == f"{arch}.attention.recurrent_layers": v = list(v)[:nblk]
    t = f.types[0]
    if t == GGUFValueType.ARRAY:
        w.add_array(k, v)
    else:
        w.add_key_value(k, v, t)
for t in r.tensors:
    w.add_tensor_info(t.name, t.data.shape if hasattr(t.data, "shape") else t.shape, t.data.dtype, t.data.nbytes, t.tensor_type)
w.write_header_to_file(); w.write_kv_data_to_file(); w.write_ti_data_to_file()
for t in r.tensors:
    w.write_tensor_data(t.data)
w.close()
print("wrote", dst, os.path.getsize(dst), "bytes (input", os.path.getsize(src), ")")
