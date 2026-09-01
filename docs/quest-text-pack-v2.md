# Quest & Rumor Text Pack v2 — the power sites (planner-authored; S26-or-rider content)

*The v1 register holds: plain archaic, colour by imagery. These replace the placeholder `teaches` lines on the five power-dungeon telegraphs and join the rumor tables as pointers. Canonical home on wiring: `data/world/quests.json`; this document is the authoring record.*

## The five sites — telegraph lines (the `teaches` slot)
- **The Dawnfast** (the Balm; Reya): "Here the dawn is kept fasting, and the keeping is taught. What she raises, she raises whole."
- **The Vanishing House** (the Crossing; Arcanis): "The house is not always where it was. Neither, afterward, are you."
- **The Hushfane** (the Quietus; Drana): "There is a way to end a thing so quietly the road forgets it walked. She tithes for the teaching."
- **The Cinderthroat** (the Barrage; Drakuseth): "Speak into the throat and it answers in kind, fourfold. Bring something to burn."
- **The Longwalk** (the Stride; Titania): "Walk it once the slow way. You will not be asked to twice."

## Pointer rumors (town boards; one per site, surfacing before discovery)
- "There's a fasting-house in the pale country where wounds go to be argued with. The dawn-keeper hears petitions."
- "A house in the drowned country comes and goes. Those who find it twice arrive places faster than leaving them."
- "In the barrow country stands a fane where nothing echoes. What's learned there is the last thing some folk learn."
- "The burnt country has a throat in the rock that teaches shouting. The dragon grades harshly."
- "The deep country keeps a road that teaches walking. Sounds like nothing. Ask anyone who's finished it."

## Power audio rows (for the next audio pass; cue names registered, silent until mapped)
| Cue | Moment | Note |
|---|---|---|
| `sting.power-learned` | the escrow payout's "you have learned" ceremony | the manalink splash's sibling — the obvious first |
| `sting.power-stride` / `-crossing` / `-balm` / `-quietus` / `-barrage` | activation | optional per-power voices; a single shared `sting.power-used` is the lean alternative |
| `sting.power-upgraded` | a lord falls; the seal flips the form | pairs naturally with the still-pending `sting.lord-fell` decision |

*Chris maps from the library at leisure; the rows exist so the cues have names the day he does.*
