import type { Action, ActionRequest, Agent, GameView } from "@shandalar/engine";

/**
 * HumanAgent (S10 Part 0.1, ADR-058): the promise bridge between the engine
 * and a UI. The engine awaits `chooseAction`; the UI receives the request via
 * `onRequest` and answers with `submit(action)`. The view it forwards is the
 * engine's redacted `buildView` for this seat — the no-peeking suite guards
 * this live seam (human-path test in packages/sim).
 *
 * One request is in flight at a time by construction (the engine awaits).
 * `submit` validates against the pending request's action list so a stale or
 * hand-rolled UI action can never reach the engine.
 */
export class HumanAgent implements Agent {
  private pending: {
    view: GameView;
    request: ActionRequest;
    resolve: (a: Action) => void;
  } | null = null;

  /** UI subscription point; set before the match starts. */
  onRequest: ((view: GameView, request: ActionRequest) => void) | null = null;

  chooseAction(view: GameView, request: ActionRequest): Promise<Action> {
    return new Promise<Action>((resolve) => {
      this.pending = { view, request, resolve };
      this.onRequest?.(view, request);
    });
  }

  /** The pending request, if the engine is waiting on this seat. */
  current(): { view: GameView; request: ActionRequest } | null {
    return this.pending ? { view: this.pending.view, request: this.pending.request } : null;
  }

  /** Answer the pending request. Throws if nothing is pending or the action isn't offered. */
  submit(action: Action): void {
    const p = this.pending;
    if (!p) throw new Error("HumanAgent.submit with no pending request");
    const offered = p.request.actions.some((a) => JSON.stringify(a) === JSON.stringify(action));
    if (!offered) throw new Error(`HumanAgent.submit: action not in the pending request: ${JSON.stringify(action)}`);
    this.pending = null;
    p.resolve(action);
  }
}

/** Wraps an agent with a fixed per-decision delay so AI turns are followable
 * in the play UI (ADR-058 "thinking" pacing; default set by the UI). */
export class DelayedAgent implements Agent {
  constructor(
    private readonly inner: Agent,
    private readonly delayMs: () => number,
  ) {}

  async chooseAction(view: GameView, request: ActionRequest): Promise<Action> {
    const action = await this.inner.chooseAction(view, request);
    const ms = this.delayMs();
    if (ms > 0) await new Promise((r) => setTimeout(r, ms));
    return action;
  }
}
