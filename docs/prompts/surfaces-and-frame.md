# Surface and frame prompts

**Table surface (`surface-wood`, 2048×1024, tileable preferred):** "aged wooden tabletop seen from directly above, warm medium-brown, subtle grain in ink hatching with a thin umber wash, slightly worn at the edges, flat lighting, no objects, no vignette, tileable." Keep value range narrow so card art pops; if the generated result is busy, flatten it (reduce contrast) in post.

**Panel parchment (`panel-parchment`, 1024 square, tileable):** "plain aged parchment, warm off-white, very faint fiber texture in ink stipple, no stains, no writing, tileable."

**Card frame (vector, built by hand — generate only ornaments):** our frame is parchment body, 2px ink border with softened corners, a wash band behind the name strip in the card's color identity (multicolor = split band; colorless = grey; lands = wood-brown), art window with a thin ink rule, type line in ink, oracle text in the humanist sans, P/T in a small ink cartouche bottom-right. Generate one ornament: `frame-corner` — "a tiny ink flourish for the corner of a frame, a single curling leaf stroke, no wash." Used at all four corners, mirrored.

**Card back (`card-back`):** "an ink-and-wash card back, symmetric, a compass rose made of five petals (one per mana color wash) on parchment, thin ink border, no text." Used for face-down cards (opponent hand, library).
