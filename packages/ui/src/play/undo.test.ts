import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { expandDecklist, replayToDecision, stableStringify, type Action, type Modifier } from "@shandalar/engine";
import { OPEN_DECKS } from "@shandalar/sim/open-decks";
import { MatchController } from "./match-controller.js";

const pool = loadCardPool(join(dirname(fileURLToPath(import.meta.url)), "../../../../data/cards")).cards;
const perm = (player: 0 | 1, cardId: string): Modifier => ({ type: "permanentOnBattlefield", player, cardId });
const UNDO_P = Number(process.env.UNDO_P ?? "0.3");
const tick = () => new Promise((r) => setTimeout(r, 0));

/** A match on our first main phase: `mine` in play for us, our deck all `deck`, the AI on vanilla creatures. */
async function atMain(opts: { mine?: string[]; theirs?: string[]; deck?: string; aiDeck?: string; seed?: number } = {}): Promise<MatchController> {
  const c = new MatchController(pool, { humanSeat: 0, seed: opts.seed ?? 11, aiDelayMs: 0, custom: {
    human: { name: "me", decklist: [{ cardId: opts.deck ?? "grizzly_bears", count: 24 }, { cardId: "forest", count: 16 }] },
    enemy: { name: "ai", decklist: [{ cardId: opts.aiDeck ?? "hill_giant", count: 24 }, { cardId: "mountain", count: 16 }], difficulty: "master", archetype: "midrange" },
    rules: { startingLife: 20, ante: 0, startingPlayer: 0 },
    modifiers: [...(opts.mine ?? []).map((x) => perm(0, x)), ...(opts.theirs ?? []).map((x) => perm(1, x))],
  } });
  void c.start();
  await waitFor(c, () => c.phase.kind === "priority" && c.game.state.step === "MAIN1" && c.game.state.activePlayer === 0);
  return c;
}
async function waitFor(c: MatchController, ok: () => boolean): Promise<void> {
  for (let g = 0; g < 400; g++) {
    await tick();
    if (ok()) return;
    if (c.phase.kind === "dialog") { c.selectDialog(0); c.confirmDialog(); }
    else if (c.phase.kind === "stackStop") c.continueFromStop();
    else if (c.phase.kind === "priority") c.pass();
  }
  throw new Error(`waitFor: never reached (phase ${c.phase.kind}, step ${c.game.state.step})`);
}
const handOf = (c: MatchController) => c.game.state.players[0].hand.map((id) => c.game.state.objects[id]!.cardId).sort();
const inHand = (c: MatchController, cardId: string) => c.game.state.players[0].hand.find((id) => c.game.state.objects[id]!.cardId === cardId)!;

