import { ArrayLog, SeededRng } from "@shandalar/core";
import { loadCardPool, validateCard, type CardDef, type ResolvedTarget } from "@shandalar/cards";
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
    id: "test_fs_soldier",
    name: "Test First-Strike Soldier",
    source: "custom",
    manaCost: "{1}{W}",
    types: ["Creature"],
    subtypes: ["Soldier"],
    power: 2,
    toughness: 1,
    keywords: ["first strike"],
    art: { fallback: "rendered" },
  },
  {
    id: "test_pinger",
    name: "Test Pinger",
    source: "custom",
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

export type TargetDesc = { object: string } | { player: number } | { spell: string };

export type ScriptEntry =
  | { player: PlayerId; do: "cast"; card: string; targets?: TargetDesc[] }
  | { player: PlayerId; do: "playLand"; card: string }
  | { player: PlayerId; do: "attack"; attackers: string[] }
  | { player: PlayerId; do: "block"; blocks: { blocker: string; attacker: string }[] }
  | { player: PlayerId; do: "activate"; card: string; abilityIndex: number; targets?: TargetDesc[] }
  | { player: PlayerId; do: "chooseTriggerTargets"; targets: TargetDesc[] }
  | { player: PlayerId; do: "discard"; card: string };

export interface BattlefieldEntry {
  card: string;
  attachedTo?: string;
  tapped?: boolean;
  summoningSick?: boolean;
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

  constructor(spec: FixtureSpec) {
    const source: ActionSource = (req) => Promise.resolve(this.decide(req));
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
        });
        const obj = getObject(state, id);
        obj.tapped = e.tapped ?? false;
        obj.summoningSick = e.summoningSick ?? false; // fixtures default to attack-ready
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
    const item = this.game.state.stack.find((s) => s.sourceCardId === d.spell);
    if (!item) throw new Error(`No ${d.spell} on the stack`);
    return { kind: "stackItem", id: item.id };
  }

  // ---------- scripted decisions ----------

  private decide(req: ActionRequest): Action {
    const head = this.script[0];
    if (head && head.player === req.player) {
      const match = this.matchAction(head, req.actions);
      if (match) {
        this.script.shift();
        this.consumed.push(head);
        return match;
      }
    }
    // Default: pass for priority; first listed action (no attacks / no blocks /
    // keep hand) everywhere else.
    return req.actions[0]!;
  }

  private matchAction(entry: ScriptEntry, actions: Action[]): Action | null {
    const state = this.game.state;
    const cardIdOf = (objectId: string) => getObject(state, objectId).cardId;

    switch (entry.do) {
      case "cast": {
        const wanted = (entry.targets ?? []).map((t) => this.resolveTargetDesc(t));
        return (
          actions.find(
            (a) =>
              a.type === "castSpell" &&
              cardIdOf(a.objectId) === entry.card &&
              JSON.stringify(a.targets) === JSON.stringify(wanted),
          ) ?? null
        );
      }
      case "playLand":
        return actions.find((a) => a.type === "playLand" && cardIdOf(a.objectId) === entry.card) ?? null;
      case "attack": {
        const wanted = [...entry.attackers].sort();
        return (
          actions.find(
            (a) =>
              a.type === "declareAttackers" &&
              JSON.stringify(a.attackers.map(cardIdOf).sort()) === JSON.stringify(wanted),
          ) ?? null
        );
      }
      case "block": {
        const wanted = [...entry.blocks]
          .map((b) => `${b.blocker}->${b.attacker}`)
          .sort();
        return (
          actions.find(
            (a) =>
              a.type === "declareBlockers" &&
              JSON.stringify(a.blocks.map((b) => `${cardIdOf(b.blocker)}->${cardIdOf(b.attacker)}`).sort()) ===
                JSON.stringify(wanted),
          ) ?? null
        );
      }
      case "activate": {
        const wanted = (entry.targets ?? []).map((t) => this.resolveTargetDesc(t));
        return (
          actions.find(
            (a) =>
              a.type === "activateAbility" &&
              cardIdOf(a.objectId) === entry.card &&
              a.abilityIndex === entry.abilityIndex &&
              JSON.stringify(a.targets) === JSON.stringify(wanted),
          ) ?? null
        );
      }
      case "chooseTriggerTargets": {
        const wanted = entry.targets.map((t) => this.resolveTargetDesc(t));
        return (
          actions.find(
            (a) => a.type === "chooseTriggerTargets" && JSON.stringify(a.targets) === JSON.stringify(wanted),
          ) ?? null
        );
      }
      case "discard":
        return actions.find((a) => a.type === "discard" && cardIdOf(a.objectId) === entry.card) ?? null;
    }
  }
}

export async function runFixture(spec: FixtureSpec): Promise<TestGame> {
  const tg = new TestGame(spec);
  await tg.run(spec);
  if (tg.consumed.length !== (spec.script ?? []).length) {
    const missed = (spec.script ?? []).slice(tg.consumed.length);
    throw new Error(`Fixture "${spec.name}": ${missed.length} script entries never matched: ${JSON.stringify(missed)}`);
  }
  return tg;
}
