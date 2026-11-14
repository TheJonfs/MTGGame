/**
 * pnpm mulligan-probe [files or directories …] [--out report.md]
 *
 * S72 Part 3 (the whole-turn probe's one lead — Earthrise's mulligans): every opening-hand decision of the human in his
 * recorded runs, against the pilot's rule (`mulliganChoice`: seven cards keep two to five lands; six keep two or more;
 * five or fewer always). Each game is replayed from its log only as far as its first spell. Per decision: the hand's
 * size, its land count, its mana sources (lands, and artifacts that make mana — the Moxen, the Lotus), the colours those
 * make, whether it holds a play by turn three (a nonland spell of mana value three or less, within the hand's sources by
 * then, its coloured pips within those colours), what he did, what the pilot would do, the turn of his first spell,
 * and the game's result. Games are taken once by seed (the "last 30" files overlap); a run is named by the first file
 * that holds the game. No playouts.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { manaValue, parseManaCost, type CardDef } from "@shandalar/cards";
import { expandDecklist, replayThenPlay, type Action, type ActionRequest, type GameView } from "@shandalar/engine";
import { RandomAgent } from "@shandalar/agents";

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1]! : d; };
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const OUT = arg("out", "");
const inputs = process.argv.slice(2).filter((f, i, all) => !f.startsWith("--") && !(all[i - 1] ?? "").startsWith("--"));
const files = (inputs.length ? inputs : [join(ROOT, "docs/debug_logs/recorded_games")]).flatMap((p) => (statSync(p).isDirectory() ? readdirSync(p).filter((f) => f.endsWith(".json")).sort().map((f) => join(p, f)) : [p]));

const COLORS = ["W", "U", "B", "R", "G"] as const;
const def = (id: string) => pool.get(id);
const isLand = (d?: CardDef) => !!d?.types.includes("Land");
/** The colours a land or mana artifact makes ("*" for any). */
function makes(d?: CardDef): Set<string> {
  const out = new Set<string>();
  for (const a of d?.abilities ?? []) if (a.kind === "activated") for (const e of a.effects) if (e.type === "addMana") {
    const m = (e as { mana?: string }).mana; if (m) for (const c of COLORS) if (m.includes(`{${c}}`)) out.add(c);
    if ((e as { choice?: unknown }).choice) out.add("*");
  }
  return out;
}
const manaArtifact = (d?: CardDef) => !!d && d.types.includes("Artifact") && !d.types.includes("Creature") && makes(d).size > 0;

interface Dec { run: string; size: number; lands: number; sources: number; colours: number; t3: boolean; human: "keep" | "mulligan"; pilot: "keep" | "mulligan"; firstSpell: number; won: boolean }
const decs: Dec[] = [];
const seen = new Set<number>();
let replayed = 0, failed = 0;
class Stop extends Error {}

for (const file of files) {
  let d: unknown; try { d = JSON.parse(readFileSync(file, "utf8")); } catch { continue; }
  const games = (d as { games?: unknown[] }).games ?? ((d as { spec?: unknown }).spec ? [d] : []);
  const run = basename(file).replace(/\.json$/, "").replace(/^convocation-games-(30-)?/, "");
  for (const g0 of games) {
    const g = g0 as { spec: { seed: number; players: { agent?: string; decklist: { cardId: string; count: number }[] }[]; rules: Record<string, unknown>; modifiers?: unknown[] }; log: { t: string; player?: number; action?: Action }[]; result?: { winner: number | null } };
    if (!g.spec || seen.has(g.spec.seed)) continue;
    const seat = g.spec.players.findIndex((p) => p.agent === "human");
    if (seat < 0) continue;
    seen.add(g.spec.seed);
    const decks: [string[], string[]] = [expandDecklist(g.spec.players[0]!.decklist), expandDecklist(g.spec.players[1]!.decklist)];
    const rules = { startingLife: 20, handSize: 7, maxTurns: 120, ante: 0, ...g.spec.rules } as never;
    const n = g.log.filter((e) => e.t === "ACTION").length;
    const mine: Omit<Dec, "firstSpell" | "won" | "run">[] = [];
    let first = -1;
    try {
      await replayThenPlay(pool, decks, g.log as never, n, null, [new RandomAgent(1), new RandomAgent(2)], 1, rules, (g.spec.modifiers ?? []) as never, undefined, (req: ActionRequest, v: GameView, a: Action) => {
        if (req.player !== seat) return;
        if (a.type === "keepHand" || a.type === "mulligan") {
          const hand = v.hand.map((c) => def(c.cardId));
          const size = 7 - v.mulliganCount;
          const lands = hand.filter(isLand).length, arts = hand.filter(manaArtifact).length;
          const cols = new Set<string>(); for (const h of hand) if (isLand(h) || manaArtifact(h)) for (const c of makes(h)) cols.add(c);
          const any = cols.has("*");
          const t3 = hand.some((h) => {
            if (!h || isLand(h) || manaArtifact(h)) return false;
            const cost = parseManaCost(h.manaCost), mv = manaValue(cost);
            if (mv > 3 || mv > Math.min(lands, 3) + arts) return false;
            const pipsOk = COLORS.every((c) => cost.colored[c] === 0 || any || cols.has(c)) && cost.hybrid.every((pair) => any || pair.some((c) => cols.has(c)));
            return pipsOk;
          });
          const pilot = size <= 5 ? "keep" : size === 7 ? (lands >= 2 && lands <= 5 ? "keep" : "mulligan") : lands >= 2 ? "keep" : "mulligan";
          mine.push({ size, lands, sources: lands + arts, colours: any ? 5 : cols.size, t3, human: a.type === "keepHand" ? "keep" : "mulligan", pilot });
        } else if (a.type === "castSpell" && first < 0) { first = Math.ceil(v.turn / 2); throw new Stop(); }
      });
      replayed++;
    } catch (e) { if (!(e instanceof Stop)) { failed++; if (mine.length === 0) continue; } else replayed++; }
    const won = g.result?.winner === seat;
    for (const m of mine) decs.push({ ...m, run, firstSpell: first, won });
  }
}

