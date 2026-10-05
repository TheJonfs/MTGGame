/**
 * Post-S54 (Chris: clicking a demonstrated loop through, a misclick away from losing): the REPEAT's bookkeeping. One
 * switch (`REPEAT_ENABLED`) and pure functions; the match controller feeds it and plays the repeats — each one a real
 * action through the engine, offered by the engine, logged like any other (the engine knows nothing of this file).
 * To remove the feature: set the switch to false (nothing is recorded, nothing is offered).
 *
 * In paper play a player who has demonstrated a loop may shortcut it a stated number of times. Here the machine can
 * simply do the steps, so the shortcut is a recording played back:
 *
 * 1. Every answer the player gives is recorded as a DESCRIPTION, not as object ids — a creature that leaves and
 *    returns is a new object each pass (CR 400.7), so "sacrifice obj_212" means nothing a pass later. An object is
 *    described by what can be seen of it (`objectSig`): its card, zone, controller, and on the battlefield whether it
 *    is tapped, summoning-sick, damaged, due an end-step sacrifice, its live power/toughness/keywords, its counters and
 *    what it is attached to. Two objects with the same description are interchangeable.
 * 2. Every decision is recorded with a FINGERPRINT of the game around it: the turn and step, the kind of decision and
 *    what asks it, the stack, combat, every permanent's description, the player's hand and floating mana, the
 *    opponent's hand size. Life totals, libraries and graveyards are left out — those are what a loop moves. So is
 *    the list of actions on offer: a mill puts new cards in a graveyard every pass, each a new legal target, and a
 *    declared loop does not end because a new option appeared (measured: the Altar's loop stopped on its first pass
 *    with the offers in the fingerprint). What IS required of the offers is the one thing that matters — step 4.
 * 3. A loop is DEMONSTRATED when the decision on screen has the fingerprint of an earlier decision this turn, and
 *    something moved between them (a life total, a library). The answers in between are the cycle.
 * 4. A repeat plays the cycle again, one decision at a time. At EVERY decision the fingerprint must equal the one
 *    recorded at that point of the cycle, and an action with the recorded description must be on offer; otherwise the
 *    repeat stops there and the decision is the player's. The opponent is asked for priority at every step, as the
 *    rules require; anything they do changes a fingerprint and stops the repeat.
 */
import type { Action, ActionRequest, GameState, GameView } from "@shandalar/engine";

export const REPEAT_ENABLED = true;
/** A repeat never runs more cycles than this, whatever is asked. */
export const REPEAT_MAX_CYCLES = 200;
/** Decisions remembered (this turn only — the fingerprint carries the turn). */
const HISTORY = 400;

type Sigs = (id: string) => string | null;

/** How one object looks from the table. `null` for a string that is no object's id. An id whose object is GONE (a
 * trigger's source that has died: "order these triggers" names it) reads as its card — `gone` is the controller's
 * record of every id it has seen — and an id-shaped string nobody knows reads as "gone", never as itself: a raw id in
 * a description could never match a pass later. */
export function objectSigs(view: GameView, state: GameState, gone?: ReadonlyMap<string, string>): Sigs {
  const onField = new Map(view.battlefield.map((o) => [o.id, o]));
  const due = new Set(view.pendingEndStepSacrifices), back = new Set(view.pendingCleanupReturns);
  const memo = new Map<string, string>();
  const sig = (id: string, depth = 0): string | null => {
    const hit = memo.get(id); if (hit !== undefined) return hit;
    const o = state.objects[id];
    if (!o) return gone?.has(id) ? `gone:${gone.get(id)}` : /^[a-z]+_\d+$/.test(id) ? "gone" : null;
    let s: string;
    const b = onField.get(id);
    if (b) {
      const counters = Object.entries(b.counters ?? {}).filter(([, n]) => n !== 0).sort(([x], [y]) => x.localeCompare(y)).map(([k, n]) => `${k}${n}`).join(",");
      const host = b.attachedTo && depth < 2 ? sig(b.attachedTo, depth + 1) : b.attachedTo ? "host" : "";
      s = `bf:${b.cardId}:c${b.controller}:${b.tapped ? "T" : "U"}${b.summoningSick ? "S" : ""}${due.has(id) ? "E" : ""}${back.has(id) ? "R" : ""}:d${b.damage}:${b.power ?? "-"}/${b.toughness ?? "-"}:${[...b.keywords].sort().join(",")}:${counters}:${b.cantAttack ? "xa" : ""}${b.cantBlock ? "xb" : ""}:@${host}`;
    } else s = `${o.zone}:${o.cardId}:o${o.owner}:c${o.controller}`;
    memo.set(id, s);
    return s;
  };
  return (id) => sig(id);
}

