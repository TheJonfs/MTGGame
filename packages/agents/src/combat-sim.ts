import { EventBus, IdGen, NullLog, SeededRng } from "@shandalar/core";
import type { CardDef } from "@shandalar/cards";
import {
  assignCombatDamage,
  dealCombatDamage,
  initialGameState,
  runSBAs,
  type EngineCtx,
  type GameView,
  type PlayerId,
} from "@shandalar/engine";

/**
 * Combat simulation (S8 brief Part 2) — THE one seam where the agent runs
 * engine code forward. Combat is perfect-information once declared, so we
 * build a throwaway GameState from the view's public battlefield and run the
 * engine's REAL assignment/dealing functions plus SBAs on it. No rules are
 * re-implemented here.
 *
 * The synthetic pool trick: each battlefield object gets a one-off def whose
 * printed stats equal the view's LIVE characteristics, so the engine's
 * characteristics() over an empty continuous-effects list reproduces exactly
 * what both players can see. Attachments/statics are already baked into
 * those numbers by the real engine that produced the view.
 */

export interface SimObject {
  id: string;
  controller: PlayerId;
  power: number;
  toughness: number;
  keywords: string[];
  tapped: boolean;
  damage: number;
}

export interface CombatOutcome {
  /** Object ids that died in the simulated combat. */
  dead: Set<string>;
  /** Damage dealt to each player. */
  playerDamage: [number, number];
}

function simDef(o: SimObject): CardDef {
  return {
    id: `sim_${o.id}`,
    name: o.id,
    source: "custom",
    text: "",
    manaCost: "{0}",
    types: ["Creature"],
    power: o.power,
    toughness: o.toughness,
    keywords: (o.keywords ?? []) as NonNullable<CardDef["keywords"]>,
    art: { fallback: "rendered" },
  };
}

export function viewCreatures(view: GameView): SimObject[] {
  return view.battlefield
    .filter((o) => o.power !== null && o.toughness !== null)
    .map((o) => ({
      id: o.id,
      controller: o.controller,
      power: o.power!,
      toughness: o.toughness!,
      keywords: o.keywords,
      tapped: o.tapped,
      damage: o.damage,
    }));
}

/**
 * Run one combat with the given attack set and block assignment through the
 * engine's real functions. `active` is the attacking player.
 */
export async function simulateCombat(
  creatures: SimObject[],
  active: PlayerId,
  attackers: string[],
  blocks: { blocker: string; attacker: string }[],
  life: [number, number],
): Promise<CombatOutcome> {
  const state = initialGameState(20);
  state.players[0].life = life[0];
  state.players[1].life = life[1];
  state.turn = 5;
  state.activePlayer = active;
  state.step = "COMBAT_DAMAGE";

  const defs = new Map<string, CardDef>();
  for (const o of creatures) {
    const def = simDef(o);
    defs.set(def.id, def);
    state.objects[o.id] = {
      id: o.id,
      cardId: def.id,
      owner: o.controller,
      controller: o.controller,
      baseController: o.controller,
      zone: "battlefield",
      isToken: true, // dead sim objects just cease; graveyard contents don't matter here
      tapped: o.tapped,
      damage: o.damage,
      deathtouchDamage: false,
      summoningSick: false,
      attachedTo: null,
      counters: {},
    };
    state.battlefield.push(o.id);
  }

  state.combat.attackers = [...attackers];
  state.combat.blocks = blocks.map((b) => ({ ...b }));
  for (const b of blocks) state.combat.blocked[b.attacker] = true;
  // Damage order: view order (the sim's block sets are single-blocker except
  // menace pairs, where order barely matters at this depth).
  for (const a of attackers) {
    state.combat.blockOrder[a] = blocks.filter((b) => b.attacker === a).map((b) => b.blocker);
  }

  const ctx: EngineCtx = {
    state,
    defs: {
      def(cardId: string): CardDef {
        const d = defs.get(cardId);
        if (!d) throw new Error(`combat-sim: unknown ${cardId}`);
        return d;
      },
    },
    ids: new IdGen(),
    bus: new EventBus(),
    log: new NullLog(),
    rng: new SeededRng(0, new NullLog()),
  };

  const lifeBefore: [number, number] = [state.players[0].life, state.players[1].life];
  // First strike step, then regular — the real two-step pipeline.
  const before = new Set(state.battlefield);
  const fsAssignments = assignCombatDamage(ctx, true);
  dealCombatDamage(ctx, fsAssignments);
  await runSBAs(ctx);
  const regular = assignCombatDamage(ctx, false);
  dealCombatDamage(ctx, regular);
  await runSBAs(ctx);

  const dead = new Set([...before].filter((id) => !state.battlefield.includes(id)));
  return {
    dead,
    playerDamage: [lifeBefore[0] - state.players[0].life, lifeBefore[1] - state.players[1].life],
  };
}
