/**
 * pnpm leak-census [--out report.md] [--margin 0.25]
 *
 * S72 Part 2 (concern 32, the baseline leak — a census, not a rule): book 165 found a no-op exchange priced at −0.5
 * still cast, because the move scorer carried it over passing. This walks the pool: every instant and sorcery cast
 * from hand, and every activated ability of a permanent on our side, on a NULL board — our lands only (two of each
 * basic, untapped), their three lands, empty graveyards, an empty stack, three cards in their hand. Each legal-looking
 * target (a player; a land, ours or theirs; nothing for a stack or graveyard target, which a null board cannot offer)
 * is one variant. A variant is a NO-OP when the predicted view, less the card's own move from hand (and the source's
 * tap), is the board it started from. A no-op scoring above passing is a leak; within `--margin` under it, a soft leak
 * (book 93: a point under passing is still picked a window in several by the softmax). The scorer is the master
 * pilot's, midrange, against a list of Swamps.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import type { CardDef } from "@shandalar/cards";
import type { Action, GameView } from "@shandalar/engine";
import type { ResolvedTarget } from "@shandalar/cards";
import { HeuristicAgent, difficultyProfile, predictAction } from "@shandalar/agents";

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1]! : d; };
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const OUT = arg("out", ""), MARGIN = Number(arg("margin", "0.25"));
const nm = (id: string) => pool.get(id)?.name ?? id;

const BASICS = ["plains", "island", "swamp", "mountain", "forest"];
/** The board: "null" (lands only) or "bears" (a Grizzly Bears a side — for the spells whose target must be a creature). */
let BOARD: "null" | "bears" = "null";
function nullView(hand: string[], extra: { id: string; cardId: string }[] = []): GameView {
  const ours = BASICS.flatMap((c, i) => [0, 1].map((k) => ({ id: `L0_${i}_${k}`, cardId: c, controller: 0 as const })));
  const theirs = ["swamp", "swamp", "swamp"].map((c, i) => ({ id: `L1_${i}`, cardId: c, controller: 1 as const }));
  const bears = BOARD === "bears" ? [{ id: "C0", cardId: "grizzly_bears", controller: 0 as const }, { id: "C1", cardId: "grizzly_bears", controller: 1 as const }] : [];
  const bf = [...ours, ...theirs, ...bears, ...extra.map((e) => ({ ...e, controller: 0 as const }))].map((b) => {
    const d = pool.get(b.cardId)!; const c = d.types.includes("Creature");
    return { id: b.id, cardId: b.cardId, controller: b.controller, tapped: false, damage: 0, attachedTo: null, power: c ? d.power ?? 0 : null, toughness: c ? d.toughness ?? 0 : null, keywords: [...(d.keywords ?? [])] };
  });
  return {
    you: 0, turn: 6, step: "MAIN1", activePlayer: 0, life: [20, 20], startingLife: 20,
    hand: hand.map((cardId, i) => ({ objectId: `h_${cardId}_${i}`, cardId })), opponentHandCount: 3, librarySizes: [30, 30], mulliganCount: 0,
    combat: { attackers: [], blocks: [] }, battlefield: bf, stack: [], graveyards: [[], []], graveyardObjects: [[], []],
    manaPool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }, pendingEndStepSacrifices: [], pendingCleanupReturns: [],
  } as unknown as GameView;
}
type Spec = { predicate?: string; zone?: string; count?: number };
/** The variants a null board offers for a target list: players and lands only. */
function variants(view: GameView, specs: readonly Spec[] | undefined): ResolvedTarget[][] | null {
  if (!specs || specs.length === 0) return [[]];
  let out: ResolvedTarget[][] = [[]];
  for (const s of specs) {
    const p = String(s.predicate ?? ""), z = s.zone ?? "battlefield";
    const opts: ResolvedTarget[] = [];
    if (/player|anyTarget|opponent/i.test(p)) { if (!/opponent/i.test(p)) opts.push({ kind: "player", player: 0 } as ResolvedTarget); opts.push({ kind: "player", player: 1 } as ResolvedTarget); }
    if (z === "battlefield" && /permanent|land/i.test(p) && !/nonland|creature/i.test(p)) for (const o of view.battlefield) if (!o.id.startsWith("C")) opts.push({ kind: "object", id: o.id } as ResolvedTarget);
    if (BOARD === "bears" && z === "battlefield" && /creature|permanent|anyTarget/i.test(p) && !/noncreature/i.test(p)) for (const id of ["C0", "C1"]) opts.push({ kind: "object", id } as ResolvedTarget);
    if (opts.length === 0) return null; // a stack, a graveyard or a creature target: the null board has none — the engine offers no cast
    out = out.flatMap((pre) => opts.slice(0, 4).map((t) => [...pre, t]));
  }
  return out;
}
/** The board a variant should leave if its effect did nothing: the card out of hand (to the graveyard), the source tapped. */
const sig = (v: GameView) => JSON.stringify({ life: v.life, bf: v.battlefield.map((o) => [o.id, o.cardId, o.controller, o.power, o.toughness, o.keywords, o.counters ?? null, o.attachedTo, o.id === "src" ? null : o.tapped]).sort(), hand: v.hand.length, opp: v.opponentHandCount, lib: v.librarySizes, yards: v.graveyards.map((g) => g.length) });

