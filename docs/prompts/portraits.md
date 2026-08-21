# Portrait prompts

Portraits are head-and-shoulders, three-quarter view, square, ink-and-wash per `style.md`, with exactly two wash colors: the subject's color identity plus parchment. No background scenery — plain paper with a faint ink vignette of one prop (a staff, a book, a raven) at most. Expression readable at 96px.

**Viewer placeholders (M3.5):**
- `portrait-you`: "a traveling mage seen from behind-the-shoulder turning toward the viewer, hooded cloak, face half-lit, neutral and attentive" — washes: brass + parchment.
- `portrait-opponent`: "a rival mage facing the viewer, confident, one raised eyebrow, high collar" — washes: ink-grey + parchment.

**Mage opponents (overworld):** one portrait per mage, washes = colour identity. Head-and-shoulders per the rules above.

## Bestiary subjects (ADR-066)

Beast opponents use the same ink-and-wash law — reference lineage: Gygax-era manual illustration, pen-and-ink bestiary plates, confident hatching, limited wash. Differences from mage portraits:
- **Composition:** full body or a distinctive three-quarter bust with the silhouette readable at 40px (the map chip). Never a tight face crop. One characteristic gesture (a wurm mid-coil, rearing; a shambling thing mid-stride). Ground shadow allowed; still no background scenery.
- **Washes:** the beast's colour identity + parchment, as with mages.
- **Two crops per subject:** parley/status (the full render) and a chip crop chosen for silhouette, both logged in MANIFEST.
- **Signature-card rule:** where the beast is a pool card, its render should be recognisably *that creature* (consistent with, not copied from, the printed art — our illustration of the same beast).

Prompt skeleton: "Ink and wash bestiary plate: [creature], full body, [gesture], bold readable silhouette, confident pen hatching, washes of [colour] and parchment, no background, no text."

Keep this file as the registry of all portrait and bestiary prompts.
