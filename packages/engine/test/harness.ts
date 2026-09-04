import { ArrayLog, SeededRng } from "@shandalar/core";
import { loadCardPool } from "@shandalar/cards/loader";
import { validateCard, type CardDef, type ResolvedTarget } from "@shandalar/cards";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  Game,
  createObject,
  getObject,
  type Action,
  type ActionRequest,
  type ActionSource,
  type PlayerId,
  type Step,
} from "../src/index.js";

const CARDS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards");

/**
 * Synthetic test cards (brief Part 3.4: the activated-ability path is
 * exercised with a synthetic ability; fixture 8 needs a first striker, which
 * the slice pool deliberately lacks). These exist only in tests.
 */
const TEST_CARDS: CardDef[] = [
  {
    // S20 solver fixtures: bare two-pip costs to force colored assignment.
    id: "test_wu_spell",
    name: "Test WU Spell",
    source: "custom",
    text: "",
    manaCost: "{W}{U}",
    types: ["Sorcery"],
    spellEffect: [{ type: "gainLife", amount: 1, who: "you" }],
    art: { fallback: "rendered" },
  },
  {
    id: "test_ub_spell",
    name: "Test UB Spell",
    source: "custom",
    text: "",
    manaCost: "{U}{B}",
    types: ["Sorcery"],
    spellEffect: [{ type: "gainLife", amount: 1, who: "you" }],
    art: { fallback: "rendered" },
  },
  {
    id: "test_fs_soldier",
    name: "Test First-Strike Soldier",
    source: "custom",
    text: "",
    manaCost: "{1}{W}",
    types: ["Creature"],
    subtypes: ["Soldier"],
    power: 2,
    toughness: 1,
    keywords: ["first strike"],
    art: { fallback: "rendered" },
  },
  {
    // Mass destroy for dies-trigger fixtures (Wrath itself is M3; the
    // resolver is real, the card is not in the pool).
    id: "test_wrath",
    name: "Test Wrath",
    source: "custom",
    text: "",
    manaCost: "{2}",
    types: ["Sorcery"],
    spellEffect: [{ type: "destroyAll", scope: "allCreatures" }],
    art: { fallback: "rendered" },
  },
  {
    // Goblin with a DIES trigger, for the sacrifice-cost trigger fixture (S3-2).
    id: "test_goblin_martyr",
    name: "Test Goblin Martyr",
    source: "custom",
    text: "",
    manaCost: "{R}",
    types: ["Creature"],
    subtypes: ["Goblin"],
    power: 1,
    toughness: 1,
    abilities: [
      {
        kind: "triggered",
        event: "DIES",
        condition: { self: true },
        effects: [{ type: "draw", count: 1, who: "you" }],
        optional: false,
      },
    ],
    art: { fallback: "rendered" },
  },
  {
    // Pyroclasm-style mass damage (the real card is M3; hexproof fixture needs the behavior).
    id: "test_pyroclasm",
    name: "Test Pyroclasm",
    source: "custom",
    text: "",
    manaCost: "{1}{R}",
    types: ["Sorcery"],
    spellEffect: [{ type: "damageAll", amount: 2, scope: "allCreatures" }],
    art: { fallback: "rendered" },
  },
  {
    // S15: a Lotus-shaped mana ability on an artifact WITH a DIES trigger, to
    // prove sacrifice-as-cost ordering (mana first, trigger at the next check).
    id: "test_lotus_martyr",
    name: "Test Lotus Martyr",
    source: "custom",
    text: "",
    manaCost: "{0}",
    types: ["Artifact"],
    abilities: [
      { kind: "activated", cost: { tap: true, sacrifice: { predicate: "self" } }, effects: [{ type: "addMana", choice: { count: 3, anyOneColor: true } }] },
      { kind: "triggered", event: "DIES", condition: { self: true }, effects: [{ type: "draw", count: 1, who: "you" }], optional: false },
    ],
    art: { fallback: "rendered" },
  },
  {
    // S15: any-card search to the battlefield, so a searched ETB creature's trigger can be asserted.
    id: "test_summon_from_library",
    name: "Test Summon From Library",
    source: "custom",
    text: "",
    manaCost: "{1}",
    types: ["Sorcery"],
    spellEffect: [{ type: "searchLibrary", predicate: "anyCard", to: "battlefield" }],
    art: { fallback: "rendered" },
  },
  {
    id: "test_pinger",
    name: "Test Pinger",
    source: "custom",
    text: "",
    manaCost: "{2}",
    types: ["Creature"],
    subtypes: ["Wizard"],
    power: 1,
    toughness: 1,
    abilities: [
      {
        kind: "activated",
        cost: { mana: "{1}", tap: true },
        targets: [{ count: 1, predicate: "anyTarget", zone: "any" }],
        effects: [{ type: "damage", amount: 1, target: 0 }],
      },
    ],
    art: { fallback: "rendered" },
  },
];

