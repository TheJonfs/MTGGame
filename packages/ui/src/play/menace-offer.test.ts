import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards/loader";
import { MatchController } from "./match-controller.js";
import type { Modifier } from "@shandalar/engine";

const CARDS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../../data/cards");
const pool = loadCardPool(CARDS_DIR).cards;
const perm = (player: 0 | 1, cardId: string): Modifier => ({ type: "permanentOnBattlefield", player, cardId });

/**
 * Post-S42b (Chris's report: attacked by two creatures, one with menace, holding two untapped and two tapped creatures,
 * and offered no block). The engine and the controller are driven through a real game: the human attacks with two
 * Pikers on turn one (so two are tapped when the AI swings back with a Brute and a Baloth) and the blockers phase
 * must arrive carrying every legal block. The sibling case — the block step legitimately skipped — must SAY why.
 */
async function drive(opts: { mine: string[]; theirs: string[]; attackFirst: number }): Promise<{ blockers: { options: Map<string, Set<string>>; board: string[]; attackers: string[] }[]; notices: string[]; attacks: string[] }> {
  const c = new MatchController(pool, {
    humanSeat: 0, seed: 7, aiDelayMs: 0,
    custom: {
      human: { name: "me", decklist: [{ cardId: "goblin_piker", count: 20 }, { cardId: "mountain", count: 20 }] },
      enemy: { name: "ai", decklist: [{ cardId: "boggart_brute", count: 20 }, { cardId: "mountain", count: 20 }], difficulty: "journeyman", archetype: "aggro" },
      rules: { startingLife: 12, ante: 0, startingPlayer: 0 },
      modifiers: [...opts.mine.map((id) => perm(0, id)), ...opts.theirs.map((id) => perm(1, id)), { type: "startingLife", player: 1, value: 40 }],
    },
  });
  const notices: string[] = [];
  const origNotice = (c as unknown as { showNotice: (t: string) => void }).showNotice.bind(c);
  (c as unknown as { showNotice: (t: string) => void }).showNotice = (t: string) => { notices.push(t); origNotice(t); };
  const done = c.start();
  const blockers: { options: Map<string, Set<string>>; board: string[]; attackers: string[] }[] = [];
  const attacks = new Set<string>();
  let attacked = false, guard = 0;
  const name = (id: string) => pool.get(c.game.state.objects[id]!.cardId)!.name;
  while (!c.result && guard++ < 4000) {
    await new Promise((r) => setTimeout(r, 0));
    const phase = c.phase;
    const st = c.game.state;
    if (st.activePlayer === 1 && st.combat.attackers.length > 0) attacks.add(`T${st.turn}: ${st.combat.attackers.map(name).join(", ")}`);
    switch (phase.kind) {
      case "priority": c.pass(); break;
      case "stackStop": c.continueFromStop(); break;
      case "attackers": if (!attacked) { for (const id of [...phase.eligible].slice(0, opts.attackFirst)) c.clickBattlefield(id); attacked = true; } c.confirmAttackers(); break;
      case "blockers": {
        const board = st.battlefield.filter((id) => st.objects[id]?.controller === 0 && pool.get(st.objects[id]!.cardId)!.types.includes("Creature")).map((id) => `${name(id)}${st.objects[id]!.tapped ? "(T)" : ""}`);
        blockers.push({ options: phase.options, board, attackers: st.combat.attackers.map(name) });
        c.confirmBlocks(); break;
      }
      case "dialog": c.selectDialog(0); c.confirmDialog(); break;
      case "confirmCast": c.confirmCast(); break;
      default: break;
    }
    if (st.turn > 2) { c.concede(); break; }
  }
  await done;
  return { blockers, notices, attacks: [...attacks] };
}

describe("menace and the offer to block (post-S42b, Chris's report)", () => {
  it("a Brute (menace) and a Baloth attack into two untapped and two tapped Pikers: the blockers phase arrives with every legal block — both untapped Pikers onto either attacker", async () => {
    const r = await drive({ mine: ["goblin_piker", "goblin_piker", "goblin_piker", "goblin_piker"], theirs: ["boggart_brute", "rumbling_baloth"], attackFirst: 2 });
    expect(r.attacks).toContain("T2: Boggart Brute, Rumbling Baloth");
    const t2 = r.blockers.find((b) => b.attackers.length === 2);
    expect(t2, JSON.stringify(r.blockers)).toBeTruthy();
    expect(t2!.board.filter((b) => b.endsWith("(T)")).length).toBeGreaterThanOrEqual(1); // the survivors of the turn-one attack stand tapped
    const untapped = t2!.board.filter((b) => !b.endsWith("(T)")).length;
    expect(untapped).toBe(2);
    expect(t2!.options.size).toBe(2); // both untapped Pikers are offered …
    for (const attackers of t2!.options.values()) expect(attackers.size).toBe(2); // … onto either attacker (a lone block on the Brute is offered because a second could join)
    expect(r.notices.some((n) => n.startsWith("No legal block"))).toBe(false);
    expect(r.notices).toContain("Opponent attacks with Boggart Brute (menace), Rumbling Baloth");
  });

  it("a Brute (menace) and a Wind Drake (flying) attack into ONE untapped Piker: no legal block exists, the step is skipped, and the notice says why in the engine's terms", async () => {
    const r = await drive({ mine: ["goblin_piker", "goblin_piker", "goblin_piker"], theirs: ["boggart_brute", "wind_drake"], attackFirst: 2 });
    expect(r.attacks).toContain("T2: Boggart Brute, Wind Drake");
    expect(r.blockers.find((b) => b.attackers.length === 2)).toBeUndefined();
    expect(r.notices).toContain("No legal block: Boggart Brute has menace and only Goblin Piker could block it (two are needed); Wind Drake has flying and none of your creatures can reach it.");
  });
});
