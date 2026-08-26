import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { validateCard, asCardDef, type CardDef } from "@shandalar/cards";
import { replayGame, runMatch, type MatchResult, type MatchSpec } from "@shandalar/engine";
import { RandomAgent } from "@shandalar/agents";
import { LORD_DECKS as LORDS } from "./lord-decks.js";

const CARDS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards");

/**
 * S22 A10 fuzz-before-fixtures: synthetic cards exercise each of the nine words (and the riders)
 * under random play BEFORE the real cards carry them — the S3 protocol. Every card validates
 * through the normal validator (no back doors).
 *
 * Word coverage: 1 RETURNED_TO_HAND (tide mage's ping) · 2 returnToHand cost (tide mage's engine) ·
 * 3 temporary reanimate (usher) · 4 any-number request-loop + life-per-target (purge) ·
 * 5 UNTAPPED + event addressing (warden law) · 6 tapCreature cost (glare) · 7 unlessPay (stoker) ·
 * 8 grantAbility hand + battlefield (stoker's cycling, felidar) · 9 graveyard-zone trigger +
 * optionalCost (phoenix). Riders: who:any, powerAtMost, withCounters, bounce libraryTop,
 * targetManaValue, createToken count/pt refs, typed graveyardCount, selfExileOnResolve,
 * SPELL_CAST + LAND_PLAYED activations.
 */
const SYNTH: unknown[] = [
  {
    id: "test_a10_tide_mage", name: "A10 Tide Mage", source: "custom", text: "test", manaCost: "{U}",
    types: ["Creature"], subtypes: ["Wizard"], power: 1, toughness: 2,
    abilities: [
      { kind: "triggered", event: "RETURNED_TO_HAND", condition: { source: "any" }, targets: [{ count: 1, predicate: "anyTarget", zone: "any" }], effects: [{ type: "damage", amount: 1, target: 0 }] },
      { kind: "activated", cost: { mana: "{G}", returnToHand: { predicate: "land" } }, effects: [{ type: "draw", count: 1, who: "you" }] },
    ],
  },
  {
    id: "test_a10_spring", name: "A10 Spring", source: "custom", text: "test", manaCost: "{G}",
    types: ["Sorcery"], targets: [{ count: 1, predicate: "permanent", zone: "battlefield" }],
    spellEffect: [{ type: "bounce", target: 0, to: "libraryTop" }],
  },
  {
    id: "test_a10_glare", name: "A10 Glare", source: "custom", text: "test", manaCost: "{1}",
    types: ["Enchantment"],
    abilities: [
      { kind: "activated", cost: { tapCreature: { predicate: "creature", count: 1 } }, targets: [{ count: 1, predicate: "creature", zone: "battlefield" }], effects: [{ type: "tapTarget", target: 0 }] },
    ],
  },
  {
    id: "test_a10_felidar", name: "A10 Felidar", source: "custom", text: "test", manaCost: "{2}",
    types: ["Creature"], subtypes: ["Cat"], power: 1, toughness: 3, keywords: ["vigilance"],
    abilities: [
      { kind: "static", effects: [{ type: "grantAbility", zone: "battlefield", scope: "creaturesYouControl", withKeyword: "vigilance", ability: { kind: "activated", cost: { mana: "{1}", tap: true }, targets: [{ count: 1, predicate: "creature", zone: "battlefield" }], effects: [{ type: "tapTarget", target: 0 }] } }] },
    ],
  },
  {
    id: "test_a10_mutation", name: "A10 Mutation", source: "custom", text: "test", manaCost: "{1}{U}",
    types: ["Sorcery"], targets: [{ count: 1, predicate: "creature", zone: "battlefield" }],
    spellEffect: [
      { type: "bounce", target: 0 },
      { type: "createToken", tokenId: "bear_2_2", count: { ref: "targetManaValue", target: 0 }, who: "you" },
    ],
  },
  {
    id: "test_a10_stoker", name: "A10 Stoker", source: "custom", text: "test", manaCost: "{1}{R}",
    types: ["Creature"], subtypes: ["Efreet"], power: 2, toughness: 2,
    abilities: [
      { kind: "triggered", event: "SPELL_CAST", condition: { controller: "opponent" }, unlessPay: { life: 2 }, effects: [{ type: "draw", count: 1, who: "you" }] },
      { kind: "static", effects: [{ type: "grantAbility", zone: "hand", ability: { kind: "activated", zone: "hand", cost: { mana: "{1}", discardSelf: true }, effects: [{ type: "draw", count: 1, who: "you" }] } }] },
    ],
  },
  {
    id: "test_a10_usher", name: "A10 Usher", source: "custom", text: "test", manaCost: "{2}{B}",
    types: ["Creature"], subtypes: ["Vampire"], power: 2, toughness: 2,
    abilities: [
      { kind: "triggered", event: "ENTERS_BATTLEFIELD", targets: [{ count: 1, predicate: "creatureCardInYourGraveyard", zone: "graveyard", who: "any" }], effects: [{ type: "returnFromGraveyard", target: 0, to: "battlefield", temporary: true }] },
    ],
  },
  {
    id: "test_a10_phoenix", name: "A10 Phoenix", source: "custom", text: "test", manaCost: "{B}",
    types: ["Creature"], subtypes: ["Phoenix"], power: 1, toughness: 1, keywords: ["haste"],
    abilities: [
      { kind: "triggered", event: "UPKEEP", zone: "graveyard", optional: true, optionalCost: { mana: "{B}" }, effects: [{ type: "returnFromGraveyard", scope: "self", to: "hand" }] },
    ],
  },
  {
    id: "test_a10_purge", name: "A10 Purge", source: "custom", text: "test", manaCost: "{B}",
    types: ["Sorcery"], targets: [{ count: "any", predicate: "creature", zone: "battlefield" }],
    additionalCost: { life: 1, perTarget: true },
    spellEffect: [{ type: "destroy", targetSpec: 0 }],
  },
  {
    id: "test_a10_grace", name: "A10 Grace", source: "custom", text: "test", manaCost: "{1}{B}",
    types: ["Sorcery"], targets: [{ count: 1, predicate: "creatureCardInYourGraveyard", zone: "graveyard", powerAtMost: 2 }],
    spellEffect: [{ type: "returnFromGraveyard", target: 0, to: "battlefield", withCounters: { kind: "+1/+1", count: 1 } }],
  },
  {
    id: "test_a10_overload", name: "A10 Overload", source: "custom", text: "test", manaCost: "{1}{R}",
    types: ["Sorcery"], selfExileOnResolve: true,
    spellEffect: [{ type: "createToken", tokenId: "zombie_2_2", count: { ref: "graveyardCount", who: "you", types: ["Sorcery"] }, who: "you", pt: { ref: "graveyardCount", who: "you", types: ["Instant", "Sorcery"] } }],
  },
  {
    id: "test_a10_warden_law", name: "A10 Warden Law", source: "custom", text: "test", manaCost: "{1}",
    types: ["Enchantment"],
    abilities: [
      { kind: "triggered", event: "UNTAPPED", condition: { source: "any", type: ["Creature"] }, effects: [{ type: "damage", amount: 1, to: "eventPlayer", from: "eventObject" }] },
    ],
  },
  {
    id: "test_a10_sower_eye", name: "A10 Sower Eye", source: "custom", text: "test", manaCost: "{1}",
    types: ["Enchantment"],
    abilities: [
      { kind: "triggered", event: "LAND_PLAYED", condition: { controller: "opponent" }, effects: [{ type: "draw", count: 1, who: "you" }] },
    ],
  },
];

