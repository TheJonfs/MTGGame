import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { expandDecklist, replayGame, type Modifier } from "@shandalar/engine";
import { MatchController } from "./match-controller.js";
import { LoopRecorder } from "./repeat.js";

const pool = loadCardPool(join(dirname(fileURLToPath(import.meta.url)), "../../../../data/cards")).cards;
const perm = (player: 0 | 1, cardId: string): Modifier => ({ type: "permanentOnBattlefield", player, cardId });
const tick = () => new Promise((r) => setTimeout(r, 0));

/** The Usher's own loop (book 99): an Usher cast with Ushers in our graveyard. `theirs` stands on the opponent's side. */
function usherMatch(theirs: string[] = [], life = 20): MatchController {
  return new MatchController(pool, { humanSeat: 0, seed: 7, aiDelayMs: 0, custom: {
    human: { name: "me", decklist: [{ cardId: "the_usher", count: 30 }, { cardId: "swamp", count: 10 }] },
    enemy: { name: "ai", decklist: [{ cardId: "grizzly_bears", count: 30 }, { cardId: "forest", count: 10 }], difficulty: "master", archetype: "midrange" },
    rules: { startingLife: life, ante: 0, startingPlayer: 0 },
    modifiers: [...["swamp", "swamp", "plains", "mountain", "swamp"].map((l) => perm(0, l)), ...theirs.map((x) => perm(1, x)), { type: "effectAtStart", player: 0, effects: [{ type: "mill", count: 6, who: "you" }] } as Modifier],
  } });
}
/** Answer whatever is on screen the same way every time (the first choice; cast the Usher when we can), counting the decisions shown. */
async function drive(c: MatchController, until: () => boolean, max = 400): Promise<number> {
  let shown = 0;
  for (let g = 0; g < max && !c.result; g++) {
    await tick();
    if (until() || c.result) break;
    const k = c.phase.kind;
    if (k === "waiting") continue;
    shown += 1;
    if (k === "dialog") { c.selectDialog(0); c.confirmDialog(); }
    else if (k === "stackStop") c.continueFromStop();
    else if (k === "confirmCast") c.confirmCast();
    else if (k === "priority") {
      const usher = c.game.state.stack.length === 0 && c.game.state.step === "MAIN1" ? c.game.state.players[0].hand.find((id) => c.game.state.objects[id]!.cardId === "the_usher" && c.phase.kind === "priority" && (c.phase as { castable: Map<string, unknown> }).castable.has(id)) : undefined;
      if (usher && !c.game.state.battlefield.some((id) => c.game.state.objects[id]!.cardId === "the_usher")) c.clickHand(usher); else c.pass();
    }
  }
  return shown;
}