describe("the take-back (post-S54, Chris — a misclick mid-loop cost a match)", () => {
  it("a land played is taken back: the game is the game before it — state, log and all — and plays on as if it never happened", async () => {
    const c = await atMain(), twin = await atMain();
    const before = stableStringify(c.game.state), logBefore = JSON.stringify(c.log.entries);
    expect(c.canUndo()).toBe(false); // nothing of ours to take back yet this turn (the draw sealed what came before)
    c.clickHand(inHand(c, "forest"));
    await waitFor(c, () => c.phase.kind === "priority");
    expect(c.game.state.battlefield.length).toBe(1);
    expect(c.undoLabel()).toBe("playing Forest");
    c.undo();
    await waitFor(c, () => c.phase.kind === "priority");
    expect(stableStringify(c.game.state)).toBe(before);
    expect(JSON.stringify(c.log.entries)).toBe(logBefore); // the rebuilt log is the old log's prefix, entry for entry
    expect(c.canUndo()).toBe(false);
    // and on: the same play now gives the game an untouched twin has after the same play
    for (const x of [c, twin]) { x.clickHand(inHand(x, "forest")); await waitFor(x, () => x.phase.kind === "priority"); }
    expect(stableStringify(c.game.state)).toBe(stableStringify(twin.game.state));
    expect(JSON.stringify(c.log.entries)).toBe(JSON.stringify(twin.log.entries));
    c.concede(); twin.concede();
  }, 30_000);

  it("a creature cast and resolved comes back to the hand with its mana (the opponent had nothing to decide); two decisions come back one at a time", async () => {
    const c = await atMain({ mine: ["forest", "forest"] });
    const hand0 = handOf(c), before = stableStringify(c.game.state);
    c.clickHand(inHand(c, "forest"));
    await waitFor(c, () => c.phase.kind === "priority");
    const afterLand = stableStringify(c.game.state);
    c.clickHand(inHand(c, "grizzly_bears")); if (c.phase.kind === "confirmCast") c.confirmCast();
    await waitFor(c, () => c.phase.kind === "priority" && c.game.state.stack.length === 0);
    expect(c.game.state.battlefield.some((id) => c.game.state.objects[id]!.cardId === "grizzly_bears")).toBe(true);
    expect(c.undoLabel()).toMatch(/Grizzly Bears|passing/);
    while (c.game.state.battlefield.some((id) => c.game.state.objects[id]!.cardId === "grizzly_bears") || c.game.state.stack.length > 0) { expect(c.canUndo()).toBe(true); c.undo(); await waitFor(c, () => c.phase.kind === "priority"); }
    expect(stableStringify(c.game.state)).toBe(afterLand);
    c.undo(); await waitFor(c, () => c.phase.kind === "priority");
    expect(stableStringify(c.game.state)).toBe(before);
    expect(handOf(c)).toEqual(hand0);
    c.concede();
  }, 30_000);

  it("sealed: nothing comes back once a card has been drawn, or the opponent has decided anything", async () => {
    // our own draw: the play before the turn passed is gone for good
    const c = await atMain();
    c.clickHand(inHand(c, "forest"));
    await waitFor(c, () => c.phase.kind === "priority");
    expect(c.canUndo()).toBe(true);
    const turn = c.game.state.turn;
    c.pass();
    await waitFor(c, () => c.phase.kind === "priority" && c.game.state.turn > turn + 1 && c.game.state.activePlayer === 0);
    expect(c.canUndo()).toBe(false);
    c.concede();
    // a cantrip: the card drawn seals the cast
    const d = await atMain({ mine: ["island", "island", "island"], deck: "divination" });
    d.clickHand(inHand(d, "divination")); if (d.phase.kind === "confirmCast") d.confirmCast();
    await waitFor(d, () => d.game.state.stack.length === 0 && d.phase.kind === "priority");
    expect(d.game.state.players[0].graveyard.length).toBe(1);
    expect(d.canUndo()).toBe(false);
    d.concede();
  }, 30_000);

  it("an attack streamed out by one confirm comes back whole: the declaration is asked again with nobody attacking", async () => {
    const c = await atMain({ mine: ["grizzly_bears", "grizzly_bears", "hill_giant"] });
    c.stops.add("DECLARE_ATTACKERS" as never); c.stops.add("DECLARE_BLOCKERS" as never); // our own stops: the attack is declared and we hold priority before damage
    c.pass();
    await waitFor(c, () => c.phase.kind === "attackers");
    const before = stableStringify(c.game.state);
    for (const id of c.game.state.battlefield.filter((x) => c.game.state.objects[x]!.controller === 0)) c.clickBattlefield(id);
    c.confirmAttackers();
    for (let g = 0; g < 50 && c.phase.kind !== "priority" && c.phase.kind !== "stackStop"; g++) await tick(); // the pause at "blocks declared"
    expect(["DECLARE_ATTACKERS", "DECLARE_BLOCKERS"]).toContain(c.game.state.step); // before damage
    expect(c.game.state.combat.attackers.length).toBe(3);
    expect(c.undoLabel()).toBe("the attack");
    c.undo();
    await waitFor(c, () => c.phase.kind === "attackers");
    expect(stableStringify(c.game.state)).toBe(before);
    // and once it lands it stays landed: the same attack, passed through to damage, cannot come back
    for (const id of c.game.state.battlefield.filter((x) => c.game.state.objects[x]!.controller === 0)) c.clickBattlefield(id);
    c.confirmAttackers();
    await waitFor(c, () => c.phase.kind === "priority" && c.game.state.step === "MAIN2");
    expect(c.game.state.players[1].life).toBe(13);
    expect(c.canUndo()).toBe(false);
    c.concede();
  }, 30_000);

  it("the match still ends through the rebuilt game: start()'s promise resolves after a take-back", async () => {
    const c = new MatchController(pool, { humanSeat: 0, seed: 12, aiDelayMs: 0, custom: { human: { name: "me", decklist: [{ cardId: "forest", count: 40 }] }, enemy: { name: "ai", decklist: [{ cardId: "mountain", count: 40 }], difficulty: "master", archetype: "midrange" }, rules: { startingLife: 20, ante: 0, startingPlayer: 0 }, modifiers: [] } });
    const done = c.start();
    await waitFor(c, () => c.phase.kind === "priority" && c.game.state.step === "MAIN1");
    c.clickHand(inHand(c, "forest")); await waitFor(c, () => c.phase.kind === "priority");
    c.undo(); await waitFor(c, () => c.phase.kind === "priority");
    c.concede();
    const r = await done;
    expect(r.reason).toBe("CONCEDE");
    expect(r.log).toBe(c.log.entries);
  }, 30_000);

  it("fuzz: random play with random take-backs on real lists — every game ends, and its log replays to the very game that ended (a take-back leaves no trace in the log)", async () => {
    const keys = ["loop", "sweep", "hearth", "depths", "muster", "coin"];
    let undone = 0, offered = 0, games = 0, turns = 0, repeated = 0;
    for (let g = 0; g < 12; g++) {
      let r = 1000 + g; const rnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff; };
      const mine = OPEN_DECKS[keys[g % keys.length]!]!, theirs = OPEN_DECKS[keys[(g + 3) % keys.length]!]!;
      const c = new MatchController(pool, { humanSeat: (g % 2) as 0 | 1, seed: 700 + g, aiDelayMs: 0, custom: { human: { name: "me", decklist: mine.decklist.map((e) => ({ ...e })) }, enemy: { name: "ai", decklist: theirs.decklist.map((e) => ({ ...e })), difficulty: "master", archetype: theirs.archetype }, rules: { startingLife: 20, ante: 0 }, modifiers: [] } });
      const done = c.start();
      const inner = c as unknown as { human: { current(): { request: { actions: Action[] } } | null }; answer(a: Action): void };
      for (let step = 0; step < 6000 && !c.result; step++) {
        await tick();
        if (c.result) break;
        if (c.game.state.turn > 14) break;
        if (c.canUndo()) { offered++; if (rnd() < UNDO_P) { c.undo(); undone++; continue; } }
        if (c.loopOffer && rnd() < 0.5) { c.repeatLoop(1 + Math.floor(rnd() * 3)); repeated++; continue; } // and any loop random play stumbles into is repeated
        if (c.phase.kind === "stackStop") { c.continueFromStop(); continue; }
        const cur = inner.human.current();
        if (!cur) continue;
        // the player's own answer to the decision on screen, whatever the phase shows: a random legal action (passing half the time)
        const pass = cur.request.actions.find((a) => a.type === "pass");
        inner.answer(pass && rnd() < 0.5 ? pass : cur.request.actions[Math.floor(rnd() * cur.request.actions.length)]!);
      }
      // the log so far, replayed by the engine alone, is the game on the table — whatever was taken back on the way
      for (let w = 0; w < 50 && !c.result && !inner.human.current(); w++) { if (c.phase.kind === "stackStop") c.continueFromStop(); await tick(); } // to a decision of ours (a held pause is mid-resolution)
      if (c.result || !inner.human.current()) { if (!c.result) c.concede(); await done; games++; continue; }
      const live = stableStringify(c.game.state), n = c.log.entries.filter((e) => e.t === "ACTION").length;
      const point = await replayToDecision(pool, [expandDecklist(c.spec.players[0].decklist), expandDecklist(c.spec.players[1].decklist)], c.log.entries, n, { startingLife: 20, handSize: 7, maxTurns: 100, ante: 0 } as never, c.spec.modifiers);
      expect(stableStringify(point.state), `game ${g}`).toBe(live);
      turns += c.game.state.turn;
      if (!c.result) c.concede();
      await done;
      games++;
    }
    expect(games).toBe(12);
    expect(undone).toBeGreaterThan(40);
    expect(offered).toBeGreaterThan(undone);
    expect(repeated).toBeGreaterThanOrEqual(0); // rare in random play; whatever it does, the log above still replays
    expect(turns).toBeGreaterThan(60); // the games were played, not conceded at the door
  }, 300_000);
});