let cachedPool: Map<string, CardDef> | null = null;

export function testPool(): Map<string, CardDef> {
  if (!cachedPool) {
    const pool = loadCardPool(CARDS_DIR);
    for (const card of TEST_CARDS) {
      const { errors } = validateCard(card);
      if (errors.length > 0) throw new Error(`Test card invalid: ${errors.join("; ")}`);
      pool.cards.set(card.id, card);
    }
    cachedPool = pool.cards;
  }
  return cachedPool;
}

// ---------- Fixture format ----------

export type TargetDesc = { object: string } | { player: number } | { spell: string } | { graveyard: string };

export type ScriptEntry =
  | { player: PlayerId; do: "cast"; card: string; targets?: TargetDesc[]; x?: number; mode?: number }
  | { player: PlayerId; do: "playLand"; card: string }
  /** Declarative multi-step: staged one declareAttacker/declareBlocker at a time, consumed when complete. */
  | { player: PlayerId; do: "attack"; attackers: string[] }
  | { player: PlayerId; do: "block"; blocks: { blocker: string; attacker: string }[] }
  | { player: PlayerId; do: "activate"; card: string; abilityIndex: number; targets?: TargetDesc[]; x?: number; color?: "W" | "U" | "B" | "R" | "G"; colors?: ("W" | "U" | "B" | "R" | "G")[] }
  /** S28 (Brainstorm): one pick of the put-on-top loop (the first pick ends on top). */
  | { player: PlayerId; do: "putOnTop"; card: string }
  | { player: PlayerId; do: "chooseTriggerTargets"; targets: TargetDesc[] }
  | { player: PlayerId; do: "orderTrigger"; card: string }
  | { player: PlayerId; do: "sacrificeChoice"; card: string }
  | { player: PlayerId; do: "optional"; accept: boolean }
  | { player: PlayerId; do: "keepLegend"; card: string }
  | { player: PlayerId; do: "orderBlocker"; blocker: string }
  | { player: PlayerId; do: "bottom"; card: string }
  | { player: PlayerId; do: "discard"; card: string }
  /** ADR-068: take this card from the search candidates, or decline (card omitted). */
  | { player: PlayerId; do: "search"; card?: string }
  /** A6 (S17): pick a mode for a modal trigger as it goes on the stack. */
  | { player: PlayerId; do: "chooseMode"; mode: number }
  /** A10 (S22): pick the permanent bounced to pay a returnToHand cost (the Unwinder). */
  | { player: PlayerId; do: "bounceCost"; card: string }
  /** A10 (S22): pick the untapped creature tapped to pay a tapCreature cost (Glare). */
  | { player: PlayerId; do: "tapCost"; card: string }
  /** A10 (S22): one pick of the any-number cast loop (Purge)… */
  | { player: PlayerId; do: "pickTarget"; target: TargetDesc }
  /** …and its explicit close. */
  | { player: PlayerId; do: "doneTargets" }
  /** S22 (the S3 first-legal-moment lesson, harness form): an explicit pass barrier — the next
   * entry cannot bind before this player passes once. Use when a later cast must wait for
   * something on the stack to resolve. */
  | { player: PlayerId; do: "pass" };

