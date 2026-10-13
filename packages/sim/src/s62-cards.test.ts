import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { validateCard } from "@shandalar/cards";
import { runMatch, type Action, type ActionRequest, type Agent, type GameView, type MatchSpec, type Modifier } from "@shandalar/engine";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const cards = loadCardPool(join(ROOT, "data/cards")).cards;
const perm = (player: 0 | 1, cardId: string): Modifier => ({ type: "permanentOnBattlefield", player, cardId });
const D = (ids: Record<string, number>) => Object.entries(ids).map(([cardId, count]) => ({ cardId, count }));
const cardOf = (v: GameView, id: string | undefined) => (id ? (v.hand.find((h) => h.objectId === id)?.cardId ?? v.battlefield.find((b) => b.id === id)?.cardId) : undefined);
const pass = (r: ActionRequest) => r.actions.find((a) => a.type === "pass") ?? r.actions[0]!;
const passer: Agent = { chooseAction: async (_v, r) => pass(r) };
const on = (v: GameView, cardId: string, controller?: 0 | 1) => v.battlefield.filter((o) => o.cardId === cardId && (controller === undefined || o.controller === controller));
type Final = { players: { life: number; library: string[]; graveyard: string[]; hand: string[] }[]; battlefield: string[]; objects: Record<string, { cardId: string; zone: string; controller: number }> };
const fin = (r: { finalStateSerialized: string }) => JSON.parse(r.finalStateSerialized) as Final;
const spec = (mine: Record<string, number>, mods: Modifier[], theirs: Record<string, number> = { mountain: 60 }, maxTurns = 1): MatchSpec =>
  ({ seed: 62, players: [{ name: "a", decklist: D(mine), agent: "x" }, { name: "b", decklist: D(theirs), agent: "x" }], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns, startingPlayer: 0 } as MatchSpec["rules"], modifiers: mods });
/** Seat 0 casts `cardId` once in its first main phase (the first legal cast action, or the one `pick` chooses), answers
 * every other request with `other` (default: the first action), and calls `look` at each later priority with an empty stack. */
const caster = (cardId: string, o: { pick?: (v: GameView, as: Action[]) => Action | undefined; other?: (v: GameView, r: ActionRequest) => Action | undefined; look?: (v: GameView, r: ActionRequest) => Action | undefined | void } = {}): Agent => {
  let cast = false;
  return { chooseAction: async (v, r) => {
    if (r.purpose !== "priority") return o.other?.(v, r) ?? r.actions[0]!;
    if (v.activePlayer === 0 && v.step === "MAIN1" && v.stack.length === 0 && !cast) {
      const as = r.actions.filter((a) => a.type === "castSpell" && cardOf(v, a.objectId) === cardId);
      const a = o.pick ? o.pick(v, as) : as[0];
      if (a) { cast = true; return a; }
    }
    if (cast && v.stack.length === 0) { const a = o.look?.(v, r); if (a) return a; }
    return pass(r);
  } };
};

/**
 * S62 — the ten cards of ADR-177, verified against Scryfall 2026-10-13. The brief's mismatches: Penumbra Wurm costs
 * {5}{G}{G} (not {4}{G}{G}{G}); Moaning Wall is a Zombie Wall first printed in Hour of Devastation (not Urza's Saga);
 * Dungrove Elder is Magic 2012 (not Innistrad); Longbow Archer and Captain of the Watch are Human Soldiers.
 */