function poolWithSynthetics(): Map<string, CardDef> {
  const pool = loadCardPool(CARDS_DIR);
  for (const raw of SYNTH) {
    const { errors } = validateCard(raw);
    expect(errors, (raw as { id: string }).id).toEqual([]);
    const def = asCardDef(raw);
    pool.cards.set(def.id, def);
  }
  return pool.cards;
}

const DECK_TIDES: { cardId: string; count: number }[] = [
  { cardId: "island", count: 8 }, { cardId: "forest", count: 8 },
  { cardId: "test_a10_tide_mage", count: 4 }, { cardId: "boomerang", count: 4 },
  { cardId: "test_a10_spring", count: 4 }, { cardId: "test_a10_glare", count: 3 },
  { cardId: "grizzly_bears", count: 4 }, { cardId: "test_a10_felidar", count: 4 },
  { cardId: "test_a10_mutation", count: 4 },
];
const DECK_FURNACE: { cardId: string; count: number }[] = [
  { cardId: "swamp", count: 8 }, { cardId: "mountain", count: 8 },
  { cardId: "test_a10_stoker", count: 4 }, { cardId: "test_a10_usher", count: 4 },
  { cardId: "test_a10_phoenix", count: 4 }, { cardId: "test_a10_purge", count: 4 },
  { cardId: "test_a10_grace", count: 4 }, { cardId: "test_a10_overload", count: 4 },
  { cardId: "test_a10_warden_law", count: 3 }, { cardId: "test_a10_sower_eye", count: 3 },
];

