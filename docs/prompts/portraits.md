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

### S18 bestiary subjects (rendered; one plate each, 1:1, chip crop 82% centre)

| Subject file (`docs/art/subjects/`) | Opponent | Colour wash |
|---|---|---|
| `beast-grizzly-bear.md` | A Grizzly Bear (G, 1) | moss green |
| `beast-deadly-recluse.md` | The Deadly Recluse (G, 1) | moss green |
| `beast-man-o-war.md` | A Bloom of Man-o'-War (U, 1) | sea blue |
| `beast-cunning-tactician.md` | The Cunning Tactician (W, 1–2; mage-voiced, field-guide plate) | pale gold |
| `beast-boggart-warband.md` | The Boggart Warband (R, 2) | ember red |
| `beast-vampire-nighthawk.md` | A Vampire Nighthawk (B, 2) | bruise violet-black |
| `beast-living-gale.md` | The Living Gale — Air Elemental (U, 2) | storm blue |
| `beast-siege-gang.md` | The Siege-Gang (R, 3) | ember red |
| `beast-hypnotic-specter.md` | The Hypnotic Specter (B, 3) | sickly green-black |
| `beast-serra-angel.md` | The Serra Angel (W, 3) | pale gold |
| `beast-pelakka-wurm.md` | the Pelakka Wurm (G, 3) — S14 PoC | moss green |
| `beast-plague-of-rats.md` | A Plague of Rats (B, 1) — S19 | bruise violet-black |
| `beast-gray-ogre.md` | A Gray Ogre (R, 1) — S19 | ember red |
| `beast-savannah-lion.md` | A Savannah Lion (W, 1) — S19 | pale gold |
| `beast-rumbling-baloth.md` | A Rumbling Baloth (G, 2) — S19 | moss green |
| `beast-faerie-formation.md` | The Faerie Formation (U, 3) — S19 | storm blue |

Descriptors are locked in the subject files (the skill hashes them); MANIFEST carries kept/rejected per Chris's verdicts.
