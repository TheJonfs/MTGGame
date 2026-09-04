/**
 * pnpm heart-sim [--games N] [--seed S] [--life L] [--lives 35,40,45] [--lands 20,18] [--refs all|stock|road]
 *
 * S27 Part 5 (ADR-093) → S28 Part 2c (ADR-096): the Manafleur's sixty WITH ROOTS (master profile, the
 * entrance, the five basics on its side, the default WBRUG sequence) at heartLife {35,40,45} × the
 * sixty at 20 lands / 18 lands (two Ravnica duals out, the least-demanded colour pair), against the
 * seven stock references (the five starters + slice C and D; journeyman at world life L, default 16)
 * AND `chris-road-B` — Chris's actual end-game deck, reconstructed (30 cards; master; life 17; four
 * basics in play, no Forest). Per cell: kill rate, turn-one-flower rate, mean turns, the petal
 * standing when the player died (Intake/Tithe/Toll/Season/Barrage/none), and whether the player ever
 * removed the flower and by what (the player's last spell before the flower left the battlefield).
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { manaValue, parseManaCost } from "@shandalar/cards";
import { runMatch, type Agent, type MatchSpec } from "@shandalar/engine";
import { HeuristicAgent, difficultyProfile } from "@shandalar/agents";
import { HEART_DECK } from "@shandalar/sim/heart-deck";
import { DECKS } from "@shandalar/sim/decks";
import { ROAD_DECKS } from "@shandalar/sim/road-decks";
import { loadCatalog } from "./loader.js";
import { heartRootModifiers } from "./corolla.js";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1]! : fallback;
}
const games = Number(arg("games", "30"));
const seed0 = Number(arg("seed", "1"));
const refLife = Number(arg("life", "16"));
const lives = arg("lives", "35,40,45").split(",").map(Number);
const landCounts = arg("lands", "20,18").split(",").map(Number);
const refFilter = arg("refs", "all");
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const catalog = loadCatalog(join(ROOT, "data/world"));

type Deck = { cardId: string; count: number }[];
type Ref = { name: string; archetype: "aggro" | "midrange" | "control"; decklist: Deck; profile: "journeyman" | "master"; life: number; entrance: string[] };
/** S28 Part 2c: Chris's final-fight deck from the black road (sim/road-decks; every card validated against the pool). */
const CHRIS_ROAD_B: Deck = ROAD_DECKS.chrisRoadB!.decklist;
for (const e of CHRIS_ROAD_B) if (!pool.has(e.cardId)) throw new Error(`chris-road-B: ${e.cardId} is not in the pool`);
if (CHRIS_ROAD_B.reduce((n, e) => n + e.count, 0) !== 30) throw new Error("chris-road-B: not 30 cards");

const stock: Ref[] = [
  ...catalog.starters.map((s) => ({ name: `starter:${s.id}`, archetype: s.archetype, decklist: s.decklist, profile: "journeyman" as const, life: refLife, entrance: [] })),
  { name: "slice:C", archetype: "midrange", decklist: [...DECKS.C.decklist], profile: "journeyman", life: refLife, entrance: [] },
  { name: "slice:D", archetype: "midrange", decklist: [...DECKS.D.decklist], profile: "journeyman", life: refLife, entrance: [] },
];
const road: Ref = { name: ROAD_DECKS.chrisRoadB!.name, archetype: ROAD_DECKS.chrisRoadB!.archetype, decklist: CHRIS_ROAD_B, profile: "master", life: ROAD_DECKS.chrisRoadB!.life, entrance: [...ROAD_DECKS.chrisRoadB!.entrance] };
const references: Ref[] = refFilter === "stock" ? stock : refFilter === "road" ? [road] : [...stock, road];

