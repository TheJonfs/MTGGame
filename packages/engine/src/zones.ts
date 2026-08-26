import type { EngineCtx } from "./ctx.js";
import { imposedEntersTapped } from "./characteristics.js";
import { getObject, type GameObject, type PlayerId, type ZoneName } from "./state.js";

export interface MoveOptions {
  /** For library destinations. Default "top". */
  position?: "top" | "bottom";
  /** Entering the battlefield attached to a host (auras). */
  attachedTo?: string;
  /** Entering the battlefield tapped (reserved; "enters tapped" is allowed by manifest §4). */
  tapped?: boolean;
  /** A8 (blink): enter the battlefield under this player's control instead of the mover's current controller. */
  controller?: PlayerId;
}

function zoneArray(ctx: EngineCtx, zone: ZoneName, owner: PlayerId): string[] | null {
  const p = ctx.state.players[owner];
  switch (zone) {
    case "library":
      return p.library;
    case "hand":
      return p.hand;
    case "graveyard":
      return p.graveyard;
    case "exile":
      return p.exile;
    case "ante":
      return p.ante;
    case "battlefield":
      return ctx.state.battlefield;
    case "stack":
      return null; // stack membership is via StackItems, not an id array
  }
}

/**
 * The one zone-move primitive (manifest §2, engine-design §3). Every object
 * movement goes through here; nothing else touches zone arrays.
 *
 * Returns the new object id (objects get a fresh identity on every move,
 * CR 400.7), or null if the object ceased to exist (token leaving battlefield).
 */
/** ADR-076 (S17): move several battlefield objects to their graveyards as ONE batch (SBA deaths,
 * Wrath): every object in the batch is an observer of every other's death — the look-back set on
 * ctx lets Blood Artist see the creatures that die alongside it. Cleared afterwards. */
export function moveBatchToGraveyard(ctx: EngineCtx, ids: string[]): void {
  const batch = ids.filter((id) => ctx.state.objects[id]?.zone === "battlefield");
  if (batch.length === 0) return;
  const prev = ctx.lookback;
  ctx.lookback = new Map(batch.map((id) => [id, { cardId: ctx.state.objects[id]!.cardId, controller: ctx.state.objects[id]!.controller }]));
  try {
    for (const id of batch) {
      if (!ctx.state.objects[id]) continue;
      const newId = moveObject(ctx, id, "graveyard");
      const entry = ctx.lookback.get(id);
      if (entry && newId) entry.currentId = newId;
    }
  } finally {
    if (prev) ctx.lookback = prev;
    else delete ctx.lookback;
  }
}

export function moveObject(
  ctx: EngineCtx,
  objectId: string,
  to: ZoneName,
  options: MoveOptions = {},
): string | null {
  const state = ctx.state;
  const obj = getObject(state, objectId);
  const from = obj.zone;

  // Detach anything attached to the moving object; SBAs will clean the
  // now-unattached auras up (CR 704.5m).
  for (const other of Object.values(state.objects)) {
    if (other.attachedTo === objectId) {
      other.attachedTo = null;
      ctx.bus.emit("ATTACHED", { objectId: other.id, previousHost: objectId, newHost: null, cause: "host-left" });
    }
  }

  // Remove from source zone array.
  const fromArr = zoneArray(ctx, from, obj.owner);
  if (fromArr) {
    const i = fromArr.indexOf(objectId);
    if (i === -1) throw new Error(`moveObject: ${objectId} not in its zone array (${from})`);
    fromArr.splice(i, 1);
  }
  delete state.objects[objectId];

  // Tokens cease to exist when they leave the battlefield (CR 111.7).
  if (obj.isToken && from === "battlefield") {
    ctx.bus.emit("ZONE_CHANGE", {
      oldId: objectId,
      newId: "",
      cardId: obj.cardId,
      from,
      to,
      owner: obj.owner,
      controller: obj.controller,
      controllerBefore: obj.controller,
    });
    return null;
  }

  const newId = ctx.ids.next("obj");
  const entersBattlefield = to === "battlefield";
  const card = ctx.defs.def(obj.cardId);
  const newObj: GameObject = {
    id: newId,
    cardId: obj.cardId,
    owner: obj.owner,
    // Control reverts to owner in non-battlefield zones; battlefield control
    // belongs to whoever put it there (control statics re-apply via syncControl).
    controller: entersBattlefield ? (options.controller ?? obj.controller) : obj.owner,
    baseController: entersBattlefield ? (options.controller ?? obj.controller) : obj.owner,
    zone: to,
    isToken: obj.isToken,
    // A9 (S20): an entersChoice land PUT onto the battlefield (search, reanimation) enters tapped,
    // choice-free — only the land PLAY asks (game.ts passes an explicit tapped there).
    // S22b (the Intake): an imposing static overrides EVERY entry path — the law outranks the choice.
    tapped: entersBattlefield
      ? imposedEntersTapped(ctx, card, options.controller ?? obj.controller) || (options.tapped ?? (card.entersChoice || card.entersTapped ? true : false))
      : false,
    damage: 0,
    deathtouchDamage: false,
    summoningSick: entersBattlefield && card.types.includes("Creature"),
    attachedTo: entersBattlefield ? (options.attachedTo ?? null) : null,
    counters: {},
  };
  state.objects[newId] = newObj;

  const toArr = zoneArray(ctx, to, newObj.owner);
  if (toArr) {
    if (to === "library" && options.position === "bottom") toArr.push(newId);
    else if (to === "library") toArr.unshift(newId);
    else toArr.push(newId);
  }
  if (entersBattlefield && options.attachedTo) {
    ctx.bus.emit("ATTACHED", { objectId: newId, previousHost: null, newHost: options.attachedTo, cause: "aura-enter" });
  }

  ctx.bus.emit("ZONE_CHANGE", {
    oldId: objectId,
    newId,
    cardId: obj.cardId,
    from,
    to,
    owner: newObj.owner,
    controller: newObj.controller,
    controllerBefore: obj.controller,
  });
  return newId;
}

/** Create a brand-new object directly in a zone (game setup, tokens). */
export function createObject(
  ctx: EngineCtx,
  cardId: string,
  owner: PlayerId,
  zone: ZoneName,
  opts: { isToken?: boolean; attachedTo?: string; basePT?: { power: number; toughness: number } } = {},
): string {
  const card = ctx.defs.def(cardId); // throws on unknown card
  const id = ctx.ids.next("obj");
  const obj: GameObject = {
    id,
    cardId,
    owner,
    controller: owner,
    baseController: owner,
    zone,
    isToken: opts.isToken ?? false,
    // A9/S20: shocks + taplands placed here enter tapped. S22b: the Intake imposes on tokens too.
    tapped: zone === "battlefield" && (!!card.entersChoice || !!card.entersTapped || imposedEntersTapped(ctx, card, owner)),

    damage: 0,
    deathtouchDamage: false,
    summoningSick: zone === "battlefield" && card.types.includes("Creature"),
    attachedTo: opts.attachedTo ?? null,
    counters: {},
    ...(opts.basePT ? { basePT: opts.basePT } : {}), // A10 (S22): P/T locked at creation (the Weird)
  };
  ctx.state.objects[id] = obj;
  const arr = zoneArray(ctx, zone, owner);
  if (arr) arr.push(id);
  ctx.bus.emit("ZONE_CHANGE", {
    oldId: "",
    newId: id,
    cardId,
    from: null,
    to: zone,
    owner,
    controller: owner,
    controllerBefore: owner,
  });
  return id;
}
