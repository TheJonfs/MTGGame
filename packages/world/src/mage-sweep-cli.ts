/**
 * pnpm mage-sweep [--games N] [--seed S] [--part 1|2|3|4|5|6|7|8|9|all] [--baseline <json>|none] [--mode easy|standard|hard]
 *
 * S29 Part 5: the mage cleansheet's three round-robins under the heuristic ladder (both seats; the
 * tier's profile; the tier's life for both sides unless noted).
 *   1. tier by tier — the five mages of each tier against each other (10 pairings × 3 tiers);
 *   2. teachers vs starters — each tier-1 mage (apprentice, 8) against the five starters at the
 *      starters' life (the player's starting world life), journeyman piloting the starter;
 *   3. children vs parents — each tier-2/3 mage against its two parent lines (the parent mage at
 *      tier-1 settings; the parent beast at its own catalog settings).
 * Per pairing: win rate, mean turns, and the share of wins by library (DECKED) — the mill decks' axis.
 * S30: a delta column against a baseline sweep; per-deck CAST COUNTS (facts.spellsCast) with the
 * never-cast list; part 4 — the five starters against each other (journeyman at 10).
 * S31: part 5 — the tier-2 and tier-3 mages against the five starters (the library size the mill
 * decks actually face); the baseline defaults to the S30 run (sweep-baselines/s30.json).
 * S32: part 6 — the beasts against the five starters (is the part-5 gap the lists or the tiers?);
 * part 7 — every tier-2/3 mage against the two MID-ROAD references (sim/road-decks: a starter plus
 * eight shop cards, a manalink basic in play, 12 life, journeyman — ADR-111's yardstick); `returned`
 * counts (graveyard → battlefield by card) beside the cast counts; the baseline defaults to S31.
 * S33 (the tiers against the road): part 8 — the MATRIX: every tier-3 mage at life {12,16,20} ×
 * entrance {none, 1, 2 basics of its own colours} and every tier-2 mage at life {10,12,14} ×
 * entrance {none, 1} against both mid-road references, with per-tier aggregates (the reference's
 * win rate by life × entrance, averaged over the five mages and both references); part 9 — the
 * tier-2/3 beasts at catalog life, +4 and +8 against both references (beasts get no roots).
 * S34: `--mode easy|standard|hard` (default standard) — the mages and beasts take the resolver's tables at
 * that mode (mageTierLife / mageTierEntrance / beastTierLifeDelta + the row offsets), so a sweep row is
 * "the catalog at this mode"; `--tier-life` is gone. Part 8's rows carry A's graveyard → battlefield
 * returns per game (Corvane's engine per cell).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { runMatch, type Agent, type MatchSpec } from "@shandalar/engine";
import { HeuristicAgent, difficultyProfile, type Difficulty } from "@shandalar/agents";
import { MAGE_DECKS } from "@shandalar/sim/mage-decks";
import { EXPANSION_DECKS } from "@shandalar/sim/expansion-decks";
import { ROAD_DECKS } from "@shandalar/sim/road-decks";
import { loadCatalog } from "./loader.js";
import { DIFFICULTIES, resolveKnobs, type DifficultyName } from "./knobs.js";
import { entranceFor, resolveMatchup } from "./matchup.js";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1]! : fallback;
}
const games = Number(arg("games", "100"));
const seed0 = Number(arg("seed", "1"));
const part = arg("part", "all");
// S30 Part 5: a baseline sweep (pairing key → A's win %) for a delta column; the S29 run ships as
// sweep-baselines/s29.json (`--baseline none` to drop the column).
const baselineArg = arg("baseline", join(dirname(fileURLToPath(import.meta.url)), "sweep-baselines/s31.json"));
const baselineName = baselineArg === "none" ? "—" : (baselineArg.match(/(s\d+)\.json$/)?.[1] ?? "baseline").toUpperCase();
const baseline: Record<string, number> = baselineArg === "none" ? {} : (JSON.parse(readFileSync(baselineArg, "utf8")) as Record<string, number>);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const catalog = loadCatalog(join(ROOT, "data/world"));
const mode = arg("mode", "standard") as DifficultyName;
if (!(mode in DIFFICULTIES)) throw new Error(`--mode must be easy|standard|hard`);
const knobs = resolveKnobs({ difficulty: DIFFICULTIES[mode] });

type Side = { name: string; decklist: { cardId: string; count: number }[]; archetype: "aggro" | "midrange" | "control"; profile: Difficulty; life: number; entrance?: string[] };
/** S34: the tier life is the resolver's table at the chosen mode. */
const TIER_LIFE: Record<1 | 2 | 3, number> = knobs.mageTierLife;
const TIER_PROFILE: Record<1 | 2 | 3, Difficulty> = { 1: "apprentice", 2: "journeyman", 3: "master" };
const mage = (key: string, tierAs?: 1 | 2 | 3): Side => {
  const m = MAGE_DECKS[key]!;
  const t = tierAs ?? m.tier;
  // S34: the resolver's cell at this mode — life AND entrance (the catalog row, when one exists, carries the offset).
  const row = catalog.opponents.find((o) => o.deck === `mage:${key}`);
  const entrance = entranceFor(`mage:${key}`, knobs.mageTierEntrance[t]);
  return { name: `${m.name} (${key})`, decklist: m.decklist, archetype: m.archetype, profile: TIER_PROFILE[t], life: TIER_LIFE[t] + (row?.worldLifeOffset ?? 0), entrance };
};
/** S33: a mage at a chosen life with N entrance basics (its colours by pip count; a mono mage repeats its one). */
const mageAt = (key: string, life: number, basics: number): Side => {
  const base = mage(key);
  return { ...base, name: `${base.name} @${life}/${basics}`, life, entrance: entranceFor(`mage:${key}`, basics) };
};
const beastAt = (key: string, delta: number): Side => {
  const b = beast(key);
  return { ...b, name: `${b.name} @+${delta}`, life: b.life + delta };
};
const beast = (key: string): Side => {
  const b = EXPANSION_DECKS[key]!;
  const row = catalog.opponents.find((o) => o.deck === `beast:${key}`);
  // S34: the resolver's life at this mode (catalog base + the tier delta + the row offset); no entrance for beasts.
  const life = row ? resolveMatchup(row, knobs).life : TIER_LIFE[b.tier];
  return { name: `${b.name} (beast:${key})`, decklist: b.decklist, archetype: b.archetype, profile: row?.difficulty ?? TIER_PROFILE[b.tier], life };
};
const starter = (id: string): Side => {
  const s = catalog.starters.find((x) => x.id === id)!;
  return { name: `starter:${id}`, decklist: s.decklist, archetype: s.archetype, profile: "journeyman", life: knobs.startingWorldLife };
};
/** S32 (ADR-111): a mid-road reference — its manalink basic(s) in play at duel start, 12 life, journeyman. */
const road = (key: string): Side => {
  const r = ROAD_DECKS[key]!;
  for (const e of r.decklist) if (!pool.has(e.cardId)) throw new Error(`${r.name}: ${e.cardId} is not in the pool`);
  return { name: r.name, decklist: r.decklist, archetype: r.archetype, profile: "journeyman", life: r.life, entrance: [...r.entrance] };
};

