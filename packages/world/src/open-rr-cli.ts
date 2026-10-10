/**
 * pnpm open:rr [--games N] [--seed S] [--shard i/n] [--only key] [--out file] | --merge file1 file2 … --out file
 *   --only key   run only the pairings that include that list (re-measuring one amended list);
 *   --merge      a LATER file's games replace an earlier file's for the same pairing.
 *   --sideboarded   post-S54: every seat plays the sixty it would bring to games two and three against that opponent
 *                (its built fifteen, the field's three rules) — run beside a plain run on the same seed.
 *   --swap key:from:n:to[;from:n:to…]   post-S55 (Chris: tuning a list): n copies of a card in list `key` replaced IN
 *                PLACE (the same slot, so the same shuffle — card-test's paired method). `to` may be a card-test variant
 *                (`protocol~cost={1}{U}~shrink=3`: the card with fields overridden, for this run only). Run with --only key on the
 *                seed of a plain run and compare game by game.
 *   --deck key:file.json[:archetype]   S58: a whole new sixty in that list's seat (a build under test); --swap then edits it.
 *   --vs k1,k2    with --only: only the pairings against those lists (a matchup study at more games).
 *   --sideboarded-one   S56: in each game ONE seat plays its sideboarded sixty against the other's registered sixty
 *                (the lists take turns, two games each) — beside a plain run on the same seed, a list's own
 *                sideboarding is read from the games where it was the one (each game records `boarded`).
 *   --shapes none|a,b   S56: with --sideboarded, only those of sideboard-ai's rules 5–8 run (sweepers, creatureCounters,
 *                steal, blockers); `none` is the S55 sideboarding and the S55 fifteen. Default: all four.
 *   --no-guide / --guide-drop c1,c2   S58: a guided fifteen sideboarded by the rules instead, or by its guide without the rows that bring those cards in.
 *   --built-fifteen k1,k2   S58: those lists sideboard from the field builder's fifteen instead of their registered one.
 *   --out-rule none|dead,four,rule9   S57 (Part 4): which of the out-rule's parts run (sideboard-ai SideboardOutRule).
 *   --matches N   S59 (ADR-171): N best-of-three MATCHES a pairing instead of games — game one on the registered sixties,
 *                games two and three sideboarded (each seat's fifteen, the event's own sideboarding), the coin and
 *                the loser's choice of the play as the event plays a series (`MatchSeries`). Each game records its
 *                match and its number. `--matches-report file…` prints the three columns: the match, game one,
 *                games two and three, each with its 95% interval, and the game-one → later delta.
 *   --trial rule[,rule] [--trial-for k1,k2]   S58 (ADR-167): a candidate rule switched ON for every seat or those lists (profile.trial).
 *   --off rule[,rule] [--off-for k1,k2]   S56: the OLD pilot — those S56 rules ("counter") switched off, for every
 *                seat or only for those lists. Run beside a plain run on the same seed: each game has its twin.
 *   --journeyman k1,k2   S54 (ADR-158's test): those lists are piloted by journeyman (every other seat master) — run
 *                with --only on the same seed as a master run, and every game is paired with its master twin.
 *
 * S46 (Part 4): the Open's round-robin — every pair of the twelve lists (sim/open-decks), N games per pairing, seats
 * alternating, master both, 20 life, no entrances. Per game it records the winner and the reason, and per seat the
 * cards CAST (castSpell) and PLAYED (playLand — the High Grounds and the Library are lands) and, for the Loop, the
 * turn its three pieces (the Usher and an Altar on the battlefield, a Restoration Angel in hand or play) first stand
 * together plus its Altar activations. `--shard` splits the pairings across processes; `--merge` joins the shards and
 * prints the table and the reads. A Lab run holds one pairing across a grid, so this writes its own shape.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { runMatch, type Action, type ActionRequest, type Agent, type GameView, type MatchSpec } from "@shandalar/engine";
import { HeuristicAgent, difficultyProfile } from "@shandalar/agents";
import { OPEN_DECKS, OPEN_FIELD } from "@shandalar/sim/open-decks";
import { OPEN_FORMAT } from "./formats.js";
import { variantDef } from "./card-variants.js";
import { MatchSeries } from "./series.js";
import { mostPlayed, staples } from "./open-reference.js";
import { buildSideboard } from "./constructed-builder.js";
import { AI_SIDEBOARD_CONSTRUCTED, SIDEBOARD_SHAPES, aiSideboard, answersCreatures, answersRelics, type AiSideboardTerms } from "./sideboard-ai.js";
import type { CardRatingTable } from "./rating.js";
import type { Decklist } from "./state.js";

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1]! : d; };
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
// S56 (ADR-164): the round-robin is the field's — an archived list is out of it (`--with-archived` brings it back for a look)
const KEYS = Object.keys(process.argv.includes("--with-archived") ? OPEN_DECKS : OPEN_FIELD);

type SeatLog = { cast: Record<string, number>; played: Record<string, number>; loopTurn?: number; altarActs?: number };
type Game = { a: string; b: string; seatA: 0 | 1; winner: "a" | "b" | "draw"; reason: string; turns: number; logA: SeatLog; logB: SeatLog; boarded?: string ; /** S59 (--matches): the match's index in its pairing and the game's number in the match (0, 1, 2) */ match?: number; gameNo?: number };

