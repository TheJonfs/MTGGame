/**
 * S59 (ADR-172): the bridge between the journey and the Convocation.
 *
 * Two pages, two saves. The journey rewrites its whole save on every autosave, so the Convocation never writes it:
 * it POSTS to an outbox, and the journey DRAINS the outbox into its own save.
 *
 *  - The outbox: one storage key PER ENTRY (`convocation-outbox:<id>`). A post is a single write of a new key and a
 *    delete is a single removal, so a Convocation posting while a journey autosaves and drains in another tab can
 *    never lose an entry (one shared list would be a read-modify-write on both sides).
 *  - An entry is applied once (the world keeps the ids it has applied) and deleted only after the world's own save
 *    has succeeded; a reload between the two finds the id already applied and only deletes.
 *  - An entry belongs to the journey whose invitation it names: a phase-one and a phase-two save each drain only
 *    their own.
 *  - Invitations: the Convocation sits on a clock. Every `convocationInterval` steps the world posts one to its own
 *    save (`invitations`); it stands until the next sitting — a window, not a stock. `source` is an enum so that a
 *    town board, a courier or a boss's grant can post one later; only the clock does today.
 *  - The fence: a kept card is never one of the packs' power slot.
 *  - The prize table: gold by place band, as knobs.
 */
import type { KnobValues } from "./knobs.js";
import type { WorldState } from "./state.js";

export const OUTBOX_PREFIX = "convocation-outbox:";
export type OutboxKind = "kept" | "prize" | "spent";
export interface OutboxEntry { id: string; kind: OutboxKind; invitationId: string; cards?: string[]; gold?: number }
/** What the outbox needs of a storage (localStorage has all four). */
export interface OutboxStore { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void; readonly length: number; key(index: number): string | null }

export type InvitationSource = "clock" | "board" | "quest" | "grant";
export type InvitationShape = "single" | "short" | "full";
export interface Invitation { id: string; source: InvitationSource; shape: InvitationShape; /** the step it was posted at, and the step the next sitting replaces it at */ postedAt: number; until: number; spent?: true }
/** The world's own record of the link (additive: a save from before S59 has none). */
export interface ConvocationLinkState { /** the number of the last sitting posted (steps ÷ the interval) */ sitting: number; /** outbox ids already applied */ applied: string[] }

/** Post an entry: one write of a key of its own. Posting the same id again changes nothing. */
export function postOutbox(store: Pick<OutboxStore, "getItem" | "setItem"> | null, entry: OutboxEntry): boolean {
  if (!store) return false;
  try { if (store.getItem(OUTBOX_PREFIX + entry.id) === null) store.setItem(OUTBOX_PREFIX + entry.id, JSON.stringify(entry)); return true; } catch { return false; }
}
export function readOutbox(store: OutboxStore | null): OutboxEntry[] {
  if (!store) return [];
  const out: OutboxEntry[] = [];
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i); if (!k || !k.startsWith(OUTBOX_PREFIX)) continue;
    try { const e = JSON.parse(store.getItem(k) ?? "") as OutboxEntry; if (e && typeof e.id === "string" && typeof e.invitationId === "string") out.push(e); } catch { /* a damaged entry is left where it is */ }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}
export function removeOutbox(store: OutboxStore | null, ids: string[]): void { for (const id of ids) { try { store?.removeItem(OUTBOX_PREFIX + id); } catch { /* it is applied; the next drain removes it */ } } }

const link = (world: WorldState): ConvocationLinkState => (world.convocation ??= { sitting: 0, applied: [] });
const shapeFor = (world: WorldState, knobs: Pick<KnobValues, "convocationShape">): InvitationShape => knobs.convocationShape[(world.phase ?? 1) >= 2 ? 2 : 1] ?? "short";
export const shapeName = (s: InvitationShape): string => (s === "single" ? "a single event" : s === "short" ? "two days" : "four days");

/** The invitation that stands now: posted, not spent, and its window not yet closed. */
export function standingInvitation(world: WorldState): Invitation | null {
  const inv = (world.invitations ?? []).find((i) => !i.spent && world.player.stepsTaken < i.until);
  return inv ?? null;
}