describe("S62 — the ten cards (ADR-177)", () => {
  it("every def is valid, with its printed cost, types and size", () => {
    const want: Record<string, [string, string[], string[], number | undefined, number | undefined, string[], number]> = {
      penumbra_wurm: ["{5}{G}{G}", ["Creature"], ["Wurm"], 6, 6, ["trample"], 2],
      wave_of_reckoning: ["{4}{W}", ["Sorcery"], [], undefined, undefined, [], 2],
      harmonize: ["{2}{G}{G}", ["Sorcery"], [], undefined, undefined, [], 2],
      sign_in_blood: ["{B}{B}", ["Sorcery"], [], undefined, undefined, [], 1],
      dungrove_elder: ["{2}{G}", ["Creature"], ["Treefolk"], 0, 0, ["hexproof"], 2],
      moaning_wall: ["{2}{B}", ["Creature"], ["Zombie", "Wall"], 0, 5, ["defender"], 1],
      dawnwing_marshal: ["{1}{W}", ["Creature"], ["Cat", "Soldier"], 2, 2, ["flying"], 2],
      longbow_archer: ["{W}{W}", ["Creature"], ["Human", "Soldier", "Archer"], 2, 2, ["first strike", "reach"], 1],
      captain_of_the_watch: ["{4}{W}{W}", ["Creature"], ["Human", "Soldier"], 3, 3, ["vigilance"], 2],
      tome_scour: ["{U}", ["Sorcery"], [], undefined, undefined, [], 1],
    };
    for (const [id, w] of Object.entries(want)) {
      const d = cards.get(id)!;
      expect(validateCard(d).errors, id).toEqual([]);
      expect([d.manaCost, d.types, d.subtypes ?? [], d.power, d.toughness, d.keywords ?? [], d.shopTier], id).toEqual(w);
      expect(d.source, id).toBe("real");
    }
    expect(cards.get("wurm_6_6_b_trample")).toMatchObject({ power: 6, toughness: 6, colors: ["B"], keywords: ["trample"], isTokenDef: true });
  });

  it("Wave of Reckoning (R-108): each creature deals damage to itself equal to its power — the walls and the 1/3 live, a 2/2 and a 4/4 die, a deathtouch creature is destroyed by its own touch (704.5h), and lifelink pays each creature's own controller (702.15b)", async () => {
    const mods = [...Array.from({ length: 5 }, () => perm(0, "plains")), perm(0, "moaning_wall"), perm(0, "vampire_nighthawk"), perm(0, "youthful_valkyrie"),
      perm(1, "grizzly_bears"), perm(1, "serra_angel"), perm(1, "wall_of_blossoms"), perm(1, "typhoid_rats"), perm(1, "child_of_night")];
    const r = await runMatch(spec({ wave_of_reckoning: 40, plains: 20 }, mods), cards, [caster("wave_of_reckoning"), passer]);
    const f = fin(r), left = f.battlefield.map((id) => f.objects[id]!.cardId).filter((c) => c !== "plains").sort();
    expect(left).toEqual(["moaning_wall", "wall_of_blossoms", "youthful_valkyrie"]);
    expect(f.players[0]!.life).toBe(22); // the Nighthawk's two, to its controller
    expect(f.players[1]!.life).toBe(22); // the Child of Night's two, to ITS controller
  });

  it("Penumbra Wurm: when it dies a 6/6 black Wurm with trample takes its place; the token's death leaves nothing", async () => {
    let sacs = 0; const seen: string[][] = [];
    const me: Agent = { chooseAction: async (v, r) => {
      if (r.actions.some((a) => a.type === "sacrifice")) return r.actions.find((a) => a.type === "sacrifice" && ["penumbra_wurm", "wurm_6_6_b_trample"].includes(cardOf(v, (a as { objectId: string }).objectId) ?? ""))!;
      if (r.purpose !== "priority") return r.actions[0]!;
      if (v.activePlayer === 0 && v.step === "MAIN1" && v.stack.length === 0) {
        seen.push(v.battlefield.filter((o) => o.power !== null).map((o) => `${o.cardId}:${o.power}/${o.toughness}:${o.keywords.join(",")}`));
        const altar = r.actions.find((a) => a.type === "activateAbility" && cardOf(v, a.objectId) === "altar_of_dementia");
        if (altar && sacs < 2 && v.battlefield.some((o) => o.power !== null)) { sacs += 1; return altar; }
      }
      return pass(r);
    } };
    await runMatch(spec({ forest: 60 }, [perm(0, "altar_of_dementia"), perm(0, "penumbra_wurm")]), cards, [me, passer]);
    expect(sacs).toBe(2);
    expect(seen[0]).toEqual(["penumbra_wurm:6/6:trample"]);
    expect(seen[1]).toEqual(["wurm_6_6_b_trample:6/6:trample"]);
    expect(seen[2]).toEqual([]);
  });

  it("Dungrove Elder: its power and toughness are the Forests we control — three, then four with a land drop; an opponent's Bolt cannot be aimed at it (hexproof, 702.11b); with no Forest it is a 0/0 and dies", async () => {
    const sizes: string[] = []; let boltAims: string[] = [];
    const me: Agent = { chooseAction: async (v, r) => {
      if (r.purpose !== "priority") return r.actions[0]!;
      if (v.activePlayer === 0 && v.step === "MAIN1" && v.stack.length === 0) {
        const e = on(v, "dungrove_elder")[0]; if (e) sizes.push(`${e.power}/${e.toughness}`);
        const land = r.actions.find((a) => a.type === "playLand"); if (land && sizes.length === 1) return land;
      }
      return pass(r);
    } };
    const them: Agent = { chooseAction: async (v, r) => {
      if (r.purpose === "priority" && v.activePlayer === 1 && v.step === "MAIN1" && v.stack.length === 0 && boltAims.length === 0)
        boltAims = r.actions.filter((a) => a.type === "castSpell" && cardOf(v, a.objectId) === "lightning_bolt").map((a) => { const t = (a as { targets: { kind: string; id?: string }[] }).targets[0]!; return t.kind === "player" ? "player" : (cardOf(v, t.id) ?? "?"); }).sort();
      return pass(r);
    } };
    await runMatch(spec({ forest: 60 }, [perm(0, "forest"), perm(0, "forest"), perm(0, "forest"), perm(0, "dungrove_elder"), perm(0, "grizzly_bears"), perm(1, "mountain")], { lightning_bolt: 60 }, 2), cards, [me, them]);
    expect(sizes.slice(0, 2)).toEqual(["3/3", "4/4"]);
    expect(boltAims).toEqual(["grizzly_bears", "player", "player"]); // the Bears and either player — never the Elder
    const dead = fin(await runMatch(spec({ plains: 60 }, [perm(0, "dungrove_elder")]), cards, [passer, passer]));
    expect(Object.values(dead.objects).find((o) => o.cardId === "dungrove_elder")!.zone).toBe("graveyard");
  });

  it("Captain of the Watch: three 1/1 Soldier tokens enter and stand as 2/2s with vigilance; another Soldier gets the same; the Captain itself does not ('other')", async () => {
    let seen: string[] = [];
    const me = caster("captain_of_the_watch", { look: (v) => { if (!seen.length) seen = v.battlefield.filter((o) => o.power !== null).map((o) => `${o.cardId}:${o.power}/${o.toughness}:${o.keywords.includes("vigilance")}`).sort(); } });
    await runMatch(spec({ captain_of_the_watch: 40, plains: 20 }, [...Array.from({ length: 6 }, () => perm(0, "plains")), perm(0, "longbow_archer"), perm(0, "grizzly_bears")]), cards, [me, passer]);
    expect(seen).toEqual(["captain_of_the_watch:3/3:true", "grizzly_bears:2/2:false", "longbow_archer:3/3:true", "soldier_1_1:2/2:true", "soldier_1_1:2/2:true", "soldier_1_1:2/2:true"]);
  });

  it("Dawnwing Marshal: {4}{W} gives every creature we control +1/+1 until end of turn — and no longer", async () => {
    const seen: string[] = []; let done = false;
    const me: Agent = { chooseAction: async (v, r) => {
      if (r.purpose !== "priority") return r.actions[0]!;
      const sizes = () => v.battlefield.filter((o) => o.power !== null).map((o) => `${o.cardId}:${o.power}/${o.toughness}`).sort().join(" ");
      if (v.activePlayer === 0 && v.step === "MAIN1" && v.stack.length === 0) {
        if (!done) { const a = r.actions.find((x) => x.type === "activateAbility" && cardOf(v, x.objectId) === "dawnwing_marshal"); if (a) { done = true; return a; } }
        else if (seen.length === 0) seen.push(sizes());
      }
      if (v.turn > 1 && seen.length === 1) seen.push(sizes());
      return pass(r);
    } };
    await runMatch(spec({ plains: 60 }, [...Array.from({ length: 5 }, () => perm(0, "plains")), perm(0, "dawnwing_marshal"), perm(0, "savannah_lions"), perm(1, "grizzly_bears")], { mountain: 60 }, 3), cards, [me, passer]);
    expect(seen).toEqual(["dawnwing_marshal:3/3 grizzly_bears:2/2 savannah_lions:3/2", "dawnwing_marshal:2/2 grizzly_bears:2/2 savannah_lions:2/1"]);
  });

  it("the plain ones: Tome Scour mills five of the target's cards; Sign in Blood makes the TARGET draw two and lose 2; Harmonize draws three; Moaning Wall cycles for {2}", async () => {
    const atThem = (_v: GameView, as: Action[]) => as.find((a) => (a as { targets?: { kind: string; player?: number }[] }).targets?.[0]?.player === 1);
    const scour = fin(await runMatch(spec({ tome_scour: 40, island: 20 }, [perm(0, "island")]), cards, [caster("tome_scour", { pick: atThem }), passer]));
    expect(scour.players[1]!.graveyard).toHaveLength(5);
    expect(scour.players[1]!.library).toHaveLength(60 - 7 - 5);
    const sign = fin(await runMatch(spec({ sign_in_blood: 40, swamp: 20 }, [perm(0, "swamp"), perm(0, "swamp")]), cards, [caster("sign_in_blood", { pick: atThem }), passer]));
    expect(sign.players[1]!.life).toBe(18);
    expect(sign.players[1]!.hand).toHaveLength(9);
    expect(sign.players[0]!.life).toBe(20);
    const harm = fin(await runMatch(spec({ harmonize: 40, forest: 20 }, Array.from({ length: 4 }, () => perm(0, "forest"))), cards, [caster("harmonize"), passer]));
    expect(harm.players[0]!.hand.length + harm.players[0]!.graveyard.length).toBe(7 + 3); // the opening seven (no draw on the play, 103.8a) and the three; the Harmonize itself is in the graveyard, one of the seven
    let cycled = false;
    const cycler: Agent = { chooseAction: async (v, r) => {
      if (r.purpose === "priority" && v.activePlayer === 0 && v.step === "MAIN1" && v.stack.length === 0 && !cycled) { const a = r.actions.find((x) => x.type === "activateAbility" && v.hand.some((h) => h.objectId === x.objectId && h.cardId === "moaning_wall")); if (a) { cycled = true; return a; } }
      return r.purpose === "priority" ? pass(r) : r.actions[0]!;
    } };
    const wall = fin(await runMatch(spec({ moaning_wall: 60 }, [perm(0, "swamp"), perm(0, "swamp")]), cards, [cycler, passer]));
    expect(cycled).toBe(true);
    expect(wall.players[0]!.graveyard.map((id) => wall.objects[id]!.cardId)).toContain("moaning_wall");
  });

  /** Post-S62 (Chris, for the Elder round) — verified against Scryfall 2026-10-13. Dazzling Angel: Foundations, {2}{W}
   * Angel 2/3, flying, "Whenever another creature you control enters, you gain 1 life." Wall of Reverence: first printed
   * in Conflux (Chris had Shards of Alara, its block), {3}{W} Spirit Wall 1/6, defender, flying, "At the beginning of
   * your end step, you may gain life equal to the power of target creature you control." */
  it("Dazzling Angel: a creature of ours entering gains us 1 — each of two tokens does; the Angel's own entering does not, and an opponent's creature does not (the Soul Warden's does)", async () => {
    for (const id of ["dazzling_angel", "wall_of_reverence"]) expect(validateCard(cards.get(id)!).errors, id).toEqual([]);
    expect(cards.get("dazzling_angel")).toMatchObject({ manaCost: "{2}{W}", power: 2, toughness: 3, keywords: ["flying"], subtypes: ["Angel"], source: "real" });
    expect(cards.get("wall_of_reverence")).toMatchObject({ manaCost: "{3}{W}", power: 1, toughness: 6, keywords: ["defender", "flying"], subtypes: ["Spirit", "Wall"], source: "real" });
    const lands = Array.from({ length: 3 }, () => perm(0, "plains"));
    const tokens = fin(await runMatch(spec({ raise_the_alarm: 40, plains: 20 }, [...lands, perm(0, "dazzling_angel")]), cards, [caster("raise_the_alarm"), passer]));
    expect(tokens.players[0]!.life).toBe(22);
    const itself = fin(await runMatch(spec({ dazzling_angel: 40, plains: 20 }, lands), cards, [caster("dazzling_angel"), passer]));
    expect(itself.players[0]!.life).toBe(20);
    // the opponent's Bears enter on their turn: our Angel says nothing, their Soul Warden would have
    let cast = false;
    const them: Agent = { chooseAction: async (v, r) => { const a = r.purpose === "priority" && v.activePlayer === 1 && v.step === "MAIN1" && v.stack.length === 0 ? r.actions.find((x) => x.type === "castSpell") : undefined; if (a) { cast = true; return a; } return r.purpose === "priority" ? pass(r) : r.actions[0]!; } };
    const theirs = fin(await runMatch(spec({ plains: 60 }, [perm(0, "dazzling_angel"), perm(1, "soul_warden"), perm(1, "forest"), perm(1, "forest")], { grizzly_bears: 60 }, 2), cards, [passer, them]));
    expect(cast).toBe(true);
    expect(theirs.players[0]!.life).toBe(20); // their Bears: nothing for our Angel
    expect(theirs.players[1]!.life).toBe(21); // …and one for their Soul Warden
  });

  it("Wall of Reverence: at the beginning of our end step we may gain life equal to the power of a creature we control — four from a Serra Angel, the Wall's own one if we choose it", async () => {
    const pick = (cardId: string): Agent => ({ chooseAction: async (v, r) => {
      const yes = r.actions.find((a) => a.type === "acceptOptional"); if (yes) return yes;
      const aim = r.actions.find((a) => a.type === "chooseTriggerTargets" && cardOf(v, (a as { targets: { id?: string }[] }).targets[0]?.id) === cardId); if (aim) return aim;
      return pass(r);
    } });
    const mods = [perm(0, "wall_of_reverence"), perm(0, "serra_angel")];
    expect(fin(await runMatch(spec({ plains: 60 }, mods), cards, [pick("serra_angel"), passer])).players[0]!.life).toBe(24);
    expect(fin(await runMatch(spec({ plains: 60 }, mods), cards, [pick("wall_of_reverence"), passer])).players[0]!.life).toBe(21);
    expect(fin(await runMatch(spec({ plains: 60 }, mods), cards, [passer, passer])).players[0]!.life).toBeGreaterThanOrEqual(20); // "may": declining is legal
  });
});
