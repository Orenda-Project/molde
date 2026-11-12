#!/usr/bin/env bash
# Make two blind A/B packs (one per critic) from our artifact and the bar's artifact.
# Usage: bash tools/make-blind.sh [--issue-file ISSUE.md] [--force] <ours> <bar> <outdir>
#   <ours> and <bar> are single files (screenshot, text, output). Folders are refused (their inner
#   names would give us away) unless --force, which copies them as they are.
# Creates:  <outdir>/critic1/{A,B}.<ext> (+ ISSUE.md)   <outdir>/critic2/{A,B}.<ext> (+ ISSUE.md)
#           <outdir>.KEY.private.txt   <- NEXT TO the pack folder, never inside it
# In one pack A is ours, in the other A is the bar; which pack is critic1 is a coin flip.
# File names are normalised: same extension is kept; two different text types both become .txt;
# anything else mixed (e.g. .png vs .jpg) is refused so the extension cannot reveal which is ours.
# Run it as the dispatcher, put <outdir> OUTSIDE the repo (so no repo CLAUDE.md loads), and hand each
# critic only its own critic folder. Never show the key to a critic.
set -euo pipefail
die() { echo "error: $*" >&2; exit 2; }
FORCE=0; ISSUE_FILE=""; ARGS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --force) FORCE=1 ;;
    --issue-file) [ $# -ge 2 ] || die "--issue-file needs a value"; ISSUE_FILE="$2"; shift ;;
    -*) die "unknown flag: $1" ;;
    *) ARGS+=("$1") ;;
  esac
  shift
done
[ ${#ARGS[@]} -eq 3 ] || die "usage: make-blind.sh [--issue-file ISSUE.md] [--force] <ours> <bar> <outdir>"
OURS="${ARGS[0]}"; BAR="${ARGS[1]}"; OUT="${ARGS[2]%/}"
[ -e "$OURS" ] || die "not found: $OURS"
[ -e "$BAR" ] || die "not found: $BAR"
[ -z "$ISSUE_FILE" ] || [ -f "$ISSUE_FILE" ] || die "not found: $ISSUE_FILE"
KEY="$OUT.KEY.private.txt"
[ ! -e "$KEY" ] || die "$KEY already exists; remove it or pick a new outdir"
[ ! -e "$OUT" ] || [ -z "$(ls -A "$OUT")" ] || die "$OUT exists and is not empty"

ext() { local f; f="$(basename "$1")"; case "$f" in *.*) echo ".${f##*.}" ;; *) echo "" ;; esac; }
istext() { case "$(file -b --mime-type "$1")" in text/*|application/json) return 0 ;; *) return 1 ;; esac; }
if [ -d "$OURS" ] || [ -d "$BAR" ]; then
  [ "$FORCE" = 1 ] || die "folders are refused: file names inside them can reveal which side is ours. Make each artifact a single file (screenshot, text, PDF), or pass --force to copy folders as they are"
  echo "warning: --force: folder contents are copied with their inner names; strip anything that shows which side is ours" >&2
  EO=""; EB=""
else
  EO="$(ext "$OURS")"; EB="$(ext "$BAR")"
  if [ "$EO" != "$EB" ]; then
    if istext "$OURS" && istext "$BAR"; then EO=.txt; EB=.txt
    elif [ "$FORCE" = 1 ]; then echo "warning: --force: extensions differ ($EO vs $EB); the extension may reveal which is ours" >&2
    else die "extensions differ ($EO vs $EB) and the files are not both text, so the file type would reveal which is ours. Convert both to one format (e.g. PNG screenshots), or pass --force"
    fi
  fi
fi
PARENT="$(cd "$(dirname "$OUT")" 2>/dev/null && pwd || echo /nonexistent)"
case "$PARENT/" in
  "$(git -C "$PARENT" rev-parse --show-toplevel 2>/dev/null || echo /nonexistent-root)"/*) echo "warning: $OUT is inside a git repo; a critic started there may load the repo's CLAUDE.md. Use a folder outside it (e.g. \$(mktemp -d)/pack)" >&2 ;;
esac
mkdir -p "$OUT/critic1" "$OUT/critic2"
if [ $(( $(od -An -N1 -tu1 /dev/urandom) % 2 )) -eq 0 ]; then FIRST=ab; else FIRST=ba; fi
mk() { # $1 dir, $2 ab|ba      ab: A = ours, B = bar     ba: A = bar, B = ours
  if [ "$2" = ab ]; then cp -R "$OURS" "$1/A$EO"; cp -R "$BAR" "$1/B$EB"; else cp -R "$BAR" "$1/A$EB"; cp -R "$OURS" "$1/B$EO"; fi
  [ -z "$ISSUE_FILE" ] || cp "$ISSUE_FILE" "$1/ISSUE.md"
}
if [ "$FIRST" = ab ]; then mk "$OUT/critic1" ab; mk "$OUT/critic2" ba; else mk "$OUT/critic1" ba; mk "$OUT/critic2" ab; fi
umask 077
{
  echo "PRIVATE KEY - do not show to critics"
  echo "ours (candidate): $OURS"; echo "bar: $BAR"
  if [ "$FIRST" = ab ]; then
    echo "critic1: A=candidate, B=bar   -> its pick is order_ab (A -> candidate, B -> bar)"
    echo "critic2: A=bar, B=candidate   -> its pick is order_ba (A -> bar, B -> candidate)"
  else
    echo "critic1: A=bar, B=candidate   -> its pick is order_ba (A -> bar, B -> candidate)"
    echo "critic2: A=candidate, B=bar   -> its pick is order_ab (A -> candidate, B -> bar)"
  fi
} > "$KEY"
echo "packs: $OUT/critic1 and $OUT/critic2"
echo "key:   $KEY"
