/**
 * pnpm play-diff <file.json …> [--playouts 8] [--archetype aggro] [--seat 0] [--out report.md]
 *
 * S58 (Part 2; ADR-167 — a probe of a PERSON's play): each recorded game is replayed to every decision its human
 * made; the pilot (the master AI, on the same deck, seeing the same view) is asked what it would do; where the two
 * differ the difference is named by kind, and BOTH lines are played out from there by the pilot (`--playouts` games
 * each, the same seeds): the human's choice, then the pilot plays on — against the pilot's own choice, then the pilot
 * plays on. The difference in win rate is what that choice is worth in the pilot's own hands.
 *
 * A file is a saved game (`shandalar-log-v1`: the play screen's download, mid-match or finished) or a Convocation
 * export that carries `games` (recorded from S58 on). A decision is a UNIT: a hand-tapped payment and its cast are
 * one; an attack is its whole set of attackers; a block its whole set of blocks.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { expandDecklist, replayThenPlay, type Action, type ActionRequest, type Agent, type GameView, type MatchSpec } from "@shandalar/engine";
import { HeuristicAgent, difficultyProfile } from "@shandalar/agents";
import { OPEN_DECKS } from "@shandalar/sim/open-decks";
import type { ActionLogEntry } from "@shandalar/core";

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1]! : d; };
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const K = Number(arg("playouts", "8"));
type Saved = { spec: MatchSpec; log: ActionLogEntry<Action>[]; note?: string; result?: { winner: number | null }; list?: string; opponent?: string };
class Stop extends Error {}

const name = (id: string | undefined) => (id ? pool.get(id)?.name ?? id : "?");
const sameList = (a: { cardId: string; count: number }[], b: { cardId: string; count: number }[]) => { const k = (l: typeof a) => l.map((e) => `${e.cardId}:${e.count}`).sort().join(); return k(a) === k(b); };
const archetypeOf = (deck: { cardId: string; count: number }[], fallback: string) => (Object.values(OPEN_DECKS).find((l) => sameList(l.decklist, deck))?.archetype ?? fallback) as "aggro" | "midrange" | "control" | "combo";

export interface Divergence { game: number; index: number; turn: number; step: string; kind: string; human: string; pilot: string; value?: number; playouts?: number; /** a card the pilot would have played now, that the human held: its name, whose turn it was, and when the human did play it */ held?: { card: string; object: string; ours: boolean; aim: string; later: "this turn" | "their next turn" | "a later turn" | "never" } }

