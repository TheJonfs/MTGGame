/**
 * Post-S70 (the Mountain ritual's price): the master pilot against a seat that only passes. Same deck and seeds per
 * price; reports the kill turn, the casts, how many were followed by another spell that turn (a cast with nothing after
 * it is the pilot's waste), and what the mana bought.
 * tsx ritual-goldfish-cli.ts <deck.json> <cost> [games] [from]   — cost "none" keeps the deck as written; else the
 * `from` slot (default seasoned_pyromancer) is the ritual at that cost.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import type { CardDef } from "@shandalar/cards";
import { runMatch, type Action, type ActionRequest, type Agent, type GameView, type MatchSpec } from "@shandalar/engine";
import { HeuristicAgent, difficultyProfile } from "@shandalar/agents";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const [deckFile, cost, gamesArg, from = "seasoned_pyromancer"] = process.argv.slice(2);
const games = Number(gamesArg ?? 300);
const cards = new Map(loadCardPool(join(ROOT, "data/cards")).cards) as Map<string, CardDef>;
const ritual = JSON.parse(readFileSync(join(ROOT, "data/cards-study/red_ritual.json"), "utf8")) as CardDef;
if (cost !== "none") cards.set("red_ritual", { ...ritual, manaCost: cost! });
const base = JSON.parse(readFileSync(deckFile!, "utf8")) as { cardId: string; count: number }[];
const deck = cost === "none" ? base : base.map((e) => (e.cardId === from ? { ...e, cardId: "red_ritual" } : e));
const passer: Agent = { chooseAction: async (_v, r: ActionRequest) => r.actions.find((a) => a.type === "pass") ?? r.actions[0]! };

const kills: number[] = [], bought = new Map<string, number>();
let casts = 0, wasted = 0, undecided = 0;
for (let seed = 1; seed <= games; seed++) {
  const inner = new HeuristicAgent(0, cards, { ...difficultyProfile("master", "midrange", [{ cardId: "forest", count: 60 }]) });
  let open: { turn: number } | null = null;
  const pilot: Agent = { chooseAction: async (v: GameView, r: ActionRequest): Promise<Action> => {
    const a = await inner.chooseAction(v, r);
    if (open && (v.turn !== open.turn)) { wasted++; open = null; }
    if (a.type === "castSpell") {
      const id = v.hand.find((h) => h.objectId === a.objectId)?.cardId ?? "?";
      if (id === "red_ritual") { casts++; if (open) { /* a second: the chain */ } open = { turn: v.turn }; }
      else if (open) { bought.set(id, (bought.get(id) ?? 0) + 1); open = null; }
    }
    return a;
  } };
  const spec = { seed, players: [{ name: "me", decklist: deck, agent: "x" }, { name: "wall", decklist: [{ cardId: "forest", count: 60 }], agent: "x" }], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 30, startingPlayer: 0 }, modifiers: [] } as MatchSpec;
  const r = await runMatch(spec, cards, [pilot, passer]);
  if (r.winner === 0) kills.push(Math.ceil(r.turns / 2)); else undecided++;
}
kills.sort((a, b) => a - b);
const mean = kills.reduce((n, k) => n + k, 0) / Math.max(1, kills.length);
const at = (t: number) => (100 * kills.filter((k) => k <= t).length) / games;
console.log(`${cost}: mean kill on our turn ${mean.toFixed(2)}; by T5 ${at(5).toFixed(1)}% T6 ${at(6).toFixed(1)}% T7 ${at(7).toFixed(1)}% T8 ${at(8).toFixed(1)}%; no kill ${undecided}; rituals cast ${casts} (${(casts / games).toFixed(2)} a game), nothing after ${wasted}; bought: ${[...bought].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${k} ${n}`).join(", ")}`);