class Tracker implements Agent {
  log: SeatLog = { cast: {}, played: {} };
  constructor(private inner: Agent, private loop: boolean) {}
  async chooseAction(view: GameView, req: ActionRequest): Promise<Action> {
    const a = await this.inner.chooseAction(view, req);
    const cardOf = (id: string) => view.hand.find((c) => c.objectId === id)?.cardId ?? view.battlefield.find((b) => b.id === id)?.cardId;
    if (a.type === "castSpell") { const c = cardOf(a.objectId); if (c) this.log.cast[c] = (this.log.cast[c] ?? 0) + 1; }
    if (a.type === "playLand") { const c = cardOf(a.objectId); if (c) this.log.played[c] = (this.log.played[c] ?? 0) + 1; }
    if (this.loop) {
      if (a.type === "activateAbility" && cardOf(a.objectId) === "altar_of_dementia") this.log.altarActs = (this.log.altarActs ?? 0) + 1;
      if (this.log.loopTurn === undefined) {
        const mine = (id: string) => view.battlefield.some((o) => o.controller === view.you && o.cardId === id);
        if (mine("the_usher") && mine("altar_of_dementia") && (mine("restoration_angel") || view.hand.some((c) => c.cardId === "restoration_angel"))) this.log.loopTurn = view.turn;
      }
    }
    return a;
  }
}

