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
import { loadCatalog } from "./loader.js";
import { ROAD_DECKS } from "@shandalar/sim/road-decks";
import { defaultKnobs } from "./knobs.js";
import { cardColors, manaValue, parseManaCost } from "@shandalar/cards";
import { checkDeck, type DeckRule } from "./legality.js";

const arg = (name: string, fallback: string): string => { const i = process.argv.indexOf(`--${name}`); return i !== -1 ? process.argv[i + 1]! : fallback; };
const games = Number(arg("games", "10"));
const seed0 = Number(arg("seed", "1"));
const only = arg("only", "");
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const knobs = defaultKnobs();
const catalog = loadCatalog(join(ROOT, "data/world"));
const flood = catalog.flood!;
const FLOOD_DECKS: Record<string, { name: string; seat: string; law: string; kind: "lord" | "court"; ground?: string; decklist: { cardId: string; count: number }[] }> = Object.fromEntries([
  ...flood.strongholds.map((s) => [s.lord.key, { ...flood.decks[s.lord.key]!, law: s.color, kind: "lord" as const }]),
  ...flood.courts.map((c) => [c.minister.key, { ...flood.decks[c.minister.key]!, law: c.color, kind: "court" as const, ground: c.ground }]),
]);
// S41: the seats as BUILT — the lords at their def's baseLife (34 ⚠) with the law and signatureToHand (the phase-one
// lords' entrance; no growth, no hunt); the courts at their def's life (34 ⚠) on their ground with the law.
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

const yardsticks = [ROAD_DECKS.salvageWRLegends!, ROAD_DECKS.salvageUBLegends!, ROAD_DECKS.chrisRoadB!];
console.log(`flood-sim (S41): ${games} games per seat per pairing; lords at ${flood.strongholds[0]!.lord.baseLife} with the law and the signature in hand; courts at ${flood.courts[0]!.minister.life} on their ground with the law; master vs journeyman. A court's intruder is the reference's NEAREST LEGAL CUT for that court's gate (the changes are listed under the table).`);

/** The nearest legal cut of a reference for a court's gate: offenders out (replaced by pack creatures of the deck's
 * colours that pass the gate, else basics of its colours), creatures topped up to the floor from the same shelf
 * (the dearest noncreature spells leave first), basics added until the land fraction holds. Deterministic. */
function legalCut(ref: { decklist: { cardId: string; count: number }[] }, rule: DeckRule): { decklist: { cardId: string; count: number }[]; changes: string[] } {
  const list = ref.decklist.map((e) => ({ ...e }));
  const changes: string[] = [];
  const def = (id: string) => pool.get(id)!;
  const mv = (id: string) => manaValue(parseManaCost(def(id).manaCost));
  const colours = [...new Set(list.flatMap((e) => (def(e.cardId).types.includes("Land") ? [] : cardColors(def(e.cardId)))))];
  const basics = colours.map((c) => BASIC[c]!);
  const passes = (id: string) => { const d = def(id); if (rule.bannedTypes?.some((t) => d.types.includes(t))) return false; if (rule.maxManaValue !== undefined && mv(id) > rule.maxManaValue) return false; if (rule.minCreaturePower !== undefined && d.types.includes("Creature") && (d.power ?? 0) < rule.minCreaturePower) return false; return true; };
  const shelf = () => colours.flatMap((c) => catalog.salvagePack!.colors[c as "W"] ?? []).filter((id) => def(id).types.includes("Creature") && passes(id) && !list.some((e) => e.cardId === id));
  const add = (id: string) => { const e = list.find((x) => x.cardId === id); if (e) e.count += 1; else list.push({ cardId: id, count: 1 }); };
  const remove = (id: string) => { const e = list.find((x) => x.cardId === id)!; e.count -= 1; if (e.count === 0) list.splice(list.indexOf(e), 1); };
  let b = 0;
  for (const e of [...list]) if (!def(e.cardId).types.includes("Land") && !passes(e.cardId)) for (let k = e.count; k > 0; k--) { remove(e.cardId); const r = shelf()[0] ?? basics[b++ % basics.length]!; add(r); changes.push(`−${def(e.cardId).name} +${def(r).name}`); }
  const creatures = () => list.reduce((n, e) => n + (def(e.cardId).types.includes("Creature") ? e.count : 0), 0);
  while (rule.minCreatures !== undefined && creatures() < rule.minCreatures) {
    const out = [...list].filter((e) => !def(e.cardId).types.includes("Land") && !def(e.cardId).types.includes("Creature")).sort((x, y) => mv(y.cardId) - mv(x.cardId))[0];
    const r = shelf()[0];
    if (!out || !r) break;
    remove(out.cardId); add(r); changes.push(`−${def(out.cardId).name} +${def(r).name}`);
  }
  const lands = () => list.reduce((n, e) => n + (def(e.cardId).types.includes("Land") ? e.count : 0), 0);
  const size = () => list.reduce((n, e) => n + e.count, 0);
  let added = 0;
  while (rule.minLandFraction !== undefined && lands() < rule.minLandFraction * size()) { add(basics[b++ % basics.length]!); added += 1; }
  if (added) changes.push(`+${added} basics (${size()} cards)`);
  const check = checkDeck(list, null, rule, pool);
  if (!check.ok) changes.push(`STILL ILLEGAL: ${check.problems.join("; ")}`);
  return { decklist: list, changes };
}
const cutNotes: string[] = [];
console.log(`| seat | legend | vs | seat wins | mean turns | legend casts/game | legend activations/game | ground or granted activations/game |`);
console.log(`|---|---|---|---|---|---|---|---|`);
for (const [key, deck] of Object.entries(FLOOD_DECKS)) {
  if (only && only !== key) continue;
  const legendId = LEGEND[key]!;
  const colours = [deck.law, ...(["W", "U", "B", "R", "G"] as const).filter((c) => c !== deck.law && pool.get(legendId)!.manaCost.includes(`{${c}}`))];
  void colours;
  const site = deck.kind === "lord" ? flood.strongholds.find((x) => x.lord.key === key)! : undefined;
  const court = deck.kind === "court" ? flood.courts.find((x) => x.minister.key === key)! : undefined;
  const life = site ? site.lord.baseLife : court!.minister.life;
  for (const y0 of yardsticks) {
    const cut = court?.deckRule ? legalCut(y0, court.deckRule) : { decklist: y0.decklist, changes: [] };
    if (cut.changes.length) cutNotes.push(`- ${court!.name} × ${y0.name}: ${cut.changes.join(", ")}`);
    const y = { ...y0, decklist: cut.decklist };
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
          ...(site ? [{ type: "signatureToHand" as const, player: seat, cardId: site.lord.cardId }] : []),
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
if (cutNotes.length) { console.log(`\nThe legal cuts (a court's intruder must pass its gate):`); for (const n of cutNotes) console.log(n); }
