import { parseManaCost, parseManaProduction } from "./mana.js";
import { IMPLEMENTED_EFFECT_TYPES } from "./resolvers.js";
import {
  EFFECT_TYPES,
  KEYWORDS,
  SCOPES,
  TARGET_PREDICATES,
  TRIGGER_EVENTS,
  type ActivatedAbilityDef,
  type CardDef,
  type CardType,
  type Effect,
  type TargetSpec,
} from "./types.js";

const CARD_TYPES: readonly CardType[] = ["Land", "Creature", "Instant", "Sorcery", "Enchantment", "Artifact"];
const DURATIONS = ["WHILE_SOURCE_ON_BATTLEFIELD", "UNTIL_END_OF_TURN", "UNTIL_SOURCE_LEAVES"];
const WHOS = ["you", "opponent", "eachPlayer", "target", "controllerOfTarget"];
const ZONES = ["battlefield", "stack", "any", "graveyard"];
const ABILITY_ZONES = ["battlefield", "hand", "graveyard"];
const SEARCH_PREDICATE = /^(basicLand|anyCard|subtype:[A-Za-z]+)$/;

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

  // ADR-053: custom cards carry their rules text (real cards use oracle.json).
  if (raw.source === "custom") {
    if (typeof raw.text !== "string") err(`custom card missing string "text" (ADR-053)`);
  } else if (raw.text !== undefined) {
    err(`real card has a "text" field — real rules text comes from oracle.json (ADR-053)`);
  }

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

  // ADR-078 (S19): every shoppable pool card carries its shop tier; the exempt classes are tokens,
  // basics, and prizeOnly treasure. A vocabulary-level guard like the resolver assertion — a card
  // without a tier is a structural error, not a latent shop surprise.
  const isBasic = Array.isArray(raw.supertypes) && (raw.supertypes as string[]).includes("Basic");
  // A9 (S20): entersChoice only on lands, with the shock shape.
  if (raw.entersChoice !== undefined) {
    const ec = raw.entersChoice as { pay?: { life?: unknown }; else?: unknown };
    if (!types.includes("Land")) err(`"entersChoice" is a land clause (A9)`);
    if (!ec || typeof ec !== "object" || !Number.isInteger(ec.pay?.life) || (ec.pay!.life as number) <= 0 || ec.else !== "tapped") {
      err(`"entersChoice" must be { pay: { life: n>0 }, else: "tapped" } (A9)`);
    }
  }
  // A8 (S20): range counts — {min≥0, max≥min≥…}; a range spec must be the LAST spec of its list.
  // A10 word 4 (S22): count "any" (the request-loop) is a SPELL-level SOLE spec — Purge's shape.
  const checkSpecs = (specs: unknown, where: string) => {
    if (!Array.isArray(specs)) return;
    specs.forEach((sp, i) => {
      const c = (sp as { count?: unknown }).count;
      if (c === "any") {
        if (where !== "targets" || specs.length !== 1) err(`${where}: an "any"-count spec must be a spell's sole target spec (A10)`);
        return;
      }
      if (typeof c === "object" && c !== null) {
        const r = c as { min?: unknown; max?: unknown };
        if (!Number.isInteger(r.min) || !Number.isInteger(r.max) || (r.min as number) < 0 || (r.max as number) < Math.max(1, r.min as number)) {
          err(`${where}: range count must be {min≥0, max≥max(1,min)} (A8)`);
        }
        if (i !== specs.length - 1) err(`${where}: a range-count spec must be the last spec (A8)`);
      }
    });
  };
  checkSpecs(raw.targets, "targets");
  for (const ab of Array.isArray(raw.abilities) ? raw.abilities : []) checkSpecs((ab as { targets?: unknown }).targets, "ability targets");
  for (const m of Array.isArray(raw.modes) ? raw.modes : []) checkSpecs((m as { targets?: unknown }).targets, "mode targets");
  // A10 (S22): the self-exile rider (Overload).
  if (raw.selfExileOnResolve !== undefined && (raw.selfExileOnResolve !== true || (!types.includes("Instant") && !types.includes("Sorcery")))) {
    err(`"selfExileOnResolve" is a true-only Instant/Sorcery rider (A10)`);
  }
  if (raw.entersTapped !== undefined && (raw.entersTapped !== true || !types.includes("Land"))) err(`"entersTapped" is a land-only true flag (S20)`);
  if (raw.priceOverride !== undefined && (!Number.isInteger(raw.priceOverride) || (raw.priceOverride as number) <= 0)) {
    err(`"priceOverride" must be a positive integer (gold)`);
  }
  const isTestCard = typeof raw.id === "string" && raw.id.startsWith("test_"); // registry: test-only cards, not pool members
  if (raw.isTokenDef !== true && !isBasic && raw.prizeOnly !== true && !isTestCard) {
    if (raw.shopTier !== 1 && raw.shopTier !== 2 && raw.shopTier !== 3 && raw.shopTier !== "R") err(`missing "shopTier" (1|2|3|"R", ADR-078; tokens/basics/prizeOnly exempt)`);
  } else if (raw.shopTier !== undefined) {
    err(`"shopTier" on a ${raw.isTokenDef ? "token" : isBasic ? "basic land" : "prizeOnly card"} — exempt classes carry none`);
  }

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
  // ADR-068: prizeOnly (Black Lotus) — boolean when present; the pool registry column mirrors it.
  if (raw.prizeOnly !== undefined && typeof raw.prizeOnly !== "boolean") err(`"prizeOnly" must be boolean (ADR-068)`);
  // ADR-082 (S22): printedAsset — custom cards only (real cards' printed view is the Scryfall normal).
  if (raw.printedAsset !== undefined && (typeof raw.printedAsset !== "string" || raw.source !== "custom")) {
    err(`"printedAsset" must be a string on a custom card (ADR-082)`);
  }

  const declaredTargets = Array.isArray(raw.targets) ? (raw.targets as unknown[]) : [];
  if (raw.targets !== undefined) {
    for (const t of declaredTargets) validateTargetSpec(t, err);
  }

  if (raw.spellEffect !== undefined) {
    if (!types.includes("Instant") && !types.includes("Sorcery")) {
      err(`spellEffect on a non-Instant/Sorcery`);
    }
    if (raw.modes !== undefined) err(`a modal spell carries "modes", not "spellEffect" (A6)`);
    validateEffects(raw.spellEffect, declaredTargets.length, err, warnings, id);
  } else if (raw.modes !== undefined) {
    // A6: modal spell — each mode carries its own targets + effects.
    if (!types.includes("Instant") && !types.includes("Sorcery")) err(`"modes" on a non-Instant/Sorcery`);
    if (raw.targets !== undefined) err(`a modal spell declares targets per mode, not at card level (A6)`);
    validateModes(raw.modes, err, warnings, id);
  } else if (types.includes("Instant") || types.includes("Sorcery")) {
    err(`Instant/Sorcery missing spellEffect`);
  }
  // A7: additional spell cost (Goblin Grenade). A10 (S22): the life form (Purge) joins it.
  if (raw.additionalCost !== undefined) {
    if (!types.includes("Instant") && !types.includes("Sorcery")) err(`additionalCost is only for Instant/Sorcery (A7)`);
    const ac = isRecord(raw.additionalCost) ? raw.additionalCost : {};
    if (ac.sacrifice === undefined && ac.life === undefined) err(`additionalCost needs "sacrifice" and/or "life" (A7/A10)`);
    if (ac.sacrifice !== undefined) {
      const pred = isRecord(ac.sacrifice) ? ac.sacrifice.predicate : undefined;
      if (typeof pred !== "string" || !/^(creature(\.subtype:[A-Za-z]+)?)$/.test(pred)) err(`additionalCost.sacrifice.predicate must be "creature" or "creature.subtype:<Subtype>" (A7)`);
    }
    if (ac.life !== undefined && (!Number.isInteger(ac.life) || (ac.life as number) <= 0)) err(`additionalCost.life must be a positive integer (A10)`);
    if (ac.perTarget !== undefined && (ac.perTarget !== true || ac.life === undefined)) err(`additionalCost.perTarget must be true and requires "life" (A10)`);
  }
  // A5: cycling {cost} — compiled into a hand-zone ability by the loader.
  if (raw.cycling !== undefined) {
    if (typeof raw.cycling !== "string") err(`"cycling" must be a mana cost string (A5)`);
    else {
      try {
        parseManaCost(raw.cycling);
      } catch (e) {
        err((e as Error).message);
      }
    }
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
  const cnt = t.count as unknown;
  const rangeOk = isRecord(cnt) && Number.isInteger((cnt as { min?: unknown }).min) && Number.isInteger((cnt as { max?: unknown }).max);
  if (cnt !== "any" && !rangeOk && (!Number.isInteger(cnt) || (cnt as number) < 1)) err(`target spec count must be >= 1, an A8 range {min,max}, or "any" (A10)`);
  // A10/ADR-038: whose graveyard; A10: the power ceiling (Graceful Restoration).
  if (t.who !== undefined && t.who !== "you" && t.who !== "any") err(`target who must be "you" | "any" (ADR-038 amendment)`);
  if (t.powerAtMost !== undefined && (!Number.isInteger(t.powerAtMost) || (t.powerAtMost as number) < 0)) err(`target powerAtMost must be a non-negative integer (A10)`);
  if (!(TARGET_PREDICATES as readonly string[]).includes(t.predicate as string)) {
    err(`unknown target predicate "${t.predicate}"`);
  }
  if (!ZONES.includes(t.zone as string)) err(`unknown target zone "${t.zone}"`);
  // ADR-076 filters.
  for (const k of ["withKeyword", "withoutKeyword"]) {
    if (t[k] !== undefined && !(KEYWORDS as readonly string[]).includes(t[k] as string)) err(`target ${k}: unknown keyword "${t[k]}"`);
  }
  if (t.notSubtype !== undefined && typeof t.notSubtype !== "string") err(`target notSubtype must be a string`);
  if (t.other !== undefined && typeof t.other !== "boolean") err(`target other must be boolean`);
  if (t.anyOf !== undefined) {
    if (!Array.isArray(t.anyOf) || t.anyOf.length < 2) err(`target anyOf must list at least two alternative specs`);
    else for (const alt of t.anyOf) validateTargetSpec(alt, err);
  }
}

