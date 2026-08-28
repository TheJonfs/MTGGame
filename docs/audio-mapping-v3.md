# Audio Mapping v3 — the ratified assignments (Chris-authored; the S24 landing spec)

*Supersedes v2's pool architecture — the region is the musical identity unit (Chris): every town resolves to its region's colour+ring track. Flat cue→file otherwise. Silent-if-unmapped remains the law; every silence below is chosen, not accidental.*

## Town music (region-resolved: town → region colour+ring → track)
| Region | Track | | Region | Track | | Region | Track |
|---|---|---|---|---|---|---|---|
| Dawnmarch (W1) | LocMus1 | | Alabaster Downs (W2) | LocMus6 | | Reliquary Wastes (W3) | LocMus14 |
| Tidemeet (U1) | LocMus4 | | Mistfen (U2) | LocMus7 | | Drowned Reach (U3) | LocMus15 |
| Duskmoor (B1) | LocMus3 | | Gallows Fen (B2) | LocMus8 | | Barrowlands (B3) | LocMus16 |
| Emberford (R1) | LocMus10 | | Cinder Scarps (R2) | LocMus11 | | Shattered Caldera (R3) | LocMus17 |
| Greenholt (G1) | LocMus2 | | Bramblemarch (G2) | LocMus13 | | Deepwood (G3) | LocMus18 |

**Reserved:** LocMus5, LocMus9, LocMus12 — future special towns.

## Stronghold splash themes (splash screen only; interiors silent pending ambience)
Spiral Spire — Ucastle · Charnel Court — Bcastle · Argent Bastion — Wcastle · Furnace Gate — Rcastle · Verdant Throne — Gcastle.
**Companion (S24):** the stronghold splash gains a **custom panel** with a gate/exterior plate per seat — a threshold visually distinct from a lair mouth.

## Stingers (non-looped)
| Hook | Track |
|---|---|
| Pre-battle stakes menu (fight/flee/payoff) | Dueltune |
| Manalink granted | Manalink |
| News update (all news — one crier's voice) | Newsflash |
| Quest completion, non-manalink reward | Reward |
| Post-battle win screen | Winduel |
| **Post-battle loss screen (new in S24)** | Loseduel |
| Dungeon treasure cache found | Findcard |

## Deliberate silences (this pass)
Overworld walking (doctrine — the tension space) · in-duel gameplay (focus space; Shandalar's per-action stings — lands, tap/untap, attack — noted as a possible later layer) · dungeon, lair, and stronghold interiors (pending the ambience pass) · front menu (TBD, Chris).

## Deferred / pending
The ambience layer (wind bed + terrain footsteps, with its cell→terrain-class lookup) · per-action duel stings · coin-flip sting (Chris hunting the piece) · `sting.lord-fell` (registered, silent, awaiting a verdict on whether the world's quieting deserves one struck note or none).

## Schema (simplified from v2 — pools deleted)
Flat cue→file in `data/audio/mapping.json`, plus two resolutions: `music.town` via region colour+ring; `splash.stronghold` via stronghold id. New cues registered per the tables. Pool-with-policy support returns only if a want emerges.