async function run(): Promise<void> {
  const pool = loadCardPool(join(ROOT, "data/cards")).cards;
  const G = Number(arg("games", "100")), seed0 = Number(arg("seed", "46")), [si, sn] = arg("shard", "0/1").split("/").map(Number) as [number, number];
  const one = process.argv.includes("--sideboarded-one");
  const M = Number(arg("matches", "0"));
  const sideboarded = one || M > 0 || process.argv.includes("--sideboarded") || process.argv.includes("--sideboarded-only");
  const rating = sideboarded ? (JSON.parse(readFileSync(join(ROOT, "data/convocation/card-rating.json"), "utf8")) as CardRatingTable) : null;
  const fifteen = new Map<string, Decklist>();
  const builtFor = new Set(arg("built-fifteen", "").split(",").filter(Boolean)); // S58: those lists use the field builder's fifteen, not their registered one
  const outArg = process.argv.includes("--out-rule") ? arg("out-rule", "none") : null; // S57: none | dead,four,rule9 (any of)
  const shapesArg = arg("shapes", "all"), { shapes: _all, ...s55 } = AI_SIDEBOARD_CONSTRUCTED;
  const terms: AiSideboardTerms = shapesArg === "all" ? AI_SIDEBOARD_CONSTRUCTED : shapesArg === "none" ? s55 : { ...s55, shapes: { perShape: SIDEBOARD_SHAPES.perShape, ...Object.fromEntries(shapesArg.split(",").map((k) => { if (!(k in SIDEBOARD_SHAPES) || k === "perShape") throw new Error(`open:rr --shapes: no shape ${k}`); return [k, SIDEBOARD_SHAPES[k as keyof typeof SIDEBOARD_SHAPES]]; })) } };
  // `--sideboarded-only k1,k2`: only those lists sideboard (one side's swaps against the other's registered sixty)
  const boardedOnly = new Set(arg("sideboarded-only", "").split(",").filter(Boolean));
  const boarded = (me: (typeof OPEN_DECKS)[string], them: (typeof OPEN_DECKS)[string]): Decklist => {
    if (!rating || (boardedOnly.size > 0 && !boardedOnly.has(me.key))) return me.decklist;
    // (S56: a list's own registered fifteen where it has one — the Pall's, the Kiln's — as the event plays it)
    if (!fifteen.has(me.key)) fifteen.set(me.key, me.sideboard && !builtFor.has(me.key) ? [...me.sideboard] : buildSideboard(me.decklist, OPEN_FORMAT, rating, pool, answersRelics, answersCreatures, !!terms.shapes));
    return aiSideboard(me.decklist, fifteen.get(me.key)!, them.decklist, pool, rating, (() => { const { outRule: keptOut, ...rest0 } = terms;
      const out = outArg === null ? (keptOut ? { outRule: keptOut } : {}) : outArg === "none" ? {} : { outRule: { deadFirst: outArg.includes("dead"), keepFourOfs: outArg.includes("four"), deadOut: outArg.includes("rule9") ? 3 : 0 } };
      return { ...rest0, ...out, ...(process.argv.includes("--counters-stay") ? { countersStay: true } : {}), ...(process.argv.includes("--no-guide") ? { noGuide: true } : {}), ...(arg("guide-drop", "") ? { guideDrop: arg("guide-drop", "").split(",") } : {}) }; })()).deck;
  };
  const swapArg = arg("swap", "");
  // S58 (a new build tried in a list's seat): `--deck key:file.json[:archetype]` — the file is a decklist ([{cardId, count}], sixty)
  const deckArg = arg("deck", "");
  const BASE: typeof OPEN_DECKS = deckArg ? (() => {
    const [key, file, archetype] = deckArg.split(":") as [string, string, string | undefined];
    const base = OPEN_DECKS[key]; if (!base) throw new Error(`open:rr --deck: no list ${key}`);
    const list = JSON.parse(readFileSync(file, "utf8")) as Decklist;
    for (const e of list) if (!pool.has(e.cardId)) throw new Error(`open:rr --deck: no card ${e.cardId}`);
    if (list.reduce((a, e) => a + e.count, 0) !== 60) throw new Error(`open:rr --deck: ${file} is ${list.reduce((a, e) => a + e.count, 0)} cards`);
    const { sideboard: _s, ...rest } = base;
    return { ...OPEN_DECKS, [key]: { ...rest, decklist: list, ...(archetype ? { archetype: archetype as typeof base.archetype } : {}) } };
  })() : OPEN_DECKS;
  const DECKS: typeof OPEN_DECKS = swapArg ? (() => {
    const [key, ...rest] = swapArg.split(":"), swaps = rest.join(":").split(";").map((x) => x.split(":") as [string, string, string]);
    const base = BASE[key!]; if (!base) throw new Error(`open:rr --swap: no list ${key}`);
    let list = base.decklist.map((e) => ({ ...e }));
    for (const [from, n, to] of swaps) {
      if (!pool.has(to)) pool.set(to, variantDef(to, pool)); // S56: a variant spec (card-test's: `protocol~cost={1}{U}~shrink=3`) is a card of this run
      const i = list.findIndex((e) => e.cardId === from); if (i < 0 || list[i]!.count < Number(n)) throw new Error(`open:rr --swap: ${key} does not hold ${n} ${from}`);
      list = [...list.slice(0, i), ...[{ cardId: from, count: list[i]!.count - Number(n) }, { cardId: to, count: Number(n) }].filter((e) => e.count > 0), ...list.slice(i + 1)];
    }
    if (list.reduce((a, e) => a + e.count, 0) !== 60) throw new Error("open:rr --swap: the list is no longer sixty");
    return { ...BASE, [key!]: { ...base, decklist: list } };
  })() : BASE;
  const vs = arg("vs", "").split(",").filter(Boolean);
  const only = arg("only", ""), journeyman = new Set(arg("journeyman", "").split(",").filter(Boolean));
  const trial = arg("trial", "").split(",").filter(Boolean), trialFor = new Set(arg("trial-for", "").split(",").filter(Boolean)); // S58: a rule on trial for those lists
  const off = arg("off", "").split(",").filter(Boolean), offFor = new Set(arg("off-for", "").split(",").filter(Boolean));
  const profile = (d: (typeof OPEN_DECKS)[string], o: (typeof OPEN_DECKS)[string]) => ({ ...difficultyProfile(pilot(d.key), d.archetype, [...o.decklist], [...d.decklist]), ...(off.length && (offFor.size === 0 || offFor.has(d.key)) ? { off } : {}), ...(trial.length && (trialFor.size === 0 || trialFor.has(d.key)) ? { trial } : {}) });
  const pilot = (key: string) => (journeyman.has(key) ? "journeyman" : "master");
  const pairs: [string, string][] = [];
  for (let i = 0; i < KEYS.length; i++) for (let j = i + 1; j < KEYS.length; j++) pairs.push([KEYS[i]!, KEYS[j]!]);
  const games: Game[] = [];
  for (let p = 0; p < pairs.length; p++) {
    if (p % sn !== si) continue;
    const [ka, kb] = pairs[p]!;
    if (only && ka !== only && kb !== only) continue;
    if (only && vs.length && !vs.includes(ka === only ? kb : ka)) continue;
    const A = DECKS[ka]!, B = DECKS[kb]!;
    // S59 (ADR-171): matches — the event's own series (the coin, the loser's choice, sideboarded from game two)
    for (let m = 0; m < M; m++) {
      const series = new MatchSeries({ seed: seed0 + p * 1009 + m * 37 });
      const A1 = { ...A, decklist: boarded(A, B) }, B1 = { ...B, decklist: boarded(B, A) };
      while (!series.done) {
        const game = series.nextGame("play"), [d0, d1] = game.index === 0 ? [A, B] : [A1, B1];
        const spec = { seed: game.seed, players: [{ name: d0.key, decklist: [...d0.decklist], agent: "heuristic:master" }, { name: d1.key, decklist: [...d1.decklist], agent: "heuristic:master" }], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 100, startingPlayer: game.startingPlayer }, modifiers: [] } as unknown as MatchSpec;
        const t0 = new Tracker(new HeuristicAgent(game.seed * 2 + 1, pool, profile(d0, d1)), false), t1 = new Tracker(new HeuristicAgent(game.seed * 2 + 2, pool, profile(d1, d0)), false);
        const r = await runMatch(spec, pool, [t0, t1]);
        series.record(game, r);
        games.push({ a: ka, b: kb, seatA: 0, winner: r.winner === null ? "draw" : r.winner === 0 ? "a" : "b", reason: r.reason, turns: r.turns, logA: t0.log, logB: t1.log, match: m, gameNo: game.index });
      }
    }
    for (let g = 0; g < (M > 0 ? 0 : G); g++) {
      const seatA = (g % 2) as 0 | 1;
      const seed = seed0 + p * 1009 + g * 37;
      const turn = one ? ((g >> 1) % 2 === 0 ? ka : kb) : undefined;
      const [d0, d1] = (seatA === 0 ? [A, B] : [B, A]).map((d, i, both) => ({ ...d, decklist: turn && d.key !== turn ? d.decklist : boarded(d, both[1 - i]!) })) as [typeof A, typeof B];
      const spec = { seed, players: [{ name: d0.key, decklist: [...d0.decklist], agent: "heuristic:master" }, { name: d1.key, decklist: [...d1.decklist], agent: "heuristic:master" }], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 100 }, modifiers: [] } as unknown as MatchSpec;
      const t0 = new Tracker(new HeuristicAgent(seed * 2 + 1, pool, profile(d0, d1)), d0.key === "loop");
      const t1 = new Tracker(new HeuristicAgent(seed * 2 + 2, pool, profile(d1, d0)), d1.key === "loop");
      const r = await runMatch(spec, pool, [t0, t1]);
      const tA = seatA === 0 ? t0 : t1, tB = seatA === 0 ? t1 : t0;
      games.push({ a: ka, b: kb, seatA, winner: r.winner === null ? "draw" : r.winner === seatA ? "a" : "b", reason: r.reason, turns: r.turns, logA: tA.log, logB: tB.log, ...(turn ? { boarded: turn } : {}) });
    }
    console.error(`shard ${si}/${sn}: ${ka} vs ${kb} done`);
  }
  const out = arg("out", join(ROOT, `analysis/runs/open_rr_shard${si}.json`));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ games: G, seed: seed0, shard: `${si}/${sn}`, results: games }));
}