export interface BattlefieldEntry {
  card: string;
  attachedTo?: string;
  tapped?: boolean;
  summoningSick?: boolean;
  /** Create as a token (ceases to exist on leaving the battlefield). */
  token?: boolean;
  /** S26: preset counters (Clio's depth; +1/+1) — a standing board may already hold them. */
  counters?: Record<string, number>;
}

export interface FixturePlayerSetup {
  life?: number;
  battlefield?: (string | BattlefieldEntry)[];
  hand?: string[];
  library?: string[];
  graveyard?: string[];
}

export interface FixtureSpec {
  name: string;
  setup: {
    turn?: number;
    active?: PlayerId;
    step?: Step;
    players: [FixturePlayerSetup, FixturePlayerSetup];
  };
  script?: ScriptEntry[];
  /** Phases to run after setup: a priority round, or a sequence of steps. */
  run?: ({ priority: true } | { steps: Step[] })[];
}

// ---------- Harness ----------

export class TestGame {
  readonly game: Game;
  readonly log = new ArrayLog<Action>();
  private script: ScriptEntry[] = [];
  /** Script entries that were matched and executed. */
  readonly consumed: ScriptEntry[] = [];
  /** Every DecisionRequest the engine issued (for asserting purposes/reveals). */
  readonly requests: ActionRequest[] = [];

  constructor(spec: FixtureSpec) {
    const source: ActionSource = (req) => {
      this.requests.push(req);
      return Promise.resolve(this.decide(req));
    };
    this.game = new Game(testPool(), [[], []], new SeededRng(1, this.log), this.log, source);
    this.script = [...(spec.script ?? [])];

    const { state } = this.game;
    const setup = spec.setup;
    state.turn = setup.turn ?? 3;
    state.activePlayer = setup.active ?? 0;
    state.step = setup.step ?? "MAIN1";

    for (const player of [0, 1] as PlayerId[]) {
      const p = setup.players[player];
      if (p.life !== undefined) state.players[player].life = p.life;
      for (const cardId of p.library ?? []) createObject(this.game.ctx, cardId, player, "library");
      for (const cardId of p.hand ?? []) createObject(this.game.ctx, cardId, player, "hand");
      for (const cardId of p.graveyard ?? []) createObject(this.game.ctx, cardId, player, "graveyard");
    }
    // Battlefield after other zones so attachedTo can reference either side.
    for (const player of [0, 1] as PlayerId[]) {
      for (const entry of setup.players[player].battlefield ?? []) {
        const e: BattlefieldEntry = typeof entry === "string" ? { card: entry } : entry;
        const id = createObject(this.game.ctx, e.card, player, "battlefield", {
          ...(e.attachedTo ? { attachedTo: this.findBattlefield(e.attachedTo) } : {}),
          ...(e.token ? { isToken: true } : {}),
        });
        const obj = getObject(state, id);
        obj.tapped = e.tapped ?? obj.tapped; // A9 (S20): createObject may have set tapped (entersChoice put path) — only an explicit fixture flag overrides
        obj.summoningSick = e.summoningSick ?? false; // fixtures default to attack-ready
        if (e.counters) obj.counters = { ...e.counters };
      }
    }
    // Setup-time ETB events are scenery, not triggers: fixtures describe a
    // board state, not cards entering it.
    state.pendingTriggers = [];
  }

  async run(spec: FixtureSpec): Promise<void> {
    for (const phase of spec.run ?? [{ priority: true }]) {
      if ("priority" in phase) await this.game.priorityRound();
      else for (const step of phase.steps) await this.game.runStep(step);
    }
  }

  // ---------- lookups ----------

  findBattlefield(cardId: string): string {
    const id = this.game.state.battlefield.find((i) => getObject(this.game.state, i).cardId === cardId);
    if (!id) throw new Error(`No ${cardId} on battlefield`);
    return id;
  }

  battlefieldCardIds(): string[] {
    return this.game.state.battlefield.map((i) => getObject(this.game.state, i).cardId);
  }

  handCardIds(player: PlayerId): string[] {
    return this.game.state.players[player].hand.map((i) => getObject(this.game.state, i).cardId);
  }

