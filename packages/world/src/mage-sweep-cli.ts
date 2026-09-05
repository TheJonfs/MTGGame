/**
 * pnpm mage-sweep [--games N] [--seed S] [--part 1|2|3|all]
 *
 * S29 Part 5: the mage cleansheet's three round-robins under the heuristic ladder (both seats; the
 * tier's profile; the tier's life for both sides unless noted).
 *   1. tier by tier — the five mages of each tier against each other (10 pairings × 3 tiers);
 *   2. teachers vs starters — each tier-1 mage (apprentice, 8) against the five starters at the
 *      starters' life (the player's starting world life), journeyman piloting the starter;
 *   3. children vs parents — each tier-2/3 mage against its two parent lines (the parent mage at
 *      tier-1 settings; the parent beast at its own catalog settings).
 * Per pairing: win rate, mean turns, and the share of wins by library (DECKED) — the mill decks' axis.
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { runMatch, type Agent, type MatchSpec } from "@shandalar/engine";
import { HeuristicAgent, difficultyProfile, type Difficulty } from "@shandalar/agents";
import { MAGE_DECKS } from "@shandalar/sim/mage-decks";
import { EXPANSION_DECKS } from "@shandalar/sim/expansion-decks";
import { loadCatalog } from "./loader.js";
import { defaultKnobs } from "./knobs.js";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1]! : fallback;
}
const games = Number(arg("games", "100"));
const seed0 = Number(arg("seed", "1"));
const part = arg("part", "all");
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const catalog = loadCatalog(join(ROOT, "data/world"));
const knobs = defaultKnobs();

type Side = { name: string; decklist: { cardId: string; count: number }[]; archetype: "aggro" | "midrange" | "control"; profile: Difficulty; life: number };
const TIER_LIFE: Record<1 | 2 | 3, number> = { 1: 8, 2: 10, 3: 12 };
const TIER_PROFILE: Record<1 | 2 | 3, Difficulty> = { 1: "apprentice", 2: "journeyman", 3: "master" };
const mage = (key: string, tierAs?: 1 | 2 | 3): Side => {
  const m = MAGE_DECKS[key]!;
  const t = tierAs ?? m.tier;
  return { name: `${m.name} (${key})`, decklist: m.decklist, archetype: m.archetype, profile: TIER_PROFILE[t], life: TIER_LIFE[t] };
};
const beast = (key: string): Side => {
  const b = EXPANSION_DECKS[key]!;
  const row = catalog.opponents.find((o) => o.deck === `beast:${key}`);
  return { name: `${b.name} (beast:${key})`, decklist: b.decklist, archetype: b.archetype, profile: row?.difficulty ?? TIER_PROFILE[b.tier], life: row?.worldLife ?? TIER_LIFE[b.tier] };
};
const starter = (id: string): Side => {
  const s = catalog.starters.find((x) => x.id === id)!;
  return { name: `starter:${id}`, decklist: s.decklist, archetype: s.archetype, profile: "journeyman", life: knobs.startingWorldLife };
};

async function pairing(a: Side, b: Side, label: string): Promise<void> {
  let aWins = 0, bWins = 0, draws = 0, turns = 0, aDecked = 0, bDecked = 0, total = 0;
  for (let i = 0; i < games; i++) {
    if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));
    const seat = i % 2; // both seats, alternating
    const [p0, p1] = seat === 0 ? [a, b] : [b, a];
    const seed = seed0 + i * 31 + label.length * 7;
    const spec: MatchSpec = {
      seed,
      players: [{ name: p0.name, decklist: [...p0.decklist], agent: "heuristic" }, { name: p1.name, decklist: [...p1.decklist], agent: "heuristic" }],
      rules: { startingLife: p0.life, handSize: 7, mulligan: "london", maxTurns: 100 },
      modifiers: [{ type: "startingLife", player: 1, value: p1.life }],
    };
    const agents: [Agent, Agent] = [
      new HeuristicAgent(seed * 2 + 1, pool, difficultyProfile(p0.profile, p0.archetype, [...p1.decklist])),
      new HeuristicAgent(seed * 2 + 2, pool, difficultyProfile(p1.profile, p1.archetype, [...p0.decklist])),
    ];
    try {
      const r = await runMatch(spec, pool, agents);
      total += 1; turns += r.turns;
      const aSeat = seat === 0 ? 0 : 1;
      if (r.winner === null) draws += 1;
      else if (r.winner === aSeat) { aWins += 1; if (r.reason === "DECKED") aDecked += 1; }
      else { bWins += 1; if (r.reason === "DECKED") bDecked += 1; }
    } catch (e) {
      console.log(`    ERROR ${label} seed ${seed}: ${(e as Error).message}`);
    }
  }
  const pct = (n: number) => `${((100 * n) / Math.max(1, total)).toFixed(0)}%`;
  const byLib = (w: number, d: number) => (w > 0 && d > 0 ? ` (${((100 * d) / w).toFixed(0)}% by library)` : "");
  console.log(`| ${label} | ${a.name} | ${b.name} | ${pct(aWins)}${byLib(aWins, aDecked)} | ${pct(bWins)}${byLib(bWins, bDecked)} | ${draws} | ${(turns / Math.max(1, total)).toFixed(1)} |`);
}

const header = () => console.log(`\n| part | A | B | A wins | B wins | draws | mean turns |\n|---|---|---|---|---|---|---|`);
const byTier: Record<1 | 2 | 3, string[]> = { 1: [], 2: [], 3: [] };
for (const [k, m] of Object.entries(MAGE_DECKS)) byTier[m.tier].push(k);

console.log(`mage-sweep: ${games} games per pairing (both seats), heuristic at the tier's profile; tier life 8/10/12; starters at ${knobs.startingWorldLife} (journeyman); beasts at their catalog life/profile.`);
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
