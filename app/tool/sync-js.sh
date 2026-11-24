#!/usr/bin/env bash
# One command to pull the latest language, renderer and decoder from their branches and rebuild the bundle.
#   app/tool/sync-js.sh            # fetch origin, export sources into app/js/vendor, bundle with esbuild
#   MOLDE_REPO=/path/to/clone app/tool/sync-js.sh
# Branch overrides: LANG_REF, RENDER_REF, DECODE_REF (default origin/phase-0-language, origin/phase-1-renderer, origin/phase-2-decode).
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
REPO="${MOLDE_REPO:-$(git -C "$HERE" rev-parse --show-toplevel)}"
LANG_REF="${LANG_REF:-origin/phase-0-language}"
RENDER_REF="${RENDER_REF:-origin/phase-1-renderer}"
DECODE_REF="${DECODE_REF:-origin/phase-2-decode}"
[ "${NO_FETCH:-}" = 1 ] || git -C "$REPO" fetch -q origin
V="$HERE/js/vendor"
# lang/*.mjs + lang/std + moldescript.gbnf
rm -rf "$V/lang" "$V/render" "$V/decode"; mkdir -p "$V/lang" "$V/render" "$V/decode"
git -C "$REPO" archive "$LANG_REF" lang | tar -x -C "$V/lang" --strip-components=1
git -C "$REPO" archive "$RENDER_REF" runtime/web | tar -x -C "$V/render" --strip-components=2
git -C "$REPO" archive "$DECODE_REF" decode | tar -x -C "$V/decode" --strip-components=1
rm -rf "$V/decode/results" "$V/render/shots" "$V/lang/corpus" 2>/dev/null || true
{
  echo "language  $LANG_REF  $(git -C "$REPO" rev-parse --short "$LANG_REF")"
  echo "renderer  $RENDER_REF  $(git -C "$REPO" rev-parse --short "$RENDER_REF")"
  echo "decoder   $DECODE_REF  $(git -C "$REPO" rev-parse --short "$DECODE_REF")"
  echo "built     $(date -u +%FT%TZ)"
} > "$HERE/js/VERSIONS.txt"
cd "$HERE/js"
[ -d node_modules/esbuild ] || npm install --no-audit --no-fund --silent
node build.mjs
cat VERSIONS.txt
