/**
 * S53: the Convocation's field worker — plays ONE series of a round headless (the event's own `playSeriesHeadless`,
 * the same call the main thread makes), so a field of 128 plays its sixty-three other series across the cores. The
 * page sends the event with only the two seats filled (a series reads its seats, the round and the seed); the worker
 * holds the card pool and the rating. A series is a pure function of its seed: the result is the main thread's.
 */
import { HeuristicAgent, difficultyProfile } from "@shandalar/agents";
import { playSeriesHeadless, type ConvocationEvent, type EntranceKnobs, type SeatAgents, type SeriesState } from "@shandalar/world";
import { loadConvocationData, loadPool } from "../engine-bridge.js";

export interface FieldJob { id: number; event: ConvocationEvent; a: number; b: number; knobs: EntranceKnobs }
export type FieldOut = { type: "ready" } | { type: "done"; id: number; series: SeriesState } | { type: "error"; id: number; message: string };

const pool = loadPool();
const { rating } = loadConvocationData();
const post = (m: FieldOut) => (self as unknown as Worker).postMessage(m);
const agents: SeatAgents = (seat, opponent, seed, side) => new HeuristicAgent(seed * 2 + 1 + side, pool, difficultyProfile("master", seat.archetype, opponent.deck));

self.onmessage = async (ev: MessageEvent<FieldJob>) => {
  const job = ev.data;
  try { post({ type: "done", id: job.id, series: await playSeriesHeadless(job.event, job.a, job.b, { cards: pool, knobs: job.knobs, rating }, agents) }); }
  catch (e) { post({ type: "error", id: job.id, message: e instanceof Error ? e.message : String(e) }); }
};
post({ type: "ready" });
