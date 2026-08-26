# Session 22 Brief — The Strongholds (split: 22a engine + cards, 22b the lords' seats)

Read first: `handoff-s21.md`, ADR-077..082 (`docs/decision-updates/`), **`docs/manifest-amendment-a10.md`** (the formal amendment — copy into the mechanics manifest as Part 0 ceremony), **`docs/stronghold-bosses.md`** (now the binding design spec — its lore-only status ends this session), `docs/dungeon-design.md` (v2.1), `docs/dual-lands-and-nighthawk.md` (A9/solver context). The card art is picked and cropped (S21 Part 5); **Chris delivers the nine custom-printed PNGs at kickoff.** Budget director rounds in both halves; the lord-sim tables drive 22b's.

Run as one session or two at Chris's discretion; 22b depends on 22a throughout.

---

## S22a — the engine and the batch

**Part 0:** A10 ceremony (append + manifest copy, verified); **the prizeOnly unification** (ADR-081: guardian and lord cards excluded from every generic roll — quest R-rolls, retrieval predicates, lair/color prize rolls; sole channel is the bearer's own defeat-drop); **the deadline-pause rule** (ADR-081, Chris's kickoff confirmation) — quest deadlines freeze while the giver's or destination's town is occupied; **gate hardening** (build/lint check joins the default gate per ADR-081); FUZZ_FULL baseline.

**Part 1 — A10's nine words + riders**, per the amendment doc, each with fixtures at its customer: the Unwinder's ping and engine (words 1–2), the Usher's entrance (3 — incl. the blink-launder fixture: a blinked temporary guest sheds the delayed sacrifice), Purge's request-loop + per-target life (4 — incl. the no-refund-on-counter case), the Warden's law (5 — incl. lifelink-nets-zero and tapped-Warden-pays-his-own-statute), Glare's cost (6), the Stoker's fork (7 — auto-resolve at life ≤ 2 per the single-option rule) and grant (8 — incl. lands-cycle-too and double-cycling-offers-both), the Phoenix loop (9). SPELL_CAST + land-play activations; the ADR-038 generalization with a no-regression sweep (every existing card stays `you`). Small pieces per the catalogue. **Fuzz before fixtures throughout** — synthetic decks exercising each word under fuzz before the real cards carry them.

**Part 2 — the batch (pool +16):** seven customs (five lords `prizeOnly`; Aetherbolt and Tainted Phoenix gold→R; all with `text`, picked art wired, **and `printedAsset` PNGs per ADR-082**) + eight real adds (Aether Mutation, Graceful Restoration, Phyrexian Purge, Experimental Overload, Glare of Subdual, Vindicate, Temporal Spring, Frondland Felidar — all gold→R; Scryfall re-verification blocker-level as ever) + **Abrade** (T1, 12g; BRC #111 printing override) + token defs (saproling, sphinx, weird). Zombie Phoenix type line per the ruling. Gallery/inspector printed-toggle honors `printedAsset` for customs (ADR-066 as amended).

**Part 3 — AI pins (measured, ladder-gated):** pin 15's valuation nudged for the Usher's doubled drain; the blink classification prices pending-sacrifice targets (the launder); the Unwinder's activation-discipline pin per the doc's sketch; Purge target-count discipline (never pay below the life floor — extend pin 17's family); the Stoker's cycling rides shipped pin 13 unchanged. Report deltas; zero-delta reverts per doctrine.

## S22b — the lords' seats

**Part 4 — strongholds as maximum-scale dungeons:** the five stronghold fixed points open; interior at a stronghold grid knob (propose 30×22); spoke-themed minion floors; **the law rides every interior duel** as its Artifact Enchantment (per-battle re-injection; destructible; the bounced-law-stuck-in-hand behavior verified by fixture); the two law-words (Risen Tide's land-drops counter; Intake's imposed enters-tapped) land here with their laws.

**Part 5 — the lord fights:** the entrance rule (post-mulligan logged swap; **the discard counterplay fixture** — a Hymn'd entrance card is gone and he draws into copies); the life formula (`base 30 + stepGrowth(worldSteps) − floor(spokeMinionPoints/3)`, **floor 15**, per-spoke attribution, global growth — schedule knobs; the world UI telegraphs each lord's current strength per the visible-schedules law); interior empowerment stacks atop; the five decks as ruled (v1 lists in the boss doc); treasures — the lord's card (guaranteed sole-drop) + **any 5 picks from the color prize list** (picker UI; prizeOnly excluded) + the seal flag (five seals = the gauntlet-unlock state; **the gauntlet itself is designed nowhere and built nowhere this session**).

**Part 6 — measurement:** `lord-sim` (the guardian-sim pattern): each lord vs the reference set, law in play, entrance applied, at several life points (base / +growth / −hunted) and empowerment tiers — kill tables per lord; **the Sower's ? = 2 question and the Toll/Season watch-flags are ruled from these tables in the director round**; the Usher's launder line observed (does she find it unaided?); the Stoker's library race measured (deck-out path arrival rates).

**Part 7 — acceptance:** scripted — a full stronghold: entry telegraph → law-governed minion floors → the lord with entrance + formula + empowerment → the five-pick treasure + seal → sole-drop verified; law destroyed in one battle, back the next; deadline-pause exercised. Human — **Chris storms one stronghold end to end** (his pick), tears a law down with Abrade or Disenchant, hunts a spoke first to feel the reduction, takes his five picks, and verdicts everything — plus the S21 leftovers if unwitnessed by then (empowerment re-dive, the Nighthawk + Blood Artist chattiness, a tavern whisper heard).

## Definition of done

A10 landed and ceremonied; batch encoded with printed PNGs; pins measured; five strongholds stormable end to end; lord-sim tables filed; the ?-cost and watch-flag rulings recorded; felt-wrong harvest. Concerns wanted: any word that fought back, law-enchantment edge cases, lord decks vs their intent, the entrance rule's mulligan interactions, anything the seal state wants that the gauntlet design should know.

## Out of scope

The final gauntlet (undesigned — the seal state only); the Lotus Vault; audio (S23+); wilds items (S23); pool changes beyond the batch; the R-economy design.

## Escalate, don't decide

Any A10 word resisting its spec; law interactions with auto-pass/priority; the stronghold grid size if 30×22 reads wrong; anything the five-pick UI wants that resembles a draft system; all things gauntlet.
