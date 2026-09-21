/**
 * pnpm heart-sim [--games N] [--seed S] [--life L] [--lives 35,40,45] [--lands 20,18] [--refs all|stock|road|flood] [--persist 0|1|both] [--tide 0|1|both] [--roots 5,3] [--hand 1|0]
 *
 * S42b (ADR-135): `--roots` runs each cell at N roots (the first N of HEART_ROOTS: W U B R G) and `--hand 0` keeps the
 * flower OUT of the opening hand — the entrance is the fount's lever, not its life.
 *
 * S38 (design §7): `--persist` runs the ACCUMULATING ring (heartLawsPersist: every prior law stays; the
 * engine's lawSequence `accumulate` mode) — `1` alone, `both` beside the rotating ring on the same seeds
 * (the paired read); a `laws at death` column counts the laws standing on the flower's side when the
 * player died.
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
import { FOUNT_DECK, HEART_DECK, TIDE_ORDER } from "@shandalar/sim/heart-deck";
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
const persistArg = arg("persist", "0");
// S42a (ADR-131/132): `--tide 1` runs the CINQUEFONT (the fount's sixty, the tide mode in U G W B R) alone; `--tide both` beside
// whatever `--persist` selected, on the same seeds. `--refs flood` = chris-road-B + the two salvage+legends references.
const tideArg = arg("tide", "0");
const rootCounts = arg("roots", "5").split(",").map(Number);
const inHand = arg("hand", "1") !== "0";
const baseRings: ("rotating" | "accumulating" | "tide")[] = persistArg === "both" ? ["rotating", "accumulating"] : persistArg === "1" ? ["accumulating"] : ["rotating"];
const rings: ("rotating" | "accumulating" | "tide")[] = tideArg === "1" ? ["tide"] : tideArg === "both" ? [...baseRings, "tide"] : baseRings;
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
const floodRefs: Ref[] = [road, ...(["salvageWRLegends", "salvageUBLegends"] as const).map((k) => ({ name: ROAD_DECKS[k]!.name, archetype: ROAD_DECKS[k]!.archetype, decklist: ROAD_DECKS[k]!.decklist, profile: "journeyman" as const, life: ROAD_DECKS[k]!.life, entrance: [...ROAD_DECKS[k]!.entrance] }))];
const references: Ref[] = refFilter === "flood" ? floodRefs : refFilter === "postlords" ? [ROAD_DECKS.salvageWRLords!, ROAD_DECKS.salvageUBLords!].map((r) => ({ name: r.name, archetype: r.archetype, decklist: r.decklist, profile: "journeyman" as const, life: r.life, entrance: [...r.entrance] })) : refFilter === "stock" ? stock : refFilter === "road" ? [road] : [...stock, road];

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

console.log(`heart-sim: ${games} games per cell · lives ${lives.join("/")} · lands ${landCounts.join("/")} · rings ${rings.join("+")} · roots ${rootCounts.join("/")} · flower in hand ${inHand ? "yes" : "NO"} · ${references.length} references (stock journeyman at ${refLife}; chris-road-B master at 17 with four basics) · the Manafleur master with roots + entrance`);
console.log(`\n| ring | roots | lands | heartLife | reference | kill % | T1 flower % | mean turns | died at (Intake/Tithe/Toll/Season/Barrage/none) | laws at death (mean; max) | flower removed (games; by) |`);
console.log(`|---|---|---|---|---|---|---|---|---|---|---|`);
const totals = new Map<string, { wins: number; total: number; t1: number; turns: number; died: Record<string, number>; removed: number; by: Record<string, number>; laws: number; lawsMax: number }>();
for (const ring of rings) {
for (const roots of rootCounts) {
for (const lands of landCounts) {
  const sixty = sixtyAt(lands);
  for (const life of lives) {
    for (const ref of references) {
      let wins = 0, total = 0, t1 = 0, turns = 0, removed = 0, lawsSum = 0, lawsMax = 0;
      const died: Record<string, number> = { Intake: 0, Tithe: 0, Toll: 0, Season: 0, Barrage: 0, none: 0 };
      const by: Record<string, number> = {};
      for (let i = 0; i < games; i++) {
        if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));
        const seed = seed0 + i + life * 101 + lands * 7; // the same seeds across roots and rings (the paired read)
        const boss = ring === "tide" ? "the_cinquefont" : "the_manafleur";
        const bossDeck = ring === "tide" ? sixty.map((e) => (e.cardId === "the_manafleur" ? { ...e, cardId: "the_cinquefont" } : { ...e })) : [...sixty];
        const spec: MatchSpec = {
          seed,
          players: [
            { name: ref.name, decklist: [...ref.decklist], agent: "heuristic" },
            { name: ring === "tide" ? FOUNT_DECK.name : HEART_DECK.name, decklist: bossDeck, agent: "heuristic" },
          ],
          rules: { startingLife: ref.life, handSize: 7, mulligan: "london", maxTurns: 100 },
          modifiers: [
            { type: "startingLife", player: 1, value: life },
            ...(inHand ? [{ type: "signatureToHand" as const, player: 1 as const, cardId: boss }] : []),
            ...heartRootModifiers(1).slice(0, roots),
            ...ref.entrance.map((cardId) => ({ type: "permanentOnBattlefield" as const, player: 0 as const, cardId })),
            ring === "tide" ? { type: "lawSequence", order: [...TIDE_ORDER], mode: "tide" as const } : { type: "lawSequence", ...(ring === "accumulating" ? { mode: "accumulate" as const } : {}) },
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
          const cast = log.find((e) => e.t === "EVENT" && e.name === "SPELL_CAST" && e.payload?.cardId === boss && e.payload?.controller === 1);
          if (cast && turnOf(cast) <= 2) t1 += 1; // the heart's first turn (turn 1 or 2 by the coin)
          // The standing petal when the player died: the law on the heart's battlefield in the FINAL
          // state (the log's EVENT stream carries no zone changes; the final state is canonical).
          if (r.winner === 1) {
            const fin = JSON.parse(r.finalStateSerialized) as { battlefield: string[]; objects: Record<string, { cardId: string; controller: number }> };
            const laws = fin.battlefield.map((id) => fin.objects[id]).filter((o) => o && o.controller === 1 && o.cardId.startsWith("law_"));
            const law = laws[laws.length - 1]; // the newest petal (the accumulating ring keeps the older ones beneath)
            died[law ? (LAW_NAMES[law.cardId] ?? "none") : "none"]! += 1;
            lawsSum += laws.length; lawsMax = Math.max(lawsMax, laws.length);
          }
          // The flower removed: its first DEATH (the EVENT stream logs DIES; exile and bounce are not
          // visible here — a floor, not a ceiling); by the player's last spell before it.
          const gone = log.findIndex((e) => e.t === "EVENT" && e.name === "DIES" && e.payload?.cardId === boss && e.payload?.owner === 1);
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
      console.log(`| ${ring} | ${roots} | ${lands} | ${life} | ${ref.name} | ${pct(wins)} | ${pct(t1)} | ${(turns / Math.max(1, total)).toFixed(1)} | ${["Intake", "Tithe", "Toll", "Season", "Barrage", "none"].map((k) => died[k]).join("/")} | ${wins ? (lawsSum / wins).toFixed(1) : "—"}; ${lawsMax} | ${removed}${byTxt ? `; ${byTxt}` : ""} |`);
      const key = `${ring}|${roots}|${lands}|${life}|${ref.name === "chris-road-B" ? "road" : "stock"}`;
      const t = totals.get(key) ?? { wins: 0, total: 0, t1: 0, turns: 0, died: { Intake: 0, Tithe: 0, Toll: 0, Season: 0, Barrage: 0, none: 0 }, removed: 0, by: {}, laws: 0, lawsMax: 0 };
      t.wins += wins; t.total += total; t.t1 += t1; t.turns += turns; t.removed += removed; t.laws += lawsSum; t.lawsMax = Math.max(t.lawsMax, lawsMax);
      for (const k of Object.keys(died)) t.died[k] = (t.died[k] ?? 0) + died[k]!;
      totals.set(key, t);
    }
  }
}
}
}
console.log(`\n**Aggregates** (stock = the seven references pooled; road = chris-road-B):\n\n| ring | roots | lands | heartLife | vs | kill % | T1 flower % | mean turns | died at (Intake/Tithe/Toll/Season/Barrage/none) | laws at death (mean; max) | flower removed |\n|---|---|---|---|---|---|---|---|---|---|---|`);
for (const [key, t] of totals) {
  const [ring, roots, lands, life, vs] = key.split("|");
  console.log(`| ${ring} | ${roots} | ${lands} | ${life} | ${vs} | ${((100 * t.wins) / Math.max(1, t.total)).toFixed(0)}% | ${((100 * t.t1) / Math.max(1, t.total)).toFixed(0)}% | ${(t.turns / Math.max(1, t.total)).toFixed(1)} | ${["Intake", "Tithe", "Toll", "Season", "Barrage", "none"].map((k) => t.died[k]).join("/")} | ${t.wins ? (t.laws / t.wins).toFixed(1) : "—"}; ${t.lawsMax} | ${t.removed}/${t.total} |`);
}