/** A6: modes — each a {label, targets?, effects[]}. */
function validateModes(modes: unknown, err: (m: string) => void, warnings: string[], cardId: string): void {
  if (!Array.isArray(modes) || modes.length < 2) return err(`"modes" must list at least two modes (A6)`);
  for (const m of modes) {
    if (!isRecord(m)) { err(`mode is not an object`); continue; }
    if (typeof m.label !== "string" || !m.label) err(`mode missing label`);
    const targets = Array.isArray(m.targets) ? (m.targets as unknown[]) : [];
    for (const t of targets) validateTargetSpec(t, err);
    validateEffects(m.effects, targets.length, err, warnings, cardId);
  }
}

const COUNT_PRED_KEYS = ["cardType", "subtype", "controller", "other", "attacking"];
function validCountPredicate(p: unknown): boolean {
  if (!isRecord(p)) return false;
  for (const k of Object.keys(p)) if (!COUNT_PRED_KEYS.includes(k)) return false;
  if (p.cardType !== undefined && !CARD_TYPES.includes(p.cardType as CardType)) return false;
  if (p.controller !== undefined && !["you", "opponent", "any"].includes(p.controller as string)) return false;
  return true;
}
/** ADR-028 + A4 value refs. */
function isAnyValueRef(v: unknown): boolean {
  if (!isRecord(v)) return false;
  if (v.ref === "targetPower") return Number.isInteger(v.target);
  if (v.ref === "count" || v.ref === "maxPower") return validCountPredicate(v.predicate);
  if (v.ref === "graveyardCount") {
    if (v.who !== "you" && v.who !== "opponent") return false;
    // A10 (S22): typed counts (Overload's instants-and-sorceries).
    if (v.types !== undefined && (!Array.isArray(v.types) || v.types.length === 0 || (v.types as unknown[]).some((t) => !CARD_TYPES.includes(t as CardType)))) return false;
    return true;
  }
  // A10 (S22): the target's LKI mana value (Aether Mutation).
  if (v.ref === "targetManaValue") return Number.isInteger(v.target);
  return false;
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
          for (const k of ["type", "notType", "subtype"]) {
            if (c[k] !== undefined && (!Array.isArray(c[k]) || (c[k] as unknown[]).some((x) => typeof x !== "string"))) err(`condition ${k} must be a string array`);
          }
        }
      }
      if (a.modes !== undefined) {
        // A6: modal trigger — modes carry the effects; the ability's own effects must be empty.
        if (Array.isArray(a.effects) && a.effects.length > 0) err(`a modal trigger carries effects in its modes, not in "effects" (A6)`);
        if (nTargets > 0) err(`a modal trigger declares targets per mode (A6)`);
        validateModes(a.modes, err, warnings, cardId);
      } else {
        validateEffects(a.effects, nTargets, err, warnings, cardId);
      }
      // A10 word 9 (S22): zone-scoped triggers — first zone graveyard, first event UPKEEP (the
      // collection only exists there; widening means a new collector, not a validator relax).
      if (a.zone !== undefined) {
        if (a.zone !== "battlefield" && a.zone !== "graveyard") err(`trigger zone must be battlefield|graveyard (A10)`);
        if (a.zone === "graveyard" && a.event !== "UPKEEP") err(`graveyard-zone triggers support only UPKEEP today (A10 — Tainted Phoenix's shape)`);
      }
      // A10 word 9 rider: optionalCost — a "you may pay" whose yes pays; requires optional.
      if (a.optionalCost !== undefined) {
        if (a.optional !== true) err(`optionalCost requires optional: true (ADR-027 + A10)`);
        const oc = isRecord(a.optionalCost) ? a.optionalCost : {};
        if (typeof oc.mana !== "string") err(`optionalCost.mana must be a mana cost string (A10)`);
        else {
          try {
            parseManaCost(oc.mana);
          } catch (e) {
            err((e as Error).message);
          }
        }
      }
      // A10 word 7: the punisher package.
      if (a.unlessPay !== undefined) {
        const up = isRecord(a.unlessPay) ? a.unlessPay : {};
        if (!Number.isInteger(up.life) || (up.life as number) <= 0) err(`unlessPay.life must be a positive integer (A10)`);
        if (a.optional === true) err(`unlessPay and optional don't combine (the fork IS the choice, A10)`);
      }
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
        // ADR-076 / A5 cost words.
        if (a.cost.discard !== undefined && (!Number.isInteger(a.cost.discard) || (a.cost.discard as number) < 1)) err(`cost.discard must be a positive integer`);
        if (a.cost.discardSelf !== undefined && a.cost.discardSelf !== true) err(`cost.discardSelf must be true when present`);
        if (a.cost.exileSelf !== undefined && a.cost.exileSelf !== true) err(`cost.exileSelf must be true when present`);
        if (a.cost.reduceBy !== undefined && !isAnyValueRef(a.cost.reduceBy)) err(`cost.reduceBy must be a value ref (A4/ADR-076)`);
        if (a.cost.reduceBy !== undefined && typeof a.cost.mana !== "string") err(`cost.reduceBy needs a mana cost to reduce`);
        // A10 word 2 (S22): the bounce cost (the Unwinder).
        if (a.cost.returnToHand !== undefined) {
          const pred = isRecord(a.cost.returnToHand) ? a.cost.returnToHand.predicate : undefined;
          if (typeof pred !== "string" || !/^(self|land|permanent|creature(\.subtype:[A-Za-z]+)?)$/.test(pred)) {
            err(`returnToHand predicate must be "self", "land", "permanent", "creature", or "creature.subtype:<Subtype>" (A10)`);
          }
        }
        // A10 word 6 (S22): the tap cost (Glare).
        if (a.cost.tapCreature !== undefined) {
          const tc = isRecord(a.cost.tapCreature) ? a.cost.tapCreature : {};
          if (typeof tc.predicate !== "string" || !/^creature(\.subtype:[A-Za-z]+)?$/.test(tc.predicate as string)) err(`tapCreature.predicate must be "creature" or "creature.subtype:<Subtype>" (A10)`);
          if (!Number.isInteger(tc.count) || (tc.count as number) < 1) err(`tapCreature.count must be a positive integer (A10)`);
        }
      }
      if (a.zone !== undefined && !ABILITY_ZONES.includes(a.zone as string)) err(`unknown ability zone "${a.zone}" (A5)`);
      if (a.zone === "hand" && !(isRecord(a.cost) && a.cost.discardSelf === true)) err(`a hand-zone ability must discard itself as a cost (A5: cycling shape)`);
      if (a.zone === "graveyard" && !(isRecord(a.cost) && a.cost.exileSelf === true)) err(`a graveyard-zone ability must exile itself as a cost (A5: Mother Bear shape)`);
      if (a.zone !== undefined && a.zone !== "battlefield" && isRecord(a.cost) && a.cost.tap === true) err(`a ${a.zone}-zone ability cannot have a {T} cost`);
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
          if (isRecord(e) && !["modifyPT", "grantKeyword", "restrict", "gainControl", "grantAbility"].includes(e.type as string)) {
            err(`static ability cannot carry effect "${e.type}" (only modifyPT/grantKeyword/restrict/gainControl/grantAbility)`);
          }
          // A10 word 8 (S22): the granted ability is itself validated as an activated ability of
          // the target zone (a hand grant must be cycling-shaped; a battlefield grant needs a scope).
          if (isRecord(e) && e.type === "grantAbility") {
            if (e.zone === "hand") {
              if (e.scope !== undefined) err(`grantAbility zone "hand" grants to the controller's whole hand — no scope (A10)`);
            } else if (e.zone === "battlefield") {
              if (!(SCOPES as readonly string[]).includes(e.scope as string)) err(`grantAbility zone "battlefield" needs a known scope (A10)`);
            } else {
              err(`grantAbility zone must be "hand" | "battlefield" (A10)`);
            }
            if (e.withKeyword !== undefined && !(KEYWORDS as readonly string[]).includes(e.withKeyword as string)) err(`grantAbility withKeyword: unknown keyword "${e.withKeyword}"`);
            if (e.cardType !== undefined && !CARD_TYPES.includes(e.cardType as CardType)) err(`grantAbility cardType: unknown type "${e.cardType}"`);
            if (!isRecord(e.ability) || e.ability.kind !== "activated") err(`grantAbility.ability must be an activated ability (A10)`);
            else validateAbility({ ...e.ability, zone: e.zone }, err, warnings, cardId);
          }
          // Statics are interpreted live and have no X: literal deltas or count refs (A4).
          if (isRecord(e) && e.type === "modifyPT" && (e.power === "X" || e.power === "-X" || e.toughness === "X" || e.toughness === "-X")) {
            err(`static modifyPT cannot reference X`);
          }
          if (isRecord(e) && e.type === "modifyPT") {
            for (const k of ["power", "toughness"]) {
              if (isRecord(e[k]) && (e[k] as Record<string, unknown>).ref === "targetPower") err(`static modifyPT cannot reference a target (no targets on statics)`);
            }
          }
        }
      }
      if (a.condition !== undefined) {
        const c = a.condition;
        if (!isRecord(c) || !isAnyValueRef(c.value) || !Number.isInteger(c.atLeast)) err(`static condition must be {value: <ref>, atLeast: n} (A4)`);
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
    // A8 (S20): damage addresses a target index OR a range-spec index (targetSpec fans out).
    // A10 (S22): OR the triggering event's player (the Warden's law).
    if (e.to !== undefined && e.to !== "eventPlayer") err(`damage "to" must be "eventPlayer" (A10)`);
    if (e.from !== undefined && e.from !== "eventObject") err(`damage "from" must be "eventObject" (A10)`);
    if (!Number.isInteger(e.target) && !Number.isInteger(e.targetSpec) && e.to !== "eventPlayer") err(`"damage" needs "target", "targetSpec", or to:"eventPlayer"`);
  },
  damageAll: (e, err) => {
    needAmount(e, err);
    needScope(e, err);
  },
  destroy: (e, err) => {
    // A10 (S22): destroy addresses a target index OR a spec index (Purge's fan-out).
    if (!Number.isInteger(e.target) && !Number.isInteger(e.targetSpec)) err(`"destroy" needs "target" or "targetSpec"`);
  },
  destroyAll: needScope,
  exile: needTargetIndex,
  bounce: (e, err) => {
    needTargetOrScope(e, err); // S20: Arcanis returns itself via scope "self"
    if (e.to !== undefined && e.to !== "hand" && e.to !== "libraryTop") err(`bounce "to" must be hand|libraryTop (A10 — Temporal Spring)`);
  },
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
  mill: (e, err) => {
    needCount(e, err);
    needWho(e, err);
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
    // A10 (S22): count may be a value ref (Aether Mutation); pt locks base P/T (Overload's Weird).
    if (!isAnyValueRef(e.count)) needCount(e, err);
    if (e.pt !== undefined && !isAnyValueRef(e.pt)) err(`createToken "pt" must be a value ref (A10)`);
    needWho(e, err);
  },
  addCounters: (e, err) => {
    if (e.kind !== "+1/+1" && e.kind !== "-1/-1") err(`addCounters kind must be +1/+1|-1/-1`);
    needCount(e, err);
    needTargetOrScope(e, err); // ADR-076: scope form ("each Vampire you control")
  },
  exileThenReturn: (e, err) => {
    needTargetIndex(e, err);
    if (e.under !== "yourControl") err(`exileThenReturn.under must be "yourControl" (A8)`);
  },
  tapTarget: (e, err) => {
    // A10 (S22): tapTarget addresses a target index OR a spec index (the Warden's up-to-two).
    if (!Number.isInteger(e.target) && !Number.isInteger(e.targetSpec)) err(`"tapTarget" needs "target" or "targetSpec"`);
  },
  untapTarget: needTargetIndex,
  returnFromGraveyard: (e, err) => {
    // A10 (S22): the targetSpec form fans out over a range spec's picks (Graceful Restoration mode 2).
    if (!Number.isInteger(e.targetSpec)) needTargetOrScope(e, err);
    if (e.to !== "battlefield" && e.to !== "hand") err(`returnFromGraveyard "to" must be battlefield|hand`);
    // A10 (S22): the temporary package (the Usher) and the counter rider (Graceful Restoration).
    if (e.temporary !== undefined && (e.temporary !== true || e.to !== "battlefield")) err(`returnFromGraveyard "temporary" is a true-only battlefield rider (A10)`);
    if (e.withCounters !== undefined) {
      const wc = e.withCounters as { kind?: unknown; count?: unknown };
      if (e.to !== "battlefield" || !isRecord(wc) || wc.kind !== "+1/+1" || !Number.isInteger(wc.count) || (wc.count as number) < 1) {
        err(`returnFromGraveyard "withCounters" must be {kind:"+1/+1", count≥1} on a battlefield return (A10)`);
      }
    }
  },
  fight: (e, err) => {
    if (!Array.isArray(e.targets) || e.targets.length !== 2) err(`fight requires targets: [i, j]`);
  },
  gainControl: (e, err) => {
    // ADR-033: static-only, scope attached. Targeted/EOT variants are reserved.
    if (e.scope !== "attached") err(`gainControl must be a static with scope "attached" (ADR-033)`);
  },
  searchLibrary: (e, err) => {
    if (typeof e.predicate !== "string" || !SEARCH_PREDICATE.test(e.predicate)) err(`searchLibrary predicate must be basicLand|anyCard|subtype:<Subtype> (ADR-068/076)`);
    if (e.to !== "hand" && e.to !== "battlefield") err(`searchLibrary "to" must be hand|battlefield`);
    if (e.entersTapped !== undefined && e.to !== "battlefield") err(`searchLibrary entersTapped only applies to battlefield destination`);
  },
  grantAbility: () => {
    // A10 word 8 (S22): static-only — the deep shape (zone/scope/ability) is validated in the
    // static branch; validateEffects rejects it outside statics.
  },
  addMana: (e, err) => {
    if (e.choice) {
      const ch = e.choice as { count?: unknown; anyOneColor?: unknown };
      if (e.mana !== undefined) return err(`addMana: give mana OR choice, not both`);
      if (!Number.isInteger(ch.count) || (ch.count as number) < 1) return err(`addMana choice.count must be a positive integer`);
      if (ch.anyOneColor !== true) return err(`addMana choice.anyOneColor must be true (the only choice shape, ADR-068)`);
      return;
    }
    if (typeof e.mana !== "string") return err(`addMana missing mana`);
    try {
      parseManaProduction(e.mana);
    } catch (ex) {
      err((ex as Error).message);
    }
  },
};

