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
# Two derivatives: battlefield tiles (~148 physical px) and hand/mini frames
# (~210-320 physical px). Both would otherwise moire from the halftone rosette.
SIZES = {".tile.jpg": 160, ".hand.jpg": 320}

def derive(src: str, dst: str, target_w: int) -> None:
    im = Image.open(src).convert("RGB")
    scale = im.width / target_w
    # Gaussian prefilter below the halftone frequency, then Lanczos.
    im = im.filter(ImageFilter.GaussianBlur(radius=max(0.5, scale * 0.45)))
    im = im.resize((target_w, max(1, round(im.height * target_w / im.width))), Image.LANCZOS)
    im.save(dst, quality=88)

def main() -> None:
    made = 0
    for name in sorted(os.listdir(ROOT)):
        if not name.endswith(".art.jpg"):
            continue
        src = os.path.join(ROOT, name)
        for suffix, width in SIZES.items():
            dst = os.path.join(ROOT, name.replace(".art.jpg", suffix))
            if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
                continue
            derive(src, dst, width)
            made += 1
    print(f"art-tiles: {made} derivative(s) written to {os.path.relpath(ROOT)}")

if __name__ == "__main__":
    sys.exit(main())
