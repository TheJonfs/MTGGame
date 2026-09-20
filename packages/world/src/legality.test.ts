import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { loadCatalog } from "./loader.js";
import { catalogFrom, type OpponentTemplate } from "./catalog.js";
import { checkDeck, describeDeckRule, validateDeckRule, type DeckRule } from "./legality.js";
import { deckLegal, doorCheck, doorRefusalText } from "./journey.js";
import { newWorld, starterDecklist, starterTemplate, type Decklist } from "./state.js";
import { renderEnemiesReference } from "./reference-docs.js";
import { defaultKnobs } from "./knobs.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const catalog = loadCatalog(join(ROOT, "data/world"));
const white = starterDecklist(starterTemplate(catalog, "white"), "standard");
const count = (d: Decklist, pred: (id: string) => boolean) => d.reduce((n, e) => n + (pred(e.cardId) ? e.count : 0), 0);
const creatures = count(white, (id) => pool.get(id)!.types.includes("Creature"));
const lands = count(white, (id) => pool.get(id)!.types.includes("Land"));

/** A catalog clone with one extra template carrying a rule (the S37 "test template"). */
function withDoor(rule: DeckRule, id = "test_gate"): ReturnType<typeof catalogFrom> {
  const gate: OpponentTemplate = { id, name: "The Test Gate", deck: "mage:brann", tier: 1, difficulty: "apprentice", portrait: "mage-brann", worldLife: 10, colors: "R", deckRule: rule };
  return catalogFrom(JSON.parse(JSON.stringify({
    regions: { catalogVersion: "v1", regions: catalog.regions, strongholds: catalog.strongholds }, towns: { catalogVersion: "v1", names: catalog.townNames },
    opponents: { catalogVersion: "v1", opponents: [...catalog.opponents, gate] }, starters: { catalogVersion: "v1", starters: catalog.starters },
    quests: { catalogVersion: "v1", offers: catalog.questText!.offers, rumors: catalog.questText!.rumors, corolla: catalog.questText!.corolla, heart: catalog.questText!.heart, door: catalog.questText!.door },
  })));
}