  graveyardCardIds(player: PlayerId): string[] {
    return this.game.state.players[player].graveyard.map((i) => getObject(this.game.state, i).cardId);
  }

  private resolveTargetDesc(d: TargetDesc): ResolvedTarget {
    if ("object" in d) return { kind: "object", id: this.findBattlefield(d.object) };
    if ("player" in d) return { kind: "player", player: d.player };
    if ("graveyard" in d) {
      for (const p of [0, 1] as PlayerId[]) {
        const id = this.game.state.players[p].graveyard.find(
          (i) => getObject(this.game.state, i).cardId === d.graveyard,
        );
        if (id) return { kind: "object", id };
      }
      throw new Error(`No ${d.graveyard} in either graveyard`);
    }
    const item = this.game.state.stack.find((s) => s.sourceCardId === d.spell);
    if (!item) throw new Error(`No ${d.spell} on the stack`);
    return { kind: "stackItem", id: item.id };
  }

  // ---------- scripted decisions ----------

  /**
   * Consume attack/block entries whose declarations were completed by a
   * forced (single-option, silent) action that never reached decide().
   */
  gcScript(): void {
    for (;;) {
      const head = this.script[0];
      if (!head) return;
      const state = this.game.state;
      const cardIdOf = (objectId: string) => getObject(state, objectId).cardId;
      let satisfied = false;
      if (head.do === "attack") {
        satisfied = TestGame.missing(head.attackers, state.combat.attackers.map(cardIdOf)).length === 0;
      } else if (head.do === "block") {
        const staged = state.combat.blocks.map((b) => `${cardIdOf(b.blocker)}->${cardIdOf(b.attacker)}`);
        satisfied = TestGame.missing(head.blocks.map((b) => `${b.blocker}->${b.attacker}`), staged).length === 0;
      }
      if (!satisfied) return;
      this.script.shift();
      this.consumed.push(head);
    }
  }

  private decide(req: ActionRequest): Action {
    this.gcScript();
    const head = this.script[0];
    if (head && head.player === req.player) {
      const match = this.matchAction(head, req.actions);
      if (match) {
        if (match.consume) {
          this.script.shift();
          this.consumed.push(head);
        }
        return match.action;
      }
    }
    // Default: pass for priority; first listed action (done declaring /
    // keep hand / first card) everywhere else.
    return req.actions[0]!;
  }

  /** Multiset difference: entries of `wanted` not yet present in `have`. */
  private static missing(wanted: string[], have: string[]): string[] {
    const pool = [...have];
    return wanted.filter((w) => {
      const i = pool.indexOf(w);
      if (i === -1) return true;
      pool.splice(i, 1);
      return false;
    });
  }

