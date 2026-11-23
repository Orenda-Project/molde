#!/usr/bin/env python3
"""Write the job files for ONE Colab session into a jobs folder (the runner executes them in order, aborts on any failure).

  python3 colab/make_jobs.py JOBS_DIR --name smoke-r0 --config configs/gemma270m.yaml [--set epochs=3 ...]
        [--stages train,eval,export] [--quants "Q8_0 Q4_K_M"] [--resume-parts N] [--ckpt-parts N]
        [--inputs molde-train/inputs/molde_inputs.tgz] [--extra-fetch DRIVEPATH=COLABPATH ...]

Jobs (numbers = run order; the trained model is packed and saved to Drive right after training, before eval/export): 30 setup (tiny cell: node + pip pins) · 31 fetch inputs from Drive · 32 unpack ·
33 smoke (files, cuda, node, tokenizer, checker on one example; a failure aborts before any training) ·
34 fetch ckpt parts (resume only) · 36 train (detached process + heartbeat) · 37 eval (test split, greedy) ·
38 export (GGUF f16/Q8_0/Q4_K_M) · 39 pack (tar of final/eval, ckpt parts) · 40 Drive save.
Big inputs never go through a cell: they are uploaded with colab_drive_upload and fetched by job 31.
"""
import argparse, json, pathlib, shlex

ap = argparse.ArgumentParser()
ap.add_argument("jobs"); ap.add_argument("--name", required=True); ap.add_argument("--config", required=True)
ap.add_argument("--set", nargs="*", default=[]); ap.add_argument("--stages", default="train,eval,export")
ap.add_argument("--quants", default="Q8_0 Q4_K_M"); ap.add_argument("--resume-parts", type=int, default=0); ap.add_argument("--ckpt-parts", type=int, default=0)
ap.add_argument("--inputs", default="molde-train/inputs/molde_inputs.tgz"); ap.add_argument("--extra-fetch", nargs="*", default=[])
ap.add_argument("--data-dir", default="data/out", help="dataset folder under train/ (train.jsonl, val.jsonl, test_refs.jsonl, dataset_card.json)")
ap.add_argument("--chat-kwargs", default="{}"); ap.add_argument("--gguf-parts", type=int, default=1, help="parts per f16 GGUF when it exceeds 900 MB")
a = ap.parse_args()
d = pathlib.Path(a.jobs); d.mkdir(parents=True, exist_ok=True)
stages = a.stages.split(","); N = a.name
RUN = f"/content/run/{N}"; ROOT = "/content/molde"; DR = f"molde-train/runs/{N}"
sets = " ".join(shlex.quote(s) for s in ["out_dir=" + RUN, f"data_dir={ROOT}/train/{a.data_dir}", f"lang={ROOT}/lang"] + a.set)

(d / "30_setup.py").write_text('''
import os, subprocess
os.makedirs("/content/molde", exist_ok=True); os.makedirs("/content/run", exist_ok=True)
cmd = ("(node -v 2>/dev/null | grep -q v20 || (wget -q https://nodejs.org/dist/v20.19.3/node-v20.19.3-linux-x64.tar.xz -O /tmp/node.txz && "
       "tar xJf /tmp/node.txz -C /usr/local --strip-components=1)); node -v; "
       "pip uninstall -y torchao 2>&1 | tail -1; pip install -q 'transformers==5.15.1' accelerate pyyaml gguf sentencepiece 2>&1 | tail -2; "
       "nvidia-smi --query-gpu=name,memory.total --format=csv")
r = subprocess.run(cmd, shell=True, capture_output=True, text=True); print(r.stdout, r.stderr[-800:])
assert r.returncode == 0, "setup failed"
''')
fetch = {a.inputs: "/content/molde_inputs.tgz"}
fetch.update(dict(kv.split("=", 1) for kv in a.extra_fetch))
(d / "31_fetch_inputs.drivefetch.json").write_text(json.dumps(fetch))
(d / "32_unpack.py").write_text('import subprocess\nr = subprocess.run("mkdir -p /content/molde && tar xzf /content/molde_inputs.tgz -C /content/molde && ls /content/molde /content/molde/train", shell=True, capture_output=True, text=True)\nprint(r.stdout, r.stderr[-500:])\nassert r.returncode == 0\n')
if a.resume_parts:
    (d / "34_fetch_ckpt.drivefetch.json").write_text(json.dumps({f"molde-train/runs/{N}/ckpt.tar.part{i:02d}": f"{RUN}/ckpt.tar.part{i:02d}" for i in range(a.resume_parts)} | {f"molde-train/runs/{N}/ckpt.tar.SHA256SUMS": f"{RUN}/ckpt.tar.SHA256SUMS"}))
    (d / "35_unpack_ckpt.py").write_text(f'import subprocess\nr = subprocess.run("python3 {ROOT}/train/colab/pack.py unpack {RUN}/ckpt {RUN}/ckpt", shell=True, capture_output=True, text=True)\nprint(r.stdout, r.stderr[-500:])\nassert r.returncode == 0\n')
