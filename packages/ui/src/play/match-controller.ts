import { ArrayLog, SeededRng } from "@shandalar/core";
import type { CardDef, ResolvedTarget } from "@shandalar/cards";
import {
  DEFAULT_RULES,
  Game,
  deriveFacts,
  expandDecklist,
  stableStringify,
  validateDecklist,
  type Action,
  type ActionRequest,
  type ActionSource,
  type Agent,
  type GameView,
  type MatchResult,
  type MatchSpec,
  type PlayerId,
  type Step,
} from "@shandalar/engine";
import {
  DelayedAgent,
  HeuristicAgent,
  HumanAgent,
  difficultyProfile,
  type Difficulty,
} from "@shandalar/agents";
import { DECKS, DECK_ARCHETYPES, type DeckKey } from "@shandalar/sim/decks";

/**
 * MatchController (S10, ADR-058): the play-mode brain. Owns the live Game,
 * the HumanAgent promise bridge, and the interaction state machine that turns
 * DecisionRequests into UI phases (priority / targeting / staging / dialogs).
 *
 * Deliberately React-free: the acceptance test drives exactly the same event
 * path the UI's clicks drive (clickHand, clickBattlefield, confirm, …).
 * The UI subscribes via onChange and re-renders from `game.ctx`.
 *
 * ADR-058 invariants honored here:
 * - Auto-pass only priority windows with no meaningful action (no cast /
 *   activation / land in the enumerated set), unless a per-step stop or an
 *   armed hold-priority pauses anyway. All non-priority requests pause.
 * - Combat staging is UI-local until Confirm; the engine's incremental
 *   declare actions are then streamed, and committed actions are final.
 * - Every legality question is answered by the enumerated action set —
 *   nothing is re-derived in the UI.
 */

export interface MatchOptions {
  humanSeat: PlayerId;
  humanDeck: DeckKey;
  aiDeck: DeckKey;
  difficulty: Difficulty;
  /** Omit for a random seed (it is generated once and displayed). */
  seed?: number;
  /** Per-AI-decision pacing delay; live-tunable. Default 400ms. */
  aiDelayMs?: number;
}

export type UiPhase =
  | { kind: "waiting" } // engine running / AI thinking
  | {
      kind: "priority";
      /** hand objectId → its castSpell variants */
      castable: Map<string, Action[]>;
      /** hand objectId → its playLand action */
      lands: Map<string, Action>;
      /** battlefield objectId → its activateAbility variants (all abilities) */
      activatable: Map<string, Action[]>;
      canPass: boolean;
    }
  | {
      kind: "chooseX";
      sourceObjectId: string;
      xs: number[];
      variants: Action[];
    }
  | {
      kind: "targeting";
      sourceObjectId: string;
      variants: Action[];
      chosen: ResolvedTarget[];
      /** Legal next targets, from the surviving variants. */
      highlightObjects: Set<string>;
      highlightPlayers: Set<PlayerId>;
      targetsNeeded: number;
    }
  | { kind: "confirmCast"; sourceObjectId: string; action: Action }
  | { kind: "attackers"; eligible: Set<string>; staged: Set<string> }
  | {
      kind: "blockers";
      /** blocker → attackers it may block (from the offered pairs) */
      options: Map<string, Set<string>>;
      stagedPairs: { blocker: string; attacker: string }[];
      pendingBlocker: string | null;
      /** True when the engine withholds "done" (menace pair owed). */
      mustAddBlocker: boolean;
    }
  | { kind: "dialog"; request: ActionRequest; view: GameView; selected: number | null }
  | { kind: "gameOver"; result: MatchResult };

export class MatchController {
  readonly game: Game;
  readonly log = new ArrayLog<Action>();
  readonly spec: MatchSpec;
  readonly seed: number;
  readonly humanSeat: PlayerId;
  aiDelayMs: number;

  /** Per-step stops (persisted by the UI in localStorage). */
  stops = new Set<Step>();
  /** Hold-priority: armed for the next own window (set by the toggle / per-cast modifier). */
  holdArmed = false;