  private matchAction(entry: ScriptEntry, actions: Action[]): { action: Action; consume: boolean } | null {
    const state = this.game.state;
    const cardIdOf = (objectId: string) => getObject(state, objectId).cardId;
    const one = (action: Action | undefined): { action: Action; consume: boolean } | null =>
      action ? { action, consume: true } : null;

    switch (entry.do) {
      case "cast": {
        const wanted = (entry.targets ?? []).map((t) => this.resolveTargetDesc(t));
        return one(
          actions.find(
            (a) =>
              a.type === "castSpell" &&
              cardIdOf(a.objectId) === entry.card &&
              a.x === entry.x &&
              a.mode === entry.mode &&
              JSON.stringify(a.targets) === JSON.stringify(wanted),
          ),
        );
      }
      case "playLand":
        return one(actions.find((a) => a.type === "playLand" && cardIdOf(a.objectId) === entry.card));
      case "attack": {
        // Stage the next wanted attacker; consume the entry with the last one.
        const staged = state.combat.attackers.map(cardIdOf);
        const missing = TestGame.missing(entry.attackers, staged);
        const next = missing[0];
        if (next === undefined) return null;
        const action = actions.find((a) => a.type === "declareAttacker" && cardIdOf(a.objectId) === next);
        return action ? { action, consume: missing.length === 1 } : null;
      }
      case "block": {
        const staged = state.combat.blocks.map((b) => `${cardIdOf(b.blocker)}->${cardIdOf(b.attacker)}`);
        const wanted = entry.blocks.map((b) => `${b.blocker}->${b.attacker}`);
        const missing = TestGame.missing(wanted, staged);
        const next = missing[0];
        if (next === undefined) return null;
        const [blockerCard, attackerCard] = next.split("->");
        const action = actions.find(
          (a) =>
            a.type === "declareBlocker" &&
            cardIdOf(a.blocker) === blockerCard &&
            cardIdOf(a.attacker) === attackerCard,
        );
        return action ? { action, consume: missing.length === 1 } : null;
      }
      case "activate": {
        const wanted = (entry.targets ?? []).map((t) => this.resolveTargetDesc(t));
        return one(
          actions.find(
            (a) =>
              a.type === "activateAbility" &&
              cardIdOf(a.objectId) === entry.card &&
              a.abilityIndex === entry.abilityIndex &&
              a.x === entry.x &&
              a.color === entry.color &&
              JSON.stringify(a.colors) === JSON.stringify(entry.colors) &&
              JSON.stringify(a.targets) === JSON.stringify(wanted),
          ),
        );
      }
      case "chooseTriggerTargets": {
        const wanted = entry.targets.map((t) => this.resolveTargetDesc(t));
        return one(
          actions.find((a) => a.type === "chooseTriggerTargets" && JSON.stringify(a.targets) === JSON.stringify(wanted)),
        );
      }
      case "orderTrigger":
        return one(actions.find((a) => a.type === "orderTrigger" && a.cardId === entry.card));
      case "sacrificeChoice":
        return one(actions.find((a) => a.type === "sacrifice" && cardIdOf(a.objectId) === entry.card));
      case "optional":
        return one(actions.find((a) => a.type === (entry.accept ? "acceptOptional" : "declineOptional")));
      case "keepLegend":
        return one(actions.find((a) => a.type === "keepLegend" && cardIdOf(a.objectId) === entry.card));
      case "orderBlocker":
        return one(actions.find((a) => a.type === "orderBlocker" && cardIdOf(a.blocker) === entry.blocker));
      case "bottom":
        return one(actions.find((a) => a.type === "bottomCard" && cardIdOf(a.objectId) === entry.card));
      case "discard":
        return one(actions.find((a) => a.type === "discard" && cardIdOf(a.objectId) === entry.card));
      case "putOnTop":
        return one(actions.find((a) => a.type === "putOnTop" && cardIdOf(a.objectId) === entry.card));
      case "search":
        return entry.card
          ? one(actions.find((a) => a.type === "searchPick" && cardIdOf(a.objectId) === entry.card))
          : one(actions.find((a) => a.type === "declineSearch"));
      case "chooseMode":
        return one(actions.find((a) => a.type === "chooseMode" && a.mode === entry.mode));
      case "bounceCost":
        return one(actions.find((a) => a.type === "returnToHand" && cardIdOf(a.objectId) === entry.card));
      case "tapCost":
        return one(actions.find((a) => a.type === "tapCreature" && cardIdOf(a.objectId) === entry.card));
      case "pickTarget": {
        const wanted = this.resolveTargetDesc(entry.target);
        return one(actions.find((a) => a.type === "chooseVariableTarget" && JSON.stringify(a.target) === JSON.stringify(wanted)));
      }
      case "doneTargets":
        return one(actions.find((a) => a.type === "doneChoosingTargets"));
      case "pass":
        return one(actions.find((a) => a.type === "pass"));
    }
  }
}

export async function runFixture(spec: FixtureSpec): Promise<TestGame> {
  const tg = new TestGame(spec);
  await tg.run(spec);
  tg.gcScript();
  if (tg.consumed.length !== (spec.script ?? []).length) {
    const missed = (spec.script ?? []).slice(tg.consumed.length);
    throw new Error(`Fixture "${spec.name}": ${missed.length} script entries never matched: ${JSON.stringify(missed)}`);
  }
  return tg;
}