async function diffGame(g: Saved, gi: number, out: Divergence[], counts: { decisions: number }): Promise<void> {
  const spec = g.spec, seat = (process.argv.includes("--seat") ? Number(arg("seat", "0")) : Math.max(0, spec.players.findIndex((p) => p.agent === "human"))) as 0 | 1, opp = (1 - seat) as 0 | 1;
  const decks: [string[], string[]] = [expandDecklist(spec.players[0].decklist), expandDecklist(spec.players[1].decklist)];
  const rules = { startingLife: spec.rules.startingLife ?? 20, handSize: spec.rules.handSize ?? 7, maxTurns: spec.rules.maxTurns ?? 100, ante: spec.rules.ante ?? 0, ...(spec.rules.startingPlayer !== undefined ? { startingPlayer: spec.rules.startingPlayer } : {}) };
  const myArch = arg("archetype", archetypeOf(spec.players[seat]!.decklist, "midrange")) as "aggro" | "midrange" | "control" | "combo", oppArch = (OPEN_DECKS[(g.list ?? "").replace(/^open:/, "")]?.archetype ?? archetypeOf(spec.players[opp]!.decklist, "midrange")) as "aggro" | "midrange" | "control" | "combo"; // a recorded game names the opponent's list (a tinkered sixty matches none by its cards)
  const agents = (seed: number, cold: boolean): [Agent, Agent] => {
    const mine = { ...difficultyProfile("master", myArch, [...spec.players[opp]!.decklist], [...spec.players[seat]!.decklist]), ...(cold ? { temperature: 0.01 } : {}) };
    const a = new HeuristicAgent(seed * 2 + 1, pool, mine), b = new HeuristicAgent(seed * 2 + 2, pool, difficultyProfile("master", oppArch, [...spec.players[seat]!.decklist], [...spec.players[opp]!.decklist]));
    return seat === 0 ? [a, b] : [b, a];
  };
  const entries = g.log.filter((e) => e.t === "ACTION") as { player: number; action: Action }[];
  // where each logged decision stood (one replay of the whole game)
  const at: { turn: number; active: number }[] = [];
  await replayThenPlay(pool, decks, g.log, entries.length, null, agents(1, true), 1, rules, spec.modifiers ?? [], undefined, (_req, view, _a, cursor) => { at[cursor] = { turn: view.turn, active: view.activePlayer }; });
  const isTap = (a: Action) => a.type === "tapForMana" || a.type === "untapForMana";
  const ATT = new Set(["declareAttacker", "doneDeclaringAttackers"]), BLK = new Set(["declareBlocker", "doneDeclaringBlockers"]);
  for (let i = 0; i < entries.length; ) {
    if (entries[i]!.player !== seat) { i++; continue; }
    // the human's unit
    let j = i; const first = entries[i]!.action;
    const group = ATT.has(first.type) ? ATT : BLK.has(first.type) ? BLK : null;
    if (group) { while (j < entries.length && entries[j]!.player === seat && group.has(entries[j]!.action.type) && !entries[j]!.action.type.startsWith("done")) j++; if (j < entries.length && entries[j]!.player === seat && entries[j]!.action.type.startsWith("done")) j++; }
    else { while (j < entries.length && entries[j]!.player === seat && isTap(entries[j]!.action)) j++; if (j < entries.length && entries[j]!.player === seat) j++; }
    const unit = entries.slice(i, j).map((e) => e.action), human = unit[unit.length - 1]!;
    if (isTap(human)) { i = j; continue; } // a payment the log does not finish
    // the pilot's answer at the same decision
    const mine: Action[] = []; let view0: GameView | null = null, req0: ActionRequest | null = null;
    try {
      await replayThenPlay(pool, decks, g.log, i, null, agents(7, true), 1, rules, spec.modifiers ?? [], (req, view, action) => {
        if (req.player !== seat) throw new Stop();
        if (!view0) { view0 = view; req0 = req; }
        mine.push(action);
        // (the pilot pays by hand too when it holds a counterspell — book 108: its taps and the cast after them are one answer)
        if (!group && isTap(action)) return;
        if (!group || action.type.startsWith("done") || !group.has(action.type)) throw new Stop();
      });
    } catch (e) { if (!(e instanceof Stop)) throw e; }
    if (!view0 || !req0 || mine.length === 0) { i = j; continue; }
    const v = view0 as GameView, r = req0 as ActionRequest;
    if (r.actions.filter((a) => !isTap(a)).length <= 1) { i = j; continue; } // no choice
    counts.decisions++;
    const cardAt = (a: Action) => { const id = (a as { objectId?: string }).objectId; return id ? v.hand.find((h) => h.objectId === id)?.cardId ?? v.battlefield.find((b) => b.id === id)?.cardId : undefined; };
    const pilot = mine[mine.length - 1]!;
    let kind = "", h = "", p = "";
    if (group === ATT) {
      const hs = unit.filter((a) => a.type === "declareAttacker").map((a) => (a as { objectId: string }).objectId).sort(), ps = mine.filter((a) => a.type === "declareAttacker").map((a) => (a as { objectId: string }).objectId).sort();
      if (hs.join() !== ps.join()) { kind = hs.length > ps.length ? "attack: the human sends more" : hs.length < ps.length ? "attack: the human sends fewer" : "attack: different attackers"; const nm = (ids: string[]) => ids.map((id) => name(v.battlefield.find((b) => b.id === id)?.cardId)).join(", ") || "nobody"; h = nm(hs); p = nm(ps); }
    } else if (group === BLK) {
      const key = (xs: Action[]) => xs.filter((a) => a.type === "declareBlocker").map((a) => { const b = a as { blocker: string; attacker: string }; return `${b.blocker}>${b.attacker}`; }).sort();
      const hs = key(unit), ps = key(mine);
      if (hs.join() !== ps.join()) { kind = hs.length > ps.length ? "block: the human blocks more" : hs.length < ps.length ? "block: the human blocks less" : "block: different blocks"; h = `${hs.length} block(s)`; p = `${ps.length} block(s)`; }
    } else if (JSON.stringify(human) !== JSON.stringify(pilot)) {
      const hc = cardAt(human), pc = cardAt(pilot), acts = (a: Action) => a.type === "castSpell" || a.type === "activateAbility" || a.type === "playLand";
      const aim = (a: Action) => { const t = ((a as { targets?: { kind: string; player?: number; id?: string }[] }).targets ?? [])[0]; return !t ? "" : t.kind === "player" ? (t.player === seat ? " at its own face" : " at the face") : ` at ${name(v.battlefield.find((b) => b.id === t.id)?.cardId ?? v.stack.find((x) => x.id === t.id)?.cardId ?? [...v.graveyardObjects[0], ...v.graveyardObjects[1]].find((x) => x.objectId === t.id)?.cardId)}`; };
      const say = (a: Action, c: string | undefined) => (a.type === "pass" ? "passes" : a.type === "playLand" ? `plays ${name(c)}` : a.type === "castSpell" ? `casts ${name(c)}${aim(a)}` : a.type === "activateAbility" ? `uses ${name(c)}${aim(a)}` : a.type);
      h = say(human, hc); p = say(pilot, pc);
      if (r.purpose !== "priority") kind = `${r.purpose}`;
      else if (human.type === "pass" && acts(pilot)) kind = pilot.type === "playLand" ? "the human holds a land the pilot plays" : "the human waits where the pilot acts";
      else if (acts(human) && pilot.type === "pass") kind = "the human acts where the pilot waits";
      else if (hc && hc === pc && human.type === pilot.type) kind = /face/.test(aim(human)) !== /face/.test(aim(pilot)) ? (/face/.test(aim(human)) ? "same spell: the human goes face, the pilot at a creature" : "same spell: the human at a creature, the pilot goes face") : "same spell, another target";
      else if (human.type === "playLand" && pilot.type === "playLand") kind = "which land";
      else if (human.type === "playLand" || pilot.type === "playLand") kind = "the order of the land and the spell";
      else kind = "which spell first";
    }
    if (kind) {
      const d: Divergence = { game: gi, index: i, turn: v.turn, step: v.step, kind, human: h, pilot: p };
      // a play the pilot wanted now and the human did not make: when did the human make it, if ever?
      if (!group && human.type === "pass" && (pilot.type === "castSpell" || pilot.type === "activateAbility")) {
        const obj = (pilot as { objectId: string }).objectId, t = ((pilot as { targets?: { kind: string; player?: number }[] }).targets ?? [])[0];
        const later = entries.findIndex((e, k) => k >= j && e.player === seat && e.action.type === pilot.type && (e.action as { objectId?: string }).objectId === obj);
        const when = later < 0 || !at[later] ? "never" : at[later]!.turn === v.turn ? "this turn" : at[later]!.turn === v.turn + 1 ? "their next turn" : "a later turn";
        d.held = { card: name(cardAt(pilot)), object: `${gi}:${obj}:${v.turn}`, ours: v.activePlayer === seat, aim: !t ? "" : t.kind === "player" ? "face" : "creature", later: when as never };
      }
      if (K > 0) {
        let hw = 0, pw = 0;
        for (let k = 0; k < K; k++) {
          const seed = 9000 + gi * 131 + i * 7 + k;
          const a = await replayThenPlay(pool, decks, g.log, j, null, agents(seed, false), seed, rules, spec.modifiers ?? [], undefined, undefined, true); // S59: both libraries reshuffled from the seed — K playouts are K samples
          const b = await replayThenPlay(pool, decks, g.log, i, null, agents(seed, false), seed, rules, spec.modifiers ?? [], undefined, undefined, true);
          hw += a.winner === seat ? 1 : 0; pw += b.winner === seat ? 1 : 0;
        }
        d.value = (hw - pw) / K; d.playouts = K;
      }
      out.push(d);
    }
    i = j;
  }
}

