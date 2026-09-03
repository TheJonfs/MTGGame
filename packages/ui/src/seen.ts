/**
 * S27 r3 (Chris): the gallery opens PROGRESSIVELY — prizeOnly cards (the twenty-one bosses, the
 * Moxen, the Lotus, the laws) stay hidden until the player has ENCOUNTERED them: seen in a duel
 * (cast, or on the battlefield / in a graveyard / in exile by the end of a fight the player was in)
 * or held in the collection. The memory is per-browser (localStorage), outside any save, so a
 * second road remembers what the first one met.
 */
import type { MatchResult } from "@shandalar/engine";

export const SEEN_KEY = "shandalar-seen";

export function readSeen(storage: Pick<Storage, "getItem" | "setItem"> | null = typeof localStorage !== "undefined" ? localStorage : null): Set<string> {
  try {
    const raw = storage?.getItem(SEEN_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

export function markSeen(ids: Iterable<string>, storage: Pick<Storage, "getItem" | "setItem"> | null = typeof localStorage !== "undefined" ? localStorage : null): Set<string> {
  const seen = readSeen(storage);
  for (const id of ids) seen.add(id);
  try { storage?.setItem(SEEN_KEY, JSON.stringify([...seen].sort())); } catch { /* storage may be unavailable */ }
  return seen;
}

/** Every card the player met in a finished duel: cast by anyone (SPELL_CAST events), or standing in
 * any public zone at the end (the final state's objects outside libraries and hands — the laws and
 * tokens that arrive by modifier, the entrance's signature once it lands). */
export function encounteredCards(result: MatchResult): string[] {
  const out = new Set<string>();
  for (const e of result.log as { t: string; name?: string; payload?: { cardId?: string } }[]) {
    if (e.t === "EVENT" && e.name === "SPELL_CAST" && e.payload?.cardId) out.add(e.payload.cardId);
  }
  try {
    const st = JSON.parse(result.finalStateSerialized) as { objects?: Record<string, { cardId: string; zone: string }> };
    for (const o of Object.values(st.objects ?? {})) if (o.zone !== "library" && o.zone !== "hand" && o.zone !== "ante") out.add(o.cardId);
  } catch { /* an empty serialization (tests) contributes nothing */ }
  return [...out];
}