/** Cast counts per deck (by the side's name) across every game it played, and games played; S32: the returns too. */
const casts = new Map<string, { games: number; byCard: Record<string, number>; returned: Record<string, number>; decklist: { cardId: string; count: number }[] }>();
function noteCasts(side: Side, seat: 0 | 1, spellsCast: Record<string, [number, number]>, returned: Record<string, [number, number]>): void {
  const row = casts.get(side.name) ?? { games: 0, byCard: {}, returned: {}, decklist: side.decklist };
  row.games += 1;
  for (const [cardId, by] of Object.entries(spellsCast)) row.byCard[cardId] = (row.byCard[cardId] ?? 0) + (by[seat] ?? 0);
  for (const [cardId, by] of Object.entries(returned)) row.returned[cardId] = (row.returned[cardId] ?? 0) + (by[seat] ?? 0);
  casts.set(side.name, row);
}

async function pairing(a: Side, b: Side, label: string): Promise<{ aPct: number; bPct: number; turns: number; bDecked: number; aReturned: number }> {
  let aWins = 0, bWins = 0, draws = 0, turns = 0, aDecked = 0, bDecked = 0, total = 0, aReturned = 0;
  for (let i = 0; i < games; i++) {
    if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));
    const seat = i % 2; // both seats, alternating
    const [p0, p1] = seat === 0 ? [a, b] : [b, a];
    const seed = seed0 + i * 31 + label.length * 7;
    const spec: MatchSpec = {
      seed,
      players: [{ name: p0.name, decklist: [...p0.decklist], agent: "heuristic" }, { name: p1.name, decklist: [...p1.decklist], agent: "heuristic" }],
      rules: { startingLife: p0.life, handSize: 7, mulligan: "london", maxTurns: 100 },
      modifiers: [
        { type: "startingLife", player: 1, value: p1.life },
        // S32: a mid-road reference's manalink basic(s) in play at duel start (the heart-sim pattern).
        ...(p0.entrance ?? []).map((cardId) => ({ type: "permanentOnBattlefield" as const, player: 0 as const, cardId })),
        ...(p1.entrance ?? []).map((cardId) => ({ type: "permanentOnBattlefield" as const, player: 1 as const, cardId })),
      ],
    };
    const agents: [Agent, Agent] = [
      new HeuristicAgent(seed * 2 + 1, pool, difficultyProfile(p0.profile, p0.archetype, [...p1.decklist])),
      new HeuristicAgent(seed * 2 + 2, pool, difficultyProfile(p1.profile, p1.archetype, [...p0.decklist])),
    ];
    try {
      const r = await runMatch(spec, pool, agents);
      total += 1; turns += r.turns;
      const aSeat = seat === 0 ? 0 : 1;
      noteCasts(a, aSeat as 0 | 1, r.facts.spellsCast, r.facts.returned);
      noteCasts(b, (1 - aSeat) as 0 | 1, r.facts.spellsCast, r.facts.returned);
      for (const by of Object.values(r.facts.returned)) aReturned += by[aSeat as 0 | 1] ?? 0;
      if (r.winner === null) draws += 1;
      else if (r.winner === aSeat) { aWins += 1; if (r.reason === "DECKED") aDecked += 1; }
      else { bWins += 1; if (r.reason === "DECKED") bDecked += 1; }
    } catch (e) {
      console.log(`    ERROR ${label} seed ${seed}: ${(e as Error).message}`);
    }
  }
  const pct = (n: number) => `${((100 * n) / Math.max(1, total)).toFixed(0)}%`;
  const byLib = (w: number, d: number) => (w > 0 && d > 0 ? ` (${((100 * d) / w).toFixed(0)}% by library)` : "");
  const key = `${label}|${a.name}|${b.name}`;
  const base = baseline[key];
  const aPct = Math.round((100 * aWins) / Math.max(1, total));
  const delta = base === undefined ? "—" : `${aPct - base >= 0 ? "+" : ""}${aPct - base}`;
  console.log(`| ${label} | ${a.name} | ${b.name} | ${pct(aWins)}${byLib(aWins, aDecked)} | ${pct(bWins)}${byLib(bWins, bDecked)} | ${draws} | ${(turns / Math.max(1, total)).toFixed(1)} | ${delta} |`);
  return { aPct: (100 * aWins) / Math.max(1, total), bPct: (100 * bWins) / Math.max(1, total), turns: turns / Math.max(1, total), bDecked: bWins > 0 ? (100 * bDecked) / bWins : 0, aReturned: aReturned / Math.max(1, total) };
}

