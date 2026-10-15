import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { validateCard } from "@shandalar/cards";
import { runMatch, type ActionRequest, type Agent, type GameView, type MatchSpec, type Modifier } from "@shandalar/engine";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const cards = loadCardPool(join(ROOT, "data/cards")).cards;
const perm = (player: 0 | 1, cardId: string): Modifier => ({ type: "permanentOnBattlefield", player, cardId });
const D = (ids: Record<string, number>) => Object.entries(ids).map(([cardId, count]) => ({ cardId, count }));
const pass = (r: ActionRequest) => r.actions.find((a) => a.type === "pass") ?? r.actions[0]!;
const passer: Agent = { chooseAction: async (_v, r) => pass(r) };
type Final = { players: { hand: string[]; library: string[] }[] };
const fin = (r: { finalStateSerialized: string }) => JSON.parse(r.finalStateSerialized) as Final;
/** Cards drawn this turn: the library began at 53 (sixty less the opening seven; the player on the play draws nothing). The hand is not counted — cleanup discards to seven. */
const drawn = (f: Final) => 53 - f.players[0]!.library.length;
const spec = (deck: Record<string, number>, mods: Modifier[]): MatchSpec =>
  ({ seed: 64, players: [{ name: "a", decklist: D(deck), agent: "x" }, { name: "b", decklist: D({ mountain: 60 }), agent: "x" }], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 1, startingPlayer: 0 } as MatchSpec["rules"], modifiers: mods });
/** Seat 0 casts `cardId` once in its first main phase and says yes to every "may" (paying when asked). */
const caster = (cardId: string): Agent => {
  let cast = false;
  return { chooseAction: async (v: GameView, r) => {
    const yes = r.actions.find((a) => a.type === "acceptOptional"); if (yes) return yes;
    if (!cast && r.purpose === "priority" && v.step === "MAIN1" && v.stack.length === 0) { const a = r.actions.find((x) => x.type === "castSpell" && v.hand.find((h) => h.objectId === x.objectId)?.cardId === cardId); if (a) { cast = true; return a; } }
    return pass(r);
  } };
};
const plains = (n: number) => Array.from({ length: n }, () => perm(0, "plains"));

/**
 * S64 (ADR-180) — Mentor of the Meek, verified against Scryfall 2026-10-15: first printed in Innistrad (the brief
 * had M12), {2}{W} Creature — Human Soldier 2/2, "Whenever another creature you control with power 2 or less enters,
 * you may pay {1}. If you do, draw a card." R-110: the entering creature's power as it is on the battlefield
 * (CR 603.6a — an Anthem counts); the optional payment is the Tainted Phoenix's word (A10 word 9's rider).
 */
describe("Mentor of the Meek", () => {
  it("is valid as printed", () => {
    const d = cards.get("mentor_of_the_meek")!;
    expect(validateCard(d).errors).toEqual([]);
    expect(d).toMatchObject({ manaCost: "{2}{W}", power: 2, toughness: 2, subtypes: ["Human", "Soldier"], source: "real", shopTier: 2 });
  });
  it("two 1/1 tokens entering: two triggers, each paid — two cards", async () => {
    const f = fin(await runMatch(spec({ raise_the_alarm: 60 }, [...plains(4), perm(0, "mentor_of_the_meek")]), cards, [caster("raise_the_alarm"), passer]));
    expect(drawn(f)).toBe(2);
  });
  it("only one mana left after the Alarm: one trigger paid, the other cannot be", async () => {
    const f = fin(await runMatch(spec({ raise_the_alarm: 60 }, [...plains(3), perm(0, "mentor_of_the_meek")]), cards, [caster("raise_the_alarm"), passer]));
    expect(drawn(f)).toBe(1);
  });
  it("a creature of power three does not trigger it; a 2/1 under a Glorious Anthem enters as a 3/2 and does not either", async () => {
    const courser = fin(await runMatch(spec({ centaur_courser: 60 }, [...plains(3), perm(0, "forest"), perm(0, "forest"), perm(0, "mentor_of_the_meek")]), cards, [caster("centaur_courser"), passer]));
    expect(drawn(courser)).toBe(0);
    const anthem = fin(await runMatch(spec({ savannah_lions: 60 }, [...plains(3), perm(0, "glorious_anthem"), perm(0, "mentor_of_the_meek")]), cards, [caster("savannah_lions"), passer]));
    expect(drawn(anthem)).toBe(0);
    const bare = fin(await runMatch(spec({ savannah_lions: 60 }, [...plains(3), perm(0, "mentor_of_the_meek")]), cards, [caster("savannah_lions"), passer]));
    expect(drawn(bare)).toBe(1); // without the Anthem the Lions are a 2/1: paid, drawn
  });
});

/**
 * S64 (Chris's custom card, his design of 2026-10-15 after a single-factor study): Karmic Mentor — {1}{W}{W} Creature —
 * Angel 2/2, flying, "When Karmic Mentor enters, return target non-Aura permanent card with mana value 2 or less from
 * your graveyard to the battlefield." The target word `nonAuraPermanentCardInYourGraveyard` (an Aura put onto the
 * battlefield must be attached as it enters — CR 303.4f — which no return does here). Mana value 3: it cannot return
 * itself or a sibling (no Altar loop).
 */
describe("Karmic Mentor", () => {
  // the Mentor is fetched to hand first (the signature modifier takes a library copy), then three of the rest are milled
  const withYard = (yard: string) => spec({ [yard]: 59, karmic_mentor: 1 }, [...plains(3), { type: "signatureToHand", player: 0, cardId: "karmic_mentor" } as Modifier, { type: "effectAtStart", player: 0, effects: [{ type: "mill", count: 3, who: "you" }] } as Modifier]);
  type Board = { battlefield: string[]; objects: Record<string, { cardId: string; controller: number }> };
  const count = (r: { finalStateSerialized: string }, cardId: string) => { const f = JSON.parse(r.finalStateSerialized) as Board; return f.battlefield.filter((id) => f.objects[id]!.cardId === cardId).length; };
  it("is valid as designed", () => {
    const d = cards.get("karmic_mentor")!;
    expect(validateCard(d).errors).toEqual([]);
    expect(d).toMatchObject({ manaCost: "{1}{W}{W}", power: 2, toughness: 2, keywords: ["flying"], subtypes: ["Angel"], source: "custom", shopTier: 2 });
  });
  it("returns a creature of mana value two or less (a Soul Warden) and a land (mana value nought)", async () => {
    expect(count(await runMatch(withYard("soul_warden"), cards, [caster("karmic_mentor"), passer]), "soul_warden")).toBe(1);
    expect(count(await runMatch(withYard("forest"), cards, [caster("karmic_mentor"), passer]), "forest")).toBe(1);
  });
  it("returns nothing of mana value three or more (a Restoration Angel), and no Aura (a Pacifism)", async () => {
    expect(count(await runMatch(withYard("restoration_angel"), cards, [caster("karmic_mentor"), passer]), "restoration_angel")).toBe(0);
    expect(count(await runMatch(withYard("pacifism"), cards, [caster("karmic_mentor"), passer]), "pacifism")).toBe(0);
  });
});
