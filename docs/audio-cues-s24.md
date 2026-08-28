# Audio cues — the landed state (S24 close; supersedes docs/audio-cues-s23.md)

The S23 worksheet's mapping round happened: v3 landed (docs/audio-mapping-v3.md) and the S24
playtest rounds grew the SFX layer well past it. This is the CURRENT inventory — what plays,
where, and what remains on the shelf. `data/audio/mapping.json` stays the one source of truth;
`/sound` is the tuning board (volume sliders audition live; keeper values go into the mapping's
`{file, volume}` entries). Everything is silent-if-unmapped; every absent binding below is chosen.

## The three channels

- **Music** — looping, ~0.9s crossfade on context change, one at a time. Baseline 0.8 × per-cue volume.
- **Stingers** — ONE VOICE: a new sting fades whatever rings (Manalink fades Winduel by design);
  the parley's Dueltune fades on a stakes choice; leaving the win/loss screen fades the result
  sting. Baseline 0.9 × per-cue volume.
- **SFX** — fire-and-forget, freely OVERLAPPING (rapid plays layer; never touches the other two).
  Baseline 1.0 × per-cue volume. Burst throttles (150ms, one ring per simultaneous batch) on
  draw, untap, damage, discard, destroy, sacrifice.

## Music & splashes (mapped)

Fifteen region tracks — town → region colour+ring → `music.town.<C><R>` → LocMus file (v3's
table; LocMus5/9/12 reserved for future special towns). Town music FOLLOWS into the deck editor
and collection when opened from the square. Five castle themes — `splash.stronghold.<id>` —
play through the stronghold telegraph's gate-plate splash and yield to interior silence.

**Deliberate silences**: overworld (doctrine — the tension space), in-duel (focus), interiors
(the Damb set owns them now), the front menu (TBD — hook kept, Chris's call).

## Stingers (mapped)

| cue | fires | file |
|---|---|---|
| sting.parley | the stakes menu opens (once per encounter; fades on choice) | Dueltune |
| sting.news | any news modal that isn't a quest payoff | Newsflash |
| sting.reward | quest completion | Reward |
| sting.manalink | the manalink SPLASH (its own ceremony screen — the talisman plate; every grant path, diff-detected) | Manalink |
| sting.treasure | a dungeon cache banks | Findcard |
| sting.duel-win / duel-loss | the result screen (fades on early exit) | Winduel / Loseduel |
| sting.coin-flip | the play/draw ceremony | sfx/Toss.wav |

## SFX (mapped — 36 cues)

- **Casting rings the TYPE** (`sfx.cast.creature`=Summon / artifact / enchantment=Enchant /
  instant / sorcery; creature-first priority) — then **entering play rings the COLOUR**
  (`sfx.enter.W…G` at 0.2 + all ten guild pairs at 0.3; resolved through the one zone-move
  event: creatures, played/fetched lands, tokens, reanimations; a land's colour is what it
  taps for). `sfx.enter.artifact`/`colorless` are registered, unmapped (Grey.wav is a candidate).
- **Actions** (0.25–0.3): draw (one per burst), shuffle (mulligan + post-search only — the
  `SHUFFLED` event; setup is deliberately silent), tap (every tap, mana payments included),
  untap (one per untap-step burst), attack (ONE at the commit), block (ONE at the commit),
  end-turn (the turn rollover), damage (one per batch), discard, destroy vs **sacrifice**
  (the `SACRIFICED` cause-marker event splits the death sounds).
- **The deep breathes** — `sfx.ambient.dungeon.1..5` (Damb1–5 at 0.4): a reveal BURST (≥5 fog
  cells uncovered by one interior step = a sightline opened), 8s cooldown (Chris-tuned from 12),
  random-without-repeat, every interior kind. Flat cues + a code-side picker (v3's pool want,
  served without resurrecting pools).

## The unmapped shelf (one line + at most one seam each)

LifeLoss · Counter · Regen · ManaBurn · Kill/Buried (destroy alternates) · Grey (colorless
entries) · EndPhase · Button/Button2 (UI clicks) · the Shell_* voice lines (menu/records
flavor) · Exp1_* (pack-opening — no packs exist) · the named-creature specials (AswanJag,
FaerDrag, PrsmDrag…: per-card entry sounds would want a `sfx.enter.card.<id>` convention —
flag before building). Overworld ambience (wind/footsteps by terrain class) remains the
deferred ambience-pass design (v3).

## Adding a cue (the contract, unchanged)

One union member (or a resolved family key) in `packages/ui/src/audio/audio.ts`, one call at
the seam, one mapping line. Silent-if-unmapped, persisted toggle, no sound before first
gesture, crossfade on music context change — all guaranteed by the manager.
