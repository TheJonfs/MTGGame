import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { replayGame, runMatch, type Action, type ActionRequest, type Agent, type GameView } from "@shandalar/engine";
import { HeuristicAgent, RandomAgent, difficultyProfile } from "@shandalar/agents";
import { FORMAT_FIELD } from "./open-decks.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const withStudy = () => new Map([...loadCardPool(join(ROOT, "data/cards")).cards]);
const RULES = { startingLife: 20, handSize: 7, mulligan: "london" as const, maxTurns: 100 };
/** Post-S71a (Chris's two hybrid cards): Domain Pouncer ({G/W}{G/W}; first strike with a Mountain, deathtouch with a Swamp — the
 * conditional static words) in a Naya and an Abzan host; Terrain Collapse ({R/G}{R/G}; R-127, the nonbasic target filter) in a Jund and
 * a Temur host — each against a list with nonbasic lands to destroy and creatures to fight. */
const RUNS: { card: string; host: [string, string]; foe: [string, string] }[] = [
  { card: "domain_pouncer", host: ["naya", "rabble"], foe: ["abzan", "roll"] },
  { card: "domain_pouncer", host: ["abzan", "levy"], foe: ["naya", "minefield"] },
  { card: "terrain_collapse", host: ["jund", "stompy"], foe: ["temur", "temurcontrol"] },
  { card: "terrain_collapse", host: ["temur", "kiln"], foe: ["jund", "ashen"] },
  { card: "clutch_guard", host: ["bant", "countersnake"], foe: ["temur", "stompy"] },
  { card: "clutch_guard", host: ["sultai", "writ"], foe: ["bant", "sower"] },
  { card: "revivalist", host: ["abzan", "bw"], foe: ["mardu", "brremoval"] },
  { card: "revivalist", host: ["esper", "wbcontrol"], foe: ["jund", "ashen"] },
  // Daunting Terror ({B/R}{B/R}; R-128, the dealt-damage trigger, to each player): burn aimed at it, big blockers in its way
  { card: "daunting_terror", host: ["grixis", "rabble"], foe: ["mardu", "burn"] },
  { card: "daunting_terror", host: ["mardu", "brremoval"], foe: ["jund", "stompy"] },
  // Discontinuous Flash ({W/U}{W/U} instant; R-129, blink under its owner's control): a Control Magic list against removal; a
  // Snake list against tokens and Lumen's borrowing
  { card: "discontinuous_flash", host: ["jeskai", "theft"], foe: ["mardu", "brremoval"] },
  { card: "discontinuous_flash", host: ["bant", "countersnake"], foe: ["jeskai", "watch"] },
  // Intuitive Mastery ({R/W}{R/W} flash Aura, −1/−1 and double strike): a Goblin list against X/1s; an Elder list against Wurms
  { card: "intuitive_mastery", host: ["mardu", "warband"], foe: ["naya", "rabble"] },
  { card: "intuitive_mastery", host: ["naya", "auras"], foe: ["naya", "stompy"] },
  // Command of the Depths ({U/B}{U/B} instant, choose two — six pair-modes): small creatures to shrink, hands to strip
  { card: "command_of_the_depths", host: ["grixis", "mbclio"], foe: ["jeskai", "watch"] },
  { card: "command_of_the_depths", host: ["sultai", "writ"], foe: ["grixis", "rabble"] },
  // Glory Hound ({B/G}{B/G} 2/2; {B/G}{B/G}, discard: team +1/+1 and menace): creature lists into blockers
  { card: "glory_hound", host: ["abzan", "bfh"], foe: ["abzan", "roll"] },
  { card: "glory_hound", host: ["jund", "stompy"], foe: ["mardu", "brremoval"] },
];
function withFour(f: string, k: string, card: string, cards: Map<string, { types: string[] }>) {
  const l = FORMAT_FIELD[f]?.[k]; if (!l) throw new Error(`no list ${f}:${k}`);
  const list = l.decklist.map((e) => ({ ...e }));
  let need = 4;
  for (const e of list) { if (need <= 0) break; if (e.count < 2 || cards.get(e.cardId)!.types.includes("Land")) continue; const t = Math.min(e.count, need); e.count -= t; need -= t; }
  return { name: l.name, decklist: [...list.filter((e) => e.count > 0), { cardId: card, count: 4 }] };
}
class Counter implements Agent {
  casts = 0; yard = 0; // yard: activations from the graveyard (Clutch Guard's eggs)
  constructor(private readonly inner: Agent, private readonly card: string) {}
  async chooseAction(view: GameView, request: ActionRequest): Promise<Action> {
    const a = await this.inner.chooseAction(view, request);
    if (a.type === "castSpell" && view.hand.find((h) => h.objectId === a.objectId)?.cardId === this.card) this.casts++;
    if (a.type === "activateAbility" && view.graveyardObjects[view.you].some((g) => g.objectId === a.objectId && g.cardId === this.card)) this.yard++;
    return a;
  }
}

