/**
 * pnpm lord-sim [--games N] [--seed S]
 *
 * S22b Part 6 (the guardian-sim pattern): each lord's v1 deck (master profile) with his PARTISAN
 * LAW on his side and his ENTRANCE applied, against the reference set — the five starters + slice
 * C and D (journeyman pilots at world life 10) — at three life points (hunted floor 15 / base 30 /
 * fully-grown 50) × empowerment tiers (0/60/90 interior steps). Reports the LORD's kill rate per
 * cell, plus the brief's three observations: the Usher's launder line (does she blink a pending-
 * sacrifice guest unaided? — instrumented at the agent seam, where the view carries
 * pendingEndStepSacrifices), the Stoker's library race (DECKED terminations by side), and the
 * Sower's sphinx activations (the ?-cost question's input).
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { runMatch, type ActionRequest, type Agent, type GameView, type MatchSpec, type Modifier, type Action } from "@shandalar/engine";
import { HeuristicAgent, difficultyProfile } from "@shandalar/agents";
import { LORD_DECKS } from "@shandalar/sim/lord-decks";
import { DECKS } from "@shandalar/sim/decks";
import { empowermentModifiers, type EmpowermentTier } from "./dungeon.js";
import { defaultKnobs } from "./knobs.js";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1]! : fallback;
}
const games = Number(arg("games", "10"));
const seed0 = Number(arg("seed", "1"));
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const fs = await import("node:fs");
const starters = JSON.parse(fs.readFileSync(join(ROOT, "data/world/starters.json"), "utf8")) as {
  starters: { id: string; archetype: "aggro" | "midrange" | "control"; decklist: { cardId: string; count: number }[] }[];
};
const dungeons = JSON.parse(fs.readFileSync(join(ROOT, "data/world/dungeons.json"), "utf8")) as {
  strongholds: { id: string; color: "W" | "U" | "B" | "R" | "G"; lord: { key: string; name: string; cardId: string; baseLife: number }; law: { cardId: string; name: string } }[];
};

// S23 Part 0 (the S20 three-place-sync flag cashes): the schedule reads the KNOB and the packages
// come from dungeon.ts's one builder. Sample points preserved from the S22b tables: untouched /
// mid-tour (through the second threshold) / full-tour (everything).
const SCHEDULE = defaultKnobs().strongholdEmpowermentTiers;
const TIERS: { steps: number; reached: EmpowermentTier[] }[] = [
  { steps: 0, reached: [] },
  { steps: SCHEDULE[1]?.steps ?? 0, reached: SCHEDULE.slice(0, 2) },
  { steps: SCHEDULE[2]?.steps ?? 0, reached: SCHEDULE.slice(0, 3) },
];
// The pace war's three postures: bled to the floor / untouched / fattened by the years (base+cap).
const LIVES = [
  { label: "hunted 15", life: 15 },
  { label: "base 30", life: 30 },
  { label: "grown 50", life: 50 },
];

const reference: { name: string; archetype: "aggro" | "midrange" | "control"; decklist: { cardId: string; count: number }[] }[] = [
  ...starters.starters.map((s) => ({ name: `starter:${s.id}`, archetype: s.archetype, decklist: s.decklist })),
  { name: "slice:C", archetype: "midrange", decklist: [...DECKS.C.decklist] },
  { name: "slice:D", archetype: "midrange", decklist: [...DECKS.D.decklist] },
];

/** Instrumented lord seat: counts the launder line (a Restoration Angel blink aimed at a
 * pending-sacrifice guest — chosen with the view in hand, so no replay archaeology needed)
 * and the Sower's sphinx activations. */
