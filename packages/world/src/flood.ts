import type { CardDef } from "@shandalar/cards";
import type { MatchResult, MatchSpec, Modifier } from "@shandalar/engine";
import type { Catalog, StarterArchetype, StarterDecklist } from "./catalog.js";
import { validateDeckRule, type DeckRule } from "./legality.js";
import { sealsHeld, type StrongholdContentDef, type LordColor } from "./stronghold.js";
import type { KnobValues } from "./knobs.js";
import type { WorldRng } from "./rng.js";
import { activeDeck, type WorldState } from "./state.js";
import { addToCollection, deckLegal, forfeitCards, recordDuel } from "./journey.js";
import { manalinkModifiers } from "./quests.js";

/**
 * S41 (ADR-128/129/130): the flood's ten seats — phase two's content (data/world/flood.json). Five
 * STRONGHOLDS (the lords; the phase-one stronghold machinery with phase-two content — a phase-two world's
 * stronghold sites resolve here) and five COURTS (the ministers, each on its High Ground in the Calyx — a
 * single duel at the site, the petal's shape without the flower). The ten lists live in the same file,
 * generated from docs/phase-two-legends-working.md §8 and pinned to it by a sync test.
 */

export interface FloodDeckDef { name: string; seat: string; archetype: StarterArchetype; decklist: StarterDecklist }

/** A phase-two stronghold: the phase-one content shape plus the triad (the colour gate and the prize picker's
 * reach) and the pair's two golds (they join the flood's shops when the seat falls). */
export interface FloodStrongholdDef extends StrongholdContentDef {
  triad: LordColor[];
  golds: [string, string];
}

/** A court on its High Ground. `color` is the LAW's colour (the law stands on the seat's side); `pair` is the
 * court's two colours — the two shores its island sits between. */
export interface FloodCourtDef {
  id: string;
  name: string;
  color: LordColor;
  pair: [LordColor, LordColor];
  minister: { key: string; name: string; cardId: string; life: number; portrait: string; gender?: "he" | "she" };
  law: { cardId: string; name: string; text: string };
  /** The High Ground's card id — on the seat's battlefield for the fight; the prize when it falls. */
  ground: string;
  deckRule?: DeckRule;
}

export interface FloodDef {
  decks: Record<string, FloodDeckDef>;
  strongholds: FloodStrongholdDef[];
  courts: FloodCourtDef[];
}

const COLORS: readonly LordColor[] = ["W", "U", "B", "R", "G"];

/** Catalog validation (the S21 pack lesson: every field named). */
export function validateFloodDef(raw: unknown): string[] {
  if (raw === undefined) return [];
  const errors: string[] = [];
  const f = raw as Partial<FloodDef>;
  if (!f.decks || typeof f.decks !== "object") return ["flood: decks missing"];
  for (const [key, d] of Object.entries(f.decks)) {
    if (!d.name || !d.seat || !["aggro", "midrange", "control"].includes(d.archetype)) errors.push(`flood deck ${key}: name/seat/archetype missing`);
    const n = (d.decklist ?? []).reduce((m, e) => m + e.count, 0);
    if (n !== 40) errors.push(`flood deck ${key}: ${n} cards; a seat's list is forty`);
  }
  const sh = f.strongholds ?? [], ct = f.courts ?? [];
  if (sh.length !== 5 || new Set(sh.map((s) => s.color)).size !== 5) errors.push("flood: strongholds must be five entries covering the five colours");
  if (ct.length !== 5 || new Set(ct.map((c) => c.color)).size !== 5) errors.push("flood: courts must be five entries covering the five laws");
  for (const s of sh) {
    if (!s.id || !s.name || !s.lord?.key || !s.lord?.cardId || !s.lord?.baseLife || !s.lord?.portrait || !s.law?.cardId) errors.push(`flood stronghold ${s.id ?? "?"}: missing fields`);
    if (!f.decks[s.lord?.key ?? ""]) errors.push(`flood stronghold ${s.id}: no deck "${s.lord?.key}"`);
    if (!Array.isArray(s.triad) || s.triad.length !== 3 || s.triad[0] !== s.color || s.triad.some((c) => !COLORS.includes(c))) errors.push(`flood stronghold ${s.id}: triad must be three colours beginning with the law's`);
    if (!Array.isArray(s.golds) || s.golds.length !== 2) errors.push(`flood stronghold ${s.id}: golds must be two card ids`);
    if (s.deckRule !== undefined) errors.push(...validateDeckRule(s.deckRule, `flood stronghold ${s.id}`));
  }
  for (const c of ct) {
    if (!c.id || !c.name || !c.minister?.key || !c.minister?.cardId || !c.minister?.life || !c.minister?.portrait || !c.law?.cardId || !c.ground) errors.push(`flood court ${c.id ?? "?"}: missing fields`);
    if (!f.decks[c.minister?.key ?? ""]) errors.push(`flood court ${c.id}: no deck "${c.minister?.key}"`);
    if (!Array.isArray(c.pair) || c.pair.length !== 2 || c.pair[0] === c.pair[1] || c.pair.some((x) => !COLORS.includes(x))) errors.push(`flood court ${c.id}: pair must be two distinct colours`);
    if (c.deckRule !== undefined) errors.push(...validateDeckRule(c.deckRule, `flood court ${c.id}`));
  }
  const ids = [...sh.map((s) => s.id), ...ct.map((c) => c.id)];
  if (new Set(ids).size !== ids.length) errors.push("flood: site ids must be distinct");
  return errors;
}

