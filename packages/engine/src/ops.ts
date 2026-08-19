import type { ResolvedTarget } from "@shandalar/cards";
import type { EngineCtx } from "./ctx.js";
import { moveObject } from "./zones.js";
import type { PlayerId } from "./state.js";

/**
 * Primitive state operations shared by effect resolution, combat, and the
 * game loop. Nothing here decides whether anything dies — that's SBAs.
 */

export function dealDamage(
  ctx: EngineCtx,
  source: { id: string; cardId: string; controller: PlayerId },
  target: ResolvedTarget,
  amount: number,
  combat: boolean,
): void {
  if (amount <= 0) return;
  if (target.kind === "player") {
    const player = target.player as PlayerId;
    const p = ctx.state.players[player];
    p.life -= amount;
    ctx.bus.emit("DAMAGE", {
      sourceId: source.id,
      sourceCardId: source.cardId,
      sourceController: source.controller,
      target: { kind: "player", player },
      amount,
      combat,
    });
    ctx.bus.emit("LIFE_CHANGE", { player, delta: -amount, total: p.life });
  } else if (target.kind === "object") {
    const obj = ctx.state.objects[target.id];
    if (!obj || obj.zone !== "battlefield") return; // damage to a departed object is lost
    obj.damage += amount;
    ctx.bus.emit("DAMAGE", {
      sourceId: source.id,
      sourceCardId: source.cardId,
      sourceController: source.controller,
      target: { kind: "object", id: target.id },
      amount,
      combat,
    });
  }
}

export function drawCard(ctx: EngineCtx, player: PlayerId): void {
  const p = ctx.state.players[player];
  const top = p.library[0];
  if (top === undefined) {
    // The loss happens at the next SBA check (CR 120.3, 704.5c), not here.
    p.attemptedDrawFromEmpty = true;
    return;
  }
  moveObject(ctx, top, "hand");
  ctx.bus.emit("CARD_DRAWN", { player });
}

export function gainLife(ctx: EngineCtx, player: PlayerId, amount: number): void {
  const p = ctx.state.players[player];
  p.life += amount;
  ctx.bus.emit("LIFE_CHANGE", { player, delta: amount, total: p.life });
}

export function loseLife(ctx: EngineCtx, player: PlayerId, amount: number): void {
  const p = ctx.state.players[player];
  p.life -= amount;
  ctx.bus.emit("LIFE_CHANGE", { player, delta: -amount, total: p.life });
}
