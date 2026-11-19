import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { replayGame, runMatch, type Action, type ActionRequest, type Agent, type GameView } from "@shandalar/engine";
import { HeuristicAgent, RandomAgent, difficultyProfile } from "@shandalar/agents";
import { FORMAT_FIELD } from "./open-decks.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const RULES = { startingLife: 20, handSize: 7, mulligan: "london" as const, maxTurns: 100 };
/** [format, list, card added ×4] against [format, list, card added ×4 | null]: Hydroilaur where black and green are made (fights into
 * tokens and weenies, a graveyard to return from, counters and theft across the table); Drakonyx in ramp and land lists; Whelkin
 * (R-134, the mass untap) in white-blue lists, beside Silt Spirit and beside Ranksmere. */
const PAIRS: [[string, string, string], [string, string, string | null]][] = [
  [["jund", "reaper", "hydroilaur"], ["open", "muster", null]],
  [["sultai", "reeve", "hydroilaur"], ["grixis", "kiln", null]],
  [["abzan", "warden", "hydroilaur"], ["open", "marducontrol", null]],
  [["naya", "stompy", "drakonyx"], ["open", "rabble", null]],
  [["temur", "ramp", "drakonyx"], ["jeskai", "theft", null]],
  [["open", "pinnacle", "drakonyx"], ["jund", "reaper", "hydroilaur"]],
  [["bant", "skies", "whelkin"], ["open", "rabble", null]],
  [["esper", "tempo", "whelkin"], ["open", "levy", null]],
  [["sultai", "mill", "whelkin"], ["jund", "reaper", "hydroilaur"]], // Silt Spirit: the Snails tap to mill
  [["bodies", "bantsnake", "whelkin"], ["naya", "stompy", "drakonyx"]], // Ranksmere copies a Snail
  [["open", "muster", "corontzasol"], ["open", "emeraldsnakes", null]],
  [["jeskai", "watch", "corontzasol"], ["sultai", "reeve", "abyssalume"]],
  [["naya", "tokens", "corontzasol"], ["esper", "tempo", "abyssalume"]],
  [["grixis", "clio", "abyssalume"], ["open", "levy", null]], // the -1/-1 into tokens (R-135)
  [["sultai", "undertow", "abyssalume"], ["open", "rabble", null]],
];
function withFour(f: string, k: string, add: string | null, cards: Map<string, { types: string[] }>) {
  const l = FORMAT_FIELD[f]?.[k]; if (!l) throw new Error(`no list ${f}:${k}`);
  if (!add) return { name: l.name, decklist: l.decklist };
  const list = l.decklist.map((e) => ({ ...e }));
  let need = 4;
  for (const e of list) { if (need <= 0) break; if (e.count < 2 || cards.get(e.cardId)!.types.includes("Land")) continue; const t = Math.min(e.count, need); e.count -= t; need -= t; }
  return { name: `${l.name} +${add}`, decklist: [...list.filter((e) => e.count > 0), { cardId: add, count: 4 }] };
}
const LEGENDS = ["hydroilaur", "drakonyx", "whelkin", "corontzasol", "abyssalume"];
/** Counts the legends' casts and the mode each trigger took. */
class Counter implements Agent {
  casts = 0; held = 0; nyxSizes = new Set<number>(); finds = new Map<string, number>();
  constructor(private readonly inner: Agent) {}
  async chooseAction(view: GameView, request: ActionRequest): Promise<Action> {
    const a = await this.inner.chooseAction(view, request);
    if (a.type === "castSpell" && LEGENDS.includes(view.hand.find((h) => h.objectId === a.objectId)?.cardId ?? "")) this.casts++;
    if (request.purpose === "chooseMode" && request.source && LEGENDS.includes(request.source.cardId)) { this.held++; const k = `${request.source.cardId}:${(a as { mode?: number }).mode ?? "?"}`; this.finds.set(k, (this.finds.get(k) ?? 0) + 1); }
    return a;
  }
}

