/**
 * pnpm guardian-sim [--games N] [--seed S]
 *
 * S20 Part 6: the empowerment knob-tuning instrument. Each Mox guardian deck (master profile, its
 * dungeon's LAW applied to both sides, its content-file life) against a reference set — the five
 * starters + slice C and D (journeyman pilots at world life 10) — at empowerment tiers 0/60/120/180
 * interior steps. Reports the GUARDIAN's kill rate per tier. Mirrors dungeonDuelSpec's construction
 * (law both sides; cumulative tier packages on the guardian's seat).
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { runMatch, type Agent, type MatchSpec, type Modifier } from "@shandalar/engine";
import { HeuristicAgent, difficultyProfile } from "@shandalar/agents";
import { GUARDIAN_DECKS } from "./guardian-decks.js";
import { DECKS } from "./slice-decks.js";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1]! : fallback;
}
const games = Number(arg("games", "20"));
const seed0 = Number(arg("seed", "1"));
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const starters = JSON.parse((await import("node:fs")).readFileSync(join(ROOT, "data/world/starters.json"), "utf8")) as {
  starters: { id: string; archetype: "aggro" | "midrange" | "control"; decklist: { cardId: string; count: number }[] }[];
};
const dungeons = JSON.parse((await import("node:fs")).readFileSync(join(ROOT, "data/world/dungeons.json"), "utf8")) as {
  mox: { id: string; color: "W" | "U" | "B" | "R" | "G"; guardian: { key: string; name: string; life: number }; law: { both: { type: string; cardId?: string; count?: number }[] } }[];
};

const BASIC: Record<string, string> = { W: "plains", U: "island", B: "swamp", R: "mountain", G: "forest" };
const TOKEN: Record<string, string> = { W: "bird_1_1_flying", U: "faerie_1_1_u", B: "faerie_rogue_1_1_flying", R: "goblin_1_1", G: "bear_2_2" };
// Mirrors dungeonEmpowermentTiers (cumulative): 30/60/90 since S20 playtest r2 (was 60/120/180).
const TIERS = [
  { steps: 0, life: 0, mods: [] as Modifier[] },
  { steps: 30, life: 2, mods: [] as Modifier[] },
  { steps: 60, life: 4, mods: [{ basic: true }] as never[] },
  { steps: 90, life: 6, mods: [{ basic: true }, { token: true }, { card: true }] as never[] },
];

const reference: { name: string; archetype: "aggro" | "midrange" | "control"; decklist: { cardId: string; count: number }[] }[] = [
  ...starters.starters.map((s) => ({ name: `starter:${s.id}`, archetype: s.archetype, decklist: s.decklist })),
  { name: "slice:C", archetype: "midrange", decklist: [...DECKS.C.decklist] },
  { name: "slice:D", archetype: "midrange", decklist: [...DECKS.D.decklist] },
];

console.log(`guardian-sim: ${games} games × ${reference.length} references × 4 tiers per guardian (law both sides; reference at world life 10, journeyman)`);
for (const mox of dungeons.mox) {
  const g = GUARDIAN_DECKS[mox.guardian.key]!;
  const line: string[] = [];
  for (const tier of TIERS) {
    let guardianWins = 0, total = 0;
    const empMods: Modifier[] = [];
    for (const m of tier.mods as { basic?: boolean; token?: boolean; card?: boolean }[]) {
      if (m.basic) empMods.push({ type: "permanentOnBattlefield", player: 1, cardId: BASIC[mox.color]! });
      if (m.token) empMods.push({ type: "permanentOnBattlefield", player: 1, cardId: TOKEN[mox.color]! });
      if (m.card) empMods.push({ type: "extraCards", player: 1, count: 1 });
    }
    const lawMods = (player: 0 | 1): Modifier[] =>
      mox.law.both.map((l) =>
        l.type === "extraCards"
          ? ({ type: "extraCards", player, count: l.count ?? 1 } as Modifier)
          : ({ type: "permanentOnBattlefield", player, cardId: l.cardId! } as Modifier),
      );
    for (const ref of reference) {
      for (let i = 0; i < games; i++) {
        if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));
        const seed = seed0 + i + tier.steps * 7;
        const spec: MatchSpec = {
          seed,
          players: [
            { name: ref.name, decklist: [...ref.decklist], agent: "heuristic" },
            { name: mox.guardian.name, decklist: [...g.decklist], agent: "heuristic" },
          ],
          rules: { startingLife: 10, handSize: 7, mulligan: "london", maxTurns: 100 },
          modifiers: [{ type: "startingLife", player: 1, value: mox.guardian.life + tier.life }, ...lawMods(0), ...lawMods(1), ...empMods],
        };
        const a0: Agent = new HeuristicAgent(seed * 2 + 1, pool, difficultyProfile("journeyman", ref.archetype, [...g.decklist]));
        const a1: Agent = new HeuristicAgent(seed * 2 + 2, pool, difficultyProfile("master", g.archetype, [...ref.decklist]));
        try {
          const r = await runMatch(spec, pool, [a0, a1]);
          if (r.winner === 1) guardianWins += 1;
          total += 1;
        } catch (e) {
          console.log(`    ERROR ${mox.id} tier ${tier.steps} vs ${ref.name} seed ${seed}: ${(e as Error).message}`);
        }
      }
    }
    line.push(`@${tier.steps}: ${((100 * guardianWins) / Math.max(1, total)).toFixed(0)}%`);
  }
  console.log(`  ${mox.guardian.name} (${mox.id}, life ${mox.guardian.life}, law ${mox.law.both.map((l) => l.cardId ?? `${l.type}`).join("+")}): kill rate ${line.join(" · ")}`);
}
