"""python3 -m unittest discover -s train/tests   (from the repo root; needs transformers, node, and the SmolLM2-135M tokenizer)"""
import json, pathlib, subprocess, sys, unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "train" / "tokens")); sys.path.insert(0, str(ROOT / "train"))


class Tokens(unittest.TestCase):
    def test_every_example_round_trips_with_and_without_added_tokens(self):
        from transformers import AutoTokenizer
        from molde_tokens import add_molde_tokens, roundtrip
        files = sorted((ROOT / "lang/examples").glob("*.mo")) + sorted((ROOT / "lang/examples/edits").glob("*/*.mo"))
        self.assertGreaterEqual(len(files), 70)
        tok = AutoTokenizer.from_pretrained("HuggingFaceTB/SmolLM2-135M-Instruct")
        for f in files:
            self.assertTrue(roundtrip(tok, f.read_text())[0], f"plain {f}")
        new, _ = add_molde_tokens(tok, None, str(ROOT / "lang"))
        self.assertGreater(len(new), 50)
        for f in files:
            self.assertTrue(roundtrip(tok, f.read_text())[0], f"with added tokens {f}")


class Dataset(unittest.TestCase):
    def test_splits_and_targets(self):
        out = ROOT / "train/data/out"
        rd = lambda n: [json.loads(l) for l in open(out / n)]
        tr, va, te = rd("train.jsonl"), rd("val.jsonl"), rd("test.jsonl")
        ids = lambda r: {x["id"] for x in r}
        self.assertFalse(ids(tr) & ids(te)); self.assertFalse(ids(va) & ids(te)); self.assertFalse(ids(tr) & ids(va))
        norm = lambda m: m[1]["content"].split("\n", 1)[0].split(": ", 1)[-1].strip().lower()
        self.assertFalse({norm(x["messages"]) for x in tr} & {norm(x["messages"]) for x in te})
        self.assertEqual(sum(1 for x in te if x["src"] == "corpus"), 40)
        for x in tr[:25] + te[:10]:
            p = pathlib.Path("/tmp/molde-test-target.mo"); p.write_text(x["messages"][2]["content"])
            r = subprocess.run(["node", str(ROOT / "lang/mo.mjs"), "check", str(p)], capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, x["id"] + r.stdout)


if __name__ == "__main__":
    unittest.main()
