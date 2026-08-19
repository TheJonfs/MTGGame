# Style prompts — shared preamble

Prepend to every image-generation prompt. Do not improvise style language outside this file; if the style needs to change, change it here.

**Preamble:**
"Ink and wash illustration. Confident warm-black ink linework (dip pen, slightly variable line weight), loose watercolor washes limited to two or three colors, generous unpainted paper, no gradients or digital smoothness, no text, no borders. Paper is warm off-white. Style references: antique field-guide plates and 19th-century cartographic vignettes; restrained, legible, slightly weathered. Square composition unless specified. Plain paper background, no vignette."

**Palette (washes only — everything else is ink and paper):** parchment #EDE3CC · ink #2B2520 · brass #B08A3E · wood #6B4A2B · mana washes: white/cream #E9E2C8, blue #3F6E9E, black/purple #4B3A5A, red #B5432F, green #4F7A3A · colorless grey #8E8A80.

**Negative (append):** "no photorealism, no 3D render, no neon, no lens effects, no anime, no text, no watermark, no frame."

**Output:** PNG, transparent background where the asset is a glyph/ornament; square 1024 for portraits and icons (icons are downscaled and traced), 2048×1024 for surfaces. Log every generation in `assets/generated/MANIFEST.md`: file, prompt, date, kept/rejected.