function needAmount(e: Record<string, unknown>, err: (m: string) => void) {
  if (e.amount !== "X" && !Number.isInteger(e.amount) && !isAnyValueRef(e.amount)) {
    err(`amount must be integer, "X", or a value ref (ADR-028 / A4: targetPower, count, graveyardCount, maxPower)`);
  }
}
function needNumber(e: Record<string, unknown>, key: string, err: (m: string) => void) {
  if (!Number.isInteger(e[key])) err(`"${key}" must be an integer`);
}
function needPT(e: Record<string, unknown>, key: string, err: (m: string) => void) {
  const v = e[key];
  if (!Number.isInteger(v) && v !== "X" && v !== "-X" && !isAnyValueRef(v)) err(`"${key}" must be an integer, "X", "-X", or a value ref (A4)`);
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
    if (type === "grantAbility" && !opts.isStatic) {
      err(`grantAbility is static-only (A10 word 8 — enumeration-time grants, never resolved)`);
      continue;
    }
    EFFECT_SHAPE[type](e, err);
    if (Number.isInteger(e.target) && ((e.target as number) < 0 || (e.target as number) >= nTargets)) {
      err(`effect target index ${e.target} out of bounds (targets: ${nTargets})`);
    }
    // ADR-076: `if` clause — a condition on a target's current characteristics.
    if (e.if !== undefined) {
      const c = e.if;
      if (!isRecord(c) || !Number.isInteger(c.target) || (c.target as number) < 0 || (c.target as number) >= nTargets) err(`effect "if" needs a valid target index`);
      else if (c.subtype === undefined && c.cardType === undefined) err(`effect "if" needs subtype or cardType`);
      else if (c.cardType !== undefined && !CARD_TYPES.includes(c.cardType as CardType)) err(`effect "if": unknown cardType ${c.cardType}`);
    }
    if (!opts.isStatic && !IMPLEMENTED_EFFECT_TYPES.has(type)) {
      warnings.push(`${cardId}: uses effect "${type}" which has no resolver yet (will throw NotImplemented if resolved)`);
    }
  }
}

/** Narrowing cast after validation; call only when validateCard returned no errors. */
/** Normalise a validated raw card into a CardDef. A5: `cycling` compiles into a hand-zone
 * ability {cost, discardSelf; draw 1} appended to `abilities` — the engine never sees the keyword. */
export function asCardDef(raw: unknown): CardDef {
  const def = raw as CardDef;
  if (def.cycling) {
    const cycling: ActivatedAbilityDef = {
      kind: "activated",
      zone: "hand",
      cost: { mana: def.cycling, discardSelf: true },
      effects: [{ type: "draw", count: 1, who: "you" }],
    };
    return { ...def, abilities: [...(def.abilities ?? []), cycling] };
  }
  return def;
}

export type { TargetSpec };
