#!/usr/bin/env bash
# Validate a critic verdict (JSON), render the fixed comment format from
# docs/plan/04-product-process.md section 6, post it to the issue, and move labels.
# Usage: bash tools/post-verdict.sh [--dry-run] [--force-repost] [--issue N] [--repo OWNER/NAME] verdict.json
# Refuses (exit 6) if the issue already has a '### Critic verdict, round N' comment for this round; --force-repost overrides.
# Default repo: Orenda-Project/molde (override with --repo when working in a fork).
# Needs: bash, jq, python3 + jsonschema (see docs/process/gauntlet.md Setup), gh (not needed with --dry-run).
# Python: uses $PYTHON if set, else ./.venv/bin/python if present, else python3.
# Exit codes: 0 ok, 1 verdict rejected, 2 bad usage, 3 jsonschema missing, 4 comment posted but labels not moved, 5 gh failed before posting, 6 round already posted.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$HERE")"
DRY=0; FORCE_REPOST=0; REPO="Orenda-Project/molde"; ISSUE=""; FILE=""
die() { local code="$1"; shift; echo "error: $*" >&2; exit "$code"; }
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY=1 ;;
    --force-repost) FORCE_REPOST=1 ;;
    --issue) [ $# -ge 2 ] || die 2 "--issue needs a value"; ISSUE="$2"; shift ;;
    --repo) [ $# -ge 2 ] || die 2 "--repo needs a value"; REPO="$2"; shift ;;
    -*) die 2 "unknown flag: $1" ;;
    *) [ -z "$FILE" ] || die 2 "only one verdict file allowed (got '$FILE' and '$1')"; FILE="$1" ;;
  esac
  shift
done
[ -n "$FILE" ] && [ -f "$FILE" ] || die 2 "usage: post-verdict.sh [--dry-run] [--issue N] [--repo OWNER/NAME] verdict.json"
[[ "$REPO" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] && [ "${REPO%%/*}" != . ] && [ "${REPO%%/*}" != .. ] \
  && [ "${REPO##*/}" != . ] && [ "${REPO##*/}" != .. ] || die 2 "--repo must look like OWNER/NAME, got: $REPO"
if [ -n "$ISSUE" ]; then [[ "$ISSUE" =~ ^[1-9][0-9]*$ ]] || die 2 "--issue must be a positive integer, got: $ISSUE"; fi

if [ -n "${PYTHON:-}" ]; then PY="$PYTHON"; elif [ -x "$ROOT/.venv/bin/python" ]; then PY="$ROOT/.venv/bin/python"; else PY=python3; fi

# 1. structure + merge rules, with short field-named errors. Nothing is posted before this passes.
set +e; "$PY" -I "$HERE/check-verdict.py" "$FILE"; rc=$?; set -e
case "$rc" in
  0) ;;
  3) exit 3 ;;                                   # checker already printed the one-line jsonschema message
  1) die 1 "verdict rejected (see errors above); nothing was posted" ;;
  *) die 2 "could not check the verdict file" ;;
esac

# 2. issue number: flag and JSON must agree
JISSUE=$(jq -r '.issue // empty' "$FILE")
if [ -n "$ISSUE" ] && [ -n "$JISSUE" ] && [ "$ISSUE" != "$JISSUE" ]; then
  die 1 "--issue $ISSUE disagrees with \"issue\": $JISSUE in the JSON; fix one of them"
fi
[ -n "$ISSUE" ] || ISSUE="$JISSUE"
[ -n "$ISSUE" ] || die 1 "no issue number: pass --issue N or set \"issue\" in the JSON"
ROUND=$(jq -r .round "$FILE"); RESULT=$(jq -r .result "$FILE")

