/**
 * pnpm flood-sim [--games N] [--seed S] [--only key]
 *
 * S40 Part 5 (ADR-128): the flood's ten lists (docs/phase-two-legends-working.md §8) against the three
 * yardsticks — salvage-WR, salvage-UB (the phase-two floor) and chris-road-B (a finished phase-one deck) —
 * N games in each seat. The lords sit at the phase-two mage T3 row (the knob's life and entrance: three basics
 * of the triad, the law's colour first); the courts at 30 life (⚠ the phase-one court's; the phase-two court
 * row is unauthored) on their own ground (the High Ground on the battlefield). Every seat has its law in play
 * on its own side, as the phase-one seats do. Master pilots against journeyman yardsticks (the lord-sim
 * convention). Reports the SEAT's win rate, mean turns, and per-legend casts and activations. A measurement:
 * the lists are Chris's; nothing here changes them.
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { runMatch, type Action, type ActionRequest, type Agent, type GameView, type MatchSpec, type Modifier } from "@shandalar/engine";
import { HeuristicAgent, difficultyProfile } from "@shandalar/agents";
import { FLOOD_DECKS } from "@shandalar/sim/flood-decks";
import { ROAD_DECKS } from "@shandalar/sim/road-decks";
import { defaultKnobs } from "./knobs.js";

const arg = (name: string, fallback: string): string => { const i = process.argv.indexOf(`--${name}`); return i !== -1 ? process.argv[i + 1]! : fallback; };
const games = Number(arg("games", "10"));
const seed0 = Number(arg("seed", "1"));
const only = arg("only", "");
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const knobs = defaultKnobs();
const T3 = { life: knobs.phaseTierTables[2]!.mageTierLife[3], entrance: knobs.phaseTierTables[2]!.mageTierEntrance[3] };
const COURT_LIFE = 30;
const LAW: Record<string, string> = { W: "law_intake", B: "law_tithe", R: "law_toll", U: "law_risen_tide", G: "law_season" };
const BASIC: Record<string, string> = { W: "plains", U: "island", B: "swamp", R: "mountain", G: "forest" };
const LEGEND: Record<string, string> = { bailiff: "the_bailiff", reeve: "the_reeve", fordkeeper: "the_fordkeeper", dredger: "the_dredger", reaper: "the_reaper", odile: "odile_the_tallyflame", zinnia: "zinnia_the_undertow", ovna: "ovna_the_enchantress", isaura: "isaura_the_levy", meliyan: "meliyan_the_torment" };
const ARCHETYPE: Record<string, "aggro" | "midrange" | "control"> = { bailiff: "midrange", reeve: "control", fordkeeper: "control", dredger: "control", reaper: "midrange", odile: "control", zinnia: "control", ovna: "midrange", isaura: "midrange", meliyan: "aggro" };

/** Counts the seat's activations by source: the legend, the ground, and granted abilities on lands (the Fordkeeper's pings). */
class Counting implements Agent {
  legend = 0; ground = 0; granted = 0;
  constructor(private readonly inner: HeuristicAgent, private readonly legendId: string, private readonly groundId: string | undefined) {}
  async chooseAction(view: GameView, request: ActionRequest): Promise<Action> {
    const action = await this.inner.chooseAction(view, request);
    if (action.type === "activateAbility" && action.color === undefined) {
      const o = view.battlefield.find((b) => b.id === action.objectId);
      if (o?.cardId === this.legendId) this.legend += 1;
      else if (o && o.cardId === this.groundId) this.ground += 1;
      else if (o && action.abilityIndex >= (pool.get(o.cardId)?.abilities ?? []).length) this.granted += 1;
    }
    return action;
  }
}

const yardsticks = [ROAD_DECKS.salvageWR!, ROAD_DECKS.salvageUB!, ROAD_DECKS.chrisRoadB!];
console.log(`flood-sim: ${games} games per seat per pairing; lords at the phase-two T3 row (life ${T3.life}, ${T3.entrance} basics), courts at ${COURT_LIFE} on their ground; the law on the seat's side; master vs journeyman.`);
console.log(`| seat | legend | vs | seat wins | mean turns | legend casts/game | legend activations/game | ground or granted activations/game |`);
console.log(`|---|---|---|---|---|---|---|---|`);
for (const [key, deck] of Object.entries(FLOOD_DECKS)) {
  if (only && only !== key) continue;
  const legendId = LEGEND[key]!;
  const colours = [deck.law, ...(["W", "U", "B", "R", "G"] as const).filter((c) => c !== deck.law && pool.get(legendId)!.manaCost.includes(`{${c}}`))];
  const entrance = deck.kind === "lord" ? Array.from({ length: T3.entrance }, (_, i) => BASIC[colours[i % colours.length]!]!) : [];
  const life = deck.kind === "lord" ? T3.life : COURT_LIFE;
  for (const y of yardsticks) {
    let wins = 0, total = 0, turns = 0, casts = 0, acts = 0, side = 0;
    for (const seat of [0, 1] as const) {
      const ySeat = (1 - seat) as 0 | 1;
      for (let i = 0; i < games; i++) {
        if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));
        const seed = seed0 + i * 2 + seat + key.length * 101;
        const modifiers: Modifier[] = [
          { type: "startingLife", player: seat, value: life },
          { type: "startingLife", player: ySeat, value: y.life },
          { type: "permanentOnBattlefield", player: seat, cardId: LAW[deck.law]! },
          ...(deck.ground ? [{ type: "permanentOnBattlefield" as const, player: seat, cardId: deck.ground }] : []),
          ...entrance.map((cardId) => ({ type: "permanentOnBattlefield" as const, player: seat, cardId })),
          ...y.entrance.map((cardId) => ({ type: "permanentOnBattlefield" as const, player: ySeat, cardId })),
        ];
        const me = { name: deck.name, decklist: [...deck.decklist], agent: "heuristic" as const };
        const them = { name: y.name, decklist: [...y.decklist], agent: "heuristic" as const };
        const spec: MatchSpec = { seed, players: seat === 0 ? [me, them] : [them, me], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 100 }, modifiers };
        const mine = new Counting(new HeuristicAgent(seed * 2 + 1, pool, difficultyProfile("master", ARCHETYPE[key]!, [...y.decklist])), legendId, deck.ground);
        const theirs: Agent = new HeuristicAgent(seed * 2 + 2, pool, difficultyProfile("journeyman", y.archetype, [...deck.decklist]));
        try {
          const r = await runMatch(spec, pool, seat === 0 ? [mine, theirs] : [theirs, mine]);
          if (r.winner === seat) wins += 1;
          total += 1; turns += r.turns;
          casts += r.facts.spellsCast[legendId]?.[seat] ?? 0;
          acts += mine.legend; side += mine.ground + mine.granted;
        } catch (e) {
          console.log(`ERROR ${key} vs ${y.name} seat ${seat} seed ${seed}: ${(e as Error).message}`);
        }
      }
    }
    const per = (n: number) => (n / Math.max(1, total)).toFixed(2);
    console.log(`| ${deck.seat} | ${deck.name} | ${y.name} | ${((100 * wins) / Math.max(1, total)).toFixed(0)}% | ${per(turns)} | ${per(casts)} | ${per(acts)} | ${per(side)} |`);
  }
}