  phase: UiPhase = { kind: "waiting" };
  result: MatchResult | null = null;
  /** Every object id ever seen → its cardId (CR 400.7 re-ids; play-log names). */
  readonly idNames = new Map<string, string>();
  /** Last spell to hit the stack (S10 playtest: the inspector snaps to it). */
  snapCardId: string | null = null;
  /** Transient combat narration (S10 playtest: with no legal blockers there is
   * no pause, so an incoming attack could resolve invisibly — narrate it). */
  combatNotice: string | null = null;
  private noticeTimer: ReturnType<typeof setTimeout> | null = null;

  private human = new HumanAgent();
  private conceding = false;
  private runPromise: Promise<MatchResult> | null = null;
  private listeners = new Set<() => void>();
  /** Queue of staged declarations being streamed after a combat Confirm. */
  private declQueue: Action[] | null = null;
  /** Last own-turn anchor stop already shown ("turn:step") — anchors pause once. */
  private anchorSeen: string | null = null;

  constructor(
    private readonly pool: Map<string, CardDef>,
    opts: MatchOptions,
  ) {
    this.humanSeat = opts.humanSeat;
    this.aiDelayMs = opts.aiDelayMs ?? 400;
    this.seed = opts.seed ?? Math.floor(Math.random() * 1_000_000);

    const humanPlayer = { name: "You", decklist: [...DECKS[opts.humanDeck].decklist], agent: "human" };
    const aiPlayer = {
      name: DECKS[opts.aiDeck].name,
      decklist: [...DECKS[opts.aiDeck].decklist],
      agent: `heuristic:${opts.difficulty}`,
    };
    this.spec = {
      seed: this.seed,
      players: opts.humanSeat === 0 ? [humanPlayer, aiPlayer] : [aiPlayer, humanPlayer],
      rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 100 },
      modifiers: [],
    };
    for (const p of this.spec.players) validateDecklist(pool, p.decklist);

    const aiInner = new HeuristicAgent(
      this.seed * 2 + 7,
      pool,
      difficultyProfile(opts.difficulty, DECK_ARCHETYPES[opts.aiDeck], [...DECKS[opts.humanDeck].decklist]),
    );
    const delayed = new DelayedAgent(aiInner, () => (this.conceding ? 0 : this.aiDelayMs));
    const ai: Agent = {
      chooseAction: async (view: GameView, request: ActionRequest): Promise<Action> => {
        const a = await delayed.chooseAction(view, request);
        this.emit(); // play-by-play: re-render after each AI decision
        return a;
      },
    };

    this.human.onRequest = (view, request) => this.onHumanRequest(view, request);
    const agents: [Agent, Agent] = opts.humanSeat === 0 ? [this.human, ai] : [ai, this.human];
    const rng = new SeededRng(this.seed, this.log);
    const source: ActionSource = (req, view) => agents[req.player].chooseAction(view, req);
    const decklists: [string[], string[]] = [
      expandDecklist(this.spec.players[0].decklist),
      expandDecklist(this.spec.players[1].decklist),
    ];
    this.game = new Game(pool, decklists, rng, this.log, source, {
      startingLife: 20,
      handSize: 7,
      maxTurns: DEFAULT_RULES.maxTurns,
    });

    // Dev handle for debugging live matches from the console.
    (globalThis as { __mc?: MatchController }).__mc = this;