const header = () => console.log(`\n| part | A | B | A wins | B wins | draws | mean turns | Δ A wins vs ${baselineName} |\n|---|---|---|---|---|---|---|---|`);
const byTier: Record<1 | 2 | 3, string[]> = { 1: [], 2: [], 3: [] };
for (const [k, m] of Object.entries(MAGE_DECKS)) byTier[m.tier].push(k);

console.log(`mage-sweep: ${games} games per pairing (both seats), heuristic at the tier's profile; MODE ${mode} — mage tier life ${TIER_LIFE[1]}/${TIER_LIFE[2]}/${TIER_LIFE[3]}, entrance ${knobs.mageTierEntrance[1]}/${knobs.mageTierEntrance[2]}/${knobs.mageTierEntrance[3]} basics, beast tier delta +${knobs.beastTierLifeDelta[1]}/+${knobs.beastTierLifeDelta[2]}/+${knobs.beastTierLifeDelta[3]}; starters at ${knobs.startingWorldLife} (journeyman).`);
if (part === "all" || part === "1") {
  console.log(`\n## 1. Tier by tier`);
  header();
  for (const t of [1, 2, 3] as const) {
    const ks = byTier[t];
    for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) await pairing(mage(ks[i]!), mage(ks[j]!), `T${t}`);
  }
}
if (part === "all" || part === "2") {
  console.log(`\n## 2. Teachers vs starters (tier-1 mages at 8 / apprentice; starters at ${knobs.startingWorldLife} / journeyman)`);
  header();
  for (const k of byTier[1]) for (const s of catalog.starters) await pairing(mage(k), starter(s.id), `T1×starter`);
}
if (part === "all" || part === "4") {
  console.log(`\n## 4. The starters against each other (journeyman at ${knobs.startingWorldLife}; a read on the five roads)`);
  header();
  const ss = catalog.starters.map((x) => x.id);
  for (let i = 0; i < ss.length; i++) for (let j = i + 1; j < ss.length; j++) await pairing(starter(ss[i]!), starter(ss[j]!), `starters`);
}
if (part === "all" || part === "5") {
  console.log(`\n## 5. Tier-2 and tier-3 mages vs the five starters (the mage at its tier's profile and life; starters at ${knobs.startingWorldLife} / journeyman)`);
  header();
  for (const t of [2, 3] as const) for (const k of byTier[t]) for (const s of catalog.starters) await pairing(mage(k), starter(s.id), `T${t}×starter`);
}
if (part === "all" || part === "6") {
  console.log(`\n## 6. The beasts vs the five starters (each beast at its catalog life/profile; starters at ${knobs.startingWorldLife} / journeyman) — is the part-5 gap the lists, or the tiers?`);
  header();
  const beastKeys = catalog.opponents.filter((o) => o.kind === "beast" && o.deck.startsWith("beast:")).map((o) => o.deck.slice(6));
  for (const k of [...new Set(beastKeys)]) for (const s of catalog.starters) await pairing(beast(k), starter(s.id), `beast×starter`);
}
if (part === "all" || part === "7") {
  console.log(`\n## 7. Tier-2 and tier-3 mages vs the mid-road references (ADR-111: a starter + eight shop cards, one manalink basic in play, 12 life, journeyman)`);
  header();
  for (const t of [2, 3] as const) for (const k of byTier[t]) for (const rk of ["roadMidW", "roadMidB"]) await pairing(mage(k), road(rk), `T${t}×road`);
}
if (part === "all" || part === "8") {
  // S33 Part 2: the matrix. The mage is A, the reference is B; the read is the REFERENCE's win rate.
  const refs = ["roadMidW", "roadMidB"];
  // S34 Part 3: tier 2 gains the two-basic cells (12/2, 14/2 were the S33 read's missing cells).
  const grid: Record<1 | 2 | 3, { lives: number[]; basics: number[] }> = { 1: { lives: [], basics: [] }, 2: { lives: [10, 12, 14], basics: [0, 1, 2] }, 3: { lives: [12, 16, 20], basics: [0, 1, 2] } };
  for (const t of [3, 2] as const) {
    console.log(`\n## 8${t === 3 ? "a" : "b"}. The matrix — tier ${t} mages at life {${grid[t].lives.join(", ")}} × entrance {${grid[t].basics.join(", ")} basics} vs the mid-road references (the mage at ${TIER_PROFILE[t]}; the references at 12 / journeyman with a basic in play)`);
    header();
    const agg: Record<string, { ref: number[]; turns: number[]; decked: number[] }> = {};
    const perMage: Record<string, Record<string, number[]>> = {};
    for (const k of byTier[t]) {
      for (const life of grid[t].lives) for (const basics of grid[t].basics) for (const rk of refs) {
        const r = await pairing(mageAt(k, life, basics), road(rk), `T${t}×road`);
        if (r.aReturned > 0) console.log(`|   ↳ ${MAGE_DECKS[k]!.name} returned ${r.aReturned.toFixed(2)} creatures/game from the graveyard in this cell |`);
        const cell = `${life}/${basics}`;
        (agg[cell] ??= { ref: [], turns: [], decked: [] });
        agg[cell]!.ref.push(r.bPct); agg[cell]!.turns.push(r.turns); agg[cell]!.decked.push(r.bDecked);
        ((perMage[k] ??= {})[cell] ??= []).push(r.bPct);
      }
    }
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
    console.log(`\n### Aggregate — the references' win rate by life × entrance (tier ${t}; mean over ${byTier[t].length} mages × 2 references)\n`);
    console.log(`| life \\ basics | ${grid[t].basics.map((b) => `${b}`).join(" | ")} |\n|---|${grid[t].basics.map(() => "---").join("|")}|`);
    for (const life of grid[t].lives) console.log(`| ${life} | ${grid[t].basics.map((b) => { const c = agg[`${life}/${b}`]!; return `${mean(c.ref).toFixed(0)}% (turns ${mean(c.turns).toFixed(1)}; by library ${mean(c.decked).toFixed(0)}%)`; }).join(" | ")} |`);
    console.log(`\n### Per mage — the references' win rate by cell (tier ${t}; mean over both references)\n`);
    const cells = grid[t].lives.flatMap((l) => grid[t].basics.map((b) => `${l}/${b}`));
    console.log(`| mage | ${cells.join(" | ")} |\n|---|${cells.map(() => "---").join("|")}|`);
    for (const k of byTier[t]) console.log(`| ${MAGE_DECKS[k]!.name} | ${cells.map((c) => `${mean(perMage[k]![c] ?? []).toFixed(0)}%`).join(" | ")} |`);
  }
}
if (part === "all" || part === "9") {
  console.log(`\n## 9. The tier-2/3 beasts vs the mid-road references at catalog life, +4 and +8 (no roots; the beast at its catalog profile)`);
  header();
  const rows = catalog.opponents.filter((o) => o.kind === "beast" && (o.tier === 2 || o.tier === 3) && o.deck.startsWith("beast:"));
  const keys = [...new Set(rows.map((o) => o.deck.slice(6)))];
  const agg: Record<string, number[]> = {};
  for (const k of keys) for (const delta of [0, 4, 8]) for (const rk of ["roadMidW", "roadMidB"]) {
    const r = await pairing(beastAt(k, delta), road(rk), `beast×road`);
    (agg[`+${delta}`] ??= []).push(r.bPct);
  }
  console.log(`\n### Aggregate — the references' win rate by life delta (mean over ${keys.length} beasts × 2 references): ${Object.entries(agg).map(([d, xs]) => `${d}: ${(xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)).toFixed(0)}%`).join(" · ")}`);
}
if (part === "all" || part === "3") {
  console.log(`\n## 3. Children vs parents (parent mage at tier-1 settings; parent beast at its own)`);
  header();
  const parents: Record<string, [string, string]> = {
    vael: ["mage:oriel", "mage:edric"], kessa: ["mage:brann", "beast:manowar"], maelin: ["mage:edric", "beast:warband"], brennor: ["mage:hask", "mage:oriel"], pell: ["mage:tessaly", "mage:hask"],
    corvane: ["mage:edric", "beast:serra"], varro: ["mage:tessaly", "mage:brann"], sorrel: ["mage:brann", "beast:specter"], ysolde: ["mage:hask", "beast:lion"], quill: ["mage:tessaly", "beast:wurm"],
  };
  for (const [child, [p1, p2]] of Object.entries(parents)) {
    for (const p of [p1, p2]) {
      const parent = p.startsWith("mage:") ? mage(p.slice(5), 1) : beast(p.slice(6));
      await pairing(mage(child), parent, `T${MAGE_DECKS[child]!.tier}×parent`);
    }
  }
}

