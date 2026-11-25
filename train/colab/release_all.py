#!/usr/bin/env python3
"""Release every Colab runtime assigned to the logged-in account (use after killing a runner).
uvx --from mcp-colab-gpu --with 'mcp<2' python colab/release_all.py"""
import requests as R
from mcp_colab_gpu import colab_runtime as cr
t = cr.get_credentials().token
r = R.get(f"{cr.COLAB_API}/tun/m/assignments", params={"authuser": "0"}, headers=cr._colab_headers(t), timeout=60)
data = cr._strip_xssi(r.text) if r.ok else {}
a = data.get("assignments", []) if isinstance(data, dict) else []
print("assignments:", len(a))
for x in a:
    cr.unassign_runtime(t, x["endpoint"]); print("released", x.get("accelerator"))
