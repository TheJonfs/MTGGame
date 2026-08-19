import { parseManaCost, parseManaProduction } from "./mana.js";
import { IMPLEMENTED_EFFECT_TYPES } from "./resolvers.js";
import {
  EFFECT_TYPES,
  KEYWORDS,
  SCOPES,
  TARGET_PREDICATES,
  TRIGGER_EVENTS,
  type CardDef,
  type CardType,
  type Effect,
  type TargetSpec,
} from "./types.js";

const CARD_TYPES: readonly CardType[] = ["Land", "Creature", "Instant", "Sorcery", "Enchantment", "Artifact"];
const DURATIONS = ["WHILE_SOURCE_ON_BATTLEFIELD", "UNTIL_END_OF_TURN", "UNTIL_SOURCE_LEAVES"];
const WHOS = ["you", "opponent", "eachPlayer", "target", "controllerOfTarget"];
const ZONES = ["battlefield", "stack", "any", "graveyard"];

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Validates one raw card JSON object. Returns errors (reject the card) and
 * warnings (card loads, but uses vocabulary with no resolver yet — brief Part 2).
 */
export function validateCard(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isRecord(raw)) return { errors: ["card is not an object"], warnings };
  const id = typeof raw.id === "string" ? raw.id : "<no id>";
  const err = (msg: string) => errors.push(`${id}: ${msg}`);

  for (const field of ["id", "name", "manaCost"]) {
    if (typeof raw[field] !== "string") err(`missing or non-string "${field}"`);
  }
  if (raw.source !== "real" && raw.source !== "custom") err(`"source" must be "real" | "custom"`);

  if (typeof raw.manaCost === "string") {
    try {
      parseManaCost(raw.manaCost);
    } catch (e) {
      err((e as Error).message);
    }
  }

  const types = Array.isArray(raw.types) ? raw.types : [];
  if (!Array.isArray(raw.types) || types.length === 0) err(`"types" must be a non-empty array`);
  for (const t of types) if (!CARD_TYPES.includes(t as CardType)) err(`unknown card type "${t}"`);

  const isCreature = types.includes("Creature");
  if (isCreature) {
    if (!Number.isInteger(raw.power)) err(`creature missing integer "power"`);
    if (!Number.isInteger(raw.toughness)) err(`creature missing integer "toughness"`);
  } else if (raw.power !== undefined || raw.toughness !== undefined) {
    err(`non-creature has power/toughness`);
  }

  if (raw.keywords !== undefined) {
    if (!Array.isArray(raw.keywords)) err(`"keywords" must be an array`);
    else for (const k of raw.keywords) if (!(KEYWORDS as readonly string[]).includes(k as string)) err(`unknown keyword "${k}"`);
  }

  // ADR-019: colors optional on cards, required on token defs.
  if (raw.colors !== undefined) {
    if (!Array.isArray(raw.colors) || raw.colors.some((c) => !["W", "U", "B", "R", "G"].includes(c as string))) {
      err(`"colors" must be an array of W|U|B|R|G`);
    }
  } else if (raw.isTokenDef === true) {
    err(`token definitions require an explicit "colors" field (ADR-019)`);
  }

  const declaredTargets = Array.isArray(raw.targets) ? (raw.targets as unknown[]) : [];
  if (raw.targets !== undefined) {
    for (const t of declaredTargets) validateTargetSpec(t, err);
  }

  if (raw.spellEffect !== undefined) {
    if (!types.includes("Instant") && !types.includes("Sorcery")) {
      err(`spellEffect on a non-Instant/Sorcery`);
    }
    validateEffects(raw.spellEffect, declaredTargets.length, err, warnings, id);
  } else if (types.includes("Instant") || types.includes("Sorcery")) {
    err(`Instant/Sorcery missing spellEffect`);
  }

  if (raw.abilities !== undefined) {
    if (!Array.isArray(raw.abilities)) err(`"abilities" must be an array`);
    else {
      for (const a of raw.abilities) validateAbility(a, err, warnings, id);
    }
  }

  const subtypes = Array.isArray(raw.subtypes) ? raw.subtypes : [];
  if (subtypes.includes("Aura")) {
    if (declaredTargets.length !== 1) err(`Aura must declare exactly one target (enchant)`);
    if (!types.includes("Enchantment")) err(`Aura subtype on non-Enchantment`);
  }

  return { errors, warnings };
}

function validateTargetSpec(t: unknown, err: (m: string) => void): void {
  if (!isRecord(t)) return err(`target spec is not an object`);
  if (!Number.isInteger(t.count) || (t.count as number) < 1) err(`target spec count must be >= 1`);
  if (!(TARGET_PREDICATES as readonly string[]).includes(t.predicate as string)) {
    err(`unknown target predicate "${t.predicate}"`);
  }
  if (!ZONES.includes(t.zone as string)) err(`unknown target zone "${t.zone}"`);
}

