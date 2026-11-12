#!/usr/bin/env bash
# Create or update every label and milestone in .github/labels.yml.
# Usage: bash tools/sync-labels.sh [--dry-run] [--repo OWNER/NAME]
set -euo pipefail
cd "$(dirname "$0")/.."
DRY=0; REPO="Orenda-Project/molde"
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY=1 ;;
    --repo) REPO="$2"; shift ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
  shift
done
run() { if [ "$DRY" = 1 ]; then printf '[dry-run] %s\n' "$*"; else "$@"; fi; }
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
    run gh label create "$name" -R "$REPO" --color "$color" --description "$desc" --force
  elif [ "$section" = milestones ]; then
    run gh api "repos/$REPO/milestones" -f "title=$item"
  fi
done < .github/labels.yml