/**
 * The clock. Called after the journey's steps move; idempotent on the step count. When a sitting has come, the
 * invitation before it is gone (missed, if it was never spent) and a new one stands until the next.
 */
export function tickConvocationClock(world: WorldState, knobs: Pick<KnobValues, "convocationInterval" | "convocationShape">): { sat: Invitation | null; missed: boolean } {
  const every = knobs.convocationInterval;
  if (!(every > 0)) return { sat: null, missed: false };
  const l = link(world), now = Math.floor(world.player.stepsTaken / every);
  if (now <= l.sitting) return { sat: null, missed: false };
  const before = (world.invitations ?? []).filter((i) => !i.spent);
  const inv: Invitation = { id: `${world.seed}-p${world.phase ?? 1}-s${now}`, source: "clock", shape: shapeFor(world, knobs), postedAt: world.player.stepsTaken, until: (now + 1) * every };
  // a window, not a stock: the unspent one is dropped; the spent stay (an outbox entry names its invitation)
  world.invitations = [...(world.invitations ?? []).filter((i) => i.spent), inv];
  l.sitting = now;
  return { sat: inv, missed: before.length > 0 };
}

/** Does this entry belong to this journey? (Its invitation is one this world posted.) */
export const ownsEntry = (world: WorldState, e: OutboxEntry): boolean => (world.invitations ?? []).some((i) => i.id === e.invitationId) || e.invitationId.startsWith(`${world.seed}-p${world.phase ?? 1}-`);

/**
 * Apply the outbox to the world (in memory): each of this journey's entries once. Returns the ids applied now and the
 * ids that had been applied before (both are to be deleted once the world's save has succeeded).
 */
export function applyOutbox(world: WorldState, entries: OutboxEntry[], isCard: (id: string) => boolean): { applied: OutboxEntry[]; stale: string[] } {
  const l = link(world), applied: OutboxEntry[] = [], stale: string[] = [];
  for (const e of entries) {
    if (!ownsEntry(world, e)) continue;
    if (l.applied.includes(e.id)) { stale.push(e.id); continue; }
    if (e.kind === "spent") { const inv = (world.invitations ?? []).find((i) => i.id === e.invitationId); if (inv) inv.spent = true; }
    else {
      for (const c of e.cards ?? []) { if (!isCard(c) || POWER_SLOT.has(c)) continue; world.player.collection[c] = (world.player.collection[c] ?? 0) + 1; world.provenance.push({ cardId: c, source: "convocation", step: world.player.stepsTaken }); }
      if (e.gold && e.gold > 0) world.player.gold += Math.floor(e.gold);
    }
    l.applied.push(e.id); applied.push(e);
  }
  return { applied, stale };
}

/** The fence (ADR-172, (a)): the packs' power slot — never a kept card. The packs' data names the fourteen
 * (`sets.json` → power); this is the same list for the world's side, which does not load the packs. */
export const POWER_SLOT: ReadonlySet<string> = new Set(["black_lotus", "mox_pearl", "mox_sapphire", "mox_jet", "mox_ruby", "mox_emerald", "time_walk", "tallyflame_court", "wrackroot", "shevelport", "obsidian_observatory", "cairnbrand", "the_manafleur", "the_cinquefont"]);
export const keepable = (cardId: string, power: readonly string[]): boolean => !power.includes(cardId) && !POWER_SLOT.has(cardId);

/** The prize table: the band a finish falls in, and what it pays. */
export type PrizeBand = "champion" | "eight" | "quarter" | "rest";
export function prizeBand(place: number, seats: number, top8: boolean): PrizeBand {
  if (place === 1) return "champion";
  if (top8 && place <= 8) return "eight";
  return place <= Math.max(1, Math.floor(seats / 4)) ? "quarter" : "rest";
}
export function prizeGold(band: PrizeBand, opts: { hard: boolean; single: boolean }, knobs: Pick<KnobValues, "convocationPrizeGold" | "convocationPrizeHard" | "convocationPrizeSingle">): number {
  return Math.round(knobs.convocationPrizeGold[band] * (opts.hard ? knobs.convocationPrizeHard : 1) * (opts.single ? knobs.convocationPrizeSingle : 1));
}
