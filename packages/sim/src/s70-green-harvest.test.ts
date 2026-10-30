import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import { validateCard, type CardDef } from "@shandalar/cards";
import { loadCardPool } from "@shandalar/cards/loader";
import { runMatch, type ActionRequest, type Agent, type GameView, type MatchSpec } from "@shandalar/engine";
import { RandomAgent } from "@shandalar/agents";
import { FORMAT_FIELD } from "./open-decks.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const cards = new Map(loadCardPool(join(ROOT, "data/cards")).cards);
const study = JSON.parse(readFileSync(join(ROOT, "data/cards-study/green_harvest.json"), "utf8")) as CardDef;
if (validateCard(study).errors.length) throw new Error(validateCard(study).errors.join("; "));
cards.set(study.id, study);
const RULES = { startingLife: 20, handSize: 7, mulligan: "london" as const, maxTurns: 100 };
const D = (ids: Record<string, number>) => Object.entries(ids).map(([cardId, count]) => ({ cardId, count }));
const pass = (r: ActionRequest) => r.actions.find((a) => a.type === "pass") ?? r.actions[0]!;

/**
 * Post-S70 — the green restricted card under study (Chris: Primeval Titan's trigger as a spell — "Search your library
 * for up to two land cards, put them onto the battlefield tapped, then shuffle", at {1}{G} and {2}{G}; a working name).
 * The one new word: the search's `landCard` (any land card, not only a basic). Fuzz first, then the fixture.
 */
describe("Post-S70 — the green land tutor (study)", () => {
  it(`fuzz: four copies in Emerald Snakes and Temur Ramp (Temur's), random play, both seats — zero exceptions, cast`, async () => {
    const games = process.env.FUZZ_FULL ? 8 : 1;
    let casts = 0;
    const lists = [FORMAT_FIELD.temur!.emeraldsnakes!, FORMAT_FIELD.temur!.ramp!];
    for (const [i, l] of lists.entries()) {
      const out = l.decklist.find((e) => e.cardId === "harmonize")!;
      const me = [...l.decklist.filter((e) => e !== out), { cardId: "harmonize", count: out.count - 3 }, { cardId: study.id, count: 4 }].filter((e) => e.count > 0);
      const o = lists[1 - i]!;
      for (let seed = 1; seed <= games; seed++) for (const seat of [0, 1] as const) {
        const inner = new RandomAgent(seed * 2 + 1 + seat);
        const counter: Agent = { async chooseAction(v: GameView, r) { const a = await inner.chooseAction(v, r); if (a.type === "castSpell" && v.hand.find((h) => h.objectId === a.objectId)?.cardId === study.id) casts++; return a; } };
        const a = { name: l.name, decklist: me, agent: "random" as const }, b = { name: o.name, decklist: o.decklist, agent: "random" as const };
        const r = await runMatch({ seed: seed * 59 + seat + 9900 + i * 100, players: seat === 0 ? [a, b] : [b, a], rules: RULES, modifiers: [] }, cards, seat === 0 ? [counter, new RandomAgent(seed * 2 + 2)] : [new RandomAgent(seed * 2 + 2), counter]);
        expect(r.reason).toBeTruthy();
      }
    }
    if (process.env.FUZZ_FULL) console.log(`green_harvest: ${casts} casts in ${lists.length * games * 2} games`);
    expect(casts).toBeGreaterThan(0);
  }, 900_000);

  it("fixture: a nonbasic land is found — a Taiga and a Forest onto the battlefield tapped", async () => {
    let done = false;
    const caster: Agent = { chooseAction: async (v: GameView, r) => {
      if (r.purpose === "priority" && !done && v.step === "MAIN1" && v.stack.length === 0) { const a = r.actions.find((c) => c.type === "castSpell"); if (a) { done = true; return a; } }
      if (r.purpose === "searchLibrary") { const seen = new Set(v.battlefield.map((o) => o.cardId)); return r.actions.find((a) => a.type === "searchPick" && !seen.has((r.revealed ?? []).find((x) => x.objectId === a.objectId)?.cardId ?? "")) ?? r.actions.find((a) => a.type === "searchPick") ?? r.actions[0]!; }
      return pass(r);
    } };
    const spec = { seed: 74, players: [{ name: "a", decklist: D({ green_harvest: 30, taiga: 15, forest: 15 }), agent: "x" }, { name: "b", decklist: D({ forest: 60 }), agent: "x" }], rules: { ...RULES, maxTurns: 1, startingPlayer: 0 }, modifiers: [{ type: "permanentOnBattlefield", player: 0, cardId: "forest" }, { type: "permanentOnBattlefield", player: 0, cardId: "forest" }] } as MatchSpec;
    const f = JSON.parse((await runMatch(spec, cards, [caster, { chooseAction: async (_v, r) => pass(r) }])).finalStateSerialized) as { battlefield: string[]; objects: Record<string, { cardId: string; controller: number; tapped?: boolean }> };
    const mine = f.battlefield.map((id) => f.objects[id]!).filter((o) => o.controller === 0);
    expect(mine.filter((o) => o.cardId === "taiga")).toHaveLength(1);
    expect(mine.filter((o) => o.cardId === "forest")).toHaveLength(3);
    expect(mine.filter((o) => o.cardId === "taiga").every((o) => o.tapped)).toBe(true);
  });
});