describe("S37 (ADR-123): checkDeck — every problem as a sentence", () => {
  it("the base rules: the floor and the cap; a legal starter has no problems; deckLegal is the first problem", () => {
    expect(checkDeck(white)).toEqual({ ok: true, problems: [] });
    const short = white.slice(0, 3);
    const c = checkDeck(short, null, null, pool);
    expect(c.ok).toBe(false);
    expect(c.problems[0]).toMatch(/^deck has \d+ cards; the floor is 30$/);
    const fat = [...white, { cardId: "savannah_lions", count: 5 }];
    expect(checkDeck(fat, null, null, pool).problems).toEqual(["Savannah Lions ×5 exceeds the 4-copy cap"]);
    expect(checkDeck([{ cardId: "plains", count: 30 }]).ok).toBe(true); // basics are exempt from the cap
    expect(deckLegal(short)).toMatchObject({ ok: false, reason: expect.stringMatching(/the floor is 30/) });
  });
  it("ownership when a collection is given (basics free); the problems combine", () => {
    const collection = Object.fromEntries(white.map((e) => [e.cardId, e.count]));
    expect(checkDeck(white, collection).ok).toBe(true);
    const deck = [...white, { cardId: "serra_angel", count: 2 }];
    const c = checkDeck(deck, collection, null, pool);
    expect(c.problems).toEqual(["Serra Angel: deck has 2, you own 0"]);
    expect(checkDeck(deck, { ...collection, serra_angel: 2 }).ok).toBe(true);
    const both = checkDeck([{ cardId: "serra_angel", count: 5 }], {}, null, pool);
    expect(both.problems).toEqual(["deck has 5 cards; the floor is 30", "Serra Angel ×5 exceeds the 4-copy cap", "Serra Angel: deck has 5, you own 0"]);
  });
  it("each rule field, on the white starter", () => {
    const rule = (r: Omit<DeckRule, "label">): DeckRule => ({ ...r, label: "the Test Gate" });
    expect(checkDeck(white, null, rule({ colorsWithin: ["W", "U", "R"] }), pool).ok).toBe(true);
    const off = checkDeck(white, null, rule({ colorsWithin: ["U", "R"] }), pool);
    expect(off.ok).toBe(false);
    expect(off.problems[0]).toMatch(/^\d+ cards are outside the Test Gate's colours \(UR\): .*Savannah Lions|^\d+ cards are outside the Test Gate's colours \(UR\): /);
    expect(off.problems[0]).not.toMatch(/Plains/); // colourless and lands are always in
    expect(checkDeck(white, null, rule({ minCreatures: creatures }), pool).ok).toBe(true);
    expect(checkDeck(white, null, rule({ minCreatures: creatures + 1 }), pool).problems).toEqual([`${creatures} creatures; the Test Gate asks ${creatures + 1}`]);
    expect(checkDeck(white, null, rule({ maxLands: lands }), pool).ok).toBe(true);
    expect(checkDeck(white, null, rule({ maxLands: lands - 1 }), pool).problems).toEqual([`${lands} lands; the Test Gate allows ${lands - 1}`]);
    expect(checkDeck(white, null, rule({ maxManaValue: 9 }), pool).ok).toBe(true);
    const low = checkDeck(white, null, rule({ maxManaValue: 1 }), pool);
    expect(low.ok).toBe(false);
    expect(low.problems[0]).toMatch(/^\d+ cards above mana value 1; the Test Gate allows none: /);
    const single = checkDeck(white, null, rule({ singleton: true }), pool);
    expect(single.ok).toBe(false);
    expect(single.problems[0]).toMatch(/cards have more than one copy; the Test Gate is singleton: /);
    expect(single.problems[0]).not.toMatch(/Plains/); // basics exempt
    expect(checkDeck([{ cardId: "plains", count: 19 }, ...white.filter((e) => e.cardId !== "plains").map((e) => ({ ...e, count: 1 }))], null, rule({ singleton: true }), pool).ok).toBe(true); // 19 + 11 = 30
    expect(checkDeck(white, null, rule({ minCards: 40 }), pool).problems).toEqual(["30 cards; the Test Gate asks 40"]);
    // Several fields, several sentences — in field order.
    const many = checkDeck(white, null, rule({ colorsWithin: ["U"], minCreatures: 99, maxLands: 0, minCards: 60 }), pool);
    expect(many.problems).toHaveLength(4);
    expect(many.problems[0]).toMatch(/^30 cards; the Test Gate asks 60$/);
    // A rule that reads the cards needs the pool — the check throws rather than admit.
    expect(() => checkDeck(white, null, rule({ colorsWithin: ["W"] }))).toThrow(/pass the pool/);
    expect(checkDeck(white, null, rule({ minCards: 30 })).ok).toBe(true); // a count-only rule reads nothing
  });
  it("describeDeckRule: the rule in one line", () => {
    expect(describeDeckRule({ label: "x", colorsWithin: ["W", "U", "R"], minCreatures: 15, maxLands: 12, maxManaValue: 4, singleton: true, minCards: 40 })).toBe("colours within WUR; ≥ 15 creatures; ≤ 12 lands; mana value ≤ 4; singleton; ≥ 40 cards");
    expect(describeDeckRule({ label: "x" })).toBe("no constraint");
  });
});