/** S59 (ADR-171): the three columns from `--matches` files — per list, and the pairings whose game-one → later delta is largest. */
function matchesReport(): void {
  const files = process.argv.slice(process.argv.indexOf("--matches-report") + 1).filter((f) => !f.startsWith("--") && f !== arg("out", ""));
  const games = files.flatMap((f) => (JSON.parse(readFileSync(f, "utf8")) as { results: Game[] }).results).filter((g) => g.match !== undefined);
  type T = { mw: number; mn: number; g1w: number; g1n: number; lw: number; ln: number };
  const blank = (): T => ({ mw: 0, mn: 0, g1w: 0, g1n: 0, lw: 0, ln: 0 });
  const byList: Record<string, T> = {}, byPair: Record<string, T> = {};
  const matches = new Map<string, Game[]>();
  for (const g of games) { const k = `${g.a}|${g.b}|${g.match}`; (matches.get(k) ?? matches.set(k, []).get(k)!).push(g); }
  for (const gs of matches.values()) {
    const { a, b } = gs[0]!, wa = gs.filter((g) => g.winner === "a").length, wb = gs.filter((g) => g.winner === "b").length;
    for (const [me, them, side, mine, theirs] of [[a, b, "a", wa, wb], [b, a, "b", wb, wa]] as const) {
      for (const t of [(byList[me] ??= blank()), (byPair[`${me}|${them}`] ??= blank())]) {
        t.mn += 1; t.mw += mine > theirs ? 1 : mine === theirs ? 0.5 : 0;
        for (const g of gs) { const w = g.winner === side ? 1 : g.winner === "draw" ? 0.5 : 0; if (g.gameNo === 0) { t.g1n += 1; t.g1w += w; } else { t.ln += 1; t.lw += w; } }
      }
    }
  }
  const r = (w: number, n: number) => (n ? (100 * w) / n : 0), ci = (w: number, n: number) => (n ? 196 * Math.sqrt(((w / n) * (1 - w / n)) / n) : 0);
  const cell = (w: number, n: number) => `${r(w, n).toFixed(1)} ± ${ci(w, n).toFixed(1)}`;
  const lines = [`# The Open in matches (ADR-171) — ${matches.size} best-of-three matches, ${games.length} games; game one on the registered sixties, games two and three sideboarded\n`,
    "| list | matches | game one | games two and three | delta (later − game one) |", "|---|---|---|---|---|"];
  for (const k of Object.keys(byList).sort((x, y) => r(byList[y]!.mw, byList[y]!.mn) - r(byList[x]!.mw, byList[x]!.mn))) { const t = byList[k]!; lines.push(`| **${k}** | ${cell(t.mw, t.mn)} | ${cell(t.g1w, t.g1n)} | ${cell(t.lw, t.ln)} | ${(r(t.lw, t.ln) - r(t.g1w, t.g1n) >= 0 ? "+" : "") + (r(t.lw, t.ln) - r(t.g1w, t.g1n)).toFixed(1)} |`); }
  const pairs = Object.entries(byPair).map(([k, t]) => ({ k, t, d: r(t.lw, t.ln) - r(t.g1w, t.g1n) })).filter((x) => x.d > 0).sort((x, y) => y.d - x.d).slice(0, 20);
  lines.push("\n## The pairings that move most after sideboarding (the row list's side; each is its opponent's loss)\n", "| pairing | matches | game one | games two and three | delta |", "|---|---|---|---|---|");
  for (const { k, t, d } of pairs) lines.push(`| ${k.replace("|", " over ")} | ${r(t.mw, t.mn).toFixed(0)} (${t.mn}) | ${r(t.g1w, t.g1n).toFixed(0)} | ${r(t.lw, t.ln).toFixed(0)} (${t.ln}) | +${d.toFixed(0)} |`);
  const md = lines.join("\n") + "\n";
  const out = arg("out", ""); if (out) { mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, md); writeFileSync(out.replace(/\.md$/, ".json"), JSON.stringify({ byList, byPair })); }
  console.log(md);
}