const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "–");
const rate = (xs: Dec[]) => `${xs.filter((x) => x.won).length}/${xs.length} (${pct(xs.filter((x) => x.won).length, xs.length)})`;
const mean = (xs: number[]) => (xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : "–");
const shape = (x: Dec) => `${x.size} cards, ${x.lands} land${x.lands === 1 ? "" : "s"}${x.sources > x.lands ? ` + ${x.sources - x.lands} mana artifact` : ""}, ${x.t3 ? "a play by turn 3" : "no play by turn 3"}`;
const lines: string[] = [`# Chris's mulligans against the pilot's rule — ${seen.size} games (${replayed} replayed, ${failed} diverged), ${decs.length} opening decisions`, ""];
const cell = (h: string, p: string) => decs.filter((x) => x.human === h && x.pilot === p);
lines.push("| he | the pilot | decisions | games won (after) | first spell (his turn, mean) |", "|---|---|---|---|---|");
for (const [h, p] of [["keep", "keep"], ["mulligan", "mulligan"], ["mulligan", "keep"], ["keep", "mulligan"]] as const) { const xs = cell(h, p); lines.push(`| ${h} | ${p} | ${xs.length} | ${rate(xs)} | ${mean(xs.filter((x) => x.firstSpell > 0).map((x) => x.firstSpell))} |`); }
const group = (title: string, xs: Dec[]) => {
  const m = new Map<string, Dec[]>(); for (const x of xs) { const k = shape(x); m.set(k, [...(m.get(k) ?? []), x]); }
  lines.push("", `## ${title} (${xs.length})`, "", "| hand | times | games won | runs |", "|---|---|---|---|");
  for (const [k, v] of [...m].sort((a, b) => b[1].length - a[1].length)) lines.push(`| ${k} | ${v.length} | ${rate(v)} | ${[...new Set(v.map((x) => x.run))].join(", ")} |`);
};
group("He sent back what the pilot keeps", cell("mulligan", "keep"));
group("He kept what the pilot sends back", cell("keep", "mulligan"));
// by land count at seven, both decisions
lines.push("", "## Seven-card hands by land count", "", "| lands | his keeps (won) | his mulligans (won) | the pilot |", "|---|---|---|---|");
for (let l = 0; l <= 7; l++) { const xs = decs.filter((x) => x.size === 7 && x.lands === l); if (!xs.length) continue; lines.push(`| ${l} | ${rate(xs.filter((x) => x.human === "keep"))} | ${rate(xs.filter((x) => x.human === "mulligan"))} | ${l >= 2 && l <= 5 ? "keep" : "mulligan"} |`); }
lines.push("", "## Seven-card keeps by a play by turn three", "", "| | his keeps (won) |", "|---|---|", `| a play by turn 3 | ${rate(decs.filter((x) => x.size === 7 && x.human === "keep" && x.t3))} |`, `| no play by turn 3 | ${rate(decs.filter((x) => x.size === 7 && x.human === "keep" && !x.t3))} |`);
lines.push("", "## By run (disagreements)", "", "| run | decisions | he mulligans, the pilot keeps | he keeps, the pilot mulligans |", "|---|---|---|---|");
for (const r of [...new Set(decs.map((x) => x.run))]) { const xs = decs.filter((x) => x.run === r); const a = xs.filter((x) => x.human === "mulligan" && x.pilot === "keep"), b = xs.filter((x) => x.human === "keep" && x.pilot === "mulligan"); if (a.length || b.length) lines.push(`| ${r} | ${xs.length} | ${a.length} (${rate(a)}) | ${b.length} (${rate(b)}) |`); }
const text = lines.join("\n") + "\n";
if (OUT) writeFileSync(OUT, text);
console.log(text);