function validateAbility(a: unknown, err: (m: string) => void, warnings: string[], cardId: string): void {
  if (!isRecord(a)) return err(`ability is not an object`);
  const targets = Array.isArray(a.targets) ? (a.targets as unknown[]) : [];
  for (const t of targets) validateTargetSpec(t, err);
  const nTargets = targets.length;

  switch (a.kind) {
    case "triggered": {
      if (!TRIGGER_EVENTS.includes(a.event as never)) err(`unknown trigger event "${a.event}"`);
      if (a.condition !== undefined) {
        if (!isRecord(a.condition)) err(`trigger condition must be an object`);
        else {
          const c = a.condition;
          if (c.source !== undefined && !["self", "attached", "other", "any"].includes(c.source as string)) {
            err(`unknown condition source "${c.source}"`);
          }
          if (c.player !== undefined && !["opponentOfController", "controller", "any"].includes(c.player as string)) {
            err(`unknown condition player "${c.player}"`);
          }
        }
      }
      validateEffects(a.effects, nTargets, err, warnings, cardId);
      break;
    }
    case "activated": {
      if (!isRecord(a.cost)) err(`activated ability missing cost`);
      else {
        if (a.cost.mana !== undefined && typeof a.cost.mana === "string") {
          try {
            parseManaCost(a.cost.mana);
          } catch (e) {
            err((e as Error).message);
          }
        }
        if (a.cost.sacrifice !== undefined) {
          const pred = isRecord(a.cost.sacrifice) ? a.cost.sacrifice.predicate : undefined;
          if (typeof pred !== "string" || !/^(self|creature(\.subtype:[A-Za-z]+)?)$/.test(pred)) {
            err(`sacrifice predicate must be "self", "creature", or "creature.subtype:<Subtype>"`);
          }
        }
      }
      if (a.equip === true) {
        // Equip (CR 702.6): attach-only, exactly one own-creature target, no effects.
        if (Array.isArray(a.effects) && a.effects.length > 0) err(`equip ability must have no effects`);
        if (nTargets !== 1 || !isRecord(targets[0]) || (targets[0] as Record<string, unknown>).predicate !== "creatureYouControl") {
          err(`equip ability must target exactly one creatureYouControl`);
        }
      } else {
        validateEffects(a.effects, nTargets, err, warnings, cardId);
      }
      break;
    }
    case "static": {
      // Statics are interpreted live by characteristics(), never resolved —
      // no resolver warning, but only the continuous-effect words make sense.
      validateEffects(a.effects, nTargets, err, warnings, cardId, { isStatic: true });
      if (Array.isArray(a.effects)) {
        for (const e of a.effects) {
          if (isRecord(e) && !["modifyPT", "grantKeyword", "restrict", "gainControl"].includes(e.type as string)) {
            err(`static ability cannot carry effect "${e.type}" (only modifyPT/grantKeyword/restrict/gainControl)`);
          }
          // Statics are interpreted live and have no X: literal deltas only.
          if (isRecord(e) && e.type === "modifyPT" && (e.power === "X" || e.power === "-X" || e.toughness === "X" || e.toughness === "-X")) {
            err(`static modifyPT cannot reference X`);
          }
        }
      }
      break;
    }
    default:
      err(`unknown ability kind "${a.kind}"`);
  }
}

/** Per-effect-type required params. Kept as data so growing the vocabulary means one row. */
const EFFECT_SHAPE: Record<Effect["type"], (e: Record<string, unknown>, err: (m: string) => void) => void> = {
  damage: (e, err) => {
    needAmount(e, err);
    needTargetIndex(e, err);
  },
  damageAll: (e, err) => {
    needAmount(e, err);
    needScope(e, err);
  },
  destroy: needTargetIndex,
  destroyAll: needScope,
  exile: needTargetIndex,
  bounce: needTargetIndex,
  counter: needTargetIndex,
  draw: (e, err) => {
    needCount(e, err);
    needWho(e, err);
  },
  discard: (e, err) => {
    needCount(e, err);
    needWho(e, err);
    if (e.mode !== "ownerChooses" && e.mode !== "random" && e.mode !== "casterChooses") {
      err(`discard mode must be ownerChooses|random|casterChooses (ADR-029)`);
    }
    if (e.filter !== undefined && e.filter !== "noncreatureNonland") err(`unknown discard filter "${e.filter}"`);
  },
  gainLife: (e, err) => {
    needAmount(e, err);
    needWho(e, err);
  },
  loseLife: (e, err) => {
    needAmount(e, err);
    needWho(e, err);
  },
  modifyPT: (e, err) => {
    needPT(e, "power", err);
    needPT(e, "toughness", err);
    needTargetOrScope(e, err);
    needDuration(e, err);
  },
  grantKeyword: (e, err) => {
    if (!(KEYWORDS as readonly string[]).includes(e.keyword as string)) err(`unknown keyword "${e.keyword}"`);
    needTargetOrScope(e, err);
    needDuration(e, err);
  },
  restrict: (e, err) => {
    if (e.what !== "attack" && e.what !== "block" && e.what !== "both") err(`restrict "what" must be attack|block|both`);
    needTargetOrScope(e, err);
    needDuration(e, err);
  },
  createToken: (e, err) => {
    if (typeof e.tokenId !== "string") err(`createToken missing tokenId`);
    needCount(e, err);
    needWho(e, err);
  },
  addCounters: (e, err) => {
    if (e.kind !== "+1/+1" && e.kind !== "-1/-1") err(`addCounters kind must be +1/+1|-1/-1`);
    needCount(e, err);
    needTargetIndex(e, err);
  },
  tapTarget: needTargetIndex,
  untapTarget: needTargetIndex,
  returnFromGraveyard: (e, err) => {
    needTargetOrScope(e, err);
    if (e.to !== "battlefield" && e.to !== "hand") err(`returnFromGraveyard "to" must be battlefield|hand`);
  },
  fight: (e, err) => {
    if (!Array.isArray(e.targets) || e.targets.length !== 2) err(`fight requires targets: [i, j]`);
  },
  gainControl: (e, err) => {
    // ADR-033: static-only, scope attached. Targeted/EOT variants are reserved.
    if (e.scope !== "attached") err(`gainControl must be a static with scope "attached" (ADR-033)`);
  },
  searchLibrary: (e, err) => {
    if (e.predicate !== "basicLand") err(`searchLibrary predicate must be basicLand`);
    if (e.to !== "hand" && e.to !== "battlefield") err(`searchLibrary "to" must be hand|battlefield`);
  },
  addMana: (e, err) => {
    if (typeof e.mana !== "string") return err(`addMana missing mana`);
    try {
      parseManaProduction(e.mana);
    } catch (ex) {
      err((ex as Error).message);
    }
  },
};

