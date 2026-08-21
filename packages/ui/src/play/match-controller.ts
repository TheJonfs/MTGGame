import { ArrayLog, SeededRng } from "@shandalar/core";
import { manaValue, parseManaCost, type CardDef, type ResolvedTarget } from "@shandalar/cards";
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
  type Modifier,
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

/** S12 (Part 2b): an explicit duel — what the overworld hands the play
 * client (ADR-002 consumed from the world side): named decklists, the enemy's
 * AI profile inputs, world-life starting life, ante, and modifiers. */
export interface CustomMatch {
  human: { name: string; decklist: { cardId: string; count: number }[] };
  enemy: {
    name: string;
    decklist: { cardId: string; count: number }[];
    difficulty: Difficulty;
    archetype: "aggro" | "midrange" | "control";
    portrait?: string;
  };
  rules: { startingLife: number; ante: number };
  modifiers: Modifier[];
}

export interface MatchOptions {
  humanSeat: PlayerId;
  /** Slice-deck form (setup screen). Ignored when `custom` is given. */
  humanDeck?: DeckKey;
  aiDeck?: DeckKey;
  difficulty?: Difficulty;
  /** Explicit-spec form (the overworld's duel handoff). */
  custom?: CustomMatch;
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
  | {
      kind: "confirmCast";
      sourceObjectId: string;
      action: Action;
      /** S11 (Chris's note 5): surplus mana exists — offer manual tapping. */
      offerManualTap: boolean;
    }
  | {
      /** S11 manual tapping: click lands (tapForMana) to float mana, then cast.
       * Auto-pay covers only the remaining shortfall, pool first. */
      kind: "manualTap";
      sourceObjectId: string;
      action: Action;
      tappable: Set<string>;
    }
  | {
      /** S11 (Chris's note 2): the opponent's spell is on the stack and you
       * have no response — pause anyway so it doesn't fly by. */
      kind: "stackStop";
      view: GameView;
    }
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
  /** S13: display names per seat (the world's enemy names; "You"/deck name otherwise). */
  readonly names: [string, string];
  /** S13: portrait image per seat (world opponents carry one); null = default art. */
  readonly portraits: [string | null, string | null];

  /** Per-step stops (persisted by the UI in localStorage). */
  stops = new Set<Step>();
  /** Hold-priority: armed for the next own window (set by the toggle / per-cast modifier). */
  holdArmed = false;
  /** S11: pause whenever the opponent casts a spell, even with no response
   * (default on; menu toggle, persisted by the UI). */
  stopOnOpponentSpells = true;
  /** S12 rider (S11 concern 4): pause at declare blockers even when no block is
   * legal (menace/flying) while I control any untapped creature — so an
   * unblockable attack is seen, not auto-skipped. Default off; Chris to trial. */
  pauseBlockersWithUntapped = false;
  /** Why the current pause happened, for the prompt ("Opponent cast X"). */
  stopReason: string | null = null;
  /** Opponent stack items already paused for (stack ids are unique per item). */
  private seenStackItems = new Set<string>();
  private stackStopResolve: (() => void) | null = null;
  /** Manual tapping in progress: the cast we will submit once mana is floated. */
  private manualTapPending: { sourceObjectId: string; action: Action } | null = null;

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
  /** Fast-forward to my next turn (ADR-059): auto-pass every priority window
   * until the human's next turn begins, any non-priority request arrives, or
   * an opponent stack item targets the human or their permanents. */
  private ff: { sinceTurn: number; wasOwnTurn: boolean } | null = null;

