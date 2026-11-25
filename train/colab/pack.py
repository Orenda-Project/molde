#!/usr/bin/env python3
"""Pack/unpack big things for Drive (the connector times out on single files near 1 GB; parts are <= 900 MB).
  pack.py pack DIR OUT_PREFIX      -> OUT_PREFIX.tar.part00.. + OUT_PREFIX.SHA256SUMS (parts + whole-tar hash)
  pack.py unpack OUT_PREFIX DEST   -> verifies hashes, rebuilds and extracts into DEST
  pack.py split FILE               -> FILE.part00.. + FILE.SHA256SUMS (for a single big file, e.g. an f16 GGUF)"""
import hashlib, io, pathlib, subprocess, sys, tarfile

PART = 900 * 1000 * 1000


def write_parts(stream, prefix):
    sums, whole, i = [], hashlib.sha256(), 0
    while chunk := stream.read(PART):
        p = pathlib.Path(f"{prefix}.part{i:02d}"); p.write_bytes(chunk); whole.update(chunk)
        sums.append(f"{hashlib.sha256(chunk).hexdigest()}  {p.name}"); i += 1
    sums.append(f"{whole.hexdigest()}  WHOLE")
    pathlib.Path(f"{prefix}.SHA256SUMS").write_text("\n".join(sums) + "\n")
    print("PARTS", i, sums)


def main():
    a = sys.argv[1:]
    if a[0] == "pack":
        d, prefix = a[1], a[2]
        pathlib.Path(prefix).parent.mkdir(parents=True, exist_ok=True)
        tmp = pathlib.Path(prefix + ".tar"); subprocess.run(["tar", "cf", str(tmp), "-C", d, "."], check=True)
        with open(tmp, "rb") as f: write_parts(f, prefix + ".tar")
        tmp.unlink()
    elif a[0] == "split":
        with open(a[1], "rb") as f: write_parts(f, a[1])
    elif a[0] == "unpack":
        prefix, dest = a[1], a[2]; pre = pathlib.Path(prefix)
        lines = pathlib.Path(prefix + ".tar.SHA256SUMS").read_text().split("\n")
        whole = hashlib.sha256(); tar = pathlib.Path(prefix + ".tar.rebuilt")
        with open(tar, "wb") as out:
            for l in lines:
                if not l.strip() or l.endswith("WHOLE"): continue
                h, name = l.split(); b = (pre.parent / name).read_bytes()
                assert hashlib.sha256(b).hexdigest() == h, "bad hash " + name
                out.write(b); whole.update(b)
        want = [l.split()[0] for l in lines if l.endswith("WHOLE")][0]
        assert whole.hexdigest() == want, "bad whole hash"
        pathlib.Path(dest).mkdir(parents=True, exist_ok=True)
        subprocess.run(["tar", "xf", str(tar), "-C", dest], check=True); tar.unlink(); print("UNPACKED", dest)


if __name__ == "__main__":
    main()
