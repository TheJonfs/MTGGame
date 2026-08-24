# The Five Lords — stronghold bosses (cycle spine + entries)

*Planner-maintained; born from the post-S19 design rounds. The document the five custom legendaries live in. One entry exists; four await. S22 is their session; A10 is their amendment.*

## The cycle spine (Chris-ratified except where flagged)

- **Who they are:** the five stronghold residents — custom legendary creatures, humanoid but not necessarily human, each defined by riding the plane's warped mana flows. Their triples (primary + both ring-adjacent splashes): **Wbg · Bwr · Rbu · Urg · Guw**. The Mox guardians keep the old orthodox ways; the lords *are* the heresy — their decks run tri-color on duals (the first AI dual users, S22).
- **Naming register:** plain agent nouns with the definite article — **"The ___er"** — kin to the toponymy (Wrack, Cairn, Brand). The strongholds are named for places; the lords for what they do to the plane.
- **Cost grammar:** `{N}{P}{P}{S1}{S2}` — double primary, one pip of each splash; **generic N scales with the card's design** (the Unwinder's engine earns {1}; a heavier design may earn more).
- **Card ceremony:** ADR-053's custom-card path (`text` field, `source: custom`) + ADR-052's four art candidates in distinct styles, Chris picks, MANIFEST-logged.
- **Drop rule (flagged for ratification):** a lord's card is obtainable **solely by defeating that lord** — `prizeOnly` + a guaranteed self-drop in the stronghold's prize room. **Proposed unification:** the Mox guardians' cards adopt the same rule (currently shopTier R per ADR-079, which leaks through quest R-rolls — a Reya card should not arrive by courier before Reya is met). If ratified: one-line S20 brief delta, legendaries `prizeOnly`.
- **Two clocks:** lords escalate on the **exterior** step-schedule (manifest §5 — visible thresholds while the player wanders) *and* the **interior** empowerment clock once their stronghold is entered. The stronghold is the dungeon system at maximum scale with a **partisan law** (S22 design round).
- **Stronghold combat parameters (Chris, filed):** lords start at high life (~30+), possibly reduced **−1 per stronghold minion defeated** (Shandalar lineage) — making minion fights *weaken* the lord while interior steps *empower* him: a third nested speed-vs-thoroughness dial. High life is also deliberately a **resource** (untapped shocks, Phyrexian Purge, life-costed lines). **Filed for consideration:** signature card forced into the lord's opening hand (`startsInHand` modifier candidate — small mechanism; mulligan/determinism interactions to think through before ruling).
- **A10 status:** words 1–4 confirmed (RETURNED_TO_HAND event; bounce-own-as-cost; `temporary` reanimate package; **any-number targeting via request-loop — Chris-ratified**), plus the ADR-038 graveyard-targeting amendment (`who: you | any`).

## Entry 1 — The Unwinder (Spiral Spire, U · r/g)

**The Unwinder** — {1}{U}{U}{R}{G} Legendary Creature — Merfolk Wizard, 3/4
- Whenever a permanent is returned to its owner's hand, The Unwinder deals 1 damage to any target.
- {U}{R}{G}, Return a land you control to your hand: Draw a card.

