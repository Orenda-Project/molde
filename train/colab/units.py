#!/usr/bin/env python3
"""Print the Colab compute-unit balance (read-only), if Colab's consumption endpoint answers. Never prints tokens.
Run with the uv env that has mcp-colab-gpu:  uvx --from mcp-colab-gpu --with 'mcp<2' python colab/units.py"""
import json, requests
from mcp_colab_gpu import colab_runtime as cr
t = cr.get_credentials().token
for ep in ("tun/m/get-consumption-info", "tun/m/consumption-info", "tun/m/user-info"):
    try:
        r = requests.get(f"{cr.COLAB_API}/{ep}", params={"authuser": "0"}, headers=cr._colab_headers(t), timeout=30)
        txt = cr._strip_xssi(r.text) if r.ok else r.status_code
        print(ep, json.dumps(txt)[:600])
    except Exception as e:
        print(ep, type(e).__name__)