/** Fuzz before fixtures: four copies in two hosts each, both seats, random agents and the heuristic. Zero exceptions, every game
 * terminates, each card cast; replays byte-identical. Smoke: 6 runs × 2 seats × 2 agent kinds × 1 seed (24 games); FUZZ_FULL: 20 seeds (800 with Revivalist's two runs — a Mardu and a Jund foe, removal to kill it — Daunting Terror's two: a burn foe and a Stompy foe; Discontinuous Flash's two; Intuitive Mastery's two; Command of the Depths' two; and Glory Hound's two — 1,440 in all). Clutch Guard ({G/U}{G/U}; the Pyromancer's graveyard shape with a hybrid ability cost) in a Bant and a Sultai host. */
describe("Post-S71a fuzz — Domain Pouncer, Terrain Collapse, Clutch Guard, Revivalist, Daunting Terror, Discontinuous Flash, Intuitive Mastery, Command of the Depths and Glory Hound", () => {
  const games = process.env.FUZZ_FULL ? 20 : 1;
  it(`${games} games × ${RUNS.length} runs × 2 seats × 2 agents`, async () => {
    const cards = withStudy();
    const casts: Record<string, number> = {};
    let yard = 0;
    for (let i = 0; i < RUNS.length; i++) {
      const { card, host, foe } = RUNS[i]!, me = withFour(...host, card, cards), o = FORMAT_FIELD[foe[0]]![foe[1]]!;
      expect(me.decklist.reduce((n, e) => n + e.count, 0), me.name).toBe(60);
      for (let seed = 1; seed <= games; seed++) for (const seat of [0, 1] as const) for (const kind of ["random", "heuristic"] as const) {
        const mk = (s: number): Agent => (kind === "random" ? new RandomAgent(s) : new HeuristicAgent(s, cards, difficultyProfile("master", "aggro", [])));
        const c = new Counter(mk(seed * 2 + 1 + seat), card);
        const a = { name: me.name, decklist: me.decklist, agent: kind }, b = { name: o.name, decklist: o.decklist, agent: kind };
        const agents: [Agent, Agent] = seat === 0 ? [c, mk(seed * 2 + 2)] : [mk(seed * 2 + 2), c];
        const r = await runMatch({ seed: seed * 71 + seat + 9100 + i * 100, players: seat === 0 ? [a, b] : [b, a], rules: RULES, modifiers: [] }, cards, agents);
        expect(r.reason, `${me.name} seat ${seat} seed ${seed} ${kind}`).toBeTruthy();
        casts[card] = (casts[card] ?? 0) + c.casts; yard += c.yard;
      }
    }
    if (process.env.FUZZ_FULL) console.log(`casts: ${JSON.stringify(casts)}; Clutch Guard's graveyard activations: ${yard}; in ${RUNS.length * games * 4} games`);
    expect(casts["domain_pouncer"]).toBeGreaterThan(0);
    expect(casts["terrain_collapse"]).toBeGreaterThan(0);
    expect(casts["clutch_guard"]).toBeGreaterThan(0);
    expect(yard).toBeGreaterThan(0);
    expect(casts["revivalist"]).toBeGreaterThan(0);
    expect(casts["daunting_terror"]).toBeGreaterThan(0);
    expect(casts["discontinuous_flash"]).toBeGreaterThan(0);
    expect(casts["intuitive_mastery"]).toBeGreaterThan(0);
    expect(casts["command_of_the_depths"]).toBeGreaterThan(0);
    expect(casts["glory_hound"]).toBeGreaterThan(0);
  }, 1_800_000);
  it("replay determinism — a game of each run replays byte-identical", async () => {
    const cards = withStudy();
    for (let i = 0; i < RUNS.length; i++) {
      const { card, host, foe } = RUNS[i]!, me = withFour(...host, card, cards), o = FORMAT_FIELD[foe[0]]![foe[1]]!, seed = 140 + i;
      const live = await runMatch({ seed, players: [{ name: me.name, decklist: me.decklist, agent: "random" }, { name: o.name, decklist: o.decklist, agent: "random" }], rules: RULES, modifiers: [] }, cards, [new RandomAgent(seed * 2 + 1), new RandomAgent(seed * 2 + 2)]);
      const replayed = await replayGame(cards, [me.decklist.flatMap((d) => Array(d.count).fill(d.cardId)), o.decklist.flatMap((d) => Array(d.count).fill(d.cardId))], live.log, { startingLife: 20, handSize: 7, maxTurns: 100, ante: 0 }, []);
      expect(replayed, me.name).toBe(live.finalStateSerialized);
    }
  }, 600_000);
});
