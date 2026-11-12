"""Check a critic verdict JSON. Prints short, field-named errors (never the whole JSON).
Usage: python3 -I tools/check-verdict.py verdict.json
Exit codes: 0 ok, 1 verdict rejected, 3 jsonschema not installed, 2 usage/file error."""
import json, os, sys, unicodedata

try:
    from jsonschema import Draft202012Validator
except ImportError:
    print("jsonschema not installed, see docs/process/gauntlet.md (Setup: python3 -m venv .venv && .venv/bin/pip install jsonschema)", file=sys.stderr)
    sys.exit(3)

here = os.path.dirname(os.path.abspath(__file__))
if len(sys.argv) != 2:
    sys.exit("usage: check-verdict.py verdict.json")
try:
    with open(sys.argv[1], encoding="utf-8-sig") as f:   # accepts a UTF-8 BOM
        d = json.load(f)
except json.JSONDecodeError as e:
    print(f"error: verdict is not valid JSON: {e.msg} at line {e.lineno} column {e.colno}", file=sys.stderr); sys.exit(1)
except UnicodeDecodeError:
    print("error: verdict is not UTF-8 text", file=sys.stderr); sys.exit(1)
except OSError as e:
    print(f"error: cannot read verdict file: {e.strerror}", file=sys.stderr); sys.exit(2)
with open(os.path.join(here, "verdict.schema.json"), encoding="utf-8") as f:
    schema = json.load(f)

# Characters that draw nothing: all Cc/Cf/Cs/Co/Cn/Z*, combining marks with no base, and filler letters.
FILLERS = {0x2800, 0x3164, 0x115F, 0x1160, 0xFFA0, 0x17B4, 0x17B5, 0x034F, 0x00AD, 0x180E}
def visible_count(s):
    n = 0
    for ch in s:
        if ord(ch) in FILLERS:
            continue
        if unicodedata.category(ch) in ("Cc", "Cf", "Cs", "Co", "Cn", "Zs", "Zl", "Zp", "Mn", "Me"):
            continue
        n += 1
    return n

def where(path):
    out = ""
    for p in path:
        out += f"[{p}]" if isinstance(p, int) else ("." if out else "") + str(p)
    return out or "(top level)"

def say(e):
    v = e.validator
    if v == "required":
        return "missing required field(s): " + ", ".join(r for r in e.validator_value if r not in e.instance)
    if v == "pattern":
        return "must contain visible text (blank or whitespace-only is not allowed)"
    if v == "maxLength":
        return f"too long ({len(e.instance)} characters, max {e.validator_value})"
    if v == "minLength":
        return f"too short ({len(e.instance)} characters, min {e.validator_value})"
    if v == "enum":
        return "must be one of " + ", ".join(map(str, e.validator_value))
    if v == "type":
        return f"must be of type {e.validator_value}"
    if v in ("minItems", "maxItems"):
        return f"{v} {e.validator_value} violated"
    if v in ("minimum", "maximum"):
        return f"must be {'>=' if v == 'minimum' else '<='} {e.validator_value}"
    if v == "additionalProperties":
        return "unknown field(s) not allowed: " + ", ".join(sorted(set(e.instance) - set(e.schema.get("properties", {}))))
    return str(e.message)[:100]

errs = []
# 1. strict integers (JSON schema alone accepts 1.0 and true as integers)
if isinstance(d, dict):
    for k in ("round", "issue"):
        if k in d and (type(d[k]) is not int):
            errs.append(f"{k}: must be a whole number written without a decimal point (got {type(d[k]).__name__})")
# 2. structure. The allOf rules are reported below in plain words instead.
for e in sorted(Draft202012Validator(schema).iter_errors(d), key=lambda e: list(map(str, e.absolute_path))):
    if "allOf" in e.relative_schema_path:
        continue
    if e.validator in ("type", "minimum", "maximum") and e.absolute_path and e.absolute_path[-1] in ("round", "issue") and len(e.absolute_path) == 1 and type(d.get(e.absolute_path[0])) is not int:
        continue   # already reported
    errs.append(f"{where(e.absolute_path)}: {say(e)}")
# 3. visible text (schema regex is best effort; this is the real check)
if not errs:
    def text_fields():
        yield "biggest_gap", d["biggest_gap"], 8
        yield "bar.name", d["bar"]["name"], 1
        yield "bar.pin", d["bar"]["pin"], 1
        yield "machine_check.link", d["machine_check"]["link"], 1
        for i, a in enumerate(d["acceptance"]):
            yield f"acceptance[{i}].line", a["line"], 1
            yield f"acceptance[{i}].evidence", a["evidence"], 1
        for i, n in enumerate(d.get("other_notes", [])):
            yield f"other_notes[{i}]", n, 1
        for i, n in enumerate(d["artifacts"]):
            yield f"artifacts[{i}]", n, 1
    for name, val, need in text_fields():
        if visible_count(val) < need:
            errs.append(f"{name}: needs at least {need} visible character{'s' if need > 1 else ''} (invisible, blank and filler characters do not count)")
if errs:
    for m in errs:
        print("error: " + m, file=sys.stderr)
    sys.exit(1)

bad = []
ab, ba = d["order_ab"], d["order_ba"]
failed = [i + 1 for i, a in enumerate(d["acceptance"]) if a["status"] != "PASS"]
machine_ok = d["machine_check"]["status"] == "PASS"
if ab == "bar" and ba == "bar":
    expected = "LOSS"
elif ab != ba:
    expected = "SPLIT"
else:
    expected = "WIN" if (machine_ok and not failed) else "LOSS"
if d["result"] != expected:
    why = f"order_ab={ab}, order_ba={ba}, machine_check={d['machine_check']['status']}, acceptance FAIL on lines {failed or 'none'}"
    bad.append(f"result: is {d['result']} but these say {expected} ({why}). "
               "WIN needs candidate chosen in both orders AND machine check PASS AND every acceptance line PASS; "
               "candidate chosen in both orders with a failed check is a LOSS")
if d["result"] == "WIN" and d["next"] != "ready to merge":
    bad.append("next: a WIN must say 'ready to merge'")
if d["result"] != "WIN" and d["next"] == "ready to merge":
    bad.append("next: only a WIN may say 'ready to merge'")
if d["round"] == 5 and d["result"] != "WIN" and d["next"] != "needs-human":
    bad.append("next: round 5 without a win must be 'needs-human'")
if d["next"] == "needs-human" and d["round"] != 5:
    bad.append("next: 'needs-human' is only valid at round 5 (rounds 1-4 without a win must say 'builder fixes the biggest gap')")
for b in bad:
    print("error: " + b, file=sys.stderr)
sys.exit(1 if bad else 0)