function merge(): void {
  const files = process.argv.slice(process.argv.indexOf("--merge") + 1).filter((f) => !f.startsWith("--") && f !== arg("out", ""));
  // A later file replaces an earlier one's games for the same pairing (an amended list re-measured with --only).
  const byPair = new Map<string, Game[]>();
  for (const f of files) {
    const fresh = new Map<string, Game[]>();
    for (const g of (JSON.parse(readFileSync(f, "utf8")) as { results: Game[] }).results) { const k = `${g.a}|${g.b}`; (fresh.get(k) ?? fresh.set(k, []).get(k)!).push(g); }
    for (const [k, v] of fresh) byPair.set(k, v);
  }
  const games: Game[] = [...byPair.values()].flat();
  const wins: Record<string, Record<string, [number, number]>> = {};
  const logs: Record<string, SeatLog[]> = {};
  const decked: Record<string, { wins: number; byLibrary: number }> = {};
  for (const g of games) {
    for (const [me, them, won, log] of [[g.a, g.b, g.winner === "a", g.logA], [g.b, g.a, g.winner === "b", g.logB]] as const) {
      const cell = ((wins[me] ??= {})[them] ??= [0, 0]);
      cell[0] += won ? 1 : 0; cell[1] += 1;
      (logs[me] ??= []).push(log);
      const d = (decked[me] ??= { wins: 0, byLibrary: 0 });
      if (won) { d.wins += 1; if (g.reason === "DECKED") d.byLibrary += 1; }
    }
  }
  const pct = (w: number, n: number) => (n ? Math.round((100 * w) / n) : 0);
  const lines: string[] = [];
  lines.push(`# The Open's round-robin (S46) — ${games.length} games, master both, 20 life, no entrances; the ROW's win rate\n`);
  lines.push(`| | ${KEYS.join(" | ")} | **mean** |`, `|---|${KEYS.map(() => "---").join("|")}|---|`);
  const means: Record<string, number> = {};
  for (const r of KEYS) {
    let w = 0, n = 0;
    const cells = KEYS.map((c) => { if (c === r) return "—"; const x = wins[r]?.[c] ?? [0, 0]; w += x[0]; n += x[1]; return `${pct(x[0], x[1])}`; });
    means[r] = pct(w, n);
    lines.push(`| **${r}** | ${cells.join(" | ")} | **${means[r]}** |`);
  }
  lines.push(`\nSolvable (a list over 65% against the field): ${KEYS.filter((k) => means[k]! > 65).join(", ") || "none"}. Under 35%: ${KEYS.filter((k) => means[k]! < 35).join(", ") || "none"}.`);
  const mw = wins.muster?.warband ?? [0, 0];
  lines.push(`Muster vs Warband: the Muster ${pct(mw[0], mw[1])}% (${mw[1]} games).`);
  const u = decked.undertow;
  if (u) lines.push(`The Undertow's wins by library: ${u.byLibrary} of ${u.wins} (${pct(u.byLibrary, u.wins)}%).`);
  // S58 (ADR-170): staples are watched, not capped — a nonland card in more than half the field is named here
  { const cardsAll = loadCardPool(join(ROOT, "data/cards")).cards, field = KEYS.map((k) => OPEN_DECKS[k]!), skip = OPEN_FORMAT.rule.restricted ?? [];
    const st = staples(field, cardsAll, skip), nm = (id: string) => cardsAll.get(id)?.name ?? id;
    lines.push(`\n## Staples (ADR-170)\n`, `In more than half of the ${field.length} lists: ${st.length ? st.map((x) => `${nm(x.cardId)} (${x.lists} lists, ${x.copies} copies)`).join("; ") : "none"}. The most played: ${mostPlayed(field, cardsAll, skip, 8).map((x) => `${nm(x.cardId)} ${x.lists}`).join(" · ")}.`); }
  lines.push(`\n## Restricted cards — % of the list's games in which it was cast (or, a land, played)\n`);
  const restricted = OPEN_FORMAT.rule.restricted!;
  for (const k of KEYS) {
    const has = OPEN_DECKS[k]!.decklist.filter((e) => restricted.includes(e.cardId)).map((e) => e.cardId);
    if (!has.length) continue;
    const L = logs[k] ?? [];
    lines.push(`- **${k}**: ${has.map((c) => `${c} ${pct(L.filter((l) => (l.cast[c] ?? 0) + (l.played[c] ?? 0) > 0).length, L.length)}%`).join(" · ")}`);
  }
  const KEY: Record<string, string[]> = {
    coin: ["the_usher", "blood_artist", "bitterblossom"], undertow: ["hedron_crab", "zinnia_the_undertow", "traumatizer"], larder: ["entomb", "buried_alive", "zombify", "graceful_restoration"],
    muster: ["glorious_anthem", "vitalist", "emeria_angel"], warband: ["siege_gang_commander", "goblin_chieftain", "goblin_grenade"], tally: ["young_pyromancer", "guttersnipe", "ponder"],
    locks: ["the_dredger", "counterspell", "wrath_of_god"], wurmspeaker: ["seedborn_muse", "rampaging_baloths", "gaean_wurm"], ford: ["the_fordkeeper", "vitalist", "spirit_link"],
    enchantress: ["ovna_the_enchantress", "angelic_destiny", "rancor"], levy: ["emeria_angel", "dread_presence", "isaura_the_levy"], loop: ["the_usher", "restoration_angel", "altar_of_dementia"],
  };
  lines.push(`\n## Key pieces — % of the list's games in which each was cast (a weak pilot reads apart from a weak list)\n`);
  for (const k of KEYS) { const L = logs[k] ?? []; lines.push(`- **${k}**: ${(KEY[k] ?? []).map((c) => `${c} ${pct(L.filter((l) => (l.cast[c] ?? 0) > 0).length, L.length)}%`).join(" · ")}`); }
  const loop = logs.loop ?? [];
  const by10 = loop.filter((l) => l.loopTurn !== undefined && l.loopTurn <= 10).length;
  lines.push(`\n## The Loop — the Usher + an Altar on the battlefield with a Restoration Angel in hand or play\n`);
  lines.push(`Assembled by turn ten in ${by10} of ${loop.length} games (${pct(by10, loop.length)}%); ever: ${loop.filter((l) => l.loopTurn !== undefined).length}. Altar activations per game: ${(loop.reduce((n, l) => n + (l.altarActs ?? 0), 0) / Math.max(1, loop.length)).toFixed(2)}.`);
  const text = lines.join("\n");
  console.log(text);
  const out = arg("out", join(ROOT, "analysis/runs/open_rr_1.json"));
  writeFileSync(out, JSON.stringify({ name: "open_rr_1", when: new Date().toISOString(), games: games.length, table: wins, means, report: text }, null, 1));
  writeFileSync(out.replace(/\.json$/, ".md"), text + "\n");
}

if (process.argv.includes("--matches-report")) matchesReport();
else if (process.argv.includes("--merge")) merge();
else await run();
