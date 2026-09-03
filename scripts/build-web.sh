#!/usr/bin/env bash
# S27 (the Vercel deploy): the static build of the viewer.
#  1. Fetch the real cards' Scryfall art into the gitignored data/art/real (idempotent — a local
#     build reuses what it has; a fresh Vercel build fetches ~370 images at Scryfall's 150ms spacing).
#     The tile derivatives (art-tiles.py, Pillow) are skipped here: the tiles are a dev nicety and the
#     UI falls back from .tile.jpg to .art.jpg on error.
#  2. Copy them into the UI's public tree (gitignored) so `/real-art/*` resolves statically —
#     the dev server's middleware served them before.
#  3. Vite build. The audio mount (assets/audio, gitignored) is NOT copied: the deploy is silent by
#     construction (silent-if-unmapped, ADR-083) — the FLACs are Chris's local library.
set -euo pipefail
cd "$(dirname "$0")/.."
tsx scripts/art-fetch.ts
rm -rf packages/ui/public/real-art
mkdir -p packages/ui/public/real-art
cp -R data/art/real/. packages/ui/public/real-art/
vite build packages/ui
echo "build-web: $(ls packages/ui/dist/real-art | wc -l | tr -d ' ') real-art files; dist at packages/ui/dist"
