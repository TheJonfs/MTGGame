/**
 * pnpm convocation-sim [--events 4] [--seed 53] [--seats 128] [--second open] --shard i/n [--out …]
 * pnpm convocation-sim --report <shard.json …>
 *
 * S53 (Part 4): the full Convocation played headless — the human's seat by the pick rule, the builder and a heuristic
 * — sixteen Swiss rounds and the Umbel at 128 seats. Per stage: the wall time (the field included), the save's size;
 * per event: rematches, the draft rounds' pod check, the human's finish; and the question the brief asks — does the
 * carried record find the strong seats? (each seat's deck quality per stage, as its percentile in the field, against
 * where it finished).
 * S54 (ADR-158): the field has strength — each seat's builder (Constructed) and rating noise (Limited) are recorded,
 * and the report reads the finish by them, the Umbel's mean deck percentile against the field's median, and r.
 * `--short` plays the short Convocation (a draft, then the Open).
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
import { CONVOCATION_SEATS, defaultStages, shortStages, eventFormat, finalPlaces, newConvocation, serializeEvent, type ConvocationEvent, type SeatAgents } from "./event.js";
import { cardRating, limitedView, type CardRatingTable } from "./rating.js";
import { OPEN_MEANS } from "./constructed-builder.js";
import type { ConvocationPackData } from "./packs.js";

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1]! : d; };
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const cards = loadCardPool(join(ROOT, "data/cards")).cards;
const read = (f: string) => JSON.parse(readFileSync(join(ROOT, "data/convocation", f), "utf8"));
const packs: ConvocationPackData = { power: read("sets.json").power, sets: read("sets.json").sets, recipes: read("recipes.json").recipes };
const rating = read("card-rating.json") as CardRatingTable, limited = limitedView(rating);
const library = authoredLists(ROOT);
const deps = { cards, packs, rating, knobs: defaultKnobs(), library };
const agents: SeatAgents = (seat, opp, seed, side) => new HeuristicAgent(seed * 2 + 1 + side, cards, difficultyProfile("master", seat.archetype, opp.deck, seat.deck));

interface StageRow { stage: number; formatId: string; ms: number; saveBytes: number; quality: number[] }
interface EventRow { seed: number; strength: { builder?: string; noise?: number; lists?: string }[]; /** S55: each seat's list at the first Constructed stage, as its measured Open mean (0 when unmeasured) */ listMeans?: number[]; stages: StageRow[]; finalSaveBytes: number; rematches: number; podViolations: number; places: number[]; humanPlace: number; bracketMs: number; totalMs: number }

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
    let e = newConvocation({ seed, stages: process.argv.includes("--short") ? shortStages(arg("second", "open")) : defaultStages(arg("second", "open")), seats: SEATS, names: convocationNames(SEATS - 1), faces: [], library }, deps);
    const stages: StageRow[] = []; let stageT = Date.now(), podViolations = 0, bracketT = 0;
    let qual: number[] = [], listMeans: number[] = [];
    while (e.phase !== "over") {
      const before = e;
      e = await stepHeadless(e, deps, agents);
      // every deck in: the build ends (a draft or Sealed stage) or the stage starts with registered decks (S54: a
      // Constructed day after the first skips the build — the snapshot was Day 1's, read again)
      if ((before.phase === "build" || before.phase === "interlude") && e.phase === "round") qual = e.field.map((_, s) => quality(e, s));
      if (!listMeans.length && e.phase === "round" && eventFormat(e.formatId).kind === "constructed") listMeans = e.field.map((x) => OPEN_MEANS[x.list ?? ""] ?? 0);
      if (e.phase === "round" && before.phase !== "round" && e.stages![e.stage!]!.kind === "draft") for (const p of e.pairings) if (!e.pods!.some((pod) => pod.includes(p.a) && pod.includes(p.b!))) podViolations += 1;
      if ((e.phase === "interlude" || (e.phase === "bracket" && before.phase === "standings")) && before.phase === "standings") {
        stages.push({ stage: before.stage!, formatId: before.formatId, ms: Date.now() - stageT, saveBytes: serializeEvent(e).length, quality: qual });
        stageT = Date.now();
        if (e.phase === "bracket") bracketT = Date.now();
      }
    }
    const pairs = e.results.map((r) => [r.a, r.b].sort((x, y) => x - y).join("-"));
    const places = finalPlaces(e).sort((x, y) => x.seat - y.seat).map((p) => p.place);
    rows.push({ seed, strength: e.field.map((x) => ({ ...(x.builder ? { builder: x.builder } : {}), ...(x.noise !== undefined ? { noise: x.noise } : {}), ...(x.lists ? { lists: x.lists } : {}) })), ...(listMeans.length ? { listMeans } : {}), stages, finalSaveBytes: serializeEvent(e).length, rematches: pairs.length - new Set(pairs).size, podViolations, places, humanPlace: places[0]!, bracketMs: Date.now() - bracketT, totalMs: Date.now() - t0 });
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
  const L: string[] = [`# The Convocation headless (S53 Part 4; S54 with the field's strength, ADR-158) — ${rows.length} events at ${seats} seats, ${rows[0]!.stages.length} days and the Umbel, the human's seat a heuristic\n`];
  L.push(`## Time and the save (Node, one process an event)\n\n| stage | format | wall time (field included) | the save after it |\n|---|---|---|---|`);
  const days = Math.max(...rows.map((r) => r.stages.length));
  for (let k = 0; k < days; k++) { const st = rows.map((r) => r.stages[k]!).filter(Boolean); L.push(`| ${k + 1} | ${st[0]?.formatId} | ${Math.round(mean(st.map((x) => x.ms)) / 1000)} s | ${Math.round(mean(st.map((x) => x.saveBytes)) / 1024)} KB |`); }
  L.push(`| the Umbel | | ${Math.round(mean(rows.map((r) => r.bracketMs)) / 1000)} s | ${Math.round(mean(rows.map((r) => r.finalSaveBytes)) / 1024)} KB at the finish |`);
  L.push(`\nWhole event: ${Math.round(mean(rows.map((r) => r.totalMs)) / 1000)} s. Rematches: ${rows.reduce((n, r) => n + r.rematches, 0)} in ${rows.length} events. Draft-round pairings outside their pod: ${rows.reduce((n, r) => n + r.podViolations, 0)}. The human's finishes: ${rows.map((r) => r.humanPlace).join(", ")}.`);
  // does the record find the strong seats?
  const seatRows = rows.flatMap((r) => r.places.map((place, s) => ({ place, q: r.stages.map((st) => pctile(st.quality, s)) })));
  const dk = [...Array(days).keys()];
  L.push(`\n## Does the carried record find the strong seats?\n\nA seat's deck quality in a stage is its percentile in the field (0 the weakest deck, 1 the strongest), by the stage's own score.\n\n| finish | seats | ${dk.map((k) => `Day ${k + 1}`).join(" | ")} | mean |\n|---|---|${dk.map(() => "---|").join("")}---|`);
  const band = (lo: number, hi: number, label: string) => { const xs = seatRows.filter((x) => x.place >= lo && x.place <= hi); L.push(`| ${label} | ${xs.length} | ${dk.map((k) => mean(xs.map((x) => x.q[k] ?? 0)).toFixed(2)).join(" | ")} | ${mean(xs.map((x) => mean(x.q))).toFixed(2)} |`); };
  band(1, 1, "the champion"); band(2, 8, "2nd–8th (the Umbel)"); band(9, 32, "9th–32nd"); band(33, 64, "33rd–64th"); band(65, seats, `65th–${seats}th`);
  L.push(`\nA seat's mean deck percentile against its finish (lower is better): r = ${corr(seatRows.map((x) => mean(x.q)), seatRows.map((x) => x.place)).toFixed(2)}. Each day alone: ${dk.map((k) => `Day ${k + 1} r = ${corr(seatRows.map((x) => x.q[k] ?? 0), seatRows.map((x) => x.place)).toFixed(2)}`).join(" · ")}.`);
  // S54 (ADR-158): the Umbel's eight against the field's median (0.5), and the finish by the seat's strength
  const umbel = seatRows.filter((x) => x.place <= 8), umbelQ = mean(umbel.map((x) => mean(x.q)));
  L.push(`\nThe Umbel's eight: mean deck percentile ${umbelQ.toFixed(2)} (the field's median 0.50; the brief wants it above).`);
  const strengthRows = rows.flatMap((r) => r.places.map((place, s) => ({ place, s, ...(r.strength?.[s] ?? {}) }))).filter((x) => x.s !== 0);
  const finishBy = (label: string, xs: { place: number }[]) => `| ${label} | ${xs.length} | ${mean(xs.map((x) => x.place)).toFixed(1)} | ${(100 * xs.filter((x) => x.place <= 8).length / Math.max(1, xs.length)).toFixed(1)}% | ${(100 * xs.filter((x) => x.place <= seats / 4).length / Math.max(1, xs.length)).toFixed(0)}% |`;
  L.push(`\n## The finish by the seat's strength (the AI seats)\n\nEvery pilot is master (ADR-158 as amended). The builder shapes the Constructed decks, the noise the Limited ones. An even field finishes ${((seats + 1) / 2).toFixed(1)} on average, ${(800 / seats).toFixed(1)}% in the Umbel.\n\n| strength | seats | mean finish | in the Umbel | top quarter |\n|---|---|---|---|---|`);
  for (const b of ["stock", "light", "heavy"]) L.push(finishBy(`builder ${b}`, strengthRows.filter((x) => x.builder === b)));
  for (const n of [0, 0.2, 0.4]) L.push(finishBy(`noise σ ${n}`, strengthRows.filter((x) => x.noise === n)));
  // S55 (ADR-158 amended): the list draw, and the list's own measured strength against the finish
  for (const l of ["top", "any", "low"]) { const xs = strengthRows.filter((x) => (x as { lists?: string }).lists === l); if (xs.length) L.push(finishBy(`list draw ${l}`, xs)); }
  const lm = rows.flatMap((r) => (r.listMeans ?? []).map((m, s) => ({ m, place: r.places[s]!, s }))).filter((x) => x.s !== 0 && x.m > 0);
  if (lm.length) L.push(`\nA seat's list (its measured Open mean) against its finish: r = ${corr(lm.map((x) => x.m), lm.map((x) => x.place)).toFixed(2)} over ${lm.length} seats. The Umbel's eight hold lists averaging ${mean(lm.filter((x) => x.place <= 8).map((x) => x.m)).toFixed(1)}; the field ${mean(lm.map((x) => x.m)).toFixed(1)}.`);
  const text = L.join("\n");
  writeFileSync(join(ROOT, `analysis/runs/${arg("report-name", "convocation_sim")}.md`), text + "\n");
  console.log(text);
}

if (process.argv.includes("--report")) report(); else await play();