function spec(seed: number): MatchSpec {
  return {
    seed,
    players: [
      { name: "Tides", decklist: DECK_TIDES, agent: "random" },
      { name: "Furnace", decklist: DECK_FURNACE, agent: "random" },
    ],
    rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 100 },
    modifiers: [],
  };
}

async function run(cards: Map<string, CardDef>, seed: number): Promise<MatchResult> {
  return runMatch(spec(seed), cards, [new RandomAgent(seed * 2 + 1), new RandomAgent(seed * 2 + 2)]);
}

/** The boss-doc v1 lord decklists — the batch's fuzz decks here; canonical home is
 * packages/sim/src/lord-decks.ts (S22b's stronghold content references them by key). */
const LORD_DECKS: Record<string, { cardId: string; count: number }[]> = Object.fromEntries(
  Object.entries(LORDS).map(([k, v]) => [k, v.decklist]),
);

describe("S22 batch fuzz — the lord decks under random play (fuzz-before-fixtures for Part 2)", () => {
  const games = process.env.FUZZ_FULL ? 60 : 12; // per pairing; five pairings cover all five decks
  const PAIRS: [string, string][] = [["unwinder", "usher"], ["warden", "stoker"], ["sower", "unwinder"], ["usher", "stoker"], ["warden", "sower"]];
  it(`${games} games x 5 lord-deck pairings: zero exceptions, every game terminates`, async () => {
    const cards = poolWithSynthetics();
    for (const [a, b] of PAIRS) {
      for (let seed = 1; seed <= games; seed++) {
        const result = await runMatch(
          { seed, players: [ { name: a, decklist: LORD_DECKS[a]!, agent: "random" }, { name: b, decklist: LORD_DECKS[b]!, agent: "random" } ], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 100 }, modifiers: [] },
          cards, [new RandomAgent(seed * 2 + 1), new RandomAgent(seed * 2 + 2)]);
        expect(result.reason).toBeTruthy();
      }
    }
  }, 600_000);

  it("lord-deck replay determinism (the lords' own request shapes replay byte-identical)", async () => {
    const cards = poolWithSynthetics();
    for (const [a, b, seed] of [["unwinder", "usher", 5], ["warden", "stoker", 9], ["sower", "unwinder", 13]] as const) {
      const live = await runMatch(
        { seed, players: [ { name: a, decklist: LORD_DECKS[a]!, agent: "random" }, { name: b, decklist: LORD_DECKS[b]!, agent: "random" } ], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 100 }, modifiers: [] },
        cards, [new RandomAgent(seed * 2 + 1), new RandomAgent(seed * 2 + 2)]);
      const replayed = await replayGame(
        cards,
        [LORD_DECKS[a]!.flatMap((d) => Array(d.count).fill(d.cardId)), LORD_DECKS[b]!.flatMap((d) => Array(d.count).fill(d.cardId))],
        live.log,
        { startingLife: 20, handSize: 7, maxTurns: 100, ante: 0 },
        [],
      );
      expect(replayed, `${a}-${b} seed ${seed}`).toBe(live.finalStateSerialized);
    }
  }, 120_000);
});

describe("S22 A10 synthetic fuzz (fuzz-before-fixtures)", () => {
  const games = process.env.FUZZ_FULL ? 300 : 60;
  it(`${games} random games over the nine-word decks: zero exceptions, every game terminates`, async () => {
    const cards = poolWithSynthetics();
    const terminations: Record<string, number> = {};
    for (let seed = 1; seed <= games; seed++) {
      const result = await run(cards, seed);
      terminations[result.reason] = (terminations[result.reason] ?? 0) + 1;
    }
    expect(Object.values(terminations).reduce((a, b) => a + b, 0)).toBe(games);
  }, 600_000);

  it("replay determinism holds through the new request shapes (variable-target loop, unlessPay, optionalCost, cost picks)", async () => {
    const cards = poolWithSynthetics();
    for (const seed of [3, 17, 41]) {
      const live = await run(cards, seed);
      const replayed = await replayGame(
        cards,
        [DECK_TIDES.flatMap((d) => Array(d.count).fill(d.cardId)), DECK_FURNACE.flatMap((d) => Array(d.count).fill(d.cardId))],
        live.log,
        { startingLife: 20, handSize: 7, maxTurns: 100, ante: 0 },
        [],
      );
      expect(replayed, `seed ${seed}`).toBe(live.finalStateSerialized);
    }
  }, 120_000);
});
