import type { ResolvedTarget } from "@shandalar/cards";
import { characteristics } from "./characteristics.js";
import type { EngineCtx } from "./ctx.js";
import { moveObject } from "./zones.js";
import type { PlayerId } from "./state.js";

/**
 * Primitive state operations shared by effect resolution, combat, and the
 * game loop. Nothing here decides whether anything dies — that's SBAs.
 */

/**
 * Deal damage from a source. When the source is a creature currently on the
 * battlefield, its deathtouch marks the damage (R-014, consulted by SBAs)
 * and its lifelink gains its controller that much life, simultaneously with
 * the damage (CR 702.15f) — combat and noncombat alike.
 */
export function dealDamage(
  ctx: EngineCtx,
  source: { id: string; cardId: string; controller: PlayerId },
  target: ResolvedTarget,
  amount: number,
  combat: boolean,
): void {
  if (amount <= 0) return;

  const sourceObj = ctx.state.objects[source.id];
  let deathtouch = false;
  let lifelink = false;
  if (sourceObj && sourceObj.zone === "battlefield" && ctx.defs.def(sourceObj.cardId).types.includes("Creature")) {
    const k = characteristics(ctx, source.id).keywords;
    deathtouch = k.has("deathtouch");
    lifelink = k.has("lifelink");
  }

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
    if (deathtouch) obj.deathtouchDamage = true;
    ctx.bus.emit("DAMAGE", {
      sourceId: source.id,
      sourceCardId: source.cardId,
      sourceController: source.controller,
      target: { kind: "object", id: target.id },
      targetCardId: obj.cardId,
      amount,
      combat,
    });
  } else {
    return;
  }

  if (lifelink) gainLife(ctx, source.controller, amount);
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

/** ADR-076: discard = hand → graveyard + a DISCARD event carrying the card's types (Waste Not). One entry point for
 * effects (Hymn/Duress/Mind Rot/Specter), cleanup, activation costs (Bouncer) and cycling (A5). */
export function discardCard(ctx: EngineCtx, objectId: string): void {
  const obj = ctx.state.objects[objectId];
  if (!obj || obj.zone !== "hand") return;
  const player = obj.owner;
  const cardId = obj.cardId;
  const types = [...ctx.defs.def(cardId).types];
  moveObject(ctx, objectId, "graveyard");
  ctx.bus.emit("DISCARD", { player, objectId, cardId, types });
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