/** The sixty at 18 lands: the two Ravnica duals whose colour pair the nonland cards demand least leave. */
const SHOCKS: Record<string, [string, string]> = { hallowed_fountain: ["W", "U"], watery_grave: ["U", "B"], blood_crypt: ["B", "R"], stomping_ground: ["R", "G"], temple_garden: ["G", "W"], godless_shrine: ["W", "B"], steam_vents: ["U", "R"], overgrown_tomb: ["B", "G"], sacred_foundry: ["R", "W"], breeding_pool: ["G", "U"] };
function sixtyAt(lands: number): Deck {
  if (lands >= 20) return HEART_DECK.decklist.map((e) => ({ ...e }));
  const pips: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  for (const e of HEART_DECK.decklist) {
    const def = pool.get(e.cardId);
    if (!def || def.types.includes("Land")) continue;
    for (const c of (def.manaCost ?? "").replace(/[^WUBRG]/g, "")) pips[c]! += e.count;
  }
  const drop = Object.entries(SHOCKS).map(([id, [a, b]]) => ({ id, demand: pips[a]! + pips[b]! })).sort((x, y) => x.demand - y.demand || x.id.localeCompare(y.id)).slice(0, 20 - lands).map((x) => x.id);
  return HEART_DECK.decklist.filter((e) => !drop.includes(e.cardId)).map((e) => ({ ...e }));
}

type LogEntry = { t: string; name?: string; payload?: Record<string, unknown>; afterAction?: number; turn?: number; player?: number; action?: { type: string } };
const LAW_NAMES: Record<string, string> = { law_intake: "Intake", law_tithe: "Tithe", law_toll: "Toll", law_season: "Season", law_risen_tide: "Barrage" };