/** A value with every object id in it replaced by that object's description (any field, any depth). */
function described(v: unknown, sigs: Sigs): unknown {
  if (typeof v === "string") { const s = sigs(v); return s === null ? v : `«${s}»`; }
  if (Array.isArray(v)) return v.map((x) => described(x, sigs));
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, described((v as Record<string, unknown>)[k], sigs)]));
  return v;
}
export const describeAction = (a: Action, sigs: Sigs): string => JSON.stringify(described(a, sigs));

/** The game around a decision, without what a loop moves (life, library and graveyard sizes). */
export function fingerprint(view: GameView, request: ActionRequest, state: GameState, sigs: Sigs): string {
  const stack = state.stack.map((s) => `${s.kind}:${s.sourceCardId}:c${s.controller}:${JSON.stringify(described(s.targets, sigs))}:x${s.x}`);
  const field = view.battlefield.map((o) => sigs(o.id) ?? o.cardId).sort();
  const hand = view.hand.map((c) => c.cardId).sort();
  return JSON.stringify({ t: view.turn, s: view.step, a: view.activePlayer, p: request.purpose, src: request.source?.cardId ?? "", combat: described(view.combat, sigs), stack, field, hand, mana: view.manaPool, oppHand: view.opponentHandCount });
}

export interface LoopStep { fp: string; purpose: string; answer: string }
interface Rec extends LoopStep { life: [number, number]; libs: [number, number] }
export interface LoopOffer {
  cycle: LoopStep[];
  /** What one pass moves: life and library, per seat. */
  life: [number, number]; libs: [number, number];
  /** Passes that end it — the opponent out of life or library — or null when one pass ends nothing. */
  toEnd: number | null;
}

/** The player's decisions this turn, and the loop (if any) the decision on screen closes. */
export class LoopRecorder {
  private recs: Rec[] = [];
  private turn = -1;
  /** A decision answered: its fingerprint and the answer's description, with the totals at the time. */
  record(view: GameView, fp: string, purpose: string, answer: string): void {
    if (view.turn !== this.turn) { this.recs = []; this.turn = view.turn; }
    this.recs.push({ fp, purpose, answer, life: [view.life[0], view.life[1]], libs: [view.librarySizes[0], view.librarySizes[1]] });
    if (this.recs.length > HISTORY) this.recs.shift();
  }
  clear(): void { this.recs = []; }
  /** The loop the decision with this fingerprint closes, seen from seat `me`: the latest earlier decision with the
   * same fingerprint, when something moved since and the player did more than pass. */
  offer(view: GameView, fp: string, me: 0 | 1): LoopOffer | null {
    if (view.turn !== this.turn) return null;
    let j = -1;
    for (let i = this.recs.length - 1; i >= 0; i--) if (this.recs[i]!.fp === fp) { j = i; break; }
    if (j < 0) return null;
    const cycle = this.recs.slice(j), from = this.recs[j]!, opp = (1 - me) as 0 | 1;
    if (!cycle.some((r) => !r.answer.includes('"type":"pass"'))) return null;
    const life: [number, number] = [view.life[0] - from.life[0], view.life[1] - from.life[1]];
    const libs: [number, number] = [view.librarySizes[0] - from.libs[0], view.librarySizes[1] - from.libs[1]];
    if (!life.some((n) => n !== 0) && !libs.some((n) => n !== 0)) return null; // nothing moved: not a loop worth repeating
    const ends: number[] = [];
    if (life[opp] < 0) ends.push(Math.ceil(view.life[opp] / -life[opp]));
    if (libs[opp] < 0) ends.push(Math.ceil(view.librarySizes[opp] / -libs[opp]));
    return { cycle: cycle.map(({ fp: f, purpose, answer }) => ({ fp: f, purpose, answer })), life, libs, toEnd: ends.length ? Math.min(REPEAT_MAX_CYCLES, Math.max(1, Math.min(...ends))) : null };
  }
}