describe("S37 (ADR-123): deckRule on a template — the validator, enemies.md, the door", () => {
  it("the catalog validator names every field: label required, colours WUBRG and distinct, counts non-negative integers, unknown keys rejected", () => {
    expect(validateDeckRule({ label: "ok", colorsWithin: ["W", "U"], minCreatures: 15, maxLands: 12, maxManaValue: 4, singleton: true, minCards: 40 }, "t")).toEqual([]);
    expect(validateDeckRule({ colorsWithin: ["W"] }, "t")).toEqual(["t: deckRule.label must be a non-empty string"]);
    expect(validateDeckRule({ label: "x", colorsWithin: ["W", "W"] }, "t")).toEqual(["t: deckRule.colorsWithin must be a non-empty array of distinct WUBRG letters"]);
    expect(validateDeckRule({ label: "x", colorsWithin: ["C"] }, "t")).toHaveLength(1);
    expect(validateDeckRule({ label: "x", minCreatures: -1, maxLands: 1.5, singleton: "yes", bogus: 1 }, "t")).toEqual([
      't: unknown deckRule field "bogus"', "t: deckRule.minCreatures must be a non-negative integer", "t: deckRule.maxLands must be a non-negative integer", "t: deckRule.singleton must be a boolean",
    ]);
    expect(() => withDoor({ label: "", colorsWithin: ["W"] })).toThrow(/deckRule.label/);
    expect(withDoor({ label: "the Test Gate", colorsWithin: ["W"] }).opponents.find((o) => o.id === "test_gate")?.deckRule?.label).toBe("the Test Gate");
    // No existing template carries a rule (the brief: data shape only).
    expect(catalog.opponents.filter((o) => o.deckRule)).toHaveLength(0);
  });
  it("enemies.md renders the rule in the notes when present (and not otherwise)", () => {
    const text = renderEnemiesReference(withDoor({ label: "the Jeskai gate", colorsWithin: ["W", "U", "R"], minCreatures: 15 }), pool, defaultKnobs());
    expect(text).toContain("| The Test Gate |");
    expect(text).toContain("door: the Jeskai gate (colours within WUR; ≥ 15 creatures)");
    // S41: the only shipped doors are the flood's ten seats (five colour gates, five shape gates); phase one carries none.
    expect(renderEnemiesReference(catalog, pool, defaultKnobs()).match(/door: /g)).toHaveLength(10);
  });
  it("the door: doorCheck reads the ACTIVE deck; the refusal is the planner's line, the label, the rule and the problems", () => {
    const cat = withDoor({ label: "the Test Gate", colorsWithin: ["U", "R"], minCreatures: 99 });
    const w = newWorld({ seed: 7, catalog: cat, starter: "white", difficulty: "standard", playerName: "T" });
    const gate = cat.opponents.find((o) => o.id === "test_gate")!;
    expect(doorCheck(w, catalog.opponents[0]!, pool)).toBeNull(); // no rule, no door
    const check = doorCheck(w, gate, pool)!;
    expect(check.ok).toBe(false);
    expect(check.problems).toHaveLength(2);
    const text = doorRefusalText(cat, gate.deckRule!, check);
    expect(text).toMatch(/^The gate knows your colours\. It will not open to these\. the Test Gate \(colours within UR; ≥ 99 creatures\): \d+ cards are outside/);
    expect(text).toMatch(/creatures; the Test Gate asks 99\.$/);
    // Without a door pack the fallback line stands.
    expect(doorRefusalText({}, gate.deckRule!, check)).toMatch(/^The gate will not open to this deck\./);
  });
});