*Flavor text pending. Concept C ratified: the Unwinding itself — the plane coming undone one card at a time; the only lord with no orthodox flow at all (both of blue's ring-adjacencies are enemy pairs elsewhere).*

**Design notes (recorded):**
- *The interlock:* the activation triggers the trigger — every land-return is a draw **and** a ping. The engine is self-limiting (bouncing lands taxes your own development) unless the deck adds land-drop enablers; the ping makes activation nearly always positive-EV with truly spare mana.
- *The trigger is symmetric over controller and cause* — the player who Boomerangs the Unwinder's blockers feeds the Unwinder's ping. Interacting with the tide costs you: the card is the Spire's partisan law in miniature, before the law is even written.
- *Shockland wrinkle:* returning a shock to hand re-imposes its 2-life toll on replay — the engine punishes greedy manabases, a self-balancing wrinkle for when the card reaches player hands.
- *AI read:* bounce-tempo is proactive (not the counter-wall trap); trigger targets route through existing harmful-classification. The one novel discipline is self-land-bounce timing — **pin sketch:** activate with spare {U}{R}{G} when holding a land in hand or when lands-in-play exceed curve needs; never below the land count needed for next turn's planned cast. Measured by the S22 guardian-sim instrument; escalate to evaluator work only if the pin fails tables.
- *Art-notes seed (Chris's direction):* lean into **spirals** and a restrained **weirdness suggestive of warped mana** — the Spire's resident should look like something the wrong currents made, not a costume. Four candidates per ADR-052 when S22 ships.

**Vocabulary bill — manifest amendment A10 (S22):**
1. New trigger event `RETURNED_TO_HAND` (battlefield → hand), keyed off the existing ZONE_CHANGE payload; observed (any controller, any cause); S17's lookback machinery covers self-observation.
2. New activated-ability cost `returnToHand: {predicate}` (bounce-own-permanent-as-cost), structurally parallel to sacrifice-cost machinery.
Everything else exists: any-target trigger choice (ADR-048), observed conditions (ADR-076), the tri-color cost (the S20 payment solver).

**Supporting cards (the Spire's arsenal; verified as marked):**
- **Aether Mutation** ✔ (APC #91) — {3}{G}{U} Sorcery: "Return target creature to its owner's hand. Create X 1/1 green Saproling creature tokens, where X is that creature's mana value." Double synergy: the bounce feeds the ping; the Saprolings hold the ground. Bill: `targetManaValue` value-ref (ADR-028 family), `createToken` count-as-ref, `saproling_1_1_g` token def. Gold → **R-class by rule** (players acquire via R channels). Scryfall ruling note: tokens only materialize if the target is still legal at resolution — matches our fizzle model.
- **Aetherbolt** (custom, Chris-drafted) — {1}{U}{U}{R} Instant: "Return target permanent to its owner's hand. Aetherbolt deals 3 damage to any target." Boomerang + Bolt stapled at the +1 tax. **Zero new vocabulary** — two effects, two independent targets by index; per-target fizzle already correct (the bolt lands even if the bounce target escapes). Gold → **R-class by rule**; the strongest custom card yet, sized for the lord's arsenal. Bounce half feeds the ping; "target permanent" includes own lands (a corner-case engine line). AI watch: pair selection should avoid same-target waste (bounce resolves first, torching the damage). Ceremony: ADR-053 text field + ADR-052 four candidates when S22 ships. *Note: the arsenal reads Aether Mutation / Aetherbolt / Aether Channeler — the "aether" in-world naming was offered and **declined for now (Chris-ruled): the warp stays nameless pending future lore work**; the card names are just card names.*
- **Temporal Spring** ⚠ (optional; APC expected) — {1}{G}{U}-ish sorcery, "Put target permanent on top of its owner's library" (recalled, unverified). Bill if added: `bounce {to: libraryTop}` destination. **Deliberately does not feed the ping** (library-top ≠ hand) — ratified: no shoehorning; the Spring unwinds too far for the tide to taste. Add on merit as a potent tempo card, or skip.
- Deck seeds (S22 pass): the pool's whole bounce suite (Boomerang, Man-o'-War, Mist Raven, Waterfront Bouncer, Aether Channeler's mode), duals across UR/UG/RG, burn as reach. The full 40 is the S22 planner deliverable alongside the Spire's law.

## Entry 2 — The Usher (Charnel Court, B · w/r)

**The Usher** — {1}{B}{B}{W}{R} Legendary Creature — Vampire Noble, 5/5
- When The Usher enters, return target creature card from a graveyard to the battlefield. It gains haste. Sacrifice it at the beginning of the next end step.
- Whenever a creature dies, target opponent loses 2 life and you gain 2 life.

*Flavor text pending. Visual seed (Chris): a vampire duchess — haughty, seductive, and deadly in equal measure, luxurious backdrop. The name's innocence is the point: she shows the dead in, and shows them out again.*

**Design notes (recorded):**
- *The exit toll:* the ETB's end-step sacrifice feeds her own drain — the temporary guest pays 2 on the way out. Raise, spend, tax: all three colors in one loop (B raises, R spends violently, W tithes).
- *"A graveyard," not "your":* the Court claims all the dead — reanimating the player's own fallen Serra with haste is the fight's signature moment. **Requires amending ADR-038** (own-graveyard-only) and generalizing `targetCandidates`; the view side is already public (S17's `graveyardObjects`).
- *Combo lines (intentional, per Chris's assemble-with-effort doctrine):* (1) the Resto chain — reanimate Restoration Angel, blink the next guest, bounded by graveyard contents; (2) **the launder** — a blinked object is a new object, so blinking the temporary guest strips the delayed sacrifice: temporary reanimation made permanent, two cards, real effort. Current pool contains no repeatable blink and no instant-speed loop-closer — the infinite stays a deliberate future enable. **Constraint recorded: the Usher must never become an Angel** (Resto's non-Angel clause would kill every line).
- *Purge synergy:* with the Usher out, Phyrexian Purge's life cost mostly refunds through the drain (9 life for three kills → 6 drained back) — the Court's removal is nearly free only in the Court.
- *AI read:* the drain is pin-15's priced shape (observed-DIES engine — valuation may want a nudge for the doubled rate); ETB reanimate-target choice rides the tutor/reanimator policies; the delayed sacrifice needs no decision. The novel judgment is *whose* graveyard and *what* to take — prediction-level, watch in S22 sims.

**Vocabulary bill (A10 continues):**
3. `returnFromGraveyard` gains `temporary: true` — the package word: gains haste; sacrificed at the beginning of the next end step (a self-contained delayed-trigger rule, not a delayed-trigger subsystem; Corpse Dance's family lives here).
4. **ADR-038 amendment:** graveyard targeting generalizes to `who: you | any` (the Usher is the sole "any" customer; all existing cards stay "you").

**Supporting cards (the Court's arsenal; verified):**
- **Graceful Restoration** ✔ (MH2 #201) — {3}{W}{B} Sorcery, modal: reanimate one with an extra +1/+1 counter, or up to two with power ≤ 2. Bill: counter-rider on `returnFromGraveyard`, `powerAtMost` target predicate; A6 modes and A8's up-to already landed/landing. Own-graveyard both modes. Gold → R-class.
- **Phyrexian Purge** ✔ (MIR #273, sole printing, Reserved List) — {2}{B}{R} Sorcery: "This spell costs 3 life more to cast for each target. Destroy any number of target creatures." Bill: `additionalCost: {life: n, perTarget: true}` (A7 family; paid at cast, no refund — printed ruling matches our doctrine) + **any-number targeting via request-loop** (choose-target/done as logged DecisionRequests — the chooseMode/ADR-013 precedents fused; client = staged multi-select with live cost readout). **A10 word 4, pending Chris's nod on the request-loop shape.** Gold → R-class.
- Deck seeds (S22 pass): the vampire court (Aristocrat, Nighthawk, Blood Artist, Child of Night), Hymn/Duress, the sacrifice suite, Wrath as the Usher's own drain-storm, WB/BR/WR duals. The full 40 is the S22 deliverable alongside the Court's law.

## Entry 3 — The Warden (Argent Bastion, W · g/b)

**The Warden** — {1}{W}{W}{G}{B} Legendary Creature — Treefolk Soldier, 4/4
- Vigilance, reach
- Whenever The Warden attacks, tap up to two target creatures.
- Whenever a creature untaps, it deals 1 damage to its controller.

*Flavor text pending. Visual seed: the Bastion's living wall given rank — a silver-barked treefolk soldier; reach is the thorned canopy over the yard. Green carried by being and keyword, not by line count.*

**Design notes (recorded):**
- *Tapping is sentencing:* the attack trigger loads the punishment — the two creatures he taps must untap and pay for it. The law is symmetric ("a creature"), including effect-untaps (Little Bear now stings its own controller in his fight).
- *Vigilance over lifelink (the revision's key move):* the Warden nets zero on his own untap not by refund but by never ringing the bell — and it's the truer flavor (the watch that never rests).
- *Counterplay the law teaches:* (1) **lifelink walks free** — any lifelink creature's own untap nets zero (Nighthawk is immune to the prison); (2) **his own statute can be turned on him** — Decoy/Scepter/Tactician tapping the Warden makes him pay his own law on the untap. A lord beatable with cards from his own color's shops.
- *Glare self-tax:* Glare's cost-tap means your payer eats the law next turn — the prison taxes its guards. AI fuel preference: vigilant attackers (already committed, not blocking). The lock: re-tap their best creature each turn = 1 damage per turn plus a dead card.
- *QoL flag:* the untap step batches N identical triggers — wants the identical-trigger auto-order treatment (Blood Artist chattiness's cousin; implementer item).

**Vocabulary bill (A10 continues):** 5. `UNTAPPED` trigger event (ZONE-adjacent status event; DISCARD-machinery sibling). The attack-trigger tap rides A8 (landing S20); vigilance/reach exist.

**Supporting cards (the Bastion's arsenal; verified):**
- **Glare of Subdual** ✔ (RAV #207) — {2}{G}{W} Enchantment: "Tap an untapped creature you control: Tap target artifact or creature." Bill: **tap-a-creature-as-activation-cost** (A10 word 6 — convoke-lite; chooser machinery parallels sacrifice costs). Gold → R-class.
- **Vindicate** ✔ (APC #126) — {1}{W}{B} Sorcery: "Destroy target permanent." Bill: `anyPermanent` target predicate (tiny) — **the pool's first land destruction**; evaluator's land pricing gets its first test. Gold → R-class.
- Deck seeds (S22 pass): the tap tribe (Master Decoy, Scepter of Dominance, Cunning Tactician — the Bastion's own signature mage belongs here), vigilance bodies, Pacifism, Wrath, Glorious Anthem, GW/WB duals.

## Entry 4 — The Stoker (Furnace Gate, R · b/u)

**The Stoker** — {1}{R}{R}{B}{U} Legendary Creature — Efreet, 5/5
- Whenever an opponent casts a spell, they may pay 2 life. If they don't, you draw a card.
- Cards in your hand have "Cycling {1}{R}."

*Flavor text pending. Visual seed (Chris): **an efreet dealing in magic, heat, and energy** — the furnace-spirit at the Gate, his bargain made law. The "may" is the opponent's alone — the draw is mandatory (Chris-ruled): the furnace does not decline fuel.*

**Design notes (recorded):**
- *Calibrated to the stronghold systems:* at healthy life the toll is a tax; at post-gauntlet interior life (arriving burned from the minion floors) it's nearly unpayable and every spell feeds him. Same card, two games — the dungeon attrition designed sessions earlier is what loads this trigger.
- *Inevitability through selection, not damage:* the cycling grant means he never bricks — every fed card and every drawn card converts toward the answer. Fuel in (their spells), fuel burned (cycling), ash raked back (the recursion suite, pending).
- *The deck-out puzzle path (deliberate, kept by dropping "may"):* overfeed the furnace — cast cheap, never pay, race his 40 against your life. `DECKED` has been a loss reason since S1; a boss defeated by overfeeding rewards puzzle-readers. **Watch item:** his own engine accelerates the race (trigger-draws + cycling-draws); S22 sims confirm the balance; levers are library size and pin discipline.
- *The counterspell story (confirmed, zero work):* his trigger resolves above the cast spell — a drawn Essence Scatter can counter the very spell that paid for it.
- *AI read:* the trigger is automatic; the cycling grant plugs directly into **shipped pin 13** (cycle only when the card has no board use) — the fiddly-control engine is legible to the AI by prior construction. The recursion loop may want one new pin when those cards land.
- *Blessed wrinkles:* lands in hand cycle too (flooded draws are fuel); cards with native cycling offer both abilities at their two costs (CR-clean, cosmetic).
- *Client note:* the opponent's pay-or-don't fires on every spell — featherweight inline prompt, not a modal; auto-resolves at life ≤ 2 (single-option rule, ADR-014).

**Vocabulary bill (A10 continues):** 7. `unlessPay` — the punisher-choice package (opponent-facing pay-or-consequence fork at trigger resolution; Browbeat's class rides in). 8. `grantAbility {zone: hand, ability}` — battlefield static conferring a zone-ability (enumeration-time grant on A5's hand-ability machinery; **no ADR-003 layer contact**). Plus the **activation of SPELL_CAST**, reserved in the data model since S1 ("opponent casts — for later") — not a new word, a debt called in.

**Supporting cards (the Gate's arsenal; verified as marked):**
- **Experimental Overload** ✔ (M21 #218) — {2}{U}{R} Sorcery: "Create an X/X blue and red Weird creature token, where X is the number of instant and sorcery cards in your graveyard. Then you may return an instant or sorcery card from your graveyard to your hand. Exile Experimental Overload." Bill (four small A4/A10-family pieces — chunkier than it reads, stated honestly): typed `graveyardCount` (instant/sorcery filter); **`createToken` with computed P/T** (`pt: <value-ref>`, locked at resolution per the printed ruling); instant-or-sorcery regrowth predicate; spell self-exile resolution rider. `weird_x_x_ur` token def. The Stoker's cycling literally grows the Weird. Gold → R-class.
- **Tainted Phoenix** (custom, Chris-drafted) — {1}{B}{R} Creature — Phoenix (planner suggests **Zombie Phoenix**, Pyre Zombie lineage; Chris rules), 2/2: Flying, haste. "At the beginning of your upkeep, if Tainted Phoenix is in your graveyard, you may pay {B}. If you do, return it to your hand." **A10 word 9: zone-scoped *triggered* abilities** (graveyard upkeep triggers — the Squee-class machinery deliberately dodged in the guardian round, now bought on purpose) + the pay-on-resolution cost rider on ADR-027 optional triggers. Roles: sac fodder, cycling fodder, persistent threat — and with the Stoker out, a bounded draw engine ({1}{R} cycle + {B} return = one extra card per upkeep). Cross-lord note: in a player's Usher deck, every death-and-return also drains. Gold custom → R-class; ADR-052/053 ceremony.
- Deck seeds (S22 pass): the burn suite, cycling natives (Airship Crash, Onslaught lands), Waste Not adjacency, Hymn, UR/BR/UB duals — a graveyard-combustion control shell, fiddly for the human, pin-13-legible for the AI.

## Entry 5 — The Sower (Verdant Throne, G · u/w) — Chris-ratified

**The Sower** — {1}{G}{G}{W}{U} Legendary Creature — Dryad Shaman, 4/4
- Whenever an opponent plays a land, search your library for a Forest card, put it onto the battlefield tapped, then shuffle.
- {3}{W}{U}: Create a 4/4 white and blue Sphinx creature token with flying and vigilance. *(Cost carries a standing playtest note: S22 sims test whether ? wants to sit at 2.)*

*Flavor text pending. Visual seed (Chris): **a dryad that evokes the sphinx-making** — the dreamer and the dreamed. The inversion lord: the only law that doesn't punish — it matches. Everything grows in the Throne's demesne; he is simply better at growing.*

**Design notes (recorded):**
- *The pattern closes:* return · die · untap · cast · **play a land** — the five lords tax the five fundamental actions of the game. Grown, not planned; complete anyway.
- *The secret engine:* "a Forest card" fetches the **typed duals** — Tropical Island, Temple Garden, Breeding Pool are Forests — so the trigger fixes his three colors while ramping, purely via the subtype system. Player-side (sole-drop): the lord makes the ABU/shock investment literally fetchable.
- *"Plays," not "enters" (recommended and load-bearing):* the special action only — an enters-wording would feed him off the opponent's own Wilds cracks and Rampant Growths; plays-wording creates the fight's counterplay: **starve him** by holding land drops, trading your development against his ramp. The fetches arriving tapped keeps the tempo honest.
- *Costing (? = 3):* the decisive asymmetry is player-side — the AI **cannot slow-roll** ("always play a land" is a SanePolicy rule inherited up the ladder), so a player-piloted Grafter is fed every turn by construction; {2} would be a degenerate sole-drop. {3}{W}{U} matches Warrant // Warden's printed sorcery rate exactly (RNA #230, ✔ verified — he casts Warden at will); S22 sims may argue it down.
- *AI read:* both halves are the easiest in the cycle — the trigger is automatic; the activation is a mana-sink the master profile already exploits (Drana/Formation lineage).

**Vocabulary bill: nearly free** — the fifth lord grows from existing soil (green composts; it does not invent). Search-Forest = Amendment 1 + subtype search (Matron machinery); tapped destination and shuffle-always exist; `sphinx_4_4_wu` token def. Sole sliver: a **land-play event emission** (the special action announcing itself; condition machinery does the rest).

**Supporting cards (the Throne's arsenal; verified):**
- **Temporal Spring** ✔ (APC #125) — {1}{G}{U} Sorcery: "Put target permanent on top of its owner's library." **Promoted from the Spire's optional slot to the Sower's GU card** — the enabling twist (Chris): spring an opponent's *land* to their library top, and their re-play triggers the Sower's ramp; forced re-development as fuel. Bill: `bounce {to: libraryTop}` destination (one small param). **Cross-listed to the Unwinder's deck** (pure tempo there; deliberately no ping — the Spring unwinds too far for the tide to taste, as ratified). Gold → R-class.
- **Frondland Felidar** ✔ (IKO #186) — {2}{G}{W} Creature — Cat Beast 3/5: Vigilance. "Creatures you control with vigilance have '{1}, {T}: Tap target creature.'" (Grants to itself, per ruling.) In the Sower's deck **the Sphinx tokens are the payoff** — every vigilant 4/4 flier becomes a tapper. **Cross-listed to the Warden's deck** (vigilance-tribe tap doctrine; the granted {T} eats the Warden's law next turn — the Glare self-tax, consistently). Bill: **battlefield sibling of A10 word 8** — grant-ability with `zone: battlefield, scope: withKeyword(vigilance) + youControl`; the Stoker bought the word, the Felidar reuses it. Gold → R-class.
- Deck seeds (S22 pass): the ramp suite, the sphinx wing + Gravitational Shift, Titania-adjacency deliberately avoided (the elder power next door keeps lands-die orthodoxy; the Sower's is lands-arrive heresy), GU/GW/WU duals and every Forest-typed dual in the game.

Each round owes: the card (spine grammar), the stronghold's partisan law, the escalation schedule's flavor, supporting-card needs (verified), art-notes seed, and the deck's 40. The final gauntlet's design waits on all five — the competition among them is what the endgame interrupts.

---

# Stronghold Systems (Chris-ruled, post-cycle design round)

## The Laws

**Implementation:** each law is a **custom Artifact Enchantment** def (no mana cost, uncastable) put into play at turn zero via `permanentOnBattlefield` — the manalink precedent; zero new machinery. **Scope (Chris-clarified): the law is in play in every fight inside the stronghold** — minion floors and lord alike; the dungeon teaches the law before the lord enforces it. **Destruction is per-battle**: a felled law returns for the next fight — which is the architecture's default behavior for free (every duel is a fresh MatchSpec re-injecting the law). **Laws are destructible by design** (Chris-ratified): the counterplay doctrine at maximum. The removal matrix: Disenchant (W), Airship Crash (G), Vindicate (WB), **Abrade** (R — new pool add, see below), and the blessed quirk — **Boomerang (U) removes a law for the battle in practice**: a zero-cost law bounced to hand can never be recast. The tide-mage unwrites what others tear down.

| Stronghold | Law | Text | Status |
|---|---|---|---|
| The Spiral Spire | *the Risen Tide* (name offered) | The Unwinder's controller may play an additional land on each of their turns | **Replaced the Undertow** (Chris — the original was undevelopable-against); fulfills the lord's original design note: his land-bounce engine runs at zero tempo under his own law |
| The Charnel Court | *the Tithe* | Whenever a creature dies, the intruder loses 1 life | As proposed ✓ |
| The Argent Bastion | *the Intake* | Creatures the intruder controls enter the battlefield tapped | As proposed ✓ — every arrival pays the Warden's law on its first untap |
| The Furnace Gate | *the Toll* | Whenever the intruder casts a spell, the Gate deals 1 damage to them | Shipped with a **watch-flag** (may hit too hard from turn 1; playtest rules) |
| The Verdant Throne | *the Season* | At the beginning of the Sower's upkeep, put a +1/+1 counter on each creature he controls | Shipped with a **watch-flag** (compounding; requires his board, but watch it) |

Vocabulary: Tithe/Toll/Season are existing machinery (observed DIES, SPELL_CAST + damage, scoped addCounters); the Risen Tide needs an **additional-land-drops effect** (a small rules counter the land-play legality check reads — new sliver); the Intake needs **enters-tapped imposed on creatures by static** (extension of the sanctioned enters-tapped special case).

**Abrade** ✔ ({1}{R} Instant: "Choose one — • Abrade deals 3 damage to target creature. • Destroy target artifact." BRC #111 printing per Chris, resolved at fetch) joins the pool at **shopTier 1** (accessible-answers doctrine) — red's law-breaker and honest removal both. Zero new vocabulary (A6 modal).

## Lord life: the pace war (Chris-designed)

`lordStartingLife = base + stepGrowth(totalWorldSteps) − floor(spokeMinionPoints / 3)`, then interior empowerment tiers stack on top at the fight.

- **Base** ~30 (knob per lord).
- **Growth:** all five lords strengthen on the **global** world step count (schedule knob; Chris's calibration target: a dawdling player faces lords at 40–50).
- **Reduction:** minion kills **inside and outside** the stronghold count, attributed **per spoke** — tier N kill = N points; every 3 points = −1 life. Uncapped by points; **floor 15 (Chris-ratified)** — the fight is never trivial.
- The asymmetry is the design: grinding one spoke softens *one* lord while the clock fattens *all five*. Campaign pace becomes strategic identity.
- **Visibility:** §5's visible-schedules law applies — the world UI telegraphs each lord's current strength (rumor/status surface; "the Usher grows fat on the years / has been bled by your hunting").

## The lord's entrance (startsInHand — Chris-ratified)

Stronghold duels only: after the lord's final mulligan keep, one random nonland card returns to the library, the signature comes to hand, shuffle — logged, deterministic, replay-clean. The danger always looms; the drama is when the mana assembles. **Counterplay noted with relish:** black discard (Hymn, Duress, Mind Rot) can strip the entrance before it's paid for — then he must draw into his remaining copies.

## Treasures

The lord's card (sole-drop, `prizeOnly`) + **any 5 picks from the color prize list** (`strongholdPrizePicks: 5`, knob) — the list is the color's R and T3 shelf **including gold cards and the lord's pair duals**; only `prizeOnly` items are blocked (Moxen, boss cards). A stronghold funds a splash-start or a deep tune. Plus the seal (story flag toward the gauntlet unlock; zero mechanics).

## The Lotus Vault (banked design thread)

Black Lotus is locked behind a **sixth dungeon that opens only when all five Mox dungeons are cleared** — guardian TBD (**boss-authoring thread #6**), name TBD. The Vault joins the final gauntlet on the remaining-design list.

## Boss decklists v1 (40 cards; signature ×3; full pool incl. R and duals; for iteration — Chris warned these get the most back-and-forth, and the S22 sims under the laws are the instrument)

**The Unwinder (Spiral Spire):**
17 lands — 5 Island, 1 Mountain, 1 Forest, 2 Volcanic Island, 2 Tropical Island, 1 Taiga, 2 Steam Vents, 2 Breeding Pool, 1 Stomping Ground
23 spells — 3 The Unwinder, 2 Aetherbolt, 2 Aether Mutation, 2 Temporal Spring, 3 Man-o'-War, 2 Mist Raven, 2 Waterfront Bouncer, 2 Boomerang, 2 Aether Channeler, 2 Lightning Bolt, 1 Shock
*Every bounce feeds the ping; under the Risen Tide his land-engine runs free; Spring re-taxes their drops.*

**The Usher (Charnel Court):**
17 lands — 6 Swamp, 1 Plains, 1 Mountain, 2 Scrubland, 2 Badlands, 1 Plateau, 2 Godless Shrine, 1 Blood Crypt, 1 Sacred Foundry
23 spells — 3 The Usher, 2 Phyrexian Purge, 2 Graceful Restoration, 2 Blood Artist, 2 Indulgent Aristocrat, 2 Vampire Nighthawk, 2 Child of Night, 1 Doom Blade, 1 Zombify, 1 Restoration Angel, 2 Swords to Plowshares, 1 Hymn to Tourach, 1 Wrath of God, 1 Vindicate
*Every death under the Tithe is −3/+2 with her out; Purge is nearly free in the Court; Restoration and Zombify keep the pews full — and **the Restoration Angel arms her own blink-launder** (blink the temporary guest, strip the delayed sacrifice, keep the reanimation). AI pin candidate: blink classification should price pending-sacrifice targets; S22 sims tell us whether she finds the line unaided.*

**The Warden (Argent Bastion):**
17 lands — 6 Plains, 1 Forest, 1 Swamp, 2 Savannah, 2 Scrubland, 2 Temple Garden, 1 Godless Shrine, 1 Bayou, 1 Overgrown Tomb
23 spells — 3 The Warden, 2 Glare of Subdual, 2 Frondland Felidar, 2 Master Decoy, 2 Scepter of Dominance, 2 Cunning Tactician, 2 Serra Angel, 2 Pacifism, 2 Swords to Plowshares, 2 Glorious Anthem, 1 Wrath of God, 1 Vindicate
*The vigilance state: everything taps, nothing rests; the Intake makes every intruder creature pay on arrival.*

**The Stoker (Furnace Gate):**
17 lands — 5 Mountain, 1 Swamp, 1 Island, 2 Badlands, 2 Volcanic Island, 2 Blood Crypt, 2 Steam Vents, 1 Watery Grave, 1 Forgotten Cave
23 spells — 3 The Stoker, 2 Tainted Phoenix, 2 Experimental Overload, 3 Lightning Bolt, 2 Shock, 1 Pyroclasm, 2 Blaze, 2 Hymn to Tourach, 2 Doom Blade, 2 Essence Scatter, 1 Counterspell, 1 Dark Ritual
*The Toll + the trigger tax every cast twice; the Phoenix loops; Overload's Weird grows on the ash.*

**The Sower (Verdant Throne):**
17 lands — 5 Forest, 1 Plains, 1 Island, 2 Tropical Island, 2 Savannah, 2 Temple Garden, 2 Breeding Pool, 1 Tundra, 1 Hallowed Fountain
23 spells — 3 The Sower, 2 Frondland Felidar, 2 Temporal Spring, 3 Llanowar Elves, 2 Rampant Growth, 2 Elvish Visionary, 2 Gaean Wurm, 1 Pelakka Wurm, 1 Serra Angel, 1 Faerie Formation, 2 Essence Scatter, 2 Swords to Plowshares
*Thirteen Forest-typed fetch targets; Spring re-taxes their drops into his trigger; Serra joins the Felidar's vigilance-tapper corps; the Formation's faerie swarm compounds under the Season — every token gets its counter each upkeep. (Gravitational Shift cut by Chris: its −2/−0 to nonfliers hit the Sower himself and his dorks — a planner-seed error, fixed.)*
