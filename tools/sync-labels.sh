#!/usr/bin/env bash
# Create or update every label and milestone in .github/labels.yml. Safe to re-run.
# Usage: bash tools/sync-labels.sh [--dry-run] [--repo OWNER/NAME]
# Default repo: Orenda-Project/molde (override with --repo when working in a fork).
# Labels use --force (update in place); milestones are created only if the title is missing.
set -euo pipefail
cd "$(dirname "$0")/.."
DRY=0; REPO="Orenda-Project/molde"
die() { echo "error: $*" >&2; exit 2; }
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY=1 ;;
    --repo) [ $# -ge 2 ] || die "--repo needs a value"; REPO="$2"; shift ;;
    *) die "unknown arg: $1" ;;
  esac
  shift
done
[[ "$REPO" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] && [ "${REPO%%/*}" != . ] && [ "${REPO%%/*}" != .. ] \
  && [ "${REPO##*/}" != . ] && [ "${REPO##*/}" != .. ] || die "--repo must look like OWNER/NAME, got: $REPO"
EXISTING=""
if [ "$DRY" = 0 ]; then
  EXISTING=$(gh api "repos/$REPO/milestones?state=all&per_page=100" --paginate --jq '.[].title')
fi
section=""
while IFS= read -r line; do
  case "$line" in
    labels:) section=labels; continue ;;
    milestones:) section=milestones; continue ;;
    "  - "*) ;;
    *) continue ;;
  esac
  item="${line#  - }"
  if [ "$section" = labels ]; then
    IFS='|' read -r name color desc <<<"$item"
    name="$(echo "$name" | xargs)"; color="$(echo "$color" | xargs)"; desc="$(echo "$desc" | xargs)"
    if [ "$DRY" = 1 ]; then echo "[dry-run] gh label create $name -R $REPO --color $color --description \"$desc\" --force"
    else gh label create "$name" -R "$REPO" --color "$color" --description "$desc" --force; fi
  elif [ "$section" = milestones ]; then
    if [ "$DRY" = 1 ]; then echo "[dry-run] create milestone if missing: $item  (repo $REPO)"
    elif grep -Fxq -- "$item" <<<"$EXISTING"; then echo "milestone exists, skipped: $item"
    else gh api "repos/$REPO/milestones" -f "title=$item" --jq '"milestone created: " + .title'; fi
  fi
done < .github/labels.yml
