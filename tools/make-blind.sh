#!/usr/bin/env bash
# Make two blind A/B packs (one per critic) from our artifact and the bar's artifact.
# Usage: bash tools/make-blind.sh <ours> <bar> <outdir>      (each is a file or a folder)
# Creates:  <outdir>/critic1/{A,B}.<ext>   <outdir>/critic2/{A,B}.<ext>   <outdir>/KEY.private.txt
# In one pack A is ours, in the other A is the bar; which pack is critic1 is a coin flip.
# KEY.private.txt says which is which. Hand each critic ONLY its own critic folder. Run this as the
# person dispatching the critics, and do not give KEY.private.txt to either critic.
# Inside a folder artifact, file names are kept: rename or strip anything that shows which side is ours.
set -euo pipefail
[ $# -eq 3 ] || { echo "usage: make-blind.sh <ours> <bar> <outdir>" >&2; exit 2; }
OURS="$1"; BAR="$2"; OUT="$3"
[ -e "$OURS" ] || { echo "error: not found: $OURS" >&2; exit 2; }
[ -e "$BAR" ] || { echo "error: not found: $BAR" >&2; exit 2; }
[ ! -e "$OUT" ] || [ -z "$(ls -A "$OUT")" ] || { echo "error: $OUT exists and is not empty" >&2; exit 2; }
mkdir -p "$OUT/critic1" "$OUT/critic2"
ext() { if [ -d "$1" ]; then echo ""; else f="$(basename "$1")"; case "$f" in *.*) echo ".${f##*.}" ;; *) echo "" ;; esac; fi; }
put() { cp -R "$1" "$2"; }   # $1 source, $2 destination path
EO="$(ext "$OURS")"; EB="$(ext "$BAR")"
if [ $(( $(od -An -N1 -tu1 /dev/urandom) % 2 )) -eq 0 ]; then FIRST=ab; else FIRST=ba; fi
# pack "ab": A = ours (candidate), B = bar.   pack "ba": A = bar, B = ours.
mk() { # $1 dir, $2 ab|ba
  if [ "$2" = ab ]; then put "$OURS" "$1/A$EO"; put "$BAR" "$1/B$EB"; else put "$BAR" "$1/A$EB"; put "$OURS" "$1/B$EO"; fi
}
if [ "$FIRST" = ab ]; then mk "$OUT/critic1" ab; mk "$OUT/critic2" ba; else mk "$OUT/critic1" ba; mk "$OUT/critic2" ab; fi
{
  echo "PRIVATE KEY - do not show to critics"
  echo "ours (candidate): $OURS"; echo "bar: $BAR"
  if [ "$FIRST" = ab ]; then
    echo "critic1: A=candidate, B=bar   -> its answer is order_ab"
    echo "critic2: A=bar, B=candidate   -> its answer is order_ba"
  else
    echo "critic1: A=bar, B=candidate   -> its answer is order_ba"
    echo "critic2: A=candidate, B=bar   -> its answer is order_ab"
  fi
  echo "A critic answering 'A' or 'B' maps to candidate or bar using the lines above."
} > "$OUT/KEY.private.txt"
chmod 600 "$OUT/KEY.private.txt"
echo "wrote $OUT/critic1 and $OUT/critic2; key in $OUT/KEY.private.txt"
