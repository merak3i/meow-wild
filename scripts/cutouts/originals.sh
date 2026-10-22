#!/usr/bin/env bash
# Restore the full species photographs the cutouts are made from.
#
# scripts/fetch-cats.mjs downloaded them from Wikimedia Commons (credits in
# public/cats/CREDITS.md) and they were committed in 4ac84f3, before the
# cutouts replaced them in public/cats. This copies them out of that commit
# into scripts/cutouts/work/orig/ without touching the working tree.
set -euo pipefail
REF=4ac84f3
ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
OUT="$ROOT/scripts/cutouts/work/orig"
mkdir -p "$OUT"
git -C "$ROOT" ls-tree --name-only "$REF" public/cats/ | grep '\.webp$' | while read -r path; do
  git -C "$ROOT" show "$REF:$path" > "$OUT/$(basename "$path")"
done
echo "originals: $(ls "$OUT" | wc -l) in $OUT"
