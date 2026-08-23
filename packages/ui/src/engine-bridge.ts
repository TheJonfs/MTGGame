/// <reference types="vite/client" />
/**
 * The viewer's only source of truth is the engine (S6 brief Part 0.2): a
 * saved log is reconstructed via replayToDecision for any decision index.
 * Nothing here re-implements a single rule.
 */
import { catalogFrom as catalogFromJson } from "@shandalar/world";
import { asCardDef } from "@shandalar/cards";
import { EventBus, IdGen, NullLog, SeededRng, type ActionLogEntry } from "@shandalar/core";
import { cardColors, type CardDef } from "@shandalar/cards";
import {
  expandDecklist,
  replayToDecision,
  type Action,
  type DecisionPoint,
  type EngineCtx,
  type GameState,
  type MatchSpec,
} from "@shandalar/engine";

export interface SavedGame {
  format: string;
  spec: MatchSpec;
  result: { winner: 0 | 1 | null; reason: string; turns: number; finalLife: [number, number] };
  log: ActionLogEntry<Action>[];
}

/** Card pool bundled at build time from data/cards/. */
export function loadPool(): Map<string, CardDef> {
  const modules = import.meta.glob("../../../data/cards/**/*.json", { eager: true }) as Record<
    string,
    { default: CardDef }
  >;
  const pool = new Map<string, CardDef>();
  for (const mod of Object.values(modules)) {
    const def = asCardDef(mod.default); // A5: compiles `cycling` like the node loader does
    pool.set(def.id, def);
  }
  return pool;
}

/** Oracle data written by `pnpm art:fetch` (absent until it has run). */
export interface OracleEntry {
  scryfallId: string;
  set: string;
  set_name: string;
  collector_number: string;
  artist: string;
  mana_cost: string;
  type_line: string;
  oracle_text: string;
}

export async function loadOracle(): Promise<Record<string, OracleEntry>> {
  try {
    const resp = await fetch("/real-art/oracle.json");
    if (!resp.ok) return {};
    return (await resp.json()) as Record<string, OracleEntry>;
  } catch {
    return {};
  }
}

/** Minimal EngineCtx over a replayed state, for characteristics() and friends. */
export function viewCtx(state: GameState, pool: Map<string, CardDef>): EngineCtx {
  return {
    state,
    defs: {
      def(cardId: string): CardDef {
        const d = pool.get(cardId);
        if (!d) throw new Error(`Unknown cardId ${cardId}`);
        return d;
      },
    },
    ids: new IdGen(),
    bus: new EventBus(),
    log: new NullLog(),
    rng: new SeededRng(0, new NullLog()),
  };
}

export interface DecisionIndexInfo {
  turn: number;
  step: string;
  player: number;
}

export class ReplaySession {
  readonly decisions: DecisionIndexInfo[];
  readonly total: number;
  private cache = new Map<number, DecisionPoint>();
  private decklists: [string[], string[]];
  /** Wall-clock ms spent in the most recent uncached replay (perf telemetry for the handoff). */
  lastReplayMs = 0;

  constructor(
    readonly game: SavedGame,
    readonly pool: Map<string, CardDef>,
  ) {
    if (game.format !== "shandalar-log-v1") throw new Error(`Unknown log format: ${game.format}`);
    this.decisions = game.log
      .filter((e) => e.t === "ACTION")
      .map((e) => ({ turn: e.turn, step: e.step, player: e.player }));
    this.total = this.decisions.length;
    this.decklists = [
      expandDecklist(game.spec.players[0].decklist),
      expandDecklist(game.spec.players[1].decklist),
    ];
  }

  async at(index: number): Promise<DecisionPoint> {
    const clamped = Math.max(0, Math.min(index, this.total));
    const hit = this.cache.get(clamped);
    if (hit) return hit;
    const t0 = performance.now();
    const point = await replayToDecision(
      this.pool,
      this.decklists,
      this.game.log,
      clamped,
      {
        startingLife: this.game.spec.rules.startingLife,
        handSize: this.game.spec.rules.handSize,
        maxTurns: this.game.spec.rules.maxTurns,
        ante: this.game.spec.rules.ante ?? 0,
      },
      this.game.spec.modifiers,
    );
    this.lastReplayMs = performance.now() - t0;
    this.cache.set(clamped, point);
    return point;
  }

  /** Index of the next/previous decision in a different (turn, step). */
  stepJump(from: number, dir: 1 | -1): number {
    const cur = this.decisions[Math.min(from, this.total - 1)];
    if (!cur) return dir === 1 ? this.total : 0;
    let i = from + dir;
    while (i > 0 && i < this.total) {
      const d = this.decisions[i]!;
      if (d.turn !== cur.turn || d.step !== cur.step) break;
      i += dir;
    }
    return Math.max(0, Math.min(i, this.total));
  }
}

/** Effective colors for the frame's wash band. */
export function frameColors(def: CardDef): string[] {
  if (def.types.includes("Land")) return ["LAND"];
  const colors = cardColors(def);
  return colors.length > 0 ? colors : ["C"];
}


/** S13: the world catalog, bundled like the card pool (data/world/*.json). */
export function loadWorldCatalog(): import("@shandalar/world").Catalog {
  const modules = import.meta.glob("../../../data/world/*.json", { eager: true }) as Record<string, { default: unknown }>;
  const byName = (name: string): unknown => {
    const key = Object.keys(modules).find((k) => k.endsWith(`/${name}.json`));
    if (!key) throw new Error(`data/world/${name}.json not bundled`);
    return modules[key]!.default;
  };
  // Lazy require keeps the viewer bundle free of world code until /world is opened.
  return catalogFromJson({ regions: byName("regions"), towns: byName("towns"), opponents: byName("opponents"), starters: byName("starters") });
}
