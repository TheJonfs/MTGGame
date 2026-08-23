/**
 * pnpm world-sim [--seeds N] [--starter white|blue|black|red|green] [--difficulty easy|standard|hard]
 *               [--player journeyman|master|apprentice] [--policy fight-all|avoid] [--legs N]
 *
 * S14 (background, for the knob-tuning round), rewritten S16 for roaming
 * visibility (ADR-071): tour many seeded worlds with an AI-piloted starter —
 * walk town→town→lair — and report what the knobs actually produce: steps
 * per fight by region tier, who initiated contact (roamer reached you / you
 * stepped onto one), fleeing roamers seen, duel W/L by enemy tier, ante
 * swing, gold, and how often world life reaches the floor.
 *
 * Policies: `fight-all` (walk the shortest path; every contact is a fight —
 * comparable to the S14/S15 baselines) and `avoid` (re-path each step around
 * visible non-fleeing roamers; contact still = fight). CLI-only: the world
 * package's runtime never imports agents.
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { runMatch, type Agent } from "@shandalar/engine";
import { HeuristicAgent, difficultyProfile, type Difficulty } from "@shandalar/agents";
import { loadCatalog } from "./loader.js";
import { newWorld, starterTemplate, worldKnobs } from "./state.js";
import type { DifficultyName } from "./knobs.js";
import type { StarterId } from "./catalog.js";
import { advance, applyDuelResult, parley, visibleRoamers } from "./journey.js";
import { findPath, idx, manhattan, type Point } from "./map.js";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1]! : fallback;
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const catalog = loadCatalog(join(ROOT, "data/world"));
const seeds = Number(arg("seeds", "30"));
const starterId = arg("starter", "green") as StarterId;
const difficulty = arg("difficulty", "standard") as DifficultyName;
const playerTier = arg("player", "journeyman") as Difficulty;
const policy = arg("policy", "fight-all") as "fight-all" | "avoid";
const maxLegs = Number(arg("legs", "60"));
// Measurement-only overrides (never written to the catalog): --tier1-life N sets every tier-1 enemy's world life.
const tier1Life = Number(arg("tier1-life", "0"));
if (tier1Life > 0) for (const o of catalog.opponents) if (o.tier === 1) o.worldLife = tier1Life;
// --tier1-deck starter: tier-1 enemies play the catalog starter of their slice deck's colour (A→red, B→white, C→green, D→black, E→blue) — the enemy-deck-quality measurement.
const tier1Deck = arg("tier1-deck", "");
const SLICE_TO_STARTER: Record<string, string> = { A: "starter:red", B: "starter:white", C: "starter:green", D: "starter:black", E: "starter:blue" };
if (tier1Deck === "starter") for (const o of catalog.opponents) if (o.tier === 1 && o.deck in SLICE_TO_STARTER) o.deck = SLICE_TO_STARTER[o.deck] as typeof o.deck;
const starter = starterTemplate(catalog, starterId);

const stepsByTier: Record<string, number> = { civilized: 0, approach: 0, wild: 0 };
const encountersByTier: Record<string, number> = { civilized: 0, approach: 0, wild: 0 };
const duels: Record<string, { w: number; l: number; d: number }> = { 1: { w: 0, l: 0, d: 0 }, 2: { w: 0, l: 0, d: 0 }, 3: { w: 0, l: 0, d: 0 } };
let anteWon = 0, anteLost = 0, goldEnd = 0, deaths = 0, toursCompleted = 0, totalSteps = 0, lairFights = 0;
let contactsByRoamer = 0, contactsByPlayer = 0, fleeingSeen = 0, fleeingCaught = 0, sightings = 0, spawned = 0;
const lifeAtEnd: number[] = [];
const renownAtEnd: number[] = [];

for (let seed = 1; seed <= seeds; seed++) {
  const w = newWorld({ seed, catalog, starter: starterId, difficulty });
  const knobs = worldKnobs(w);
  const targets = [...w.map.towns.filter((t) => !(t.at.x === w.map.start.x && t.at.y === w.map.start.y)).map((t) => t.at), ...w.map.strongholds.map((f) => f.at)];
  let dead = false;
  const seenIds = new Set<string>();
  for (const dest of targets) {
    if (dead) break;
    for (let leg = 0; leg < maxLegs && !dead; leg++) {
      // Plan: shortest path, or (avoid) a path that keeps ≥2 cells from visible non-fleeing roamers.
      let path: Point[] | null;
      if (policy === "avoid") {
        const threats = visibleRoamers(w, catalog, knobs).filter((r) => !r.fleeing).map((r) => r.inst.at!);
        path = findPath(w.map, w.player.position, dest, (p) => w.map.passable[idx(w.map, p)]! && !threats.some((t) => manhattan(t, p) <= 2));
        if (!path) path = findPath(w.map, w.player.position, dest);
        if (path) path = path.slice(0, 3); // re-plan every few steps as roamers move
      } else {
        path = findPath(w.map, w.player.position, dest);
      }
      if (!path) break;
      if (path.length === 0) break; // arrived
      const ev = advance(w, catalog, path);
      for (const e of ev) {
        if (e.type === "moved") stepsByTier[w.map.regions[w.map.region[e.to.y * w.map.width + e.to.x]!]!.tier]! += 1;
        if (e.type === "spawned") spawned += 1;
      }
      for (const r of visibleRoamers(w, catalog, knobs)) {
        if (!seenIds.has(r.inst.id)) {
          seenIds.add(r.inst.id);
          sightings += 1;
          if (r.fleeing) fleeingSeen += 1;
        }
      }
      const enc = ev.find((e) => e.type === "encounter");
      if (!enc || enc.type !== "encounter") {
        if (ev.some((e) => e.type === "arrived")) break;
        continue; // avoid-policy partial leg: keep walking
      }
      const region = w.map.regions[enc.encounter.region]!;
      encountersByTier[region.tier]! += 1;
      if (enc.encounter.contact === "lair") lairFights += 1;
      else if (enc.encounter.contact === "reached") contactsByRoamer += 1;
      else contactsByPlayer += 1;
      if (enc.encounter.fleeing) fleeingCaught += 1;
      const out = parley(w, catalog, enc.encounter, "fight");
      if (out.type !== "fight") break;
      const d = out.duel;
      const human: Agent = new HeuristicAgent(seed * 7 + 1, pool, difficultyProfile(playerTier, starter.archetype, d.spec.players[1].decklist));
      const enemy: Agent = new HeuristicAgent(seed * 7 + 2, pool, difficultyProfile(d.enemy.difficulty, d.enemy.archetype, d.spec.players[0].decklist));
      const result = await runMatch(d.spec, pool, [human, enemy]);
      const rec = applyDuelResult(w, catalog, d, result);
      const t = String(d.enemy.tier);
      if (rec.outcome === "win") duels[t]!.w += 1;
      else if (rec.outcome === "loss") duels[t]!.l += 1;
      else duels[t]!.d += 1;
      anteWon += rec.anteWon.length;
      anteLost += rec.anteLost.length;
      if (w.gameOver) { dead = true; deaths += 1; }
    }
  }
  if (!dead) toursCompleted += 1;
  lifeAtEnd.push(w.player.worldLife);
  renownAtEnd.push(w.player.renown);
  goldEnd += w.player.gold;
  totalSteps += w.player.stepsTaken;
  process.stderr.write(`seed ${seed}: steps ${w.player.stepsTaken}, life ${w.player.worldLife}, gold ${w.player.gold}, duels ${w.duels.length}, renown ${w.player.renown}${dead ? " — DEAD" : ""}\n`);
}

const pct = (a: number, b: number) => (b === 0 ? "—" : `${((100 * a) / b).toFixed(0)}%`);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
console.log(`world-sim: ${seeds} seeds, starter ${starterId} "${starter.name}" (${playerTier} pilot, ${policy}), difficulty ${difficulty}${tier1Life ? `, tier-1 life ${tier1Life}` : ""}${tier1Deck ? `, tier-1 decks ${tier1Deck}` : ""}, tour = all towns + the lair, fight every contact`);
console.log(`  steps/tour: ${(totalSteps / seeds).toFixed(0)} · tours completed alive: ${toursCompleted}/${seeds} · deaths (world life 0): ${deaths}`);
for (const tier of ["civilized", "approach", "wild"]) {
  const st = stepsByTier[tier]!, en = encountersByTier[tier]!;
  console.log(`  ${tier}: ${st} steps, ${en} fights → ${st ? ((100 * en) / st).toFixed(1) : "—"} per 100 steps (${en ? (st / en).toFixed(0) : "—"} steps per fight)`);
}
for (const t of ["1", "2", "3"]) {
  const r = duels[t]!;
  console.log(`  tier ${t}: ${r.w}W ${r.l}L ${r.d}D (win ${pct(r.w, r.w + r.l + r.d)})`);
}
console.log(`  contacts: roamer reached you ${contactsByRoamer} · you stepped onto one ${contactsByPlayer} · lair fights ${lairFights} · distinct roamers sighted ${sightings} (fleeing ${fleeingSeen}; caught fleeing ${fleeingCaught}) · respawns ${spawned}`);
console.log(`  ante won ${anteWon} / lost ${anteLost} · mean gold at end ${(goldEnd / seeds).toFixed(0)} · mean world life at end ${mean(lifeAtEnd).toFixed(1)} · mean renown at end ${mean(renownAtEnd).toFixed(1)}`);
