/**
 * S34 (ADR-115/116/117): THE MATCHUP RESOLVER — one place that turns an opponent template into a duel's
 * enemy setup: its starting life, AI profile, entrance (basics on the battlefield before turn one — the
 * player's manalink shape, the Heart's roots path) and the ante. The difficulty mode reaches it through
 * the knobs (the tier tables carry easy / standard / hard bundles), so every caller that already holds
 * `worldKnobs(world)` gets the mode for free. Situational terms (a lair resident's bonus, empowerment,
 * the Barrage) stay in their callers and apply on top of the result. `legacyTerm` is the phase-two hook
 * (the player holds N ministers / M powers → +X) and returns zeros today; a per-road term is the same
 * shape. The Corolla (heartLife, the petals, the roots) does not go through here.
 */
import type { Modifier } from "@shandalar/engine";
import type { EnemyTier, KnobValues } from "./knobs.js";
import type { OpponentTemplate, Difficulty } from "./catalog.js";
import type { Legacy } from "./corolla.js";
import { MAGE_DECKS } from "@shandalar/sim/mage-decks";

export interface Matchup {
  life: number;
  profile: Difficulty;
  /** Basics on the enemy's battlefield before turn one, in the mage's pip order (`primaryColors`). */
  entrance: string[];
  ante: number;
}
/** The phase-two hook's shape: what the player's profile (the Legacy — cuttings, victories) costs the enemy's setup. */
export interface LegacyTerm { lifeDelta: number; entranceDelta: number }

const BASIC_OF: Record<string, string> = { W: "plains", U: "island", B: "swamp", R: "mountain", G: "forest" };

/** Phase two fills this ("the player holds N ministers / M powers → +X"); zeros today (ADR-115). */
export function legacyTerm(_legacy: Legacy | null | undefined, _opponent: OpponentTemplate): LegacyTerm {
  return { lifeDelta: 0, entranceDelta: 0 };
}

/** The entrance basics for a mage deck ref: its colours in pip order (`primaryColors`, a data field on the
 * mage row, sync-tested against the pool's pip counts), one basic each, repeating for a mono mage. */
export function entranceFor(deck: string, count: number): string[] {
  if (count <= 0) return [];
  const key = deck.startsWith("mage:") ? deck.slice(5) : null;
  const colours = key && MAGE_DECKS[key] ? [...MAGE_DECKS[key].primaryColors] : [];
  if (colours.length === 0) return [];
  return Array.from({ length: count }, (_, i) => BASIC_OF[colours[i % colours.length]!]!);
}

export function resolveMatchup(opponent: OpponentTemplate, knobs: KnobValues, legacy: Legacy | null = null): Matchup {
  const tier = opponent.tier as EnemyTier;
  const term = legacyTerm(legacy, opponent);
  const isMage = (opponent.kind ?? "mage") === "mage";
  const baseLife = isMage ? knobs.mageTierLife[tier] : opponent.worldLife + knobs.beastTierLifeDelta[tier];
  const life = Math.max(1, baseLife + (opponent.worldLifeOffset ?? 0) + term.lifeDelta);
  const basics = isMage ? Math.max(0, knobs.mageTierEntrance[tier] + term.entranceDelta) : 0;
  return { life, profile: opponent.difficulty, entrance: entranceFor(opponent.deck as string, basics), ante: knobs.anteCount };
}

/** The entrance as engine modifiers on the enemy seat. */
export function entranceModifiers(m: Matchup, player: 0 | 1 = 1): Modifier[] {
  return m.entrance.map((cardId) => ({ type: "permanentOnBattlefield" as const, player, cardId }));
}
