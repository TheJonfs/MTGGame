# Visual style bible (gemini-image skill)

The block below is prepended verbatim to every render prompt made through
the gemini-image skill. Descriptors define *what* is depicted; this file
defines *how*.

**Source of truth: `docs/prompts/style.md` (per `docs/art-direction.md`
§0, style language is never improvised outside that file).** This block
mirrors it in the structure the render script extracts. If the style
changes upstream, re-mirror it here — a drifted copy means two art
styles.

---

## House style block

Ink and wash illustration. Confident warm-black ink linework (dip pen,
slightly variable line weight), loose watercolor washes limited to two or
three colors per image, generous unpainted paper, no gradients or digital
smoothness. Paper is warm off-white; plain paper background, no vignette.
Style references: antique field-guide plates and nineteenth-century
cartographic vignettes; restrained, legible, slightly weathered. Washes
only, over parchment (#EDE3CC) and warm near-black ink (#2B2520); brass
(#B08A3E) and aged wood (#6B4A2B) as accents; mana washes — white-cream
#E9E2C8, blue #3F6E9E, black-purple #4B3A5A, red #B5432F, green #4F7A3A,
colorless grey #8E8A80 — used only to encode color identity, never as
decoration. No photorealism, no 3D render, no neon, no lens effects, no
anime, no text, no watermark, no frame, no borders.

---

## Notes

- Square composition is the project default: pass `--aspect 1:1` unless
  an asset class says otherwise (surfaces are 2:1 — use `--aspect 16:9`
  as the nearest supported ratio, or crop downstream).
- The skill keeps its own machine-readable log in `assets/manifest.json`
  (file, prompt hash, conditioning, date). If `assets/generated/
  MANIFEST.md` remains the human ledger of record for this project, copy
  entries over or decide at the project level that manifest.json
  supersedes it for skill-generated assets.