/** S73a fuzz-before-fixtures (Hydroilaur and Drakonyx, the first two High Ground legends — enters-or-attacks modes): six pairings, both seats, random agents and the
 * heuristic. Zero exceptions, every game terminates; replays byte-identical. Smoke 1 seed (24 games); FUZZ_FULL 15 (360). */
describe("S73a fuzz — the five High Ground legends (fuzz-before-fixtures)", () => {
  const games = process.env.FUZZ_FULL ? 15 : 1;
  it(`${games} games × ${PAIRS.length} pairings × 2 seats × 2 agents`, async () => {
    const cards = loadCardPool(join(ROOT, "data/cards")).cards;
    let casts = 0, held = 0; const sizes = new Set<number>(); const finds = new Map<string, number>();
    for (let i = 0; i < PAIRS.length; i++) {
      const [[af, ak, aa], [bf, bk, ba]] = PAIRS[i]!;
      const me = withFour(af, ak, aa, cards), o = withFour(bf, bk, ba, cards);
      for (const d of [me, o]) expect(d.decklist.reduce((n, e) => n + e.count, 0), d.name).toBe(60);
      for (let seed = 1; seed <= games; seed++) for (const seat of [0, 1] as const) for (const kind of ["random", "heuristic"] as const) {
        const mk = (s: number): Agent => (kind === "random" ? new RandomAgent(s) : new HeuristicAgent(s, cards, difficultyProfile("master", "midrange", [])));
        const c = new Counter(mk(seed * 2 + 1 + seat)), c2 = new Counter(mk(seed * 2 + 2));
        const a = { name: me.name, decklist: me.decklist, agent: kind }, b = { name: o.name, decklist: o.decklist, agent: kind };
        const agents: [Agent, Agent] = seat === 0 ? [c, c2] : [c2, c];
        const r = await runMatch({ seed: seed * 73 + seat + 9200 + i * 100, players: seat === 0 ? [a, b] : [b, a], rules: RULES, modifiers: [] }, cards, agents);
        expect(r.reason, `${me.name} v ${o.name} seat ${seat} seed ${seed} ${kind}`).toBeTruthy();
        casts += c.casts + c2.casts; held += c.held + c2.held; for (const s of [...c.nyxSizes, ...c2.nyxSizes]) sizes.add(s); for (const [k, n] of [...c.finds, ...c2.finds]) finds.set(k, (finds.get(k) ?? 0) + n);
      }
      await new Promise((r) => setTimeout(r, 0));
    }
    console.log(`s73a legends: ${casts} casts, ${held} mode choices; modes ${[...finds].sort((x, y) => y[1] - x[1]).map(([k, n]) => `${k}×${n}`).join(" ")}`);
    expect(casts).toBeGreaterThan(0);
  }, 1_800_000);
  it("replay determinism — a game of each pairing replays byte-identical", async () => {
    const cards = loadCardPool(join(ROOT, "data/cards")).cards;
    for (let i = 0; i < PAIRS.length; i++) {
      const [[af, ak, aa], [bf, bk, ba]] = PAIRS[i]!;
      const me = withFour(af, ak, aa, cards), o = withFour(bf, bk, ba, cards), seed = 150 + i;
      const live = await runMatch({ seed, players: [{ name: me.name, decklist: me.decklist, agent: "random" }, { name: o.name, decklist: o.decklist, agent: "random" }], rules: RULES, modifiers: [] }, cards, [new RandomAgent(seed * 2 + 1), new RandomAgent(seed * 2 + 2)]);
      const replayed = await replayGame(cards, [me.decklist.flatMap((d) => Array(d.count).fill(d.cardId)), o.decklist.flatMap((d) => Array(d.count).fill(d.cardId))], live.log, { startingLife: 20, handSize: 7, maxTurns: 100, ante: 0 }, []);
      expect(replayed, me.name).toBe(live.finalStateSerialized);
    }
  }, 600_000);
});