# 3. render the comment. Free text: control chars (NUL, ESC...) removed, flattened to one line, & and < escaped,
#    @mentions, #123 references, leading # or >, "![" and "](" broken with a zero-width space. Urdu text is untouched.
BODY=$(jq -r '
  def z: "​";
  def c: tostring | gsub("\u0000";"") | gsub("[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]";"")
         | gsub("[\\r\\n\\t]+"; " ") | gsub("^\\s+|\\s+$"; "")
         | gsub("&"; "&amp;") | gsub("<"; "&lt;") | gsub("@"; "@" + z)
         | gsub("(?<s>https?://|ftp://)"; .s + z; "i") | gsub("(?<w>www)\\."; .w + z + "."; "i")
         | gsub("(?<g>GH-)(?<n>[0-9])"; .g + z + .n; "i")
         | gsub("!\\["; "!" + z + "[") | gsub("\\]\\("; "]" + z + "(")
         | gsub("#(?<n>[0-9])"; "#" + z + .n) | gsub("^(?<h>[#>])"; z + .h);
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
ADD_LIST=("round:$ROUND"); REM_LIST=()
for n in 1 2 3 4 5; do [ "$n" = "$ROUND" ] || REM_LIST+=("round:$n"); done
if [ "$RESULT" = WIN ]; then
  ADD_LIST+=(state:won); REM_LIST+=(state:building state:critic state:needs-human)
elif [ "$ROUND" = 5 ]; then
  ADD_LIST+=(state:needs-human); REM_LIST+=(state:building state:critic state:won)
else
  ADD_LIST+=(state:building); REM_LIST+=(state:critic state:won state:needs-human)
fi
join() { local IFS=,; echo "$*"; }
ADD="$(join "${ADD_LIST[@]}")"; REM="$(join "${REM_LIST[@]}")"
edit_cmd() { local c="gh issue edit $ISSUE -R $REPO --add-label $ADD"; [ -z "$REM" ] || c="$c --remove-label $REM"; echo "$c"; }
EDIT_CMD="$(edit_cmd)"

if [ "$DRY" = 1 ]; then
  printf '%s\n\n' "$BODY"
  echo "[dry-run] refuse (exit 6) if a '### Critic verdict, round $ROUND' comment already exists on #$ISSUE, unless --force-repost"
  echo "[dry-run] ensure labels exist (create any missing from .github/labels.yml): $ADD"
  echo "[dry-run] gh issue comment $ISSUE -R $REPO --body-file -"
  echo "[dry-run] (labels to remove that do not exist in the repo are skipped)"
  echo "[dry-run] $EDIT_CMD"
  exit 0
fi

# 5. one guarded step. Everything that can fail cheaply runs BEFORE the comment is posted.
command -v gh >/dev/null || die 5 "gh not found"
HAVE=$(gh label list -R "$REPO" --limit 500 --json name -q '.[].name') || die 5 "cannot list labels in $REPO; nothing was posted"
# a verdict for this round must not be posted twice
if [ "$FORCE_REPOST" = 0 ]; then
  BODIES=$(gh issue view "$ISSUE" -R "$REPO" --json comments -q '.comments[].body') || die 5 "cannot read comments on #$ISSUE; nothing was posted"
  if grep -qx "### Critic verdict, round $ROUND" <<<"$BODIES"; then
    die 6 "#$ISSUE already has a 'Critic verdict, round $ROUND' comment; nothing was posted. Use --force-repost if you really mean to post it again"
  fi
fi
# labels to remove that do not exist in the repo cannot be on the issue: skip them
KEEP=(); for l in "${REM_LIST[@]}"; do grep -Fxq -- "$l" <<<"$HAVE" && KEEP+=("$l"); done
REM="$(join "${KEEP[@]}")"; EDIT_CMD="$(edit_cmd)"
for l in "${ADD_LIST[@]}"; do
  grep -Fxq -- "$l" <<<"$HAVE" && continue
  line=$(grep -F -- "  - $l |" "$ROOT/.github/labels.yml" || true)
  color=$(echo "$line" | cut -d'|' -f2 | xargs); desc=$(echo "$line" | cut -d'|' -f3- | xargs)
  gh label create "$l" -R "$REPO" --color "${color:-ededed}" --description "${desc:-created by post-verdict.sh}" >/dev/null \
    || die 5 "label $l does not exist and could not be created; nothing was posted"
done
printf '%s\n' "$BODY" | gh issue comment "$ISSUE" -R "$REPO" --body-file - || die 5 "gh issue comment failed; nothing was posted"
if ! $EDIT_CMD; then
  echo "################################################################" >&2
  echo "COMMENT POSTED, LABELS NOT MOVED: run this command to finish:" >&2
  echo "  $EDIT_CMD" >&2
  echo "################################################################" >&2
  exit 4
fi
