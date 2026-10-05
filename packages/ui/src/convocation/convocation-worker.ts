/**
 * S53: the Convocation's field worker — plays ONE series of a round headless (the event's own `playSeriesHeadless`,
 * the same call the main thread makes), so a field of 128 plays its sixty-three other series across the cores. The
 * page sends the event with only the two seats filled (a series reads its seats, the round and the seed); the worker
 * holds the card pool and the rating. A series is a pure function of its seed: the result is the main thread's.
 * S54 (Concern 6): it also drafts a pod headless at a draft stage's start (the event's `stagePodDrafts` names the
 * pods and their seeds) — sixteen pods of eight across the cores instead of one after another on the page.
 */
import { HeuristicAgent, difficultyProfile } from "@shandalar/agents";
import { limitedView, playSeriesHeadless, runDraftPacks, type ConvocationEvent, type EntranceKnobs, type SeatAgents, type SeriesState } from "@shandalar/world";
import { loadConvocationData, loadPool } from "../engine-bridge.js";

export interface SeriesJob { kind: "series"; id: number; event: ConvocationEvent; a: number; b: number; knobs: EntranceKnobs }
export interface DraftJob { kind: "draft"; id: number; seed: number; setId: string; recipeId: string; packs: number; seats: number }
export type FieldJob = SeriesJob | DraftJob;
export type FieldOut = { type: "ready" } | { type: "done"; id: number; series: SeriesState } | { type: "drafted"; id: number; picks: string[][] } | { type: "error"; id: number; message: string };

const pool = loadPool();
const { rating, packs } = loadConvocationData();
const draftRating = limitedView(rating);
const post = (m: FieldOut) => (self as unknown as Worker).postMessage(m);
const agents: SeatAgents = (seat, opponent, seed, side) => new HeuristicAgent(seed * 2 + 1 + side, pool, difficultyProfile("master", seat.archetype, opponent.deck, seat.deck));

self.onmessage = async (ev: MessageEvent<FieldJob>) => {
  const job = ev.data;
  try {
    if (job.kind === "draft") {
      const set = packs.sets.find((x) => x.id === job.setId), recipe = packs.recipes.find((r) => r.id === job.recipeId);
      if (!set || !recipe) throw new Error(`no set ${job.setId} or recipe ${job.recipeId}`);
      post({ type: "drafted", id: job.id, picks: runDraftPacks(set, recipe, packs, pool, draftRating, job.seed, job.seats, job.packs) });
    } else post({ type: "done", id: job.id, series: await playSeriesHeadless(job.event, job.a, job.b, { cards: pool, knobs: job.knobs, rating }, agents) });
  }
  catch (e) { post({ type: "error", id: job.id, message: e instanceof Error ? e.message : String(e) }); }
};
post({ type: "ready" });