function isValueRef(v: unknown): boolean {
  return (
    typeof v === "object" && v !== null && (v as Record<string, unknown>).ref === "targetPower" &&
    Number.isInteger((v as Record<string, unknown>).target)
  );
}
function needAmount(e: Record<string, unknown>, err: (m: string) => void) {
  if (e.amount !== "X" && !Number.isInteger(e.amount) && !isValueRef(e.amount)) {
    err(`amount must be integer, "X", or {ref:"targetPower",target:i} (ADR-028)`);
  }
}
function needNumber(e: Record<string, unknown>, key: string, err: (m: string) => void) {
  if (!Number.isInteger(e[key])) err(`"${key}" must be an integer`);
}
function needPT(e: Record<string, unknown>, key: string, err: (m: string) => void) {
  const v = e[key];
  if (!Number.isInteger(v) && v !== "X" && v !== "-X") err(`"${key}" must be an integer, "X", or "-X"`);
}
function needCount(e: Record<string, unknown>, err: (m: string) => void) {
  if (!Number.isInteger(e.count) || (e.count as number) < 1) err(`count must be a positive integer`);
}
function needWho(e: Record<string, unknown>, err: (m: string) => void) {
  if (!WHOS.includes(e.who as string)) err(`"who" must be you|opponent|eachPlayer`);
}
function needScope(e: Record<string, unknown>, err: (m: string) => void) {
  if (!(SCOPES as readonly string[]).includes(e.scope as string)) err(`unknown scope "${e.scope}"`);
}
function needDuration(e: Record<string, unknown>, err: (m: string) => void) {
  if (!DURATIONS.includes(e.duration as string)) err(`unknown duration "${e.duration}"`);
}
function needTargetIndex(e: Record<string, unknown>, err: (m: string) => void) {
  if (!Number.isInteger(e.target)) err(`"target" must be an index into targets[]`);
}
function needTargetOrScope(e: Record<string, unknown>, err: (m: string) => void) {
  const hasTarget = Number.isInteger(e.target);
  const hasScope = (SCOPES as readonly string[]).includes(e.scope as string);
  if (!hasTarget && !hasScope) err(`needs either "target" or a known "scope"`);
}

function validateEffects(
  effects: unknown,
  nTargets: number,
  err: (m: string) => void,
  warnings: string[],
  cardId: string,
  opts: { isStatic?: boolean } = {},
): void {
  if (!Array.isArray(effects) || effects.length === 0) return err(`effects must be a non-empty array`);
  for (const e of effects) {
    if (!isRecord(e)) {
      err(`effect is not an object`);
      continue;
    }
    const type = e.type as Effect["type"];
    if (!EFFECT_TYPES.includes(type)) {
      err(`unknown effect type "${e.type}"`);
      continue;
    }
    EFFECT_SHAPE[type](e, err);
    if (Number.isInteger(e.target) && ((e.target as number) < 0 || (e.target as number) >= nTargets)) {
      err(`effect target index ${e.target} out of bounds (targets: ${nTargets})`);
    }
    if (!opts.isStatic && !IMPLEMENTED_EFFECT_TYPES.has(type)) {
      warnings.push(`${cardId}: uses effect "${type}" which has no resolver yet (will throw NotImplemented if resolved)`);
    }
  }
}

/** Narrowing cast after validation; call only when validateCard returned no errors. */
export function asCardDef(raw: unknown): CardDef {
  return raw as CardDef;
}

export type { TargetSpec };