cfg = shlex.quote(a.config)
(d / "33_smoke.py").write_text(f'''
import os, subprocess, sys, json
need = ["train/train.py", "train/eval_gen.py", "train/score.mjs", "train/{a.data_dir}/train.jsonl", "train/{a.data_dir}/test_refs.jsonl", "lang/mo.mjs", "lang/moldescript.gbnf", "train/{a.config}"]
miss = [n for n in need if not os.path.exists("{ROOT}/" + n) or os.path.getsize("{ROOT}/" + n) == 0]
assert not miss, "MISSING " + str(miss)
import torch, transformers, yaml
assert torch.cuda.is_available(), "no cuda"
cfg = yaml.safe_load(open("{ROOT}/train/{a.config}"))
from transformers import AutoTokenizer
tok = AutoTokenizer.from_pretrained(cfg["model"]); print("tokenizer ok", cfg["model"], len(tok))
r = subprocess.run("cd {ROOT} && node lang/mo.mjs check lang/examples/01-water.mo", shell=True, capture_output=True, text=True); print(r.stdout)
assert r.returncode == 0, "node/checker failed " + r.stderr
print("SMOKE_OK torch", torch.__version__, "cuda", torch.cuda.get_device_name(0), "transformers", transformers.__version__)
''')
HEART = '''
import subprocess, time, os
def heart(logpath, pattern, maxsec, proc):
    import re
    t0 = time.time(); last = 0; dead = 0
    while time.time() - t0 < maxsec:
        time.sleep(15)
        txt = open(logpath).read() if os.path.exists(logpath) else ""
        if re.search(pattern, txt): return txt
        alive = subprocess.run(["pgrep", "-f", proc], capture_output=True).returncode == 0
        dead = 0 if alive else dead + 1
        if dead >= 3:
            print("PROCESS DIED without a result (killed? out of memory?)"); return txt + " Traceback: process died"
        if time.time() - last > 45:
            print("hb", int(time.time() - t0), txt.strip().splitlines()[-1][:160] if txt.strip() else "(no output yet)", flush=True); last = time.time()
    return open(logpath).read() if os.path.exists(logpath) else ""
'''
if "train" in stages:
    cmd = f"cd {ROOT}/train && nohup python3 train.py --config {cfg} --set {sets} > {RUN}.train.log 2>&1 &"
    (d / "36_train.py").write_text(HEART + f'''
os.makedirs("{RUN}", exist_ok=True)
subprocess.Popen({cmd!r}, shell=True)
log = heart("{RUN}.train.log", "SFT_DONE|Traceback|PAUSE|NONFINITE", 2800, "train.py")
print(log[-1500:])
assert "Traceback" not in log and "NONFINITE" not in log, "train failed"
assert ("SFT_DONE" in log) or ("PAUSE" in log), "train did not finish in the job time"
print("TRAIN_END", "SFT_DONE" in log)
''')
if "train" in stages:
    (d / "37_pack_model.py").write_text(f'import subprocess, os\nfor c in ["python3 {ROOT}/train/colab/pack.py pack {RUN}/final {RUN}/final", "cp {RUN}.train.log {RUN}/train.stdout.log"]:\n    r = subprocess.run(c, shell=True, capture_output=True, text=True); print(c, r.stdout[-200:], r.stderr[-300:])\n    assert r.returncode == 0, c\n')
    (d / "37_save_model.drivesave.json").write_text(json.dumps({f"{RUN}/log.jsonl": DR, f"{RUN}/train.stdout.log": DR, f"{RUN}/final.tar.part00": DR, f"{RUN}/final.tar.SHA256SUMS": DR}))
