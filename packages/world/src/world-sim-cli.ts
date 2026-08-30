/**
 * pnpm world-sim [--seeds N] [--starter white|blue|black|red|green] [--difficulty easy|standard|hard] [--no-beasts]
 *               [--player journeyman|master|apprentice] [--policy fight-all|avoid] [--tour towns|all] [--legs N]
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
import { maxWorldLife, newWorld, starterTemplate, worldKnobs } from "./state.js";
import type { DifficultyName } from "./knobs.js";
import type { StarterId } from "./catalog.js";
import { advance, applyDuelResult, innRest, parley, visibleRoamers } from "./journey.js";
import { activateStride, applyBalm, barrageFight, fuelCandidates, fuelDepth, powerRates, quietusRefusal, quietusStrike, suggestFuel, unlockPower, POWER_COLORS } from "./powers.js";
import { findPath, idx, manhattan, type Point } from "./map.js";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1]! : fallback;
}

/** Yield the list once; with `repeat`, keep cycling it until `stop()` (S21 --min-steps). */
function* repeatUntil<T>(items: T[], stop: () => boolean, repeat = false): Generator<T> {
  do {
    for (const it of items) {
      if (stop()) return;
      yield it;
    }
  } while (repeat && !stop() && items.length > 0);
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const catalog = loadCatalog(join(ROOT, "data/world"));
const seeds = Number(arg("seeds", "30"));
const starterId = arg("starter", "green") as StarterId;
const difficulty = arg("difficulty", "standard") as DifficultyName;
const playerTier = arg("player", "journeyman") as Difficulty;
const minSteps = Number(arg("min-steps", "0")); // S21: repeat the tour circuit to this horizon (siege pressure)
const policy = arg("policy", "fight-all") as "fight-all" | "avoid";
const maxLegs = Number(arg("legs", "60"));
// --tour towns (default): every town; --tour all: towns + every lair (ADR-072: one per wild region — five wild rings, lethal by design).
const tour = arg("tour", "towns") as "towns" | "all";
// Measurement-only overrides (never written to the catalog): --tier1-life N sets every tier-1 enemy's world life.
const tier1Life = Number(arg("tier1-life", "0"));
if (tier1Life > 0) for (const o of catalog.opponents) if (o.tier === 1) o.worldLife = tier1Life;
// --tier1-deck starter: tier-1 enemies play the catalog starter of their slice deck's colour (A→red, B→white, C→green, D→black, E→blue) — the enemy-deck-quality measurement.
const tier1Deck = arg("tier1-deck", "");
const SLICE_TO_STARTER: Record<string, string> = { A: "starter:red", B: "starter:white", C: "starter:green", D: "starter:black", E: "starter:blue" };
if (tier1Deck === "starter") for (const o of catalog.opponents) if (o.tier === 1 && o.deck in SLICE_TO_STARTER) o.deck = SLICE_TO_STARTER[o.deck] as typeof o.deck;
const starter = starterTemplate(catalog, starterId);
// S18: --no-beasts sets beastShare 0 everywhere (the mage-only roster — the S16-comparable baseline for starter gates).
const noBeasts = process.argv.includes("--no-beasts");
// S25 (ADR-088): --powers grants all five at world start and turns on the pilot's power rules
// (v1, documented in the report): Stride whenever idle and G depth ≥ cost+4; Quietus on tier-3
// contacts when affordable; else Barrage half-their-life on tier 3 when affordable; Balm to
// half-max when life ≤ ⌈max/3⌉. The Crossing stays unused (the tour never liberates — its
// column exists for the fighting policy that will). Usage + spare-pool depth by colour report.
const powersOn = process.argv.includes("--powers");
const extraKnobs = noBeasts ? { event: { beastShare: { civilized: 0, approach: 0, wild: 0 } } } : {};
// S18: per-opponent (per deck) W/L — the brief's per-deck tier performance table.
const byOpponent: Record<string, { w: number; l: number; d: number }> = {};

const stepsByTier: Record<string, number> = { civilized: 0, approach: 0, wild: 0 };
const encountersByTier: Record<string, number> = { civilized: 0, approach: 0, wild: 0 };
const duels: Record<string, { w: number; l: number; d: number }> = { 1: { w: 0, l: 0, d: 0 }, 2: { w: 0, l: 0, d: 0 }, 3: { w: 0, l: 0, d: 0 } };
let anteWon = 0, anteLost = 0, goldEnd = 0, deaths = 0, toursCompleted = 0, totalSteps = 0, lairFights = 0;
let contactsByRoamer = 0, contactsByPlayer = 0, fleeingSeen = 0, fleeingCaught = 0, sightings = 0, spawned = 0;
const lifeAtEnd: number[] = [];
const renownAtEnd: number[] = [];
// S21 sieges: pressure instrument — threats/falls by the town's ring, occupation exposure
// (the tour policy never liberates, so "time under occupation" here = exposure a passive
// player eats; liberation timing needs a fighting policy — reported as occupied-at-end).
const siegeThreats: Record<string, number> = { civilized: 0, approach: 0, wild: 0 };
const siegeFalls: Record<string, number> = { civilized: 0, approach: 0, wild: 0 };
let occupiedTownSteps = 0; // Σ over steps of (towns occupied at that step)
const occupiedAtEnd: number[] = [];
const firstFallStep: number[] = [];
// S24 (ADR-086): the life economy — losses vs recoveries per tour (the recovery knobs' tables).
// Rest policy: at every town arrival, rest to FULL when below half maximum (the modest default).
let lifeLostToLosses = 0, innRests = 0, innStepsSpent = 0, innLifeBought = 0;
const maxLifeAtEnd: number[] = [];
let lifeLinksHeld = 0;
// S25 (ADR-088): power usage + fuel economy instruments.
const powerUses: Record<string, number> = { stride: 0, balm: 0, crossing: 0, quietus: 0, barrage: 0 };
const fuelBurned: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
const quietusByTier: Record<string, number> = { 1: 0, 2: 0, 3: 0 };
const barrageSizes: number[] = [];
let balmLifeBought = 0;
const spareDepthSamples: Record<string, number[]> = { W: [], U: [], B: [], R: [], G: [] };
const spareDepthAtEnd: Record<string, number[]> = { W: [], U: [], B: [], R: [], G: [] };

for (let seed = 1; seed <= seeds; seed++) {
  const w = newWorld({ seed, catalog, starter: starterId, difficulty, knobLayers: extraKnobs });
  const knobs = worldKnobs(w, extraKnobs);
  if (powersOn) for (const c of POWER_COLORS) unlockPower(w, c);
  const depthOf = (c: "W" | "U" | "B" | "R" | "G") => fuelDepth(fuelCandidates(w, pool, c));
  const burn = (c: "W" | "U" | "B" | "R" | "G", n: number) => { fuelBurned[c]! += n; };
  const targets = [...w.map.towns.filter((t) => !(t.at.x === w.map.start.x && t.at.y === w.map.start.y)).map((t) => t.at), ...(tour === "all" ? w.map.strongholds.filter((f) => f.kind === "lair").map((f) => f.at) : [])];
  let dead = false;
  const seenIds = new Set<string>();
  // S21: --min-steps N repeats the tour circuit until N steps (siege timers live on horizons
  // longer than one town tour — a single pass measured ~183 steps against a 225-step shortest
  // threat, so the default tour never sees a siege; the pressure table needs the longer walk).
  for (const dest of repeatUntil(targets, () => dead || (minSteps > 0 ? w.player.stepsTaken >= minSteps : false), minSteps > 0)) {
    if (dead) break;
    for (let leg = 0; leg < maxLegs && !dead; leg++) {
      if (powersOn && w.powers.strideStepsLeft === 0) {
        const cost = powerRates(w, "G").stride!.cost;
        if (depthOf("G") >= cost + 4) {
          const fuel = suggestFuel(fuelCandidates(w, pool, "G"), cost);
          if (fuel && activateStride(w, pool, fuel).ok) { powerUses.stride! += 1; burn("G", cost); }
        }
      }
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
      const ev = advance(w, catalog, path, extraKnobs);
      for (const e of ev) {
        if (e.type === "moved") {
          stepsByTier[w.map.regions[w.map.region[e.to.y * w.map.width + e.to.x]!]!.tier]! += 1;
          occupiedTownSteps += (w.sieges as { status?: string }[]).filter((s) => s.status === "occupied").length;
        }
        if (e.type === "spawned") spawned += 1;
        if (e.type === "siegeThreatened") siegeThreats[w.map.regions[w.map.towns[e.townIndex]!.region]!.tier]! += 1;
        if (e.type === "siegeFell") {
          siegeFalls[w.map.regions[w.map.towns[e.townIndex]!.region]!.tier]! += 1;
          firstFallStep.push(w.player.stepsTaken);
        }
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
        if (ev.some((e) => e.type === "arrived")) {
          // S24 rest policy: below half maximum → rest to full (the inn's clocks tick inside).
          const mx = maxWorldLife(w, extraKnobs);
          if (w.player.worldLife < Math.ceil(mx / 2)) {
            const rest = innRest(w, catalog, mx - w.player.worldLife, extraKnobs);
            innRests += 1; innStepsSpent += rest.stepsSpent; innLifeBought += rest.healed;
            for (const e of rest.events) {
              if (e.type === "siegeThreatened") siegeThreats[w.map.regions[w.map.towns[e.townIndex]!.region]!.tier]! += 1;
              if (e.type === "siegeFell") { siegeFalls[w.map.regions[w.map.towns[e.townIndex]!.region]!.tier]! += 1; firstFallStep.push(w.player.stepsTaken); }
            }
          }
          for (const c of POWER_COLORS) spareDepthSamples[c]!.push(depthOf(c));
          break;
        }
        continue; // avoid-policy partial leg: keep walking
      }
      const region = w.map.regions[enc.encounter.region]!;
      encountersByTier[region.tier]! += 1;
      if (enc.encounter.contact === "lair") lairFights += 1;
      else if (enc.encounter.contact === "reached") contactsByRoamer += 1;
      else contactsByPlayer += 1;
      if (enc.encounter.fleeing) fleeingCaught += 1;
      let out: ReturnType<typeof parley>;
      if (powersOn && enc.encounter.tier === 3 && !quietusRefusal(w, catalog, pool, enc.encounter)) {
        // Pilot rule: a signature fight whose prize roll does NOT justify it — skip it outright.
        const cost = powerRates(w, "B").quietus!.costs[enc.encounter.tier];
        const fuel = suggestFuel(fuelCandidates(w, pool, "B"), cost)!;
        const q = quietusStrike(w, catalog, pool, enc.encounter, fuel);
        if (q.ok) {
          powerUses.quietus! += 1; quietusByTier[String(enc.encounter.tier)]! += 1; burn("B", cost);
          anteWon += q.anteWon.length;
          continue;
        }
      }
      if (powersOn && enc.encounter.tier === 3) {
        const r = powerRates(w, "R").barrage!;
        const tmplLife = catalog.opponents.find((o) => o.id === enc.encounter.catalogId)?.worldLife ?? 10;
        const want = Math.min(r.cap, Math.ceil(tmplLife / 2), Math.floor(depthOf("R") / r.costPerDamage));
        if (want >= 3) {
          const fuel = suggestFuel(fuelCandidates(w, pool, "R"), want * r.costPerDamage);
          const b = fuel ? barrageFight(w, catalog, pool, enc.encounter, want, fuel) : null;
          if (b?.ok) {
            powerUses.barrage! += 1; barrageSizes.push(want); burn("R", want * r.costPerDamage);
            out = b.outcome;
          } else out = parley(w, catalog, enc.encounter, "fight");
        } else out = parley(w, catalog, enc.encounter, "fight");
      } else out = parley(w, catalog, enc.encounter, "fight");
      if (out.type !== "fight") break;
      const d = out.duel;
      const human: Agent = new HeuristicAgent(seed * 7 + 1, pool, difficultyProfile(playerTier, starter.archetype, d.spec.players[1].decklist));
      const enemy: Agent = new HeuristicAgent(seed * 7 + 2, pool, difficultyProfile(d.enemy.difficulty, d.enemy.archetype, d.spec.players[0].decklist));
      const result = await runMatch(d.spec, pool, [human, enemy]);
      const rec = applyDuelResult(w, catalog, d, result);
      const t = String(d.enemy.tier);
      if (rec.outcome === "win") duels[t]!.w += 1;
      else if (rec.outcome === "loss") { duels[t]!.l += 1; lifeLostToLosses += knobs.lossLifePenalty; }
      else duels[t]!.d += 1;
      const bo = (byOpponent[enc.encounter.catalogId] ??= { w: 0, l: 0, d: 0 });
      if (rec.outcome === "win") bo.w += 1; else if (rec.outcome === "loss") bo.l += 1; else bo.d += 1;
      anteWon += rec.anteWon.length;
      anteLost += rec.anteLost.length;
      if (w.gameOver) { dead = true; deaths += 1; }
      if (powersOn && !dead) {
        const mx = maxWorldLife(w, extraKnobs);
        if (w.player.worldLife <= Math.ceil(mx / 3)) {
          const per = powerRates(w, "W").balm!.costPerLife;
          const want = Math.min(Math.ceil(mx / 2) - w.player.worldLife, Math.floor(depthOf("W") / per));
          if (want >= 1) {
            const fuel = suggestFuel(fuelCandidates(w, pool, "W"), want * per);
            if (fuel && applyBalm(w, pool, want, fuel).ok) { powerUses.balm! += 1; balmLifeBought += want; burn("W", want * per); }
          }
        }
      }
    }
  }
  if (!dead) toursCompleted += 1;
  occupiedAtEnd.push((w.sieges as { status?: string }[]).filter((s) => s.status === "occupied").length);
  lifeAtEnd.push(w.player.worldLife);
  maxLifeAtEnd.push(maxWorldLife(w, extraKnobs));
  lifeLinksHeld += w.manalinks.filter((m) => m.kind === "life").length;
  for (const c of POWER_COLORS) spareDepthAtEnd[c]!.push(depthOf(c));
  renownAtEnd.push(w.player.renown);
  goldEnd += w.player.gold;
  totalSteps += w.player.stepsTaken;
  process.stderr.write(`seed ${seed}: steps ${w.player.stepsTaken}, life ${w.player.worldLife}, gold ${w.player.gold}, duels ${w.duels.length}, renown ${w.player.renown}${dead ? " — DEAD" : ""}\n`);
}

const pct = (a: number, b: number) => (b === 0 ? "—" : `${((100 * a) / b).toFixed(0)}%`);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
console.log(`world-sim: ${seeds} seeds, starter ${starterId} "${starter.name}" (${playerTier} pilot, ${policy}), difficulty ${difficulty}${tier1Life ? `, tier-1 life ${tier1Life}` : ""}${tier1Deck ? `, tier-1 decks ${tier1Deck}` : ""}${noBeasts ? ", NO beasts (mage-only roster)" : ""}, tour = ${tour === "all" ? "all towns + every lair" : "all towns"}, fight every contact`);
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
// S24 (ADR-086): the life economy — the recovery knobs' tuning table. Life links stay ~0 until
// the sim accepts quests (bounty rewards flow through defeats only); the column exists for the day it does.
console.log(`  life economy: lost to losses −${lifeLostToLosses} · inn: ${innRests} rests, ${innStepsSpent} steps for +${innLifeBought} life (policy: rest to full below half max) · mean max life at end ${mean(maxLifeAtEnd).toFixed(1)} · life links held ${(lifeLinksHeld / seeds).toFixed(1)}/seed`);
// S25 (ADR-088): power usage + the three-demand fuel economy (card-courier, shop liquidity, power fuel).
if (powersOn) {
  console.log(`  powers (all five granted; pilot rules v1): stride ${(powerUses.stride! / seeds).toFixed(1)}/tour · balm ${(powerUses.balm! / seeds).toFixed(1)}/tour (+${balmLifeBought} life total) · quietus ${(powerUses.quietus! / seeds).toFixed(1)}/tour (tier mix ${quietusByTier[1]}/${quietusByTier[2]}/${quietusByTier[3]}) · barrage ${(powerUses.barrage! / seeds).toFixed(1)}/tour (mean size ${barrageSizes.length ? mean(barrageSizes).toFixed(1) : "—"}, max ${barrageSizes.length ? Math.max(...barrageSizes) : "—"}) · crossing 0 (the tour never liberates — needs the fighting policy)`);
  console.log(`  fuel burned/tour by colour: ${POWER_COLORS.map((c) => `${c} ${(fuelBurned[c]! / seeds).toFixed(1)}`).join(" · ")}`);
}
console.log(`  spare-pool depth by colour (mean at town arrivals → at tour end): ${POWER_COLORS.map((c) => `${c} ${mean(spareDepthSamples[c]!).toFixed(1)}→${mean(spareDepthAtEnd[c]!).toFixed(1)}`).join(" · ")}`);
// S21: siege pressure (the tour never relieves or liberates — this is the passive player's exposure).
console.log(`  sieges: threats c/a/w ${siegeThreats.civilized}/${siegeThreats.approach}/${siegeThreats.wild} · falls c/a/w ${siegeFalls.civilized}/${siegeFalls.approach}/${siegeFalls.wild} · mean towns occupied at tour end ${mean(occupiedAtEnd).toFixed(1)} · occupied-town exposure ${(occupiedTownSteps / Math.max(1, totalSteps)).toFixed(2)} town·steps/step${firstFallStep.length ? ` · first fall at mean step ${mean(firstFallStep).toFixed(0)}` : ""}`);
// S18: per-opponent table (player's win % vs each catalog entry), beasts and signatures marked.
console.log(`  per opponent (player win % · W-L, n):`);
const rows = Object.entries(byOpponent).map(([id, r]) => ({ id, r, tmpl: catalog.opponents.find((o) => o.id === id)! })).sort((a, b) => a.tmpl.tier - b.tmpl.tier || a.tmpl.id.localeCompare(b.tmpl.id));
for (const { id, r, tmpl } of rows) {
  const n = r.w + r.l + r.d;
  console.log(`    T${tmpl.tier} ${tmpl.spoke ? `[${tmpl.spoke} ${tmpl.kind ?? "mage"}] ` : ""}${tmpl.name} (${id}, ${tmpl.deck}): ${pct(r.w, n)} · ${r.w}-${r.l}${r.d ? `-${r.d}` : ""}, n=${n}`);
}