class InstrumentedAgent implements Agent {
  launders = 0;
  sphinxes = 0;
  constructor(private readonly inner: HeuristicAgent) {}
  async chooseAction(view: GameView, request: ActionRequest): Promise<Action> {
    const action = await this.inner.chooseAction(view, request);
    if (request.purpose === "chooseTarget" && request.source?.cardId === "restoration_angel" && action.type === "chooseTriggerTargets") {
      if (action.targets.some((t) => t.kind === "object" && view.pendingEndStepSacrifices.includes(t.id))) this.launders += 1;
    }
    if (action.type === "activateAbility") {
      const o = view.battlefield.find((b) => b.id === action.objectId);
      if (o?.cardId === "the_sower") this.sphinxes += 1;
    }
    return action;
  }
}

console.log(`lord-sim: ${games} games × ${reference.length} references per cell (law on the lord's side; entrance applied; reference at world life 10, journeyman vs master)`);
for (const sh of dungeons.strongholds) {
  const lord = LORD_DECKS[sh.lord.key]!;
  console.log(`\n${sh.lord.name} (${sh.id}, law ${sh.law.name}):`);
  let deckouts0 = 0, deckouts1 = 0, launders = 0, laundersGames = 0, sphinxes = 0, cellTotal = 0;
  for (const lv of LIVES) {
    const line: string[] = [];
    for (const tier of TIERS) {
      let lordWins = 0, total = 0;
      const { lifeBonus, modifiers: empMods } = empowermentModifiers(tier.reached, sh.color);
      for (const ref of reference) {
        for (let i = 0; i < games; i++) {
          if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));
          const seed = seed0 + i + tier.steps * 7 + lv.life * 131;
          const spec: MatchSpec = {
            seed,
            players: [
              { name: ref.name, decklist: [...ref.decklist], agent: "heuristic" },
              { name: sh.lord.name, decklist: [...lord.decklist], agent: "heuristic" },
            ],
            rules: { startingLife: 10, handSize: 7, mulligan: "london", maxTurns: 100 },
            modifiers: [
              { type: "startingLife", player: 1, value: lv.life + lifeBonus },
              { type: "permanentOnBattlefield", player: 1, cardId: sh.law.cardId }, // the partisan law
              { type: "signatureToHand", player: 1, cardId: sh.lord.cardId }, // the entrance
              ...empMods,
            ],
          };
          const a0: Agent = new HeuristicAgent(seed * 2 + 1, pool, difficultyProfile("journeyman", ref.archetype, [...lord.decklist]));
          const a1 = new InstrumentedAgent(new HeuristicAgent(seed * 2 + 2, pool, difficultyProfile("master", lord.archetype, [...ref.decklist])));
          try {
            const r = await runMatch(spec, pool, [a0, a1]);
            if (r.winner === 1) lordWins += 1;
            if (r.reason === "DECKED") (r.winner === 1 ? deckouts0 += 1 : deckouts1 += 1); // the DECKED side is the loser
            launders += a1.launders;
            if (a1.launders > 0) laundersGames += 1;
            sphinxes += a1.sphinxes;
            total += 1; cellTotal += 1;
          } catch (e) {
            console.log(`    ERROR ${sh.id} ${lv.label} tier ${tier.steps} vs ${ref.name} seed ${seed}: ${(e as Error).message}`);
          }
        }
      }
      line.push(`@${tier.steps}: ${((100 * lordWins) / Math.max(1, total)).toFixed(0)}%`);
    }
    console.log(`  ${lv.label.padEnd(9)} kill rate ${line.join(" · ")}`);
  }
  const notes: string[] = [];
  if (sh.lord.key === "usher") notes.push(`launder lines found unaided: ${launders} across ${laundersGames}/${cellTotal} games`);
  if (sh.lord.key === "stoker") notes.push(`DECKED terminations: opponent decked ${deckouts0}, the Stoker decked ${deckouts1} (of ${cellTotal})`);
  if (sh.lord.key === "sower") notes.push(`sphinx activations: ${sphinxes} across ${cellTotal} games (${(sphinxes / Math.max(1, cellTotal)).toFixed(2)}/game — the ?-cost question's input)`);
  for (const n of notes) console.log(`  ◆ ${n}`);
}