describe("S40 (ADR-128): the three new gates — a stat floor, a fraction, a type ban; the door's own lines", () => {
  const deck = (pairs: [string, number][]): Decklist => pairs.map(([cardId, count]) => ({ cardId, count }));
  it("minCreaturePower: every creature card's printed power ≥ N, each offender named", () => {
    const d = deck([["forest", 14], ["grizzly_bears", 4], ["hedron_crab", 3], ["llanowar_elves", 3], ["wall_of_blossoms", 2], ["giant_growth", 4]]);
    const c = checkDeck(d, null, { label: "the Wrackroot gate", minCreaturePower: 2 }, pool);
    expect(c.problems).toEqual(["8 creatures have power less than 2: Hedron Crab ×3, Llanowar Elves ×3, Wall of Blossoms ×2"]);
    expect(c.failed).toEqual(["minCreaturePower"]);
    expect(checkDeck(deck([["forest", 14], ["grizzly_bears", 4], ["giant_growth", 4], ["rampant_growth", 4], ["rumbling_baloth", 4]]), null, { label: "g", minCreaturePower: 2 }, pool).ok).toBe(true);
  });
  it("minLandFraction: lands ÷ cards ≥ N — 12 of 30 fails half, 15 of 30 passes, 15 of 31 fails", () => {
    const rule: DeckRule = { label: "the Observatory gate", minLandFraction: 0.5 };
    expect(checkDeck(deck([["plains", 12], ["savannah_lions", 4], ["soul_warden", 4], ["raise_the_alarm", 4], ["pacifism", 4], ["serra_angel", 2]]), null, rule, pool).problems).toEqual(["lands are 12 of 30; the Observatory gate asks half"]);
    expect(checkDeck(deck([["plains", 15], ["savannah_lions", 4], ["soul_warden", 4], ["raise_the_alarm", 4], ["pacifism", 3]]), null, rule, pool).ok).toBe(true);
    expect(checkDeck(deck([["plains", 15], ["savannah_lions", 4], ["soul_warden", 4], ["raise_the_alarm", 4], ["pacifism", 4]]), null, rule, pool).ok).toBe(false);
    expect(checkDeck(deck([["plains", 10], ["savannah_lions", 4], ["soul_warden", 4], ["raise_the_alarm", 4], ["pacifism", 4], ["serra_angel", 4]]), null, { label: "g", minLandFraction: 0.4 }, pool).problems).toEqual(["lands are 10 of 30; g asks 40%"]);
  });
  it("bannedTypes: no card of the type — a flash creature is a creature, a sorcery stays", () => {
    const d = deck([["forest", 8], ["island", 8], ["giant_growth", 2], ["counterspell", 1], ["mystic_snake", 2], ["rampant_growth", 4], ["grizzly_bears", 4], ["divination", 1]]);
    const c = checkDeck(d, null, { label: "the Shevelport gate", bannedTypes: ["Instant"] }, pool);
    expect(c.problems).toEqual(["3 instants: Giant Growth ×2, Counterspell"]);
    expect(c.failed).toEqual(["bannedTypes"]);
  });
  it("the validator and the one-line description know the three fields", () => {
    expect(validateDeckRule({ label: "x", minCreaturePower: -1, minLandFraction: 1.5, bannedTypes: ["Instant", "Planeswalker"] }, "t")).toEqual([
      "t: deckRule.minCreaturePower must be a non-negative integer", "t: deckRule.minLandFraction must be a number in (0, 1]", "t: deckRule.bannedTypes must be a non-empty array of distinct card types",
    ]);
    expect(validateDeckRule({ label: "x", minCreaturePower: 2, minLandFraction: 0.5, bannedTypes: ["Instant"] }, "t")).toEqual([]);
    expect(describeDeckRule({ label: "x", minCreaturePower: 2, minLandFraction: 0.5, bannedTypes: ["Instant"] })).toBe("every creature's power ≥ 2; lands ≥ half of the deck; no instants");
  });
  it("the door speaks the first failed field's own line (the planner's five); the colour gate keeps the S37 line; a bad pack names its field", () => {
    const lines = catalog.questText!.door!.byRule!;
    expect(Object.keys(lines).sort()).toEqual(["bannedTypes", "maxManaValue", "minCreaturePower", "minCreatures", "minLandFraction"]);
    for (const [rule, opening] of [
      [{ label: "Odile's gate", minCreatures: 99 }, "Bring bodies to the fire."],
      [{ label: "Zinnia's gate", minCreaturePower: 9 }, "Nothing small. The water takes the small things first."],
      [{ label: "Isaura's gate", minLandFraction: 0.9 }, "Half of what you bring must be ground."],
      [{ label: "Meliyan's gate", maxManaValue: 0 }, "Nothing dear."],
    ] as [DeckRule, string][]) {
      const check = checkDeck(white, null, rule, pool);
      expect(check.ok, rule.label).toBe(false);
      expect(doorRefusalText(catalog, rule, check).startsWith(`${opening} ${rule.label} (`), rule.label).toBe(true);
    }
    const instants = deck([["forest", 20], ["giant_growth", 4], ["grizzly_bears", 4], ["rampant_growth", 2]]);
    const ban: DeckRule = { label: "Ovna's gate", bannedTypes: ["Instant"] };
    expect(doorRefusalText(catalog, ban, checkDeck(instants, null, ban, pool))).toMatch(/^No sudden things\. Ovna's gate \(no instants\): 4 instants: Giant Growth ×4\.$/);
    // S41: a SITE's own line wins over the field's fallback (the courts' words, numbers and all).
    const odile = catalog.flood!.courts.find((c) => c.id === "tallyflame_court")!;
    expect(doorRefusalText(catalog, odile.deckRule!, checkDeck(instants, null, odile.deckRule!, pool), odile.id)).toMatch(/^Bring bodies to the fire\. Twelve, at the least\. the Tallyflame gate \(≥ 12 creatures\): 4 creatures; the Tallyflame gate asks 12\.$/);
    expect(Object.keys(catalog.questText!.door!.bySite!).sort()).toEqual(["cairnbrand_pyre", "obsidian_observatory", "shevelport_green", "tallyflame_court", "wrackroot_shallows"]);
    // Colour first: the S37 line stands even when a shape gate also fails.
    const both: DeckRule = { label: "g", colorsWithin: ["U"], minCreatures: 99 };
    expect(doorRefusalText(catalog, both, checkDeck(white, null, both, pool))).toMatch(/^The gate knows your colours\./);
    // No shipped site carries a rule yet (S41 attaches them).
    expect(catalog.opponents.filter((o) => o.deckRule)).toHaveLength(0);
  });
});
