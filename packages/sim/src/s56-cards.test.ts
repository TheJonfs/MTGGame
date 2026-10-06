import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { validateCard } from "@shandalar/cards";
import { runMatch, type Action, type ActionRequest, type Agent, type GameView, type MatchSpec, type Modifier } from "@shandalar/engine";

const cards = loadCardPool(join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards")).cards;
const perm = (player: 0 | 1, cardId: string): Modifier => ({ type: "permanentOnBattlefield", player, cardId });
const D = (ids: Record<string, number>) => Object.entries(ids).map(([cardId, count]) => ({ cardId, count }));
const cardOf = (v: GameView, id: string | undefined) => (id ? (v.hand.find((h) => h.objectId === id)?.cardId ?? v.battlefield.find((b) => b.id === id)?.cardId) : undefined);
const RULES = (maxTurns: number) => ({ startingLife: 20, handSize: 7, mulligan: "london", maxTurns, startingPlayer: 0 }) as MatchSpec["rules"];
type Snap = { controller: number; power: number | null; sick: boolean };

/** Seat 0 casts Protocol at the opposing `host` on its first main phase; seat 1 follows `theirs`. Every decision of
 * either seat records the host as it stands, keyed by turn (the last reading of a turn wins). */
async function play(opts: { host: string; mine?: string[]; theirs?: string[]; theirDeck?: Record<string, number>; reply?: (v: GameView, r: ActionRequest) => Action | undefined; second?: (v: GameView, r: ActionRequest) => Action | undefined; turns?: number }) {
  const seen = new Map<number, Snap>();
  let cast = false, hostId = "";
  const note = (v: GameView) => { const h = v.battlefield.find((o) => o.cardId === opts.host && (hostId ? o.id === hostId : true)); if (h) { hostId = h.id; seen.set(v.turn, { controller: h.controller, power: h.power, sick: !!h.summoningSick }); } };
  const me: Agent = { chooseAction: async (v, r) => {
    note(v);
    if (r.purpose === "priority" && v.activePlayer === 0 && v.stack.length === 0) {
      if (!cast && v.step === "MAIN1") { const a = r.actions.find((x) => x.type === "castSpell" && cardOf(v, x.objectId) === "protocol" && (x as { targets: { id?: string }[] }).targets[0]?.id === hostId); if (a) { cast = true; return a; } }
      const b = opts.second?.(v, r); if (b) return b;
    }
    return r.actions.find((a) => a.type === "pass") ?? r.actions[0]!;
  } };
  const them: Agent = { chooseAction: async (v, r) => { note(v); return opts.reply?.(v, r) ?? r.actions.find((a) => a.type === "pass") ?? r.actions[0]!; } };
  const spec: MatchSpec = { seed: 5, players: [{ name: "a", decklist: D({ protocol: 40, island: 20 }), agent: "x" }, { name: "b", decklist: D(opts.theirDeck ?? { forest: 60 }), agent: "x" }], rules: RULES(opts.turns ?? 3),
    modifiers: [perm(0, "island"), perm(0, "island"), perm(0, "island"), perm(0, "island"), ...(opts.mine ?? []).map((c) => perm(0, c)), perm(1, opts.host), ...(opts.theirs ?? []).map((c) => perm(1, c))] };
  const r = await runMatch(spec, cards, [me, them]);
  return { seen, cast, final: JSON.parse(r.finalStateSerialized) as { objects: Record<string, { cardId: string; zone: string; controller: number; attachedTo?: string | null }> }, hostId };
}

/**
 * S56 — Protocol (Chris's card; R-105). {U}{U} Enchantment — Aura. "Enchant creature. Enchanted creature gets -2/-0.
 * As long as enchanted creature's power is 0 or less, you control enchanted creature."
 * Rules: 303.4 (Auras), 613.1b / 613.4c (control is layer 2, power layer 7c — the condition reads a later layer's
 * result; R-105 records how), 302.6 (a creature that changed control is summoning-sick), 704.5m (an Aura attached to
 * nothing is put into the graveyard — not at issue: the Aura stays on the creature whoever controls it).
 */
describe("S56 — Protocol (R-105)", () => {
  it("the card as written", () => {
    const p = cards.get("protocol")!;
    expect([p.manaCost, p.types, p.subtypes, p.source, p.shopTier]).toEqual(["{U}{U}", ["Enchantment"], ["Aura"], "custom", 2]);
    expect(p.text).toBe("Enchant creature\nEnchanted creature gets -2/-0.\nAs long as enchanted creature's power is 0 or less, you control enchanted creature.");
  });

  it("on a 2/2 it takes the creature: power 0, ours, and summoning-sick as it arrives (302.6); the Aura stays on it", async () => {
    const g = await play({ host: "grizzly_bears" });
    expect(g.cast).toBe(true);
    expect(g.seen.get(1)).toMatchObject({ controller: 0, power: 0 });
    expect(g.seen.get(3)).toMatchObject({ controller: 0, power: 0, sick: false }); // ours at our next turn, and ready
    const aura = Object.values(g.final.objects).find((o) => o.cardId === "protocol" && o.zone === "battlefield")!;
    expect(aura.attachedTo).toBe(g.hostId);
  });

  it("on a 3/3 it only shrinks it: power 1, still theirs", async () => {
    const g = await play({ host: "hill_giant" });
    expect(g.cast).toBe(true);
    expect(g.seen.get(1)).toMatchObject({ controller: 1, power: 1 });
    expect(g.seen.get(3)).toMatchObject({ controller: 1, power: 1 });
  });

  it("the condition is live: a Giant Growth on the taken creature hands it back for the turn (power 3), and it comes back to us at the cleanup", async () => {
    let grown = false;
    const g = await play({ host: "grizzly_bears", theirs: ["forest"], theirDeck: { giant_growth: 40, forest: 20 }, turns: 3,
      reply: (v, r) => { if (grown || r.purpose !== "priority" || v.activePlayer !== 1 || v.step !== "MAIN1") return undefined; const a = r.actions.find((x) => x.type === "castSpell" && cardOf(v, x.objectId) === "giant_growth" && (x as { targets: { id?: string }[] }).targets[0]?.id === v.battlefield.find((o) => o.cardId === "grizzly_bears")?.id); if (a) grown = true; return a; } });
    expect(grown).toBe(true);
    expect(g.seen.get(2)).toMatchObject({ controller: 1, power: 3 }); // theirs again while it is grown
    expect(g.seen.get(3)).toMatchObject({ controller: 0, power: 0 }); // back with us once the growth ends
  });

  it("an anthem counts where the creature would be WITHOUT the Aura's control (R-105): theirs keeps a 2/2 out of reach (3 − 2 = 1); ours does not hand a taken creature back (it is 1/3 under us and stays)", async () => {
    const theirs = await play({ host: "grizzly_bears", theirs: ["glorious_anthem"] });
    expect(theirs.seen.get(1)).toMatchObject({ controller: 1, power: 1 });
    const ours = await play({ host: "grizzly_bears", mine: ["glorious_anthem"] });
    expect(ours.seen.get(1)).toMatchObject({ controller: 0, power: 1 });
    expect(ours.seen.get(3)).toMatchObject({ controller: 0, power: 1 });
  });

  it("a second Protocol on a 3/3 takes it (3 − 2 − 2); with the Aura gone the creature goes home", async () => {
    let n = 0;
    const two = await play({ host: "hill_giant", turns: 3, second: (v, r) => { if (n > 0 || v.step !== "MAIN1") return undefined; const a = r.actions.find((x) => x.type === "castSpell" && cardOf(v, x.objectId) === "protocol" && (x as { targets: { id?: string }[] }).targets[0]?.id === v.battlefield.find((o) => o.cardId === "hill_giant")?.id); if (a) n += 1; return a; } });
    expect(n).toBe(1);
    expect(two.seen.get(1)).toMatchObject({ controller: 0, power: -1 });
    let hit = false;
    const gone = await play({ host: "grizzly_bears", theirs: ["plains", "plains"], theirDeck: { disenchant: 40, plains: 20 }, turns: 3,
      reply: (v, r) => { if (hit || r.purpose !== "priority" || v.activePlayer !== 1 || v.step !== "MAIN1") return undefined; const a = r.actions.find((x) => x.type === "castSpell" && cardOf(v, x.objectId) === "disenchant" && (x as { targets: { id?: string }[] }).targets[0]?.id === v.battlefield.find((o) => o.cardId === "protocol")?.id); if (a) hit = true; return a; } });
    expect(hit).toBe(true);
    expect(gone.seen.get(1)).toMatchObject({ controller: 0, power: 0 });
    expect(gone.seen.get(3)).toMatchObject({ controller: 1, power: 2 });
  });

  it("the validator: a condition is atLeast or atMost, not both or neither; attachedPower conditions only a control static on the attached creature", () => {
    const base = cards.get("protocol")!;
    const withStatic = (ability: unknown) => validateCard({ ...base, id: "x", abilities: [ability] }).errors;
    expect(withStatic({ kind: "static", condition: { value: { ref: "attachedPower" }, atMost: 0 }, effects: [{ type: "gainControl", scope: "attached" }] })).toEqual([]);
    expect(withStatic({ kind: "static", condition: { value: { ref: "attachedPower" }, atMost: 0, atLeast: 0 }, effects: [{ type: "gainControl", scope: "attached" }] }).join(" ")).toMatch(/atLeast: n} or/);
    expect(withStatic({ kind: "static", condition: { value: { ref: "attachedPower" } }, effects: [{ type: "gainControl", scope: "attached" }] }).join(" ")).toMatch(/atLeast: n} or/);
    expect(withStatic({ kind: "static", condition: { value: { ref: "attachedPower" }, atMost: 0 }, effects: [{ type: "modifyPT", power: 1, toughness: 1, scope: "attached", duration: "WHILE_SOURCE_ON_BATTLEFIELD" }] }).join(" ")).toMatch(/attachedPower may only gain control/);
  });
});