    // Combat visibility (S10 playtest): re-render on step changes so the lane
    // paints during auto-resolved combat, and narrate incoming attacks/damage
    // that produce no human pause (ADR-014 auto-takes pass-only windows).
    const bus = this.game.ctx.bus;
    // Objects get fresh ids on every zone move (CR 400.7); track every id's
    // cardId from live ZONE_CHANGE events so the play log can name historical
    // actions. (Display-side masking keeps hidden info hidden.)
    bus.on("ZONE_CHANGE", (e) => {
      this.idNames.set(e.oldId, e.cardId);
      this.idNames.set(e.newId, e.cardId);
    });
    bus.on("STEP_BEGIN", () => this.emit());
    bus.on("SPELL_CAST", (e) => {
      this.snapCardId = e.cardId; // inspector snap — event-driven, so it fires
      this.emit(); //              even when the spell resolves render-free
    });
    bus.on("ATTACKERS_DECLARED", (e) => {
      const state = this.game.state;
      if (state.activePlayer === this.humanSeat) return; // your own attack is visible by construction
      const names = e.attackers
        .map((id) => state.objects[id])
        .filter((o): o is NonNullable<typeof o> => !!o)
        .map((o) => pool.get(o.cardId)?.name ?? o.cardId);
      if (names.length > 0) this.showNotice(`Opponent attacks with ${names.join(", ")}`);
    });
    bus.on("DAMAGE", (e) => {
      if (e.target.kind === "player" && e.target.player === this.humanSeat && e.combat) {
        this.showNotice(`You take ${e.amount} combat damage (${pool.get(e.sourceCardId)?.name ?? e.sourceCardId})`);
      }
    });
  }

  private showNotice(text: string): void {
    this.combatNotice = this.combatNotice && this.noticeTimer ? `${this.combatNotice} · ${text}` : text;
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => {
      this.combatNotice = null;
      this.noticeTimer = null;
      this.emit();
    }, 4000);
    this.emit();
  }

  // ---------- lifecycle ----------

  start(): Promise<MatchResult> {
    if (this.runPromise) return this.runPromise;
    this.runPromise = this.game
      .run(this.spec.modifiers)
      .then(() => this.finish())
      .catch((e) => {
        // Concede unwinds by resolving pending requests after result is set;
        // anything else is a real bug worth surfacing.
        if (!this.conceding) throw e;
        return this.finish();
      });
    return this.runPromise;
  }

  private finish(): MatchResult {
    const state = this.game.state;
    const r = state.result ?? { winner: null, reason: "DRAW" as const };
    this.result = {
      winner: r.winner,
      reason: r.reason,
      turns: state.turn,
      finalLife: [state.players[0].life, state.players[1].life],
      log: this.log.entries,
      facts: deriveFacts(this.pool, this.log.entries),
      finalStateSerialized: stableStringify(state),
    };
    this.phase = { kind: "gameOver", result: this.result };
    this.emit();
    return this.result;
  }

  /** ADR-058 match shell: concession (UI confirms first). Sets the result and
   * drains the current/next requests with first-choice actions so the engine
   * loop reaches its result check and unwinds. */
  concede(): void {
    if (this.result || this.conceding) return;
    this.conceding = true;
    this.game.state.result = { winner: (this.humanSeat === 0 ? 1 : 0) as PlayerId, reason: "CONCEDE" };
    const pending = this.human.current();
    if (pending) this.human.submit(pending.request.actions[0]!);
  }

  /** Saved-game payload for the viewer route / download (shandalar-log-v1). */
  savedGame(): string {
    if (!this.result) throw new Error("match not finished");
    return JSON.stringify(
      {
        format: "shandalar-log-v1",
        spec: this.spec,
        result: {
          winner: this.result.winner,
          reason: this.result.reason,
          turns: this.result.turns,
          finalLife: this.result.finalLife,
        },
        log: this.result.log,
      },
      null,
      1,
    );
  }

  // ---------- subscription ----------

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  // ---------- request intake ----------

  private onHumanRequest(view: GameView, request: ActionRequest): void {
    if (this.conceding) {
      this.human.submit(request.actions[0]!);
      return;
    }
    // Streaming a confirmed combat stage: answer from the queue.
    if (this.declQueue) {
      this.streamDeclarations(request);
      return;
    }
    switch (request.purpose) {
      case "priority":
        this.enterPriority(view, request);
        return;
      case "declareAttacker":
        this.enterAttackers(request);
        return;
      case "declareBlocker":
        this.enterBlockers(request);
        return;
      default:
        this.phase = { kind: "dialog", request, view, selected: null };
        this.emit();
    }
  }

  private currentRequest(): ActionRequest {
    const p = this.human.current();
    if (!p) throw new Error("no pending request");
    return p.request;
  }

  private submit(action: Action): void {
    this.phase = { kind: "waiting" };
    this.human.submit(action);
    this.emit();
  }

  // ---------- priority (ADR-058 auto-pass) ----------

  /** Steps that always pause on the human's own turn (S10 playtest: Chris
   * wants main phases and end step as fixed anchors, not opt-in stops). */
  private static OWN_TURN_STOPS: ReadonlySet<string> = new Set(["MAIN1", "MAIN2", "END"]);

  private enterPriority(view: GameView, request: ActionRequest): void {
    const castable = new Map<string, Action[]>();
    const lands = new Map<string, Action>();
    const activatable = new Map<string, Action[]>();
    for (const a of request.actions) {
      if (a.type === "castSpell") castable.set(a.objectId, [...(castable.get(a.objectId) ?? []), a]);
      else if (a.type === "playLand") lands.set(a.objectId, a);
      else if (a.type === "activateAbility") activatable.set(a.objectId, [...(activatable.get(a.objectId) ?? []), a]);
    }
    // R-029 dedups hand actions by cardId, so only one copy of a duplicate
    // carries the action. Alias every copy in hand to the enumerated one:
    // all Islands glow, clicking any of them plays the enumerated Island.
    // (S10 playtest: "I'm not able to play some of the Islands.")
    const byCardId = new Map(view.hand.map((c) => [c.objectId, c.cardId]));
    for (const { objectId, cardId } of view.hand) {
      if (!lands.has(objectId)) {
        const twin = [...lands.keys()].find((id) => byCardId.get(id) === cardId);
        if (twin) lands.set(objectId, lands.get(twin)!);
      }
      if (!castable.has(objectId)) {
        const twin = [...castable.keys()].find((id) => byCardId.get(id) === cardId);
        if (twin) castable.set(objectId, castable.get(twin)!);
      }
    }
    const meaningful = castable.size > 0 || lands.size > 0 || activatable.size > 0;
    const anchorKey = `${view.turn}:${view.step}`;
    const ownTurnAnchor =
      view.activePlayer === request.player &&
      MatchController.OWN_TURN_STOPS.has(view.step) &&
      this.anchorSeen !== anchorKey;
    const stopHere = this.stops.has(view.step as Step) || this.holdArmed || ownTurnAnchor;
    if (!meaningful && !stopHere) {
      const pass = request.actions.find((a) => a.type === "pass");
      if (pass) {
        this.human.submit(pass);
        return; // no phase change, no flicker
      }
    }
    if (ownTurnAnchor) this.anchorSeen = anchorKey;
    this.holdArmed = false; // consumed by pausing
    this.phase = { kind: "priority", castable, lands, activatable, canPass: request.actions.some((a) => a.type === "pass") };
    this.emit();
  }

  pass(): void {
    if (this.phase.kind !== "priority") return;
    const pass = this.currentRequest().actions.find((a) => a.type === "pass");
    if (pass) this.submit(pass);
  }

  clickHand(objectId: string): void {
    if (this.phase.kind !== "priority") return;
    const land = this.phase.lands.get(objectId);
    if (land) {
      this.submit(land); // lands are single actions; played on click (documented)
      return;
    }
    const variants = this.phase.castable.get(objectId);
    if (variants && variants.length > 0) this.beginCast(objectId, variants);
  }

  clickBattlefield(objectId: string): void {
    if (this.phase.kind === "attackers") {
      this.toggleAttacker(objectId);
      return;
    }
    if (this.phase.kind === "blockers") {
      this.clickBlockerOrAttacker(objectId);
      return;
    }
    if (this.phase.kind === "targeting") {
      this.clickTarget({ kind: "object", id: objectId });
      return;
    }
    if (this.phase.kind !== "priority") return;
    const variants = this.phase.activatable.get(objectId);
    if (variants && variants.length > 0) this.beginCast(objectId, variants);
  }

  clickPlayer(player: PlayerId): void {
    if (this.phase.kind === "targeting") this.clickTarget({ kind: "player", player });
  }

  // ---------- casting: X → targets → confirm ----------

  private beginCast(sourceObjectId: string, variants: Action[]): void {
    const xs = [...new Set(variants.map((v) => (v as { x?: number }).x).filter((x): x is number => x !== undefined))];
    if (xs.length > 1) {
      this.phase = { kind: "chooseX", sourceObjectId, xs: xs.sort((a, b) => a - b), variants };
      this.emit();
      return;
    }
    this.enterTargeting(sourceObjectId, variants);
  }

  chooseX(x: number): void {
    if (this.phase.kind !== "chooseX") return;
    const remaining = this.phase.variants.filter((v) => (v as { x?: number }).x === x);
    this.enterTargeting(this.phase.sourceObjectId, remaining);
  }

  private enterTargeting(sourceObjectId: string, variants: Action[]): void {
    const first = variants[0] as { targets?: ResolvedTarget[] };
    const needed = first.targets?.length ?? 0;
    if (needed === 0 || variants.length === 1) {
      this.phase = { kind: "confirmCast", sourceObjectId, action: variants[0]! };
      this.emit();
      return;
    }
    this.phase = {
      kind: "targeting",
      sourceObjectId,
      variants,
      chosen: [],
      ...this.nextTargetHighlights(variants, 0),
      targetsNeeded: needed,
    };
    this.emit();
  }

  private nextTargetHighlights(
    variants: Action[],
    position: number,
  ): { highlightObjects: Set<string>; highlightPlayers: Set<PlayerId> } {
    const objects = new Set<string>();
    const players = new Set<PlayerId>();
    for (const v of variants) {
      const t = (v as { targets?: ResolvedTarget[] }).targets?.[position];
      if (!t) continue;
      if (t.kind === "object") objects.add(t.id);
      else if (t.kind === "player") players.add(t.player as PlayerId);
      else objects.add(t.id); // stack items highlight in the stack panel
    }
    return { highlightObjects: objects, highlightPlayers: players };
  }

  private clickTarget(target: ResolvedTarget): void {
    if (this.phase.kind !== "targeting") return;
    const pos = this.phase.chosen.length;
    const matches = this.phase.variants.filter((v) => {
      const t = (v as { targets?: ResolvedTarget[] }).targets?.[pos];
      return t && JSON.stringify(t) === JSON.stringify(target);
    });
    if (matches.length === 0) return; // illegal click: ignore (dimmed in UI)
    const chosen = [...this.phase.chosen, target];
    if (chosen.length >= this.phase.targetsNeeded || matches.length === 1) {
      this.phase = { kind: "confirmCast", sourceObjectId: this.phase.sourceObjectId, action: matches[0]! };
      this.emit();
      return;
    }
    this.phase = {
      ...this.phase,
      variants: matches,
      chosen,
      ...this.nextTargetHighlights(matches, chosen.length),
    };
    this.emit();
  }

  /** Confirm the staged cast; `hold` arms hold-priority for the follow-up window (ADR-058). */
  confirmCast(hold = false): void {
    if (this.phase.kind !== "confirmCast") return;
    this.holdArmed = hold;
    this.submit(this.phase.action);
  }

  cancel(): void {
    // Back out of any local staging to the pending request's base phase.
    const p = this.human.current();
    if (!p) return;
    this.onHumanRequest(p.view, p.request);
  }

  // ---------- combat staging (ADR-058: local until Confirm, then final) ----------

  private enterAttackers(request: ActionRequest): void {
    const eligible = new Set(
      request.actions.filter((a) => a.type === "declareAttacker").map((a) => (a as { objectId: string }).objectId),
    );
    const staged = this.phase.kind === "attackers" ? this.phase.staged : new Set<string>();
    if (eligible.size === 0 && staged.size === 0) {
      // Nothing can attack: auto-done, no pause.
      const done = request.actions.find((a) => a.type === "doneDeclaringAttackers");
      if (done) {
        this.human.submit(done);
        return;
      }
    }
    this.phase = { kind: "attackers", eligible, staged };
    this.emit();
  }

  private toggleAttacker(objectId: string): void {
    if (this.phase.kind !== "attackers") return;
    if (!this.phase.eligible.has(objectId) && !this.phase.staged.has(objectId)) return;
    const staged = new Set(this.phase.staged);
    if (staged.has(objectId)) staged.delete(objectId);
    else staged.add(objectId);
    this.phase = { ...this.phase, staged };
    this.emit();
  }

  confirmAttackers(): void {
    if (this.phase.kind !== "attackers") return;
    const queue: Action[] = [...this.phase.staged].map((objectId) => ({ type: "declareAttacker", objectId }));
    this.declQueue = queue;
    this.phase = { kind: "waiting" };
    this.streamDeclarations(this.currentRequest());
    this.emit();
  }

  private enterBlockers(request: ActionRequest): void {
    const options = new Map<string, Set<string>>();
    for (const a of request.actions) {
      if (a.type !== "declareBlocker") continue;
      const set = options.get(a.blocker) ?? new Set<string>();
      set.add(a.attacker);
      options.set(a.blocker, set);
    }
    const done = request.actions.some((a) => a.type === "doneDeclaringBlockers");
    const stagedPairs = this.phase.kind === "blockers" ? this.phase.stagedPairs : [];
    if (options.size === 0 && done && stagedPairs.length === 0) {
      // No legal blocks at all: auto-done, no pause.
      this.human.submit(request.actions.find((a) => a.type === "doneDeclaringBlockers")!);
      return;
    }
    this.phase = { kind: "blockers", options, stagedPairs, pendingBlocker: null, mustAddBlocker: !done };
    this.emit();
  }

  private clickBlockerOrAttacker(objectId: string): void {
    if (this.phase.kind !== "blockers") return;
    const { options, stagedPairs, pendingBlocker } = this.phase;
    // Clicking a staged blocker un-stages its pair (local, pre-confirm).
    const stagedIdx = stagedPairs.findIndex((p) => p.blocker === objectId);
    if (stagedIdx !== -1) {
      const next = [...stagedPairs];
      next.splice(stagedIdx, 1);
      this.phase = { ...this.phase, stagedPairs: next, pendingBlocker: null };
      this.emit();
      return;
    }
    if (options.has(objectId)) {
      this.phase = { ...this.phase, pendingBlocker: objectId === pendingBlocker ? null : objectId };
      this.emit();
      return;
    }
    if (pendingBlocker && options.get(pendingBlocker)?.has(objectId)) {
      this.phase = {
        ...this.phase,
        stagedPairs: [...stagedPairs, { blocker: pendingBlocker, attacker: objectId }],
        pendingBlocker: null,
      };
      this.emit();
    }
  }

  confirmBlocks(): void {
    if (this.phase.kind !== "blockers") return;
    const queue: Action[] = this.phase.stagedPairs.map((p) => ({
      type: "declareBlocker",
      blocker: p.blocker,
      attacker: p.attacker,
    }));
    this.declQueue = queue;
    this.phase = { kind: "waiting" };
    this.streamDeclarations(this.currentRequest());
    this.emit();
  }

  /** Feed staged declarations to the engine one request at a time, then done.
   * If "done" is withheld after the queue drains (menace pair owed), fall
   * back to the blockers phase so the player adds the second blocker. */
  private streamDeclarations(request: ActionRequest): void {
    const queue = this.declQueue!;
    while (queue.length > 0) {
      const next = queue[0]!;
      const offered = request.actions.find((a) => JSON.stringify(a) === JSON.stringify(next));
      if (!offered) break; // shouldn't happen: enumerator re-offers independent declarations
      queue.shift();
      this.human.submit(offered);
      return; // the next request re-enters streamDeclarations
    }
    const done = request.actions.find(
      (a) => a.type === "doneDeclaringAttackers" || a.type === "doneDeclaringBlockers",
    );
    this.declQueue = null;
    if (done) {
      this.human.submit(done);
      return;
    }
    // Menace: a second blocker is owed. Re-enter staging with what's offered.
    this.onHumanRequest(this.human.current()!.view, request);
  }

  // ---------- dialogs ----------

  selectDialog(index: number): void {
    if (this.phase.kind !== "dialog") return;
    this.phase = { ...this.phase, selected: index };
    this.emit();
  }

  confirmDialog(): void {
    if (this.phase.kind !== "dialog" || this.phase.selected === null) return;
    const action = this.phase.request.actions[this.phase.selected];
    if (action) this.submit(action);
  }
}
