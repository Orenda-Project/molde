#!/usr/bin/env bash
# Validate a critic verdict (JSON), render the fixed comment format from
# docs/plan/04-product-process.md section 6, post it to the issue, and move labels.
# Usage: bash tools/post-verdict.sh [--dry-run] [--issue N] [--repo OWNER/NAME] verdict.json
# Default repo: Orenda-Project/molde (override with --repo when working in a fork).
# Needs: bash, jq, python3 + jsonschema, gh (gh is not needed with --dry-run).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
DRY=0; REPO="Orenda-Project/molde"; ISSUE=""; FILE=""
die() { echo "error: $*" >&2; exit "${2:-1}"; }
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY=1 ;;
    --issue) [ $# -ge 2 ] || die "--issue needs a value" 2; ISSUE="$2"; shift ;;
    --repo) [ $# -ge 2 ] || die "--repo needs a value" 2; REPO="$2"; shift ;;
    -*) die "unknown flag: $1" 2 ;;
    *) FILE="$1" ;;
  esac
  shift
done
[ -n "$FILE" ] && [ -f "$FILE" ] || die "usage: post-verdict.sh [--dry-run] [--issue N] [--repo OWNER/NAME] verdict.json" 2
[[ "$REPO" =~ ^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$ ]] || die "--repo must look like OWNER/NAME, got: $REPO" 2
if [ -n "$ISSUE" ]; then [[ "$ISSUE" =~ ^[1-9][0-9]*$ ]] || die "--issue must be a positive integer, got: $ISSUE" 2; fi

# 1. structure + merge rules, with short field-named errors
python3 -I "$HERE/check-verdict.py" "$FILE" || die "verdict rejected (see errors above); nothing was posted"

# 2. issue number
[ -n "$ISSUE" ] || ISSUE=$(jq -r '.issue // empty' "$FILE")
[ -n "$ISSUE" ] || die "no issue number: pass --issue N or set \"issue\" in the JSON"
ROUND=$(jq -r .round "$FILE"); RESULT=$(jq -r .result "$FILE")

# 3. render the comment. Free text is flattened to one line, HTML-escaped, and
#    @mentions / a leading # or > are broken with a zero-width space. Urdu text is untouched.
BODY=$(jq -r '
  def c: tostring | gsub("[\\r\\n\\t]+"; " ") | gsub("^\\s+|\\s+$"; "") | gsub("&"; "&amp;") | gsub("<"; "&lt;")
         | gsub("@"; "@​") | gsub("^(?<h>[#>])"; "​\(.h)");
  "### Critic verdict, round \(.round)\n" +
  "Bar: \(.bar.name | c) @ \(.bar.pin | c)\n" +
  "Order A/B: \(.order_ab) chosen | Order B/A: \(.order_ba) chosen\n" +
  "Result: \(.result)\n" +
  "Biggest gap: \(.biggest_gap | c)\n" +
  "Acceptance: " + ([.acceptance | to_entries[] | "line \(.key + 1) \"\(.value.line | c)\" \(.value.status)" + (if .value.score then " \(.value.score)/5" else "" end) + " (\(.value.evidence | c))"] | join(" ; ")) + "\n" +
  "Machine check: \(.machine_check.status) (\(.machine_check.link | c))\n" +
  "Other notes (max 3): " + (if (.other_notes // []) | length == 0 then "none" else ([.other_notes[] | c] | join(" ; ")) end) + "\n" +
  "Artifacts: \([.artifacts[] | c] | join(", "))\n" +
  "Next: \(.next)"' "$FILE")

# 4. label moves: WIN -> state:won; LOSS/SPLIT -> state:building; round 5 without a win -> state:needs-human
ADD="round:$ROUND"; REM=""
for n in 1 2 3 4 5; do [ "$n" = "$ROUND" ] || REM="$REM,round:$n"; done
if [ "$RESULT" = WIN ]; then
  ADD="$ADD,state:won"; REM="$REM,state:building,state:critic,state:needs-human"
elif [ "$ROUND" = 5 ]; then
  ADD="$ADD,state:needs-human"; REM="$REM,state:building,state:critic,state:won"
else
  ADD="$ADD,state:building"; REM="$REM,state:critic,state:won,state:needs-human"
fi
REM="${REM#,}"

if [ "$DRY" = 1 ]; then
  printf '%s\n\n' "$BODY"
  echo "[dry-run] gh issue comment $ISSUE -R $REPO --body-file -"
  echo "[dry-run] gh issue edit $ISSUE -R $REPO --add-label $ADD --remove-label $REM"
  exit 0
fi
printf '%s\n' "$BODY" | gh issue comment "$ISSUE" -R "$REPO" --body-file -
gh issue edit "$ISSUE" -R "$REPO" --add-label "$ADD" --remove-label "$REM"