if "eval" in stages:
    (d / "38_eval.py").write_text(HEART + f'''
cmd = "cd {ROOT}/train && python3 eval_gen.py --model {RUN}/final --data {a.data_dir} --out {RUN}/eval --lang {ROOT}/lang --chat_kwargs {shlex.quote(a.chat_kwargs)} > {RUN}.eval.log 2>&1; echo EVAL_FINISHED >> {RUN}.eval.log"
subprocess.Popen(cmd, shell=True)
log = heart("{RUN}.eval.log", "EVAL_FINISHED", 1500, "eval_gen.py")
print(log[-2500:])
assert "Traceback" not in log and "score.mjs failed" not in log, "eval failed"
assert os.path.exists("{RUN}/eval/metrics.json"), "no metrics"
''')
if "export" in stages:
    (d / "39_export.py").write_text(HEART + f'''
env = "QUANTS={shlex.quote(a.quants)}"
cmd = "cd {ROOT}/train && " + env + " bash export_gguf.sh {RUN}/final {N} {RUN}/gguf > {RUN}.export.log 2>&1; echo EXPORT_FINISHED >> {RUN}.export.log"
subprocess.Popen(cmd, shell=True)
log = heart("{RUN}.export.log", "EXPORT_FINISHED", 1500, "export_gguf|convert_hf|llama-quantize")
print(log[-2000:])
assert "EXPORT_OK" in log, "export failed"
''')
pk = ["true"]
if "eval" in stages:
    pk.append(f"python3 {ROOT}/train/colab/pack.py pack {RUN}/eval {RUN}/eval")
if "export" in stages and a.gguf_parts > 1:
    pk.append(f"python3 {ROOT}/train/colab/pack.py split {RUN}/gguf/{N}-f16.gguf && rm {RUN}/gguf/{N}-f16.gguf")
if a.ckpt_parts:
    pk.append(f"python3 {ROOT}/train/colab/pack.py pack {RUN}/ckpt {RUN}/ckpt")
(d / "40_pack.py").write_text(f'import subprocess\nfor c in {pk!r}:\n    r = subprocess.run(c, shell=True, capture_output=True, text=True); print(c, r.stdout[-300:], r.stderr[-300:])\n    assert r.returncode == 0, c\nprint(subprocess.run("ls -la {RUN} {RUN}/gguf", shell=True, capture_output=True, text=True).stdout)\n')
save = {}
if "eval" in stages:
    save |= {f"{RUN}/eval.tar.part00": DR, f"{RUN}/eval.tar.SHA256SUMS": DR, f"{RUN}/eval/metrics.json": DR}
if "export" in stages:
    save[f"{RUN}/gguf/SHA256SUMS"] = DR + "/gguf"
    for q in ["f16"] + a.quants.split():
        if q == "f16" and a.gguf_parts > 1:
            save |= {f"{RUN}/gguf/{N}-f16.gguf.part{i:02d}": DR + "/gguf" for i in range(a.gguf_parts)}
            save[f"{RUN}/gguf/{N}-f16.gguf.SHA256SUMS"] = DR + "/gguf"
        else:
            save[f"{RUN}/gguf/{N}-{q}.gguf"] = DR + "/gguf"
if a.ckpt_parts:
    save |= {f"{RUN}/ckpt.tar.part{i:02d}": DR for i in range(a.ckpt_parts)} | {f"{RUN}/ckpt.tar.SHA256SUMS": DR}
(d / "41_save.drivesave.json").write_text(json.dumps(save or {f"{RUN}/log.jsonl": DR}))
print("jobs written to", d, sorted(p.name for p in d.iterdir()))