// ---- S30 Part 5: per-deck cast counts (the mages only) ----
const mageNames = new Set(Object.entries(MAGE_DECKS).map(([k, m]) => `${m.name} (${k})`));
const mageRows = [...casts.entries()].filter(([name]) => mageNames.has(name));
if (mageRows.length > 0) {
  console.log(`\n## Cast counts per mage (every game the deck played in this run; casts per game in brackets; NEVER CAST listed)\n`);
  for (const [name, row] of mageRows) {
    const nonland = row.decklist.filter((e) => !(pool.get(e.cardId)?.types ?? []).includes("Land"));
    const cells = nonland.map((e) => { const n = row.byCard[e.cardId] ?? 0; return `${pool.get(e.cardId)?.name ?? e.cardId} ×${e.count}: ${n} (${(n / Math.max(1, row.games)).toFixed(2)})`; });
    const never = nonland.filter((e) => !(row.byCard[e.cardId] ?? 0)).map((e) => pool.get(e.cardId)?.name ?? e.cardId);
    const returns = Object.entries(row.returned).sort((x, y) => y[1] - x[1]).map(([id, n]) => `${pool.get(id)?.name ?? id} ${n} (${(n / Math.max(1, row.games)).toFixed(2)})`);
    console.log(`- **${name}** — ${row.games} games — ${cells.join(" · ")}${never.length ? ` — **never cast: ${never.join(", ")}**` : ""}${returns.length ? ` — **returned from the graveyard**: ${returns.join(" · ")}` : ""}`);
  }
}