async function main(): Promise<void> {
  const files = process.argv.slice(2).filter((a) => a.endsWith(".json") && a !== arg("out", ""));
  if (!files.length) throw new Error("play-diff: give one or more saved games (.json)");
  const games: Saved[] = [];
  for (const f of files) {
    const j = JSON.parse(readFileSync(f, "utf8")) as Saved & { games?: Saved[] };
    if (Array.isArray(j.games)) games.push(...j.games.filter((x) => x?.spec && Array.isArray(x.log)));
    else if (j.spec && Array.isArray(j.log)) games.push(j);
    else console.error(`play-diff: ${f} holds no recorded game (a Convocation export from before S58 records results only)`);
  }
  // `--event <seed>`: only the games of that Convocation (a recording holds the newest thirty games, whatever the event)
  const only = arg("event", "");
  if (only) for (let i = games.length - 1; i >= 0; i--) if (String((games[i] as { eventSeed?: number }).eventSeed) !== only) games.splice(i, 1);
  if (!games.length) { console.log("No recorded games to read."); return; }
  const out: Divergence[] = [], counts = { decisions: 0 };
  for (const [gi, g] of games.entries()) { await diffGame(g, gi, out, counts); console.error(`game ${gi + 1} of ${games.length}: ${out.filter((d) => d.game === gi).length} divergences`); }
  const L: string[] = [`# The play diff — ${games.length} game(s), ${counts.decisions} decisions with a choice, ${out.length} where the human and the pilot differ (${Math.round((100 * out.length) / Math.max(1, counts.decisions))}%)\n`];
  const by = new Map<string, Divergence[]>(); for (const d of out) (by.get(d.kind) ?? by.set(d.kind, []).get(d.kind)!).push(d);
  const rows = [...by].sort((a, b) => b[1].length - a[1].length);
  const val = (ds: Divergence[]) => { const v = ds.filter((d) => d.value !== undefined); if (!v.length) return "–"; const m = v.reduce((a, d) => a + d.value!, 0) / v.length, n = v.reduce((a, d) => a + d.playouts!, 0), se = Math.sqrt(0.5 / Math.max(1, n)); return `${m >= 0 ? "+" : ""}${Math.round(100 * m)} ± ${Math.round(196 * se)} points`; };
  L.push(`*Each difference is played out ${K} time(s) a side; from S59 both libraries are reshuffled for each playout (the hands are as they were), so ${K} playouts are ${K} samples of the draws to come. Both lines are played on by the pilot.*\n`);
  L.push("| kind of difference | times | a game | the human's line less the pilot's (played out by the pilot) |", "|---|---|---|---|");
  for (const [k, ds] of rows) L.push(`| ${k} | ${ds.length} | ${(ds.length / games.length).toFixed(1)} | ${val(ds)} |`);
  L.push(`| **all** | ${out.length} | ${(out.length / games.length).toFixed(1)} | ${val(out)} |`, "");
  // the same, split by how the game ended for the human (a seat is the spec's "human" player, or --seat)
  const lostGame = (gi: number) => { const g = games[gi]!, seat = Math.max(0, g.spec.players.findIndex((p) => p.agent === "human")); return g.result ? g.result.winner !== seat : false; };
  const inLost = out.filter((d) => lostGame(d.game)), inWon = out.filter((d) => !lostGame(d.game));
  L.push(`In the ${games.filter((_, i) => lostGame(i)).length} games the human LOST: ${inLost.length} differences, ${val(inLost)}. In the ${games.filter((_, i) => !lostGame(i)).length} won: ${inWon.length}, ${val(inWon)}.`, "");
  L.push("Per game: " + games.map((g, i) => `${i + 1}. ${(g as { opponent?: string }).opponent ?? "?"} (${((g as { list?: string }).list ?? "").replace("open:", "")}, game ${(((g as { game?: number }).game ?? 0) + 1)}) ${lostGame(i) ? "lost" : "won"} — ${out.filter((d) => d.game === i).length} differences, ${val(out.filter((d) => d.game === i))}`).join("; ") + ".", "");
  for (const [k, ds] of rows.slice(0, 3)) {
    L.push(`## ${k} (${ds.length})`, "");
    const pairs = new Map<string, number>(); for (const d of ds) { const key = `the human ${d.human}; the pilot ${d.pilot}`; pairs.set(key, (pairs.get(key) ?? 0) + 1); }
    for (const [key, n] of [...pairs].sort((a, b) => b[1] - a[1]).slice(0, 8)) L.push(`- ${n}× ${key}`);
    L.push(`- by turn: ${[...new Set(ds.map((d) => d.turn))].sort((a, b) => a - b).map((t) => `t${t}:${ds.filter((d) => d.turn === t).length}`).join(" ")}`, "");
  }
  // The holds: one row a card held on a turn (a card held through six priority windows of a turn is one hold)
  const holds = new Map<string, NonNullable<Divergence["held"]>>(); for (const d of out) if (d.held && !holds.has(d.held.object)) holds.set(d.held.object, d.held);
  if (holds.size) {
    const hs = [...holds.values()], cnt = (f: (h: NonNullable<Divergence["held"]>) => boolean) => hs.filter(f).length;
    L.push(`## What the human held that the pilot would have played at once (${hs.length} holds: a card on a turn, however many windows it was held through)`, "");
    L.push("| card | holds | on our turn / theirs | the pilot's aim: face / creature | played later that turn | on the next turn | on a later turn | never |", "|---|---|---|---|---|---|---|---|");
    for (const c of [...new Set(hs.map((h) => h.card))].sort((a, b) => cnt((h) => h.card === b) - cnt((h) => h.card === a))) { const x = (f: (h: NonNullable<Divergence["held"]>) => boolean) => cnt((h) => h.card === c && f(h)); L.push(`| ${c} | ${x(() => true)} | ${x((h) => h.ours)} / ${x((h) => !h.ours)} | ${x((h) => h.aim === "face")} / ${x((h) => h.aim === "creature")} | ${x((h) => h.later === "this turn")} | ${x((h) => h.later === "their next turn")} | ${x((h) => h.later === "a later turn")} | ${x((h) => h.later === "never")} |`); }
    L.push("");
  }
  // The single decisions the playouts separate most (a lead to read by hand, not a verdict: K playouts a side)
  const swings = out.filter((d) => d.value !== undefined && Math.abs(d.value) >= 0.3).sort((a, b) => a.value! - b.value!);
  if (swings.length) {
    const row = (d: Divergence) => `- game ${d.game + 1} (${(games[d.game] as { opponent?: string }).opponent ?? "?"}, ${lostGame(d.game) ? "lost" : "won"}), turn ${d.turn} ${d.step}: the human ${d.human}; the pilot ${d.pilot} — the human's line ${d.value! >= 0 ? "+" : ""}${Math.round(100 * d.value!)} points over ${d.playouts} playouts a side`;
    L.push("## Where the pilot's line played out better (the human's choice cost most)", "", ...swings.filter((d) => d.value! < 0).slice(0, 12).map(row), "", "## Where the human's line played out better", "", ...swings.filter((d) => d.value! > 0).reverse().slice(0, 12).map(row), "");
  }
  const text = L.join("\n");
  console.log(text);
  const file = arg("out", ""); if (file) writeFileSync(file, text + "\n");
}
await main();
