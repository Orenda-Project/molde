"""Check a critic verdict JSON. Prints short, field-named errors (never the whole JSON).
Usage: python3 -I tools/check-verdict.py verdict.json   (needs jsonschema)"""
import json, os, sys
from jsonschema import Draft202012Validator

here = os.path.dirname(os.path.abspath(__file__))
try:
    with open(sys.argv[1], encoding="utf-8") as f:
        d = json.load(f)
except json.JSONDecodeError as e:
    sys.exit(f"verdict is not valid JSON: {e.msg} at line {e.lineno} column {e.colno}")
except OSError as e:
    sys.exit(f"cannot read verdict file: {e.strerror}")
with open(os.path.join(here, "verdict.schema.json"), encoding="utf-8") as f:
    schema = json.load(f)

def where(e):
    out = ""
    for p in e.absolute_path:
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

# Structure errors. The allOf rules are reported below in plain words instead.
errs = [e for e in Draft202012Validator(schema).iter_errors(d) if "allOf" not in e.relative_schema_path]
if errs:
    for e in sorted(errs, key=lambda e: list(map(str, e.absolute_path))):
        print(f"error: {where(e)}: {say(e)}", file=sys.stderr)
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
for b in bad:
    print("error: " + b, file=sys.stderr)
sys.exit(1 if bad else 0)