/** The stronghold content a world of this phase reads: phase one's five seats, or the flood's. ONE switch — every
 * colour-keyed stronghold lookup goes through here. */
export function strongholdContentFor(catalog: Pick<Catalog, "strongholdContent" | "flood">, phase: number | undefined): StrongholdContentDef[] {
  return (phase ?? 1) >= 2 && catalog.flood ? catalog.flood.strongholds : (catalog.strongholdContent ?? []);
}
export const floodStronghold = (catalog: Pick<Catalog, "flood">, id: string): FloodStrongholdDef | undefined => catalog.flood?.strongholds.find((s) => s.id === id);
export const floodCourt = (catalog: Pick<Catalog, "flood">, id: string): FloodCourtDef | undefined => catalog.flood?.courts.find((c) => c.id === id);

/** A seat's list by key (`lord:<key>` / `court:<key>` resolve here through `enemyDeck`). */
export function floodDeck(catalog: Pick<Catalog, "flood">, key: string): FloodDeckDef {
  const d = catalog.flood?.decks[key];
  if (!d) throw new Error(`unknown flood deck ${key}`);
  return { ...d, decklist: d.decklist.map((e) => ({ ...e })) };
}

/** The court's side of the table: its law and its High Ground (ADR-128 §6 — the courts fight on their own ground). */
export function courtModifiers(court: FloodCourtDef): Modifier[] {
  return [
    { type: "permanentOnBattlefield", player: 1, cardId: court.law.cardId },
    { type: "permanentOnBattlefield", player: 1, cardId: court.ground },
  ];
}

/** The document's §8 code blocks as lists (card NAMES resolved by the caller's map) — the sync test's reader and
 * the generator's. Ten blocks, in the document's order: five strongholds, five courts. */
