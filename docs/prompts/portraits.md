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

### S20 playtest r2: Mox guardian battle portraits

Mage-portrait law (Drakuseth: bestiary three-quarter bust); signature-card rule applies —
recognisably the printed legend, consistent with, not copied from, its card art (grounded
against the cached Scryfall crops before writing descriptors).

| Subject file | Guardian | Colour wash | Status |
|---|---|---|---|
| `guardian-reya.md` | Reya Dawnbringer (mox_w) | pale dawn-gold | kept (S21 kickoff) |
| `guardian-arcanis.md` | Arcanis the Omnipotent (mox_u) | storm blue | kept (S21 kickoff) |
| `guardian-drana.md` | Drana, Kalastria Bloodchief (mox_b) | deep violet-black | kept (Chris's own render — the refusal trigger was the two-horns phrase; descriptor corrected to the filigree crown) |
| `guardian-drakuseth.md` | Drakuseth, Maw of Flames (mox_r) | ember orange-red | kept (S21 kickoff) |
| `guardian-titania.md` | Titania, Protector of Argoth (mox_g) | deep moss green | kept (S21 kickoff) |

### S29 mage portraits (the cleansheet round — fifteen faces, two candidates each; Chris's verdicts pending)

The five shared deck portraits (`portrait-opponent-*`) gave three mages one face each and stopped matching the flowing pairs. Fifteen subjects from the decks' identities and epithets, TWO candidates each (`docs/art/subjects/portrait-mage-<key>-{1,2}.md`); candidate 1 wired provisionally (`packages/ui/public/portraits/portrait-mage-<key>.png`, 512px; `opponents.json` `portrait`). Washes = the mage's colour identity + parchment.

| Subject (`portrait-mage-<key>-{1,2}`) | Mage | Pair · tier | Epithet | Wash |
|---|---|---|---|---|
| oriel | Sister Oriel | W · 1 | the Almoner | white-cream |
| tessaly | Tessaly Reed | U · 1 | the Tidewright | sea blue |
| edric | Pale Edric | B · 1 | the Sexton | black-purple |
| brann | Brann the Scorched | R · 1 | the Sparkwright | ember red |
| hask | Old Hask | G · 1 | the Wardener | moss green |
| vael | Mistress Vael | WB · 2 | the Tithe-Reeve | white-cream + black-purple |
| kessa | Kessa Emberhand | UR · 2 | the Stormcaller | sea blue + ember red |
| maelin | Adept Maelin | BR · 2 | the Pyre-Warden | ember red + black-purple |
| brennor | Brennor of the Glade | WG · 2 | the Sanctuary | moss green + white-cream |
| pell | Pell of the Shallows | UG · 2 | the Tidesower | sea blue + moss green |
| corvane | Lord Corvane | WB · 3 | the Sepulchre | white-cream + black-purple |
| varro | Varro Flamebrand | UR · 3 | the Ashwright | ember red + sea blue |
| sorrel | High Warden Sorrel | BR · 3 | the Inquisitor | black-purple + ember red |
| ysolde | Thornmother Ysolde | WG · 3 | the Thornmother | moss green + white-cream |
| quill | Magister Quill | UG · 3 | the Drowned Grove | sea blue + moss green |

