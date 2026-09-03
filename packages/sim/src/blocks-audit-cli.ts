/**
 * Deploy playtest r1 (Chris: "I became unable to block ANY attacker when a Boggart Brute with
 * menace attacked beside others and I had one blocker"): audit a saved duel log's DECLARE
 * BLOCKERS decisions for one seat. For every blocker request the engine asked that seat, print
 * the attackers (with their keywords), the untapped creatures the seat controlled, every block
 * the engine OFFERED, and the action the log says was taken. The viewer never re-implements
 * rules and neither does this: it is `replayToDecision` (ADR-040) at each blocker index.
 *
 *   pnpm blocks-audit path/to/duel.json [--seat 0|1]     (seat defaults to the human's: spec.players[i].agent === "human")
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import type { ActionLogEntry } from "@shandalar/core";
import { expandDecklist, replayToDecision, type Action, type MatchSpec } from "@shandalar/engine";

function argOf(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
if (!file) {
  console.error("usage: pnpm blocks-audit <saved-game.json> [--seat 0|1]");
  process.exit(2);
}
const game = JSON.parse(readFileSync(file, "utf8")) as { format: string; spec: MatchSpec; log: ActionLogEntry<Action>[] };
if (game.format !== "shandalar-log-v1") throw new Error(`not a shandalar-log-v1 file: ${game.format}`);
const humanSeat = game.spec.players.findIndex((p) => p.agent === "human");
const seat = Number(argOf("seat") ?? (humanSeat === -1 ? 0 : humanSeat)) as 0 | 1;

const pool = loadCardPool(join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards")).cards;
const decklists: [string[], string[]] = [expandDecklist(game.spec.players[0].decklist), expandDecklist(game.spec.players[1].decklist)];
const rules = { startingLife: game.spec.rules.startingLife, handSize: game.spec.rules.handSize, maxTurns: game.spec.rules.maxTurns, ante: game.spec.rules.ante ?? 0 };
const actions = game.log.filter((e) => e.t === "ACTION");
const name = (cardId: string) => pool.get(cardId)?.name ?? cardId;

let found = 0;
for (let i = 0; i < actions.length; i++) {
  const entry = actions[i]!;
  if (entry.player !== seat || entry.step !== "DECLARE_BLOCKERS") continue;
  const point = await replayToDecision(pool, decklists, game.log, i, rules, game.spec.modifiers ?? []);
  const req = point.request;
  if (!req || req.purpose !== "declareBlocker") continue;
  found += 1;
  const st = point.state;
  const describe = (id: string) => {
    const o = st.objects[id];
    if (!o) return `${id} (gone)`;
    const def = pool.get(o.cardId);
    const kw = def?.keywords?.length ? ` [${def.keywords.join(", ")}]` : "";
    return `${def?.name ?? o.cardId}${kw}${o.tapped ? " (tapped)" : ""}`;
  };
  const attackers = st.combat.attackers.map(describe);
  const blocks = st.combat.blocks.map((b) => `${describe(b.blocker)} → ${describe(b.attacker)}`);
  const mine = st.battlefield.filter((id) => { const o = st.objects[id]; return o && o.controller === seat && pool.get(o.cardId)?.types.includes("Creature"); }).map(describe);
  const offered = req.actions.map((a) => a.type === "declareBlocker" ? `${describe(a.blocker)} → ${describe(a.attacker)}` : a.type);
  const taken = entry.action.type === "declareBlocker" ? `${describe(entry.action.blocker)} → ${describe(entry.action.attacker)}` : entry.action.type;
  console.log(`\n== T${entry.turn} decision #${i} (seat ${seat}, life ${st.players[seat].life}) ==`);
  console.log(`  attackers:      ${attackers.join(" | ") || "(none)"}`);
  console.log(`  my creatures:   ${mine.join(" | ") || "(none)"}`);
  if (blocks.length) console.log(`  staged so far:  ${blocks.join(" | ")}`);
  console.log(`  OFFERED:        ${offered.join(" | ")}`);
  console.log(`  taken:          ${taken}`);
}
console.log(`\n${found} blocker decision(s) for seat ${seat} in ${actions.length} actions (${game.spec.players[0].name} vs ${game.spec.players[1].name}, seed ${game.spec.seed}); ${name("boggart_brute")} check complete.`);
