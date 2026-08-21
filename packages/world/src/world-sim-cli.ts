/**
 * pnpm world-sim [--seeds N] [--deck A..E] [--difficulty easy|standard|hard] [--player journeyman|master|apprentice]
 *
 * S14 (background, for the knob-tuning round): tour many seeded worlds with a
 * journeyman-piloted starter deck — walk town→town→lair, fight every
 * encounter (no flee/buy-off), apply consequences — and report what the
 * knobs actually produce: encounters per 100 steps by region tier, duel
 * W/L by enemy tier, ante swing, gold, and how often world life reaches the
 * floor. CLI-only: the world package's runtime never imports agents.
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { runMatch, type Agent } from "@shandalar/engine";
import { HeuristicAgent, difficultyProfile, type Difficulty } from "@shandalar/agents";
import { DECK_ARCHETYPES, type DeckKey } from "@shandalar/sim/decks";
import { loadCatalog } from "./loader.js";
import { newWorld } from "./state.js";
import type { DifficultyName } from "./knobs.js";
import { applyDuelResult, parley, walkTo } from "./journey.js";
import type { WorldRng } from "./rng.js";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1]! : fallback;
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const catalog = loadCatalog(join(ROOT, "data/world"));
const seeds = Number(arg("seeds", "30"));
const deck = arg("deck", "A") as DeckKey;
const difficulty = arg("difficulty", "standard") as DifficultyName;
const playerTier = arg("player", "journeyman") as Difficulty;
// Measurement-only overrides (never written to the catalog): --tier1-life N sets every tier-1 enemy's world life.
const tier1Life = Number(arg("tier1-life", "0"));
if (tier1Life > 0) for (const o of catalog.opponents) if (o.tier === 1) o.worldLife = tier1Life;

const stepsByTier: Record<string, number> = { civilized: 0, approach: 0, wild: 0 };
const encountersByTier: Record<string, number> = { civilized: 0, approach: 0, wild: 0 };
const duels: Record<string, { w: number; l: number; d: number }> = { 1: { w: 0, l: 0, d: 0 }, 2: { w: 0, l: 0, d: 0 }, 3: { w: 0, l: 0, d: 0 } };
let anteWon = 0, anteLost = 0, goldEnd = 0, deaths = 0, toursCompleted = 0, totalSteps = 0, lairFights = 0;
const lifeAtEnd: number[] = [];

for (let seed = 1; seed <= seeds; seed++) {
  const w = newWorld({ seed, catalog, starterDeck: deck, difficulty });
  const targets = [...w.map.towns.slice(1).map((t) => t.at), ...w.map.strongholds.map((f) => f.at)];
  let dead = false;
  for (const dest of targets) {
    if (dead) break;
    for (let leg = 0; leg < 40 && !dead; leg++) {
      const before = w.player.stepsTaken;
      const ev = walkTo(w, catalog, dest);
      if (!ev) break;
      // attribute steps to the region walked through (approximation: region at arrival per step)
      for (const e of ev) if (e.type === "moved") stepsByTier[w.map.regions[w.map.region[e.to.y * w.map.width + e.to.x]!]!.tier]! += 1;
      const enc = ev.find((e) => e.type === "encounter");
      if (!enc || enc.type !== "encounter") break; // arrived
      const region = w.map.regions[enc.encounter.region]!;
      encountersByTier[region.tier]! += 1;
      if (w.map.strongholds.some((f) => f.at.x === enc.encounter.at.x && f.at.y === enc.encounter.at.y)) lairFights += 1;
      const out = parley(w, catalog, enc.encounter, "fight");
      if (out.type !== "fight") break;
      const d = out.duel;
      const human: Agent = new HeuristicAgent(seed * 7 + 1, pool, difficultyProfile(playerTier, DECK_ARCHETYPES[deck], d.spec.players[1].decklist));
      const enemy: Agent = new HeuristicAgent(seed * 7 + 2, pool, difficultyProfile(d.enemy.difficulty, DECK_ARCHETYPES[d.enemy.deck], d.spec.players[0].decklist));
      const result = await runMatch(d.spec, pool, [human, enemy]);
      const rec = applyDuelResult(w, catalog, d, result);
      const t = String(d.enemy.tier);
      if (rec.outcome === "win") duels[t]!.w += 1;
      else if (rec.outcome === "loss") duels[t]!.l += 1;
      else duels[t]!.d += 1;
      anteWon += rec.anteWon.length;
      anteLost += rec.anteLost.length;
      if (w.gameOver) { dead = true; deaths += 1; }
      void (before as number);
    }
  }
  if (!dead) toursCompleted += 1;
  lifeAtEnd.push(w.player.worldLife);
  goldEnd += w.player.gold;
  totalSteps += w.player.stepsTaken;
  process.stderr.write(`seed ${seed}: steps ${w.player.stepsTaken}, life ${w.player.worldLife}, gold ${w.player.gold}, duels ${w.duels.length}${dead ? " — DEAD" : ""}\n`);
}

const pct = (a: number, b: number) => (b === 0 ? "—" : `${((100 * a) / b).toFixed(0)}%`);
console.log(`world-sim: ${seeds} seeds, deck ${deck} (${playerTier} pilot), difficulty ${difficulty}${tier1Life ? `, tier-1 life ${tier1Life}` : ""}, tour = all towns + the lair, fight everything`);
console.log(`  steps/tour: ${(totalSteps / seeds).toFixed(0)} · tours completed alive: ${toursCompleted}/${seeds} · deaths (world life 0): ${deaths}`);
for (const tier of ["civilized", "approach", "wild"]) {
  console.log(`  ${tier}: ${stepsByTier[tier]} steps, ${encountersByTier[tier]} encounters → ${stepsByTier[tier] ? ((100 * encountersByTier[tier]!) / stepsByTier[tier]!).toFixed(1) : "—"} per 100 steps`);
}
for (const t of ["1", "2", "3"]) {
  const r = duels[t]!;
  console.log(`  tier ${t}: ${r.w}W ${r.l}L ${r.d}D (win ${pct(r.w, r.w + r.l + r.d)})`);
}
console.log(`  lair fights: ${lairFights} · ante won ${anteWon} / lost ${anteLost} · mean gold at end ${(goldEnd / seeds).toFixed(0)} · mean world life at end ${(lifeAtEnd.reduce((a, b) => a + b, 0) / seeds).toFixed(1)}`);