/** Effects the view does not show (a library search, an extra turn): never read as a no-op. */
const UNSEEN = new Set(["searchLibrary", "extraTurn"]);
const unseen = (effects: readonly { type: string }[] | undefined) => (effects ?? []).some((e) => UNSEEN.has(e.type));
interface Hit { card: string; kind: string; target: string; margin: number; noop: boolean; board: string }
const gated: { card: string; kind: string; target: string; board: string }[] = [];
const hits: Hit[] = [];
const agent = new HeuristicAgent(1, pool, difficultyProfile("master", "midrange", [{ cardId: "swamp", count: 17 }]));
const tdesc = (ts: ResolvedTarget[]) => ts.map((t) => (t.kind === "player" ? (t.player === 0 ? "us" : "them") : t.kind === "object" ? (t.id.startsWith("L0") ? "our land" : t.id.startsWith("L1") ? "their land" : t.id === "C0" ? "our Bears" : t.id === "C1" ? "their Bears" : t.id) : t.kind)).join(", ") || "—";

for (const board of ["null", "bears"] as const) { BOARD = board;
for (const d of [...pool.values()].sort((a, b) => a.id.localeCompare(b.id)) as CardDef[]) {
  if (d.types.includes("Land") && !(d.abilities ?? []).some((a) => a.kind === "activated")) continue;
  // instants and sorceries, cast from hand (each mode)
  if (d.types.includes("Instant") || d.types.includes("Sorcery")) {
    const modes = d.modes ? d.modes.map((m, i) => ({ i, targets: m.targets as Spec[] | undefined })) : [{ i: undefined as number | undefined, targets: d.targets as Spec[] | undefined }];
    for (const m of modes) {
      const view = nullView([d.id]);
      for (const ts of variants(view, m.targets) ?? []) {
        const action = { type: "castSpell", objectId: `h_${d.id}_0`, targets: ts, ...(m.i !== undefined ? { mode: m.i } : {}), ...(/\{X\}/.test(d.manaCost) ? { x: 1 } : {}) } as unknown as Action;
        const pass = agent.scorePriorityAction(view, { type: "pass" } as Action), s = agent.scorePriorityAction(view, action);
        if (!Number.isFinite(s)) { gated.push({ card: d.id, kind: d.modes ? `spell, mode ${m.i}` : "spell", target: tdesc(ts), board: BOARD }); continue; }
        const pred = predictAction(view, action, pool);
        const expect = nullView([]); (expect as { graveyards: string[][] }).graveyards = [[d.id], []];
        const noop = !unseen(m.i !== undefined ? d.modes![m.i]!.effects : d.spellEffect) && (pred.unchanged || sig(pred.view) === sig(expect) || sig(pred.view) === sig(nullView([])));
        hits.push({ card: d.id, kind: d.modes ? `spell, mode ${m.i}` : "spell", target: tdesc(ts), margin: s - pass, noop, board: BOARD });
      }
    }
  }
  // activated abilities of the permanent on our side (not sick)
  if (!d.types.includes("Instant") && !d.types.includes("Sorcery")) {
    (d.abilities ?? []).forEach((ab, ai) => {
      if (ab.kind !== "activated" || ab.effects.every((e) => e.type === "addMana") || ab.equip || ((ab as { zone?: string }).zone ?? "battlefield") !== "battlefield") return; // a graveyard or hand ability is not the permanent's
      const view = nullView([], [{ id: "src", cardId: d.id }]);
      for (const ts of variants(view, ab.targets as Spec[] | undefined) ?? []) {
        const action = { type: "activateAbility", objectId: "src", abilityIndex: ai, targets: ts, ...(/X/.test(ab.cost.mana ?? "") ? { x: 1 } : {}) } as unknown as Action;
        const pass = agent.scorePriorityAction(view, { type: "pass" } as Action), s = agent.scorePriorityAction(view, action);
        if (!Number.isFinite(s)) { gated.push({ card: d.id, kind: `ability ${ai}`, target: tdesc(ts), board: BOARD }); continue; }
        const pred = predictAction(view, action, pool);
        const tapped = nullView([], [{ id: "src", cardId: d.id }]);
        const noop = !unseen(ab.effects) && (pred.unchanged || sig(pred.view) === sig(view) || sig(pred.view) === sig(tapped));
        hits.push({ card: d.id, kind: `ability ${ai}`, target: tdesc(ts), margin: s - pass, noop, board: BOARD });
      }
    });
  }
}

}
const leaks = hits.filter((h) => h.noop && h.margin > 0).sort((a, b) => b.margin - a.margin);
const soft = hits.filter((h) => h.noop && h.margin <= 0 && h.margin > -MARGIN).sort((a, b) => b.margin - a.margin);
const f2 = (x: number) => (x >= 0 ? "+" : "") + x.toFixed(2);
const lines = [`# The baseline leak — a census of the pool on a null board and a Bears board (${hits.length} variants of ${new Set(hits.map((h) => h.card)).size} cards)`, "",
  `A no-op variant is one whose predicted board, less the card's own move (and the source's tap), is the board it started from. **${leaks.length} no-op variants score above passing** (leaks); ${soft.length} more within ${MARGIN} under it (soft). ${hits.filter((h) => h.noop).length} no-ops in all.`, "",
  "## Leaks (above passing)", "", "| card | what | target | board | score − pass |", "|---|---|---|---|---|", ...leaks.map((h) => `| ${nm(h.card)} | ${h.kind} | ${h.target} | ${h.board} | ${f2(h.margin)} |`), "",
  `## Soft leaks (within ${MARGIN} under passing)`, "", "| card | what | target | board | score − pass |", "|---|---|---|---|---|", ...soft.map((h) => `| ${nm(h.card)} | ${h.kind} | ${h.target} | ${h.board} | ${f2(h.margin)} |`), "",
  "## Every no-op, by score", "", "| card | what | target | board | score − pass |", "|---|---|---|---|---|", ...hits.filter((h) => h.noop).sort((a, b) => b.margin - a.margin).map((h) => `| ${nm(h.card)} | ${h.kind} | ${h.target} | ${h.board} | ${f2(h.margin)} |`), "",
  `## Refused outright by a gate (−∞): ${gated.length} variants`, "", [...new Set(gated.map((g) => `${nm(g.card)} (${g.kind}${g.target !== "—" ? ", " + g.target : ""}, ${g.board})`))].join("; "), "",
  "## Effects that changed the board yet scored above passing (not leaks; listed for the planner's eye)", "", "| card | what | target | board | score − pass |", "|---|---|---|---|---|",
  ...hits.filter((h) => !h.noop && h.margin > 0).sort((a, b) => b.margin - a.margin).slice(0, 40).map((h) => `| ${nm(h.card)} | ${h.kind} | ${h.target} | ${h.board} | ${f2(h.margin)} |`)];
const text = lines.join("\n") + "\n";
if (OUT) writeFileSync(OUT, text);
console.log(text);
