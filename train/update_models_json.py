#!/usr/bin/env python3
"""Put new model entries at the top of models.json in oyekamal/molde-tiny; set recommended on one entry and false on all others.
  update_models_json.py --add ID:NAME:FOLDER/FILE:LOCALPATH:NOTE ... --recommend ID"""
import argparse, hashlib, json, os, tempfile
from huggingface_hub import HfApi, hf_hub_download
ap = argparse.ArgumentParser(); ap.add_argument("--add", nargs="+", required=True); ap.add_argument("--recommend", required=True); a = ap.parse_args()
REPO = "oyekamal/molde-tiny"
p = hf_hub_download(REPO, "models.json", force_download=True); d = json.load(open(p))
new = []
for spec in a.add:
    mid, name, rel, local, note = spec.split(":", 4)
    h = hashlib.sha256(open(local, "rb").read()).hexdigest()
    new.append({"id": mid, "name": name, "file": rel, "url": f"https://huggingface.co/{REPO}/resolve/main/{rel}", "bytes": os.path.getsize(local), "sha256": h, "recommended": False, "note": note})
ids = {m["id"] for m in new}
d["models"] = new + [m for m in d["models"] if m["id"] not in ids]
for m in d["models"]: m["recommended"] = (m["id"] == a.recommend)
import datetime; d["updated"] = str(datetime.date.today())
tmp = tempfile.mkdtemp() + "/models.json"; json.dump(d, open(tmp, "w"), indent=1)
HfApi().upload_file(path_or_fileobj=tmp, path_in_repo="models.json", repo_id=REPO, commit_message="models.json: " + ", ".join(sorted(ids)))
print(json.dumps(d, indent=1)[:1500])