console.log(`heart-sim: ${games} games per cell · lives ${lives.join("/")} · lands ${landCounts.join("/")} · ${references.length} references (stock journeyman at ${refLife}; chris-road-B master at 17 with four basics) · the Manafleur master with roots + entrance`);
console.log(`\n| lands | heartLife | reference | kill % | T1 flower % | mean turns | died at (Intake/Tithe/Toll/Season/Barrage/none) | flower removed (games; by) |`);
console.log(`|---|---|---|---|---|---|---|---|`);
const totals = new Map<string, { wins: number; total: number; t1: number; turns: number; died: Record<string, number>; removed: number; by: Record<string, number> }>();
for (const lands of landCounts) {
  const sixty = sixtyAt(lands);
  for (const life of lives) {
    for (const ref of references) {
      let wins = 0, total = 0, t1 = 0, turns = 0, removed = 0;
      const died: Record<string, number> = { Intake: 0, Tithe: 0, Toll: 0, Season: 0, Barrage: 0, none: 0 };
      const by: Record<string, number> = {};
      for (let i = 0; i < games; i++) {
        if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));
        const seed = seed0 + i + life * 101 + lands * 7;
        const spec: MatchSpec = {
          seed,
          players: [
            { name: ref.name, decklist: [...ref.decklist], agent: "heuristic" },
            { name: HEART_DECK.name, decklist: [...sixty], agent: "heuristic" },
          ],
          rules: { startingLife: ref.life, handSize: 7, mulligan: "london", maxTurns: 100 },
          modifiers: [
            { type: "startingLife", player: 1, value: life },
            { type: "signatureToHand", player: 1, cardId: "the_manafleur" },
            ...heartRootModifiers(1),
            ...ref.entrance.map((cardId) => ({ type: "permanentOnBattlefield" as const, player: 0 as const, cardId })),
            { type: "lawSequence" },
          ],
        };
        const a0: Agent = new HeuristicAgent(seed * 2 + 1, pool, difficultyProfile(ref.profile, ref.archetype, [...sixty]));
        const a1: Agent = new HeuristicAgent(seed * 2 + 2, pool, difficultyProfile("master", HEART_DECK.archetype, [...ref.decklist]));
        try {
          const r = await runMatch(spec, pool, [a0, a1]);
          total += 1;
          turns += r.turns;
          if (r.winner === 1) wins += 1;
          const log = r.log as LogEntry[];
          const actions = log.filter((e) => e.t === "ACTION");
          const turnOf = (e: LogEntry): number => (e.afterAction !== undefined && actions[e.afterAction] ? (actions[e.afterAction]!.turn ?? 0) : 0);
          const cast = log.find((e) => e.t === "EVENT" && e.name === "SPELL_CAST" && e.payload?.cardId === "the_manafleur" && e.payload?.controller === 1);
          if (cast && turnOf(cast) <= 2) t1 += 1; // the heart's first turn (turn 1 or 2 by the coin)
          // The standing petal when the player died: the law on the heart's battlefield in the FINAL
          // state (the log's EVENT stream carries no zone changes; the final state is canonical).
          if (r.winner === 1) {
            const fin = JSON.parse(r.finalStateSerialized) as { battlefield: string[]; objects: Record<string, { cardId: string; controller: number }> };
            const law = fin.battlefield.map((id) => fin.objects[id]).find((o) => o && o.controller === 1 && o.cardId.startsWith("law_"));
            died[law ? (LAW_NAMES[law.cardId] ?? "none") : "none"]! += 1;
          }
          // The flower removed: its first DEATH (the EVENT stream logs DIES; exile and bounce are not
          // visible here — a floor, not a ceiling); by the player's last spell before it.
          const gone = log.findIndex((e) => e.t === "EVENT" && e.name === "DIES" && e.payload?.cardId === "the_manafleur" && e.payload?.owner === 1);
          if (gone !== -1) {
            removed += 1;
            const before = log.slice(0, gone).reverse().find((e) => e.t === "EVENT" && e.name === "SPELL_CAST" && e.payload?.controller === 0);
            const k = before ? (pool.get(String(before.payload?.cardId))?.name ?? String(before.payload?.cardId)) : "combat / no spell";
            by[k] = (by[k] ?? 0) + 1;
          }
        } catch (e) {
          console.log(`    ERROR lands ${lands} life ${life} vs ${ref.name} seed ${seed}: ${(e as Error).message}`);
        }
      }
      const pct = (n: number) => `${((100 * n) / Math.max(1, total)).toFixed(0)}%`;
      const byTxt = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ×${v}`).join(", ");
      console.log(`| ${lands} | ${life} | ${ref.name} | ${pct(wins)} | ${pct(t1)} | ${(turns / Math.max(1, total)).toFixed(1)} | ${["Intake", "Tithe", "Toll", "Season", "Barrage", "none"].map((k) => died[k]).join("/")} | ${removed}${byTxt ? `; ${byTxt}` : ""} |`);
      const key = `${lands}|${life}|${ref.name === "chris-road-B" ? "road" : "stock"}`;
      const t = totals.get(key) ?? { wins: 0, total: 0, t1: 0, turns: 0, died: { Intake: 0, Tithe: 0, Toll: 0, Season: 0, Barrage: 0, none: 0 }, removed: 0, by: {} };
      t.wins += wins; t.total += total; t.t1 += t1; t.turns += turns; t.removed += removed;
      for (const k of Object.keys(died)) t.died[k] = (t.died[k] ?? 0) + died[k]!;
      totals.set(key, t);
    }
  }
}
console.log(`\n**Aggregates** (stock = the seven references pooled; road = chris-road-B):\n\n| lands | heartLife | vs | kill % | T1 flower % | mean turns | died at (Intake/Tithe/Toll/Season/Barrage/none) | flower removed |\n|---|---|---|---|---|---|---|---|`);
for (const [key, t] of totals) {
  const [lands, life, vs] = key.split("|");
  console.log(`| ${lands} | ${life} | ${vs} | ${((100 * t.wins) / Math.max(1, t.total)).toFixed(0)}% | ${((100 * t.t1) / Math.max(1, t.total)).toFixed(0)}% | ${(t.turns / Math.max(1, t.total)).toFixed(1)} | ${["Intake", "Tithe", "Toll", "Season", "Barrage", "none"].map((k) => t.died[k]).join("/")} | ${t.removed}/${t.total} |`);
}