export function parseFloodLists(markdown: string, idOfName: (name: string) => string | undefined): { seat: string; decklist: StarterDecklist }[] {
  const sec = markdown.split("## 8. The ten decklists")[1]?.split("\n## 9.")[0] ?? "";
  const out: { seat: string; decklist: StarterDecklist }[] = [];
  for (const m of sec.matchAll(/### (.+?)\n```\n([\s\S]*?)```/g)) {
    const decklist: StarterDecklist = [];
    for (const entry of m[2]!.trim().split(/\s·\s|\n/)) {
      const e = entry.trim().match(/^(\d+) (.+)$/);
      if (!e) throw new Error(`flood lists: cannot read "${entry}"`);
      const id = idOfName(e[2]!.trim());
      if (!id) throw new Error(`flood lists: no card named "${e[2]}"`);
      decklist.push({ cardId: id, count: Number(e[1]) });
    }
    out.push({ seat: m[1]!.split(" — ")[0]!, decklist });
  }
  return out;
}

// ---------- the run: the court's duel, the falls, the Heart's gate, the golds ----------

/** The flood's slot in the gauntlet save object (additive; absent on every older save). */
export interface FloodRunState {
  /** Courts fallen, by site id. */
  courts?: Record<string, true>;
  /** Golds that joined the shops (a stronghold's fall adds its pair's two). */
  golds?: string[];
  /** The falls, in order — the run's chronicle of the flood (site id + the step it fell at). */
  falls?: { siteId: string; step: number }[];
  /** The ford's line has been shown. */
  fordSeen?: true;
}
export function floodRun(world: WorldState): FloodRunState {
  const g = world.gauntlet as { flood?: FloodRunState };
  return (g.flood ??= {});
}
export const courtFallen = (world: WorldState, courtId: string): boolean => !!floodRun(world).courts?.[courtId];
export const courtsFallen = (world: WorldState): number => Object.keys(floodRun(world).courts ?? {}).length;
/** ADR-130 (Chris, 2026-09-20): the flood's Heart opens when the five LORDS have fallen — the courts are prizes. */
export const floodHeartOpen = (world: WorldState): boolean => (world.phase ?? 1) >= 2 && sealsHeld(world) >= 5;

/** A stronghold of the flood has fallen: its pair's two golds join the shops; the fall is chronicled. */
export function recordFloodLordFall(world: WorldState, sh: FloodStrongholdDef): void {
  const run = floodRun(world);
  run.golds = [...new Set([...(run.golds ?? []), ...sh.golds])];
  (run.falls ??= []).push({ siteId: sh.id, step: world.player.stepsTaken });
}

/** The court's fight: the petal's shape on the outer map — your WORLD life, the world's ante, the law and the
 * High Ground on the court's side, the minister's list at the court's life row (the knob, else the def's). */
export function courtDuelSpec(world: WorldState, catalog: Catalog, knobs: KnobValues, court: FloodCourtDef, rng: WorldRng): { spec: MatchSpec; enemyName: string; enemyLife: number } {
  const legal = deckLegal(activeDeck(world));
  if (!legal.ok) throw new Error(`cannot fight the court: ${legal.reason}`);
  const deck = floodDeck(catalog, court.minister.key);
  const enemyLife = Math.max(1, knobs.floodCourtLife > 0 ? knobs.floodCourtLife : court.minister.life);
  const spec: MatchSpec = {
    seed: rng.int(1_000_000_000),
    players: [
      { name: world.player.name, decklist: activeDeck(world).map((e) => ({ ...e })), agent: "human" },
      { name: court.minister.name, decklist: deck.decklist, agent: "heuristic:master" },
    ],
    rules: { startingLife: world.player.worldLife, handSize: 7, mulligan: "london", maxTurns: 100, ante: knobs.anteCount, startingPlayer: rng.chance(0.5) ? 0 : 1 },
    modifiers: [{ type: "startingLife", player: 1, value: enemyLife }, ...courtModifiers(court), ...manalinkModifiers(world)],
  };
  return { spec, enemyName: court.minister.name, enemyLife };
}

export type CourtOutcome =
  | { type: "win"; paidGold: number; paidCards: string[]; anteWon: string[]; anteWithheld: string[]; ministerWithheld: boolean }
  | { type: "loss"; anteLost: string[] };

/** A WIN pays the High Ground (one copy — it is the place itself) and the minister's card (withheld for coin if
 * already held — the never-duplicate rule), the purse and the ante minus any prizeOnly stake; the court is
 * cleared and chronicled. A LOSS costs the stake and a world life, as every fixed point does. */
export function applyCourtDuel(world: WorldState, knobs: KnobValues, pool: Map<string, CardDef>, court: FloodCourtDef, result: MatchResult, record?: { seed: number; spec: MatchSpec; enemyName: string }): CourtOutcome {
  if (record) {
    recordDuel(world, record.seed, record.spec, result, {
      opponentId: `court_${court.id}`, catalogId: `court_${court.id}`, enemyName: record.enemyName,
      outcome: result.winner === 0 ? "win" : result.winner === 1 ? "loss" : "draw",
      anteWon: result.winner === 0 ? [...result.facts.ante[1]] : [], anteLost: result.winner === 1 ? [...result.facts.ante[0]] : [],
    });
  }
  if (result.winner === 0) {
    const run = floodRun(world);
    (run.courts ??= {})[court.id] = true;
    (run.falls ??= []).push({ siteId: court.id, step: world.player.stepsTaken });
    world.dungeons[court.id] = { cleared: true, resets: world.dungeons[court.id]?.resets ?? 0 };
    const staked = [...result.facts.ante[1]];
    const anteWon = staked.filter((id) => !pool.get(id)?.prizeOnly);
    const anteWithheld = staked.filter((id) => pool.get(id)?.prizeOnly);
    const held = (id: string) => (world.player.collection[id] ?? 0) > 0;
    const ministerWithheld = held(court.minister.cardId);
    const paidCards = [...(held(court.ground) ? [] : [court.ground]), ...(ministerWithheld ? [] : [court.minister.cardId])];
    addToCollection(world, paidCards, "reward");
    if (anteWon.length) addToCollection(world, anteWon, "ante");
    const paidGold = knobs.petalGoldPrize * (ministerWithheld ? 2 : 1);
    world.player.gold += paidGold;
    return { type: "win", paidGold, paidCards, anteWon, anteWithheld, ministerWithheld };
  }
  const anteLost = [...result.facts.ante[0]];
  forfeitCards(world, anteLost);
  world.player.worldLife = Math.max(knobs.lifeFloor, world.player.worldLife - knobs.lossLifePenalty);
  if (world.player.worldLife <= 0) world.gameOver = true;
  return { type: "loss", anteLost };
}