  constructor(
    private readonly pool: Map<string, CardDef>,
    opts: MatchOptions,
  ) {
    this.humanSeat = opts.humanSeat;
    this.aiDelayMs = opts.aiDelayMs ?? 400;
    this.seed = opts.seed ?? Math.floor(Math.random() * 1_000_000);

    const custom = opts.custom;
    if (!custom && (!opts.humanDeck || !opts.aiDeck || !opts.difficulty)) {
      throw new Error("MatchController: give either custom or humanDeck/aiDeck/difficulty");
    }
    const humanPlayer = custom
      ? { name: custom.human.name, decklist: custom.human.decklist.map((e) => ({ ...e })), agent: "human" }
      : { name: "You", decklist: [...DECKS[opts.humanDeck!].decklist], agent: "human" };
    const aiDifficulty: Difficulty = custom ? custom.enemy.difficulty : opts.difficulty!;
    const aiPlayer = custom
      ? { name: custom.enemy.name, decklist: custom.enemy.decklist.map((e) => ({ ...e })), agent: `heuristic:${aiDifficulty}` }
      : { name: DECKS[opts.aiDeck!].name, decklist: [...DECKS[opts.aiDeck!].decklist], agent: `heuristic:${aiDifficulty}` };
    const startingLife = custom ? custom.rules.startingLife : 20;
    const ante = custom ? custom.rules.ante : DEFAULT_RULES.ante;
    this.spec = {
      seed: this.seed,
      players: opts.humanSeat === 0 ? [humanPlayer, aiPlayer] : [aiPlayer, humanPlayer],
      rules: { startingLife, handSize: 7, mulligan: "london", maxTurns: 100, ante },
      modifiers: custom ? custom.modifiers.map((m) => ({ ...m })) : [],
    };
    for (const p of this.spec.players) validateDecklist(pool, p.decklist);
    this.names = [this.spec.players[0].name, this.spec.players[1].name];
    const enemyPortrait = custom?.enemy.portrait ? `/portraits/${custom.enemy.portrait}.png` : null;
    this.portraits = opts.humanSeat === 0 ? [null, enemyPortrait] : [enemyPortrait, null];

    const aiArchetype = custom ? custom.enemy.archetype : DECK_ARCHETYPES[opts.aiDeck!];
    const aiInner = new HeuristicAgent(
      this.seed * 2 + 7,
      pool,
      difficultyProfile(aiDifficulty, aiArchetype, humanPlayer.decklist.map((e) => ({ ...e }))),
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
      startingLife,
      handSize: 7,
      maxTurns: DEFAULT_RULES.maxTurns,
      ante,
    });

