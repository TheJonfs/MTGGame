/**
 * pnpm convocation-sim [--events 4] [--seed 53] [--seats 128] [--second open] --shard i/n [--out …]
 * pnpm convocation-sim --report <shard.json …>
 *
 * S53 (Part 4): the full Convocation played headless — the human's seat by the pick rule, the builder and a heuristic
 * — sixteen Swiss rounds and the Umbel at 128 seats. Per stage: the wall time (the field included), the save's size;
 * per event: rematches, the draft rounds' pod check, the human's finish; and the question the brief asks — does the
 * carried record find the strong seats? (each seat's deck quality per stage, as its percentile in the field, against
 * where it finished).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { HeuristicAgent, difficultyProfile } from "@shandalar/agents";
import { defaultKnobs } from "./knobs.js";
import { authoredLists } from "./authored-lists.js";
import { convocationNames } from "./convocation-names.js";
import { stepHeadless } from "./convocation-run.js";
import { CONVOCATION_SEATS, defaultStages, eventFormat, finalPlaces, newConvocation, serializeEvent, type ConvocationEvent, type SeatAgents } from "./event.js";
import { cardRating, limitedView, type CardRatingTable } from "./rating.js";
import type { ConvocationPackData } from "./packs.js";

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1]! : d; };
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const cards = loadCardPool(join(ROOT, "data/cards")).cards;
const read = (f: string) => JSON.parse(readFileSync(join(ROOT, "data/convocation", f), "utf8"));
const packs: ConvocationPackData = { power: read("sets.json").power, sets: read("sets.json").sets, recipes: read("recipes.json").recipes };
const rating = read("card-rating.json") as CardRatingTable, limited = limitedView(rating);
const library = authoredLists(ROOT);
const deps = { cards, packs, rating, knobs: defaultKnobs(), library };
const agents: SeatAgents = (seat, opp, seed, side) => new HeuristicAgent(seed * 2 + 1 + side, cards, difficultyProfile("master", seat.archetype, opp.deck));

interface StageRow { stage: number; formatId: string; ms: number; saveBytes: number; quality: number[] }
interface EventRow { seed: number; stages: StageRow[]; finalSaveBytes: number; rematches: number; podViolations: number; places: number[]; humanPlace: number; bracketMs: number; totalMs: number }

/** A seat's deck quality: the mean score of its nonland cards (the Limited score in a Limited stage, the Constructed one else). */
const quality = (e: ConvocationEvent, seat: number) => {
  const table = eventFormat(e.formatId).kind === "limited" ? limited : rating;
  const xs = e.field[seat]!.deck.flatMap((x) => { const d = cards.get(x.cardId)!; return d.types.includes("Land") ? [] : Array<number>(x.count).fill(cardRating(d, table)); });
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
};

async function play(): Promise<void> {
  const EVENTS = Number(arg("events", "4")), seed0 = Number(arg("seed", "53")), SEATS = Number(arg("seats", String(CONVOCATION_SEATS)));
  const [si, sn] = arg("shard", "0/1").split("/").map(Number) as [number, number];
  const rows: EventRow[] = [];
  for (let k = 0; k < EVENTS; k++) {
    if (k % sn !== si) continue;
    const seed = seed0 * 1000 + k, t0 = Date.now();
    let e = newConvocation({ seed, stages: defaultStages(arg("second", "open")), seats: SEATS, names: convocationNames(SEATS - 1), faces: [], library }, deps);
    const stages: StageRow[] = []; let stageT = Date.now(), podViolations = 0, bracketT = 0;
    let qual: number[] = [];
    while (e.phase !== "over") {
      const before = e;
      e = await stepHeadless(e, deps, agents);
      if (before.phase === "build" && e.phase === "round") qual = e.field.map((_, s) => quality(e, s)); // every deck registered
      if (e.phase === "round" && before.phase !== "round" && e.stages![e.stage!]!.kind === "draft") for (const p of e.pairings) if (!e.pods!.some((pod) => pod.includes(p.a) && pod.includes(p.b!))) podViolations += 1;
      if ((e.phase === "interlude" || (e.phase === "bracket" && before.phase === "standings")) && before.phase === "standings") {
        stages.push({ stage: before.stage!, formatId: before.formatId, ms: Date.now() - stageT, saveBytes: serializeEvent(e).length, quality: qual });
        stageT = Date.now();
        if (e.phase === "bracket") bracketT = Date.now();
      }
    }
    const pairs = e.results.map((r) => [r.a, r.b].sort((x, y) => x - y).join("-"));
    const places = finalPlaces(e).sort((x, y) => x.seat - y.seat).map((p) => p.place);
    rows.push({ seed, stages, finalSaveBytes: serializeEvent(e).length, rematches: pairs.length - new Set(pairs).size, podViolations, places, humanPlace: places[0]!, bracketMs: Date.now() - bracketT, totalMs: Date.now() - t0 });
    console.error(`event ${seed}: ${Math.round((Date.now() - t0) / 1000)} s, the human ${places[0]} of ${SEATS}`);
  }
  const out = arg("out", join(ROOT, `analysis/runs/convocation_shard${si}.json`));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ seats: SEATS, rows }));
}

