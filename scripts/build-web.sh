#!/usr/bin/env bash
# S27 r3 (the Vercel deploy; Chris's ruling): the static build of the viewer. The Scryfall art
# (data/art/real) and the audio mount (assets/audio) are committed, so the build only COPIES them
# into the UI's public tree (both copies gitignored) where the dev server's middlewares served them:
# /real-art/* and /audio/*. No network at build; the deploy shows exactly what dev shows.
#   ART_FETCH=1 pnpm build:web   # opt in to a Scryfall refresh first (adds/updates missing images only)
set -euo pipefail
cd "$(dirname "$0")/.."
if [ "${ART_FETCH:-0}" = "1" ]; then tsx scripts/art-fetch.ts; fi
rm -rf packages/ui/public/real-art packages/ui/public/audio
mkdir -p packages/ui/public/real-art packages/ui/public/audio
cp -R data/art/real/. packages/ui/public/real-art/
cp -R assets/audio/. packages/ui/public/audio/
# vite is the UI workspace's devDependency — run it THROUGH pnpm so its bin resolves on Vercel
# (the root's PATH only carries the root's .bin; locally the hoist hid this).
pnpm --filter @shandalar/ui exec vite build
echo "build-web: $(ls packages/ui/dist/real-art | wc -l | tr -d ' ') real-art files, $(find packages/ui/dist/audio -type f | wc -l | tr -d ' ') audio files; dist at packages/ui/dist"
