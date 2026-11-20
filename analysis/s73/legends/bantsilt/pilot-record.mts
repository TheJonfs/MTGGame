/**
 * Post-S73a (2026-11-20) — the pilot playing Chris's Bant Silt, recorded for reading (concern 93).
 *   npx tsx analysis/s73/legends/bantsilt/pilot-record.mts <games-per-opponent> <out.json>
 * Game ones, Bant Silt in seat 0 against every other Bant list, the play alternating; the logs in the recorded-games
 * shape, so narrate.mts reads them (event seed 183).
 */
import { writeFileSync } from "node:fs";
import { loadCardPool } from "../../../../packages/cards/src/loader.ts";
import { runMatch, type MatchSpec } from "../../../../packages/engine/src/index.ts";
import { HeuristicAgent, difficultyProfile } from "../../../../packages/agents/src/index.ts";
import { FORMAT_FIELD } from "../../../../packages/sim/src/open-decks.ts";

const ROOT = new URL("../../../../", import.meta.url).pathname;
const pool = loadCardPool(ROOT + "data/cards").cards, D = FORMAT_FIELD.bant!, A = D.silt!;
const G = Number(process.argv[2] ?? 4), games: unknown[] = [];
for (const [oi, ok] of Object.keys(D).filter((k) => k !== "silt").entries()) for (let g = 0; g < G; g++) {
  const B = D[ok]!, seed = 5183 + oi * 1009 + g * 37;
  const spec = { seed, players: [{ name: "silt", decklist: [...A.decklist], agent: "heuristic:master" }, { name: ok, decklist: [...B.decklist], agent: "heuristic:master" }], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 120, ante: 0, startingPlayer: g % 2 }, modifiers: [] } as unknown as MatchSpec;
  const h = (s: number, d: typeof A, o: typeof A) => new HeuristicAgent(s, pool, difficultyProfile("master", d.archetype as never, [...o.decklist], [...d.decklist]));
  const r = await runMatch(spec, pool, [h(seed * 2 + 1, A, B), h(seed * 2 + 2, B, A)]);
  games.push({ format: "shandalar-log-v1", eventSeed: 183, formatId: "bant", round: oi, phase: "pilot", game: g, opponent: ok, list: `bant:${ok}`, spec, result: { winner: r.winner, reason: r.reason, turns: r.turns }, log: r.log });
  console.log(ok, g, r.winner === 0 ? "WON" : "lost", r.reason, r.turns);
}
writeFileSync(process.argv[3]!, JSON.stringify({ format: "shandalar-games-v1", games }));
