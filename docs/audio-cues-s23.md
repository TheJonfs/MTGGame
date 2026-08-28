# Audio cues — the mapping round's worksheet (S23; ADR-083/084 step 2)

> **SUPERSEDED (S24 close):** the mapping round happened — v3 landed and the S24 rounds grew the SFX layer well past this sheet. The current inventory is **`docs/audio-cues-s24.md`**; this file stays as the round's record.

Implementer-filed for Chris + the planner. **The left table is what's wired and waiting for
music**; the right section is the implementer's candidate list for NEW hooks — mark wants, add
your own, and the wiring lands next session. Everything here is cue-first: game code names cues,
never files; `data/audio/mapping.json` (committed) binds cue → file name under the gitignored
`assets/audio/` mount (dev-served at `/audio`). An unmapped or unmounted cue is SILENT by design.

## How to author the mapping

1. Put files in `assets/audio/` (any of `.flac .ogg .mp3 .wav`; the folder is gitignored — your
   library never enters the repo, per ADR-083).
2. Edit `data/audio/mapping.json`: `"music.overworld": "my-file.flac"` — keys are the cue names
   below; keys starting with `_` are ignored (documentation).
3. Restart the dev server (the mapping is read at startup). Sound begins at the first click or
   keypress — the browser's autoplay rule, not ours; the toggle (front page + the in-game ♪ tab)
   is remembered separately.

Behavior notes for choosing tracks: **music cues loop and crossfade** (~0.9s) when the context
changes; re-entering the same context does NOT restart the track. **Stingers overlay the music**
without ducking it (v1 — say the word if ducking is wanted). One music cue plays at a time.

## Wired today — awaiting music

| cue | plays when | notes for track choice |
|---|---|---|
| `music.menu` | the Cinquefoil title card (new game / continue screen) | the front door; loops under setup choices |
| `music.overworld` | the campaign map — walking, parley panels, telegraph modals | the game's default state; the longest-heard track by far |
| `music.town` | inside any town screen (market, board, tavern tabs — one cue for all, today) | calm register; see candidates for per-tab wants |
| `music.dungeon` | inside a Mox or lair dungeon (interior walk + its telegraph) | the dark register; also under the victory ceremony |
| `music.stronghold` | inside a lord's stronghold (telegraph, interior, the victory picker) | the maximum-stakes register; distinct from dungeon on purpose |
| `music.duel` | every battle: world duels, interior duels, siege engagements | one cue for ALL duels today; see candidates for splits |

## Wired today — awaiting stingers

| cue | fires when | notes |
|---|---|---|
| `sting.coin-flip` | the play/draw coin ceremony mounts | short; the spinner runs ~2s |
| `sting.quest-complete` | the news modal opens for quest completions | |
| `sting.siege-news` | the news modal opens for siege threats/falls/liberations | shared by bad news (a fall) and good (a liberation) — split candidate below |
| `sting.duel-win` | the world duel result screen shows a win | interior/siege duels do NOT sting today (their ceremonies differ) — candidate below |
| `sting.duel-loss` | the world duel result screen shows a loss | same caveat |

## Candidate hooks (unwired — the round marks wants; each is a small, known seam)

**Music splits.** Per-ring town themes (civilized/approach/wild — the footprint variety's audio
twin); a distinct `music.duel-boss` for guardians and lords (the spec knows which fight it is);
`music.gameover`.

**Stinger candidates, roughly by likely value:**
- `sting.siege-fell` vs `sting.siege-relieved` — splitting the shared siege cue by valence.
- `sting.lord-falls` / the seal ceremony (the strongholdVictory screen is a known seam).
- `sting.treasure` — a dungeon cache banking to escrow; `sting.escrow-paid` at the victory payout.
- `sting.levelup`-class moments: a manalink granted; a renown threshold; a seal collected.
- `sting.card-bought` / `sting.card-sold` (the shop's till); `sting.quest-accepted`.
- `sting.encounter` — a roamer contact opening the parley panel (danger chord).
- `sting.your-turn` — the duel's turn-register flip (the r4 bottom-rail shift, audible).
- In-duel micro-stingers (cast, damage, death) are a DEEPER workstream — flagged, not sized;
  they live at engine-event seams, not screen seams, and want a volume/dedup design first.

**Ambience (a third channel?)** — looping non-music beds (rain on the map, tavern murmur,
dungeon drips) would be a new channel in the manager (music/sting/ambience). Small build; wants
the mapping round's verdict on whether it earns its keep.

## The contract (unchanged from S23)

Cue names are typed (`packages/ui/src/audio/audio.ts`); adding a cue = one union member + one
mapping key + one call at the seam. The manager guarantees: silent when unmapped/unmounted,
persisted toggle, no sound before first user gesture, crossfade on context change. Step 3 (the
deploy library) repoints the same cues at repo-safe files — a data change, zero code.
