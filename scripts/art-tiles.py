#!/usr/bin/env python3
"""Tile-size art derivatives (S10 playtest fix).

Battlefield tiles show art at ~74css/148physical px. Browsers single-step
downscale the ~563px Scryfall scans, and the print halftone rosette aliases
into a visible checkerboard moire (worst on the Beta basics). A proper
prefiltered Lanczos downscale to near-final size fixes it; the browser's
remaining resize is ~1:1.

Run after `pnpm art:fetch` (wired into the npm script). Idempotent by mtime.
"""
import os, sys
from PIL import Image, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), "..", "data", "art", "real")
TARGET_W = 160

def main() -> None:
    made = 0
    for name in sorted(os.listdir(ROOT)):
        if not name.endswith(".art.jpg") or name.endswith(".tile.jpg"):
            continue
        src = os.path.join(ROOT, name)
        dst = os.path.join(ROOT, name.replace(".art.jpg", ".tile.jpg"))
        if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
            continue
        im = Image.open(src).convert("RGB")
        scale = im.width / TARGET_W
        # Gaussian prefilter below the halftone frequency, then Lanczos.
        im = im.filter(ImageFilter.GaussianBlur(radius=max(0.6, scale * 0.45)))
        im = im.resize((TARGET_W, max(1, round(im.height * TARGET_W / im.width))), Image.LANCZOS)
        im.save(dst, quality=88)
        made += 1
    print(f"art-tiles: {made} tile derivative(s) written to {os.path.relpath(ROOT)}")

if __name__ == "__main__":
    sys.exit(main())
