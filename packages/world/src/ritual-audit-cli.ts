/**
 * Post-S70 (the Mountain ritual's price): why the card goes uncast. The master pilot plays a list against the Open's
 * field; each of its own main phases with an empty stack and the ritual castable and paying for itself is sorted by
 * what the hand then holds. A window the pilot passes with a payoff in reach is the pilot's error; one with no payoff
 * is the deck's. tsx ritual-audit-cli.ts <deck.json> <cost> <from> [gamesAPairing] [mcycle cost]
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { manaValue, parseManaCost, type CardDef } from "@shandalar/cards";
import { runMatch, type Action, type ActionRequest, type Agent, type GameView, type MatchSpec } from "@shandalar/engine";
import { HeuristicAgent, difficultyProfile } from "@shandalar/agents";
import { FORMAT_FIELD } from "@shandalar/sim/open-decks";
import { variantDef } from "./card-variants.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const [deckFile, cost, from, gamesArg, mcycle] = process.argv.slice(2);
const n = Number(gamesArg ?? 15);
const cards = new Map(loadCardPool(join(ROOT, "data/cards")).cards) as Map<string, CardDef>;
cards.set("red_ritual", JSON.parse(readFileSync(join(ROOT, "data/cards-study/red_ritual.json"), "utf8")) as CardDef);
cards.set("red_ritual", variantDef(`red_ritual~cost=${cost}${mcycle ? `~mcycle=${mcycle}` : ""}`, cards));
cards.get("red_ritual")!.id = "red_ritual";
const deck = (JSON.parse(readFileSync(deckFile!, "utf8")) as { cardId: string; count: number }[]).map((e) => (e.cardId === from ? { ...e, cardId: "red_ritual" } : e));
const copies = deck.find((e) => e.cardId === "red_ritual")!.count;
const ownCost = manaValue(parseManaCost(cost!));
const t = { games: 0, wins: 0, noDraw: 0, castGames: 0, heldGames: 0, cast: 0, reach: 0, xHeld: 0, nothing: 0, notPositive: 0, cycled: 0 };
const field = Object.values(FORMAT_FIELD.open!).filter((l) => l.key !== "warband");
for (const opp of field) for (let g = 1; g <= n; g++) {
  const seat = (g % 2) as 0 | 1, seed = 7100 + g * 13;
  const inner = new HeuristicAgent(seed, cards, difficultyProfile("master", "midrange", [...opp.decklist], deck));
  const foe = new HeuristicAgent(seed + 1, cards, difficultyProfile("master", opp.archetype, deck, [...opp.decklist]));
  let drew = false, casts = 0, lastWindow = "";
  const pilot: Agent = { chooseAction: async (v: GameView, r: ActionRequest): Promise<Action> => {
    const a = await inner.chooseAction(v, r);
    if (r.purpose !== "priority") return a;
    if (a.type === "activateAbility" && v.hand.find((h) => h.objectId === a.objectId)?.cardId === "red_ritual") t.cycled++;
    if (v.hand.some((h) => h.cardId === "red_ritual")) drew = true;
    if (a.type === "castSpell" && v.hand.find((h) => h.objectId === a.objectId)?.cardId === "red_ritual") { casts++; t.cast++; return a; }
    const key = `${v.turn}`;
    if (a.type === "pass" && v.activePlayer === v.you && (v.step === "MAIN1" || v.step === "MAIN2") && v.stack.length === 0 && key !== lastWindow && r.actions.some((x) => x.type === "castSpell" && v.hand.find((h) => h.objectId === x.objectId)?.cardId === "red_ritual")) {
      lastWindow = key;
      const mine = v.battlefield.filter((o) => o.controller === v.you);
      const mountains = mine.filter((o) => (cards.get(o.cardId)?.subtypes ?? []).includes("Mountain")).length;
      const avail = mine.filter((o) => !o.tapped && cards.get(o.cardId)?.types.includes("Land")).length;
      const after = avail - ownCost + mountains;
      if (mountains <= ownCost) t.notPositive++;
      else {
        const spells = v.hand.map((h) => cards.get(h.cardId)!).filter((d) => !d.types.includes("Land") && d.id !== "red_ritual");
        if (spells.some((d) => { const mv = manaValue(parseManaCost(d.manaCost)); return mv > avail && mv <= after; })) t.reach++;
        else if (spells.some((d) => /\{X\}/.test(d.manaCost))) t.xHeld++;
        else t.nothing++;
      }
    }
    return a;
  } };
  const me = { name: "me", decklist: deck, agent: "x" }, them = { name: opp.key, decklist: [...opp.decklist], agent: "x" };
  const spec = { seed, players: seat === 0 ? [me, them] : [them, me], rules: { startingLife: 20, handSize: 7, mulligan: "london", maxTurns: 100, startingPlayer: 0 }, modifiers: [] } as MatchSpec;
  const res = await runMatch(spec, cards, seat === 0 ? [pilot, foe] : [foe, pilot]);
  t.games++; if (res.winner === seat) t.wins++;
  if (!drew) t.noDraw++; else if (casts > 0) t.castGames++; else t.heldGames++;
}
console.log(`${deckFile!.split("/").pop()} ${cost} x${copies}: ${t.games} games, ${(100 * t.wins / t.games).toFixed(1)}% wins; never seen ${t.noDraw}, cast ${t.castGames}, seen but never cast ${t.heldGames}; ${t.cast} casts, ${t.cycled} cycled. Windows passed: payoff in reach ${t.reach}, X spell held ${t.xHeld}, no payoff ${t.nothing}, too few Mountains ${t.notPositive}`);