describe("the repeat (post-S54, Chris — a demonstrated loop, shortcut)", () => {
  it("the Usher's loop: after it has come round, the loop is offered with what a pass moves and the passes to the end; the repeat wins the game without another decision, and the log replays", async () => {
    const c = usherMatch([], 60); // sixty life: fifteen passes at four a pass
    const done = c.start();
    const manual = await drive(c, () => c.loopOffer !== null);
    expect(c.loopOffer, "the loop is demonstrated").not.toBeNull();
    const offer = c.loopOffer!;
    expect(offer.life).toEqual([4, -4]); // both Ushers see each death
    expect(offer.toEnd).toBe(Math.ceil(c.game.state.players[1].life / 4));
    expect(c.game.state.players[1].life).toBeLessThan(60); // it took real passes to demonstrate
    expect(manual).toBeGreaterThan(2);
    const lifeBefore = c.game.state.players[1].life;
    // one pass, then the decision is ours again and the loop still stands
    c.repeatLoop(1);
    for (let g = 0; g < 200 && (c.repeating || c.phase.kind === "waiting"); g++) await tick();
    expect(c.game.state.players[1].life).toBe(lifeBefore - 4);
    expect(c.result).toBeNull();
    expect(c.loopOffer).not.toBeNull();
    // to the end
    c.repeatLoop(c.loopOffer!.toEnd!);
    const r = await done;
    expect(r.winner).toBe(0);
    expect(r.reason).toBe("LIFE");
    const replayed = await replayGame(pool, [expandDecklist(c.spec.players[0].decklist), expandDecklist(c.spec.players[1].decklist)], r.log, { startingLife: 60, handSize: 7, maxTurns: 100, ante: 0, startingPlayer: 0 } as never, c.spec.modifiers);
    expect(replayed).toBe(r.finalStateSerialized); // every repeated step is a logged action like any other
  }, 60_000);

  it("Chris's loop — the Usher, a Restoration Angel and an Altar of Dementia: the Angel is a new object every pass (sacrificed, returned, blinking the Usher), and the loop is still seen, described and repeated to the end", async () => {
    const c = new MatchController(pool, { humanSeat: 0, seed: 21, aiDelayMs: 0, custom: {
      human: { name: "me", decklist: [{ cardId: "restoration_angel", count: 30 }, { cardId: "plains", count: 10 }] },
      enemy: { name: "ai", decklist: [{ cardId: "grizzly_bears", count: 30 }, { cardId: "forest", count: 10 }], difficulty: "master", archetype: "midrange" },
      rules: { startingLife: 20, ante: 0, startingPlayer: 0 },
      modifiers: [...["plains", "plains", "plains", "plains", "altar_of_dementia", "the_usher"].map((l) => perm(0, l))],
    } });
    const done = c.start();
    const inner = c as unknown as { human: { current(): { request: { purpose: string; actions: import("@shandalar/engine").Action[] } } | null }; answer(a: import("@shandalar/engine").Action): void };
    const st = () => c.game.state, card = (id: string | undefined) => (id ? st().objects[id]?.cardId : undefined);
    const angelOut = () => st().battlefield.some((id) => card(id) === "restoration_angel");
    let decisions = 0;
    // the line, played by hand: cast the Angel; with its trigger on the stack sacrifice it to the Altar (the mill at the
    // opponent); the Usher blinks and returns the Angel; again
    for (let g = 0; g < 600 && !c.result && !c.loopOffer; g++) {
      await tick();
      if (c.phase.kind === "stackStop") { c.continueFromStop(); continue; }
      const cur = inner.human.current(); if (!cur || c.loopOffer) continue;
      const A = cur.request.actions; decisions += 1;
      const tgt = (a: import("@shandalar/engine").Action) => ((a as { targets?: { kind: string; id?: string; player?: number }[] }).targets ?? [])[0];
      let pick = A[0]!;
      if (cur.request.purpose === "priority") {
        const altar = A.find((a) => a.type === "activateAbility" && card(a.objectId) === "altar_of_dementia" && tgt(a)?.kind === "player" && tgt(a)?.player === 1);
        const cast = A.find((a) => a.type === "castSpell" && card(a.objectId) === "restoration_angel");
        pick = angelOut() && st().stack.length > 0 && altar ? altar : !angelOut() && st().stack.length === 0 && st().step === "MAIN1" && st().activePlayer === 0 && cast ? cast : (A.find((a) => a.type === "pass") ?? A[0]!);
      } else if (A.some((a) => a.type === "sacrifice")) pick = A.find((a) => a.type === "sacrifice" && card(a.objectId) === "restoration_angel") ?? A[0]!;
      else if (A.some((a) => a.type === "acceptOptional")) pick = A.find((a) => a.type === "acceptOptional")!;
      else if (A.some((a) => a.type === "chooseTriggerTargets")) pick = A.find((a) => card(tgt(a)?.id) === "restoration_angel") ?? A.find((a) => card(tgt(a)?.id) === "the_usher") ?? A[0]!;
      inner.answer(pick);
    }
    expect(c.loopOffer, "the loop is demonstrated").not.toBeNull();
    const offer = c.loopOffer!;
    expect(offer.life).toEqual([2, -2]); // the Usher drains for the Angel's death
    expect(offer.libs).toEqual([0, -3]); // the Altar mills the Angel's power
    expect(offer.cycle.length).toBeGreaterThanOrEqual(3); // several decisions a pass — what the shortcut saves
    const before = decisions, life = st().players[1].life;
    c.repeatLoop(offer.toEnd!);
    const r = await done;
    expect(r.winner).toBe(0);
    expect(life).toBeGreaterThan(8); // the repeat did the killing: at least four more passes
    expect(decisions).toBe(before);
  }, 60_000);

  it("a repeat asked for more passes than the game has simply ends the game; one asked past the cap is capped", async () => {
    const c = usherMatch();
    const done = c.start();
    await drive(c, () => c.loopOffer !== null);
    c.repeatLoop(10_000);
    expect(c.repeating?.total ?? 200).toBeLessThanOrEqual(200);
    expect((await done).winner).toBe(0);
  }, 60_000);

  it("the repeat stops at the first decision that is not the recorded one, and that decision is the player's", async () => {
    const c = usherMatch([], 60);
    void c.start();
    await drive(c, () => c.loopOffer !== null);
    // tamper with the recording: the second step now expects a board that will never be
    const inner = c as unknown as { repeat: { cycle: { fp: string }[] } | null };
    c.repeatLoop(5);
    if (inner.repeat && inner.repeat.cycle.length > 1) inner.repeat.cycle = inner.repeat.cycle.map((s, i) => (i === 1 ? { ...s, fp: "never" } : s)) as never;
    const life = c.game.state.players[1].life;
    for (let g = 0; g < 200 && (c.repeating || c.phase.kind === "waiting"); g++) await tick();
    expect(c.repeating).toBeNull();
    expect(c.phase.kind).not.toBe("waiting"); // the decision is on screen
    expect(c.combatNotice).toMatch(/The loop stopped after 0 of 5/);
    expect(c.game.state.players[1].life).toBeGreaterThanOrEqual(life - 4); // no pass completed
    expect(c.result).toBeNull();
    c.concede();
  }, 60_000);

  it("the recorder: no offer for a decision never seen, for passes alone, or when nothing moved; an offer names what moved and the passes to the end", () => {
    const view = (life: [number, number], libs: [number, number], turn = 3) => ({ turn, life, librarySizes: libs }) as never;
    const r = new LoopRecorder();
    r.record(view([20, 20], [30, 30]), "A", "priority", '{"type":"activateAbility"}');
    r.record(view([20, 20], [30, 30]), "B", "chooseTarget", '{"type":"chooseTriggerTargets"}');
    expect(r.offer(view([20, 20], [30, 27]), "C", 0)).toBeNull(); // never seen
    expect(r.offer(view([20, 20], [30, 30]), "A", 0)).toBeNull(); // nothing moved (a tap and its take-back)
    const o = r.offer(view([22, 18], [30, 27]), "A", 0)!;
    expect(o.cycle.map((s) => s.fp)).toEqual(["A", "B"]);
    expect([o.life, o.libs]).toEqual([[2, -2], [0, -3]]);
    expect(o.toEnd).toBe(9); // 18 life at two a pass and 27 cards at three: nine either way
    expect(r.offer(view([22, 18], [30, 27], 4), "A", 0)).toBeNull(); // another turn
    const p = new LoopRecorder();
    p.record(view([20, 20], [30, 30]), "A", "priority", '{"type":"pass"}');
    expect(p.offer(view([20, 18], [30, 30]), "A", 0)).toBeNull(); // passing is not a loop
  });
});
