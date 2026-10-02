/**
 * pnpm constructed:rr [--format open] [--seed 52] [--seats 15] [--games 20]
 *
 * S52 (Part 4): a Constructed field in a round-robin — the event's own select-and-repair decks (one per AI seat, the
 * event's seeds), every pair, master both, 20 life. How the archetypes spread, the variation within one archetype
 * (the noise swaps), and any deck the repair left weak.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { loadCardPool } from "@shandalar/cards/loader";
import { runMatch, type MatchSpec } from "@shandalar/engine";
import { HeuristicAgent, difficultyProfile } from "@shandalar/agents";
import { CONSTRUCTED_FORMATS } from "./formats.js";
import { authoredLists } from "./authored-lists.js";
import { newConstructedEvent } from "./event.js";
import { convocationNames } from "./convocation-names.js";
import type { CardRatingTable } from "./rating.js";

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1]! : d; };
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const cards = loadCardPool(join(ROOT, "data/cards")).cards;
const rating = JSON.parse(readFileSync(join(ROOT, "data/convocation/card-rating.json"), "utf8")) as CardRatingTable;
const format = CONSTRUCTED_FORMATS.find((f) => f.id === arg("format", "open"))!;
const seed0 = Number(arg("seed", "52")), SEATS = Number(arg("seats", "31")), G = Number(arg("games", "12"));
const event = newConstructedEvent({ seed: seed0, format, seats: SEATS + 1, rounds: 5, names: convocationNames(SEATS), faces: [], library: authoredLists(ROOT) }, { cards, rating });
const field = event.field.slice(1);
const w = field.map(() => 0), n = field.map(() => 0); let games = 0;
for (let i = 0; i < field.length; i++) for (let j = i + 1; j < field.length; j++) for (let g = 0; g < G; g++) {
  const seatA = g % 2, seed = seed0 + i * 1009 + j * 37 + g, A = field[i]!, B = field[j]!;
  const [d0, d1] = seatA === 0 ? [A, B] : [B, A];
  const spec = { seed, players: [{ name: d0.name, decklist: d0.deck, agent: "h" }, { name: d1.name, decklist: d1.deck, agent: "h" }], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 100 }, modifiers: [] } as unknown as MatchSpec;
  const r = await runMatch(spec, cards, [new HeuristicAgent(seed * 2 + 1, cards, difficultyProfile("master", d0.archetype, d1.deck)), new HeuristicAgent(seed * 2 + 2, cards, difficultyProfile("master", d1.archetype, d0.deck))]);
  const a = r.winner === null ? 0.5 : r.winner === seatA ? 1 : 0;
  w[i]! += a; w[j]! += 1 - a; n[i]! += 1; n[j]! += 1; games += 1;
}
const pct = (x: number) => `${Math.round(x * 100)}%`;
const src = (l: string) => JSON.parse(JSON.stringify(authoredLists(ROOT).find((x) => x.key === l)!.decklist)) as { cardId: string; count: number }[];
const diff = (deck: { cardId: string; count: number }[], list: string) => { const s = new Map(src(list).map((e) => [e.cardId, e.count])); const out: string[] = []; for (const e of deck) { const k = e.count - (s.get(e.cardId) ?? 0); if (k > 0) out.push(`+${k} ${cards.get(e.cardId)!.name}`); s.delete(e.cardId); if (k < 0) out.push(`${k} ${cards.get(e.cardId)!.name}`); } for (const [id, k] of s) out.push(`−${k} ${cards.get(id)!.name}`); return out.join(", ").replace(/-/g, "−"); };
const byList: Record<string, number[]> = {}; field.forEach((s, i) => (byList[s.list!] ??= []).push(i));
const L = [`# ${format.name}'s field in a round-robin (S52 Part 4) — ${field.length} select-and-repair decks (seed ${seed0}), ${games} games (${G} a pairing), master both, 20 life\n`,
  `## The archetypes\n\n| list | seats | mean win rate | range within the list |\n|---|---|---|---|`,
  ...Object.entries(byList).sort((a, b) => b[1].length - a[1].length).map(([l, is]) => { const rs = is.map((i) => w[i]! / n[i]!); return `| ${l} | ${is.length} | ${pct(rs.reduce((a, b) => a + b, 0) / rs.length)} | ${pct(Math.min(...rs))}–${pct(Math.max(...rs))} |`; }),
  (() => { // the noise of the noise: how a seat fares against its own list's mean, by how far it moved from the list
    const listMean = (l: string) => { const is = byList[l]!; return is.reduce((a, i) => a + w[i]! / n[i]!, 0) / is.length; };
    const lv: Record<string, number[]> = {}; field.forEach((s, i) => { if (byList[s.list!]!.length > 1) (lv[s.tinker!] ??= []).push(w[i]! / n[i]! - listMean(s.list!)); });
    const all: Record<string, number[]> = {}; field.forEach((s, i) => (all[s.tinker!] ??= []).push(w[i]! / n[i]!));
    return `\n## By how far a seat moved from its list\n\n| tinker | seats | mean win rate | against its own list's mean (lists with two or more seats) |\n|---|---|---|---|\n${["stock", "light", "heavy"].map((t) => `| ${t} | ${(all[t] ?? []).length} | ${all[t]?.length ? pct(all[t]!.reduce((a, b) => a + b, 0) / all[t]!.length) : "—"} | ${lv[t]?.length ? `${((lv[t]!.reduce((a, b) => a + b, 0) / lv[t]!.length) * 100).toFixed(1)} points (${lv[t]!.length} seats)` : "—"} |`).join("\n")}`;
  })(),
  `\n## The seats\n\n| seat | from | tinker | win rate | against its list |\n|---|---|---|---|---|`,
  ...field.map((s, i) => [s, i] as const).sort((a, b) => w[b[1]]! / n[b[1]]! - w[a[1]]! / n[a[1]]!).map(([s, i]) => `| ${s.name} | ${s.list} | ${s.tinker} | ${pct(w[i]! / n[i]!)} | ${diff(s.deck, s.list!) || "—"} |`)];
const text = L.join("\n"); console.log(text);
mkdirSync(join(ROOT, "analysis/runs"), { recursive: true }); writeFileSync(join(ROOT, `analysis/runs/constructed_rr_${format.id}.md`), text + "\n");
