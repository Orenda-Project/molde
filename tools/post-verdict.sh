#!/usr/bin/env bash
# Validate a critic verdict (JSON), render the fixed comment format from
# docs/plan/04-product-process.md section 6, post it to the issue, and move labels.
# Usage: bash tools/post-verdict.sh [--dry-run] [--issue N] [--repo OWNER/NAME] verdict.json
# Needs: bash, jq, python3 + jsonschema, gh (not needed with --dry-run).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
DRY=0; REPO="Orenda-Project/molde"; ISSUE=""; FILE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY=1 ;;
    --issue) ISSUE="$2"; shift ;;
    --repo) REPO="$2"; shift ;;
    -*) echo "unknown flag: $1" >&2; exit 2 ;;
    *) FILE="$1" ;;
  esac
  shift
done
[ -n "$FILE" ] && [ -f "$FILE" ] || { echo "usage: post-verdict.sh [--dry-run] [--issue N] verdict.json" >&2; exit 2; }

# 1. schema check (this is what rejects a missing biggest_gap)
python3 -I -m jsonschema -i "$FILE" "$HERE/verdict.schema.json" >&2 || { echo "verdict rejected: does not match tools/verdict.schema.json" >&2; exit 1; }

# 2. rules the schema cannot say
ROUND=$(jq -r .round "$FILE")
jq -e '(.order_ab == "candidate" and .order_ba == "candidate" and .result == "WIN")
    or (.order_ab == "bar" and .order_ba == "bar" and .result == "LOSS")
    or (.order_ab != .order_ba and .result == "SPLIT")' "$FILE" >/dev/null \
  || { echo "verdict rejected: result does not match the two orders (WIN=both candidate, LOSS=both bar, SPLIT=differ)" >&2; exit 1; }
if [ "$ROUND" = 5 ] && [ "$(jq -r .result "$FILE")" != WIN ] && [ "$(jq -r .next "$FILE")" != needs-human ]; then
  echo "verdict rejected: round 5 without a win must have next = needs-human" >&2; exit 1
fi
[ -n "$ISSUE" ] || ISSUE=$(jq -r '.issue // empty' "$FILE")
[ -n "$ISSUE" ] || { echo "no issue number: pass --issue N or set \"issue\" in the JSON" >&2; exit 1; }

# 3. render the comment
BODY=$(jq -r '
  "### Critic verdict, round \(.round)\n" +
  "Bar: \(.bar.name) @ \(.bar.pin)\n" +
  "Order A/B: \(.order_ab) chosen | Order B/A: \(.order_ba) chosen\n" +
  "Result: \(.result)\n" +
  "Biggest gap: \(.biggest_gap)\n" +
  "Acceptance: " + ([.acceptance | to_entries[] | "line \(.key + 1) \(.value.status)" + (if .value.score then " \(.value.score)/5" else "" end) + " (\(.value.evidence))"] | join(" ; ")) + "\n" +
  "Machine check: \(.machine_check.status) (\(.machine_check.link))\n" +
  "Other notes (max 3): " + (if (.other_notes // []) | length == 0 then "none" else (.other_notes | join(" ; ")) end) + "\n" +
  "Artifacts: \(.artifacts | join(", "))\n" +
  "Next: \(.next)"' "$FILE")

# 4. label moves
RESULT=$(jq -r .result "$FILE")
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