function report(): void {
  const files = process.argv.slice(2).filter((a) => a.endsWith(".json"));
  const runs = files.map((f) => JSON.parse(readFileSync(f, "utf8")) as { seats: number; rows: EventRow[] });
  const rows = runs.flatMap((r) => r.rows), seats = runs[0]!.seats;
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  const pctile = (xs: number[], i: number) => xs.filter((x) => x < xs[i]!).length / (xs.length - 1); // the seat's deck against the field's
  const corr = (xs: number[], ys: number[]) => { const mx = mean(xs), my = mean(ys); let c = 0, sx = 0, sy = 0; xs.forEach((x, i) => { c += (x - mx) * (ys[i]! - my); sx += (x - mx) ** 2; sy += (ys[i]! - my) ** 2; }); return c / Math.sqrt(sx * sy); };
  const L: string[] = [`# The full Convocation headless (S53 Part 4) — ${rows.length} events at ${seats} seats, sixteen Swiss rounds and the Umbel, the human's seat a heuristic\n`];
  L.push(`## Time and the save (Node, one process an event)\n\n| stage | format | wall time (field included) | the save after it |\n|---|---|---|---|`);
  for (let k = 0; k < 4; k++) { const st = rows.map((r) => r.stages[k]!).filter(Boolean); L.push(`| ${k + 1} | ${st[0]?.formatId} | ${Math.round(mean(st.map((x) => x.ms)) / 1000)} s | ${Math.round(mean(st.map((x) => x.saveBytes)) / 1024)} KB |`); }
  L.push(`| the Umbel | | ${Math.round(mean(rows.map((r) => r.bracketMs)) / 1000)} s | ${Math.round(mean(rows.map((r) => r.finalSaveBytes)) / 1024)} KB at the finish |`);
  L.push(`\nWhole event: ${Math.round(mean(rows.map((r) => r.totalMs)) / 1000)} s. Rematches: ${rows.reduce((n, r) => n + r.rematches, 0)} in ${rows.length} events. Draft-round pairings outside their pod: ${rows.reduce((n, r) => n + r.podViolations, 0)}. The human's finishes: ${rows.map((r) => r.humanPlace).join(", ")}.`);
  // does the record find the strong seats?
  const seatRows = rows.flatMap((r) => r.places.map((place, s) => ({ place, q: r.stages.map((st) => pctile(st.quality, s)) })));
  L.push(`\n## Does the carried record find the strong seats?\n\nA seat's deck quality in a stage is its percentile in the field (0 the weakest deck, 1 the strongest), by the stage's own score.\n\n| finish | seats | Day 1 | Day 2 | Day 3 | Day 4 | mean |\n|---|---|---|---|---|---|---|`);
  const band = (lo: number, hi: number, label: string) => { const xs = seatRows.filter((x) => x.place >= lo && x.place <= hi); L.push(`| ${label} | ${xs.length} | ${[0, 1, 2, 3].map((k) => mean(xs.map((x) => x.q[k] ?? 0)).toFixed(2)).join(" | ")} | ${mean(xs.map((x) => mean(x.q))).toFixed(2)} |`); };
  band(1, 1, "the champion"); band(2, 8, "2nd–8th (the Umbel)"); band(9, 32, "9th–32nd"); band(33, 64, "33rd–64th"); band(65, seats, `65th–${seats}th`);
  L.push(`\nA seat's mean deck percentile against its finish (lower is better): r = ${corr(seatRows.map((x) => mean(x.q)), seatRows.map((x) => x.place)).toFixed(2)}. Each day alone: ${[0, 1, 2, 3].map((k) => `Day ${k + 1} r = ${corr(seatRows.map((x) => x.q[k] ?? 0), seatRows.map((x) => x.place)).toFixed(2)}`).join(" · ")}.`);
  const text = L.join("\n");
  writeFileSync(join(ROOT, `analysis/runs/${arg("report-name", "convocation_sim")}.md`), text + "\n");
  console.log(text);
}

if (process.argv.includes("--report")) report(); else await play();