    // S11: observe lone-pass windows so an opponent's spell can be shown
    // before it resolves even when nobody can respond (ADR-014 auto-take).
    this.game.onLonePass = (player, view) => this.onLonePass(player, view);

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
      // S11 playtest: name each attacker's keywords — an un-pausable combat
      // (e.g. menace attackers vs one untapped blocker enumerates no legal
      // block, so ADR-014 auto-takes "done") must SAY why it couldn't be
      // blocked, not just that it happened.
      const names = e.attackers
        .map((id) => state.objects[id])
        .filter((o): o is NonNullable<typeof o> => !!o)
        .map((o) => {
          const def = pool.get(o.cardId);
          const kw = def?.keywords?.length ? ` (${def.keywords.join(", ")})` : "";
          return `${def?.name ?? o.cardId}${kw}`;
        });
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
    }, 2500); // S11 playtest: 4s lingered too long
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
    this.stackStopResolve?.();
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
    // Any non-priority request cancels fast-forward: the game needs YOU
    // (blocks, discard, triggers) — it never skips a decision.
    if (this.ff && request.purpose !== "priority") this.ff = null;
    // S11 manual tapping: after each tapForMana the engine re-asks; stay in
    // the tapping phase as long as the staged cast is still on offer.
    if (this.manualTapPending) {
      if (request.purpose === "priority" && this.resumeManualTap(request)) return;
      this.manualTapPending = null;
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
    this.stopReason = null;
    this.human.submit(action);
    this.emit();
  }

  // ---------- S11: opponent-spell stop (request path + lone-pass path) ----------

  /** First opponent-controlled spell on the stack not yet paused for. */
  private pendingOpponentSpell(): { id: string; sourceCardId: string } | null {
    if (!this.stopOnOpponentSpells) return null;
    const item = this.game.state.stack.find(
      (s) => s.kind === "spell" && s.controller !== this.humanSeat && !this.seenStackItems.has(s.id),
    );
    return item ? { id: item.id, sourceCardId: item.sourceCardId } : null;
  }

  private markStackSeen(): void {
    for (const s of this.game.state.stack) this.seenStackItems.add(s.id);
  }

  /** Engine lone-pass observation (nothing requested, nothing logged): if the
   * opponent's spell is on the stack and this is a fresh sight of it, hold the
   * engine until the player clicks Continue. */
  private async onLonePass(player: PlayerId, view: GameView): Promise<void> {
    if (player !== this.humanSeat || this.conceding || this.ff) return;
    const oppSpell = this.pendingOpponentSpell();
    if (!oppSpell) return;
    this.markStackSeen();
    this.stopReason = `Opponent cast ${this.pool.get(oppSpell.sourceCardId)?.name ?? oppSpell.sourceCardId}.`;
    this.phase = { kind: "stackStop", view };
    this.emit();
    await new Promise<void>((resolve) => {
      this.stackStopResolve = resolve;
    });
    this.stackStopResolve = null;
    this.stopReason = null;
    this.phase = { kind: "waiting" };
    this.emit();
  }

  /** Continue past a stack stop (the engine then auto-passes, as it would have). */
  continueFromStop(): void {
    this.stackStopResolve?.();
  }

  // ---------- S11: manual tapping ----------

  /** Surplus-mana rule (Chris): offer manual tapping when the cast would NOT
   * use everything available — untapped producers (the enumerated tapForMana
   * actions) plus the floating pool exceed the cost. */
  private offerManualTapFor(action: Action): boolean {
    if (action.type !== "castSpell") return false;
    const req = this.human.current()?.request;
    if (!req) return false;
    const producers = req.actions.filter((a) => a.type === "tapForMana").length;
    if (producers === 0) return false;
    const pool = this.game.state.players[this.humanSeat].manaPool;
    const floating = Object.values(pool).reduce((n, v) => n + v, 0);
    const obj = this.game.state.objects[action.objectId];
    const def = obj ? this.pool.get(obj.cardId) : undefined;
    if (!def) return false;
    const cost = manaValue(parseManaCost(def.manaCost)) + (action.x ?? 0);
    return producers + floating > cost;
  }

  private tappableNow(request: ActionRequest): Set<string> {
    return new Set(
      request.actions.filter((a) => a.type === "tapForMana").map((a) => (a as { objectId: string }).objectId),
    );
  }

  beginManualTap(): void {
    if (this.phase.kind !== "confirmCast") return;
    const { sourceObjectId, action } = this.phase;
    this.manualTapPending = { sourceObjectId, action };
    this.phase = { kind: "manualTap", sourceObjectId, action, tappable: this.tappableNow(this.currentRequest()) };
    this.emit();
  }

  /** A new priority request arrived mid-tapping: re-find the staged cast. */
  private resumeManualTap(request: ActionRequest): boolean {
    const pending = this.manualTapPending!;
    const key = JSON.stringify(pending.action);
    const offered = request.actions.find((a) => JSON.stringify(a) === key);
    if (!offered) return false;
    this.phase = { kind: "manualTap", sourceObjectId: pending.sourceObjectId, action: offered, tappable: this.tappableNow(request) };
    this.emit();
    return true;
  }

  private tapLand(objectId: string): void {
    if (this.phase.kind !== "manualTap" || !this.phase.tappable.has(objectId)) return;
    const tap = this.currentRequest().actions.find((a) => a.type === "tapForMana" && a.objectId === objectId);
    if (!tap) return;
    this.phase = { kind: "waiting" };
    this.human.submit(tap); // the next request re-enters manual tapping
    this.emit();
  }

  /** Cast the staged spell now; auto-pay covers whatever the pool lacks. */
  castNow(hold = false): void {
    if (this.phase.kind !== "manualTap") return;
    this.manualTapPending = null;
    this.holdArmed = hold;
    this.submit(this.phase.action);
  }

  // ---------- priority (ADR-058 auto-pass) ----------

  /** Steps that always pause on the human's own turn (S10 playtest: Chris
   * wants main phases and end step as fixed anchors, not opt-in stops). */
  private static OWN_TURN_STOPS: ReadonlySet<string> = new Set(["MAIN1", "MAIN2", "END"]);

  /** ADR-058/-059 "meaningful action" rule (exposed for tests): a window is
   * meaningful when it offers a land, an activation, or a cast — except a
   * cast whose only enumerated variants are X=0 (Blaze with no spare mana
   * made every window pause; ADR-059 declares it non-meaningful). */
  static isMeaningful(
    castable: Map<string, Action[]>,
    lands: Map<string, Action>,
    activatable: Map<string, Action[]>,
  ): boolean {
    const xZeroOnly = (vs: Action[]) => vs.every((v) => (v as { x?: number }).x === 0);
    return [...castable.values()].some((vs) => !xZeroOnly(vs)) || lands.size > 0 || activatable.size > 0;
  }

  private enterPriority(view: GameView, request: ActionRequest): void {
    // Fast-forward (ADR-059): pass every window until my next turn — unless
    // an opponent stack item aims at me/mine (never skips a Duress).
    if (this.ff) {
      const reachedMyTurn =
        view.activePlayer === this.humanSeat && (this.ff.wasOwnTurn ? view.turn > this.ff.sinceTurn : true);
      if (reachedMyTurn || this.stackThreatensHuman()) {
        this.ff = null;
      } else {
        const pass = request.actions.find((a) => a.type === "pass");
        if (pass) {
          this.human.submit(pass);
          return;
        }
        this.ff = null; // no pass on offer: fall back to a normal pause
      }
    }
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
    const meaningful = MatchController.isMeaningful(castable, lands, activatable);
    const anchorKey = `${view.turn}:${view.step}`;
    const ownTurnAnchor =
      view.activePlayer === request.player &&
      MatchController.OWN_TURN_STOPS.has(view.step) &&
      this.anchorSeen !== anchorKey;
    // S11: an opponent spell on the stack we haven't paused for yet stops
    // the flow (fast-forward deliberately skips this; targeting cancels FF).
    const oppSpell = this.ff ? null : this.pendingOpponentSpell();
    const stopHere = this.stops.has(view.step as Step) || this.holdArmed || ownTurnAnchor || oppSpell !== null;
    if (!meaningful && !stopHere) {
      const pass = request.actions.find((a) => a.type === "pass");
      if (pass) {
        this.human.submit(pass);
        return; // no phase change, no flicker
      }
    }
    if (ownTurnAnchor) this.anchorSeen = anchorKey;
    this.holdArmed = false; // consumed by pausing
    this.markStackSeen();
    if (oppSpell) this.stopReason = `Opponent cast ${this.pool.get(oppSpell.sourceCardId)?.name ?? oppSpell.sourceCardId}.`;
    this.phase = { kind: "priority", castable, lands, activatable, canPass: request.actions.some((a) => a.type === "pass") };
    this.emit();
  }

  pass(): void {
    if (this.phase.kind !== "priority") return;
    const pass = this.currentRequest().actions.find((a) => a.type === "pass");
    if (pass) this.submit(pass);
  }

  /** ADR-059: arm fast-forward from a paused priority window and pass it. */
  fastForwardToMyTurn(): void {
    if (this.phase.kind !== "priority") return;
    const p = this.human.current();
    if (!p) return;
    this.ff = { sinceTurn: p.view.turn, wasOwnTurn: p.view.activePlayer === this.humanSeat };
    this.pass();
  }

  get fastForwarding(): boolean {
    return this.ff !== null;
  }

  /** An opponent-controlled stack item targeting the human or a human-controlled
   * permanent (full state is fair game here — ADR-059 hidden-info honesty). */
  private stackThreatensHuman(): boolean {
    const seat = this.humanSeat;
    const state = this.game.state;
    return state.stack.some(
      (item) =>
        item.controller !== seat &&
        item.targets.some(
          (t) =>
            (t.kind === "player" && t.player === seat) ||
            (t.kind === "object" && state.objects[t.id]?.controller === seat) ||
            (t.kind === "stackItem" && state.stack.some((s) => s.id === t.id && s.controller === seat)),
        ),
    );
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
    if (this.phase.kind === "manualTap") {
      this.tapLand(objectId);
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
      this.phase = { kind: "confirmCast", sourceObjectId, action: variants[0]!, offerManualTap: this.offerManualTapFor(variants[0]!) };
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
      this.phase = { kind: "confirmCast", sourceObjectId: this.phase.sourceObjectId, action: matches[0]!, offerManualTap: this.offerManualTapFor(matches[0]!) };
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
    // (Manual tapping: floated mana stays in the pool until the step ends.)
    this.manualTapPending = null;
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
    if (options.size === 0 && done && stagedPairs.length === 0 && !(this.pauseBlockersWithUntapped && this.humanHasUntappedCreature())) {
      // No legal blocks at all: auto-done, no pause.
      this.human.submit(request.actions.find((a) => a.type === "doneDeclaringBlockers")!);
      return;
    }
    this.phase = { kind: "blockers", options, stagedPairs, pendingBlocker: null, mustAddBlocker: !done };
    this.emit();
  }

  private humanHasUntappedCreature(): boolean {
    const st = this.game.state;
    return st.battlefield.some((id) => {
      const o = st.objects[id];
      return !!o && o.controller === this.humanSeat && !o.tapped && this.pool.get(o.cardId)?.types.includes("Creature");
    });
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
