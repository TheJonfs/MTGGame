/**
 * S53 (Part 4): a full Convocation played headless — the human's seat taken by the pick rule, the builder and a
 * heuristic agent, every phase driven through the event's own functions (the controller's path, without the
 * screens). The test's and the measure's runner. `step` sees the event after every transition (the save-and-resume
 * test serializes there).
 */
import type { CardDef } from "@shandalar/cards";
import { buildLimitedDeck } from "./limited-builder.js";
import type { LibraryList } from "./constructed-builder.js";
import { limitedView } from "./rating.js";
import {
  advanceBracket, advanceEvent, bracketRound, bracketRoundComplete, closeRound, draftStep, eventFormat, nextStage, pairingOf, playBracketFieldRound, playFieldRound, playSeriesHeadless,
  recordBracketSeries, recordSeries, registerDeck, registerDecklist, suggestedConstructedDeck, suggestedPick, type ConvocationEvent, type EventDeps, type SeatAgents, type SeriesDeps,
} from "./event.js";

export interface HeadlessDeps extends EventDeps { knobs: SeriesDeps["knobs"]; library: readonly LibraryList[] }

/** One transition of the event as the human's seat would make it. */
export async function stepHeadless(e: ConvocationEvent, deps: HeadlessDeps, agents: SeatAgents, cards: Map<string, CardDef> = deps.cards): Promise<ConvocationEvent> {
  const sdeps: SeriesDeps = { cards, knobs: deps.knobs, rating: deps.rating };
  switch (e.phase) {
    case "draft": return draftStep(e, suggestedPick(e, deps), deps);
    case "build": {
      const deck = eventFormat(e.formatId).kind === "constructed" ? suggestedConstructedDeck(e, deps.library, deps) : buildLimitedDeck(e.field[0]!.pool, limitedView(deps.rating), cards).deck;
      const r = e.registering?.length ? registerDecklist(e, deck, deps, deps.library) : registerDeck(e, 0, deck, cards); // S53: the decklists come first
      if (!r.ok) throw new Error(`headless: the suggested deck is refused (${r.problems.join("; ")})`);
      return r.event;
    }
    case "round": {
      let x = e;
      const mine = pairingOf(x, 0);
      if (mine && mine.b !== null && !x.results.some((r) => r.round === x.round && r.a === 0)) x = recordSeries(x, 0, mine.b, await playSeriesHeadless(x, 0, mine.b, sdeps, agents));
      return closeRound(await playFieldRound(x, sdeps, agents));
    }
    case "standings": return advanceEvent(e);
    case "interlude": return nextStage(e, deps, deps.library);
    case "bracket": {
      let x = e;
      const mine = bracketRound(x).find((m) => m.a === 0 && m.winner === undefined);
      if (mine) x = recordBracketSeries(x, 0, mine.b, await playSeriesHeadless(x, 0, mine.b, sdeps, agents));
      x = await playBracketFieldRound(x, sdeps, agents);
      return bracketRoundComplete(x) ? advanceBracket(x) : x;
    }
    case "over": return e;
  }
}

/** Play the event to its end; `step` sees every state (return a replacement to test a save and resume). */
export async function runHeadless(event: ConvocationEvent, deps: HeadlessDeps, agents: SeatAgents, step: (e: ConvocationEvent) => ConvocationEvent | void = () => {}): Promise<ConvocationEvent> {
  let e = event;
  for (let guard = 0; e.phase !== "over" && guard < 100_000; guard++) { e = await stepHeadless(e, deps, agents); e = step(e) ?? e; }
  return e;
}
