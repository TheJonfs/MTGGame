/// <reference types="vite/client" />
/**
 * The Lab's deck catalogue (S33 director round — Chris: "a quick analysis tool to look at different
 * matchups under different conditions"). Browser-safe: the sim's deck modules plus the world's JSON
 * (imported as data, never through the node loader). Shared by the page and its workers.
 */
import { DECKS, DECK_ARCHETYPES, type DeckKey } from "@shandalar/sim/decks";
import { MAGE_DECKS } from "@shandalar/sim/mage-decks";
import { EXPANSION_DECKS } from "@shandalar/sim/expansion-decks";
import { ROAD_DECKS } from "@shandalar/sim/road-decks";
import { GUARDIAN_DECKS } from "@shandalar/sim/guardian-decks";
import { COURT_DECKS } from "@shandalar/sim/court-decks";
import { LORD_DECKS } from "@shandalar/sim/lord-decks";
import { COROLLA_DECKS } from "@shandalar/sim/corolla-decks";
import { HEART_DECK } from "@shandalar/sim/heart-deck";
import type { CardDef } from "@shandalar/cards";
import type { Modifier } from "@shandalar/engine";
import { DIFFICULTIES, resolveKnobs, type DifficultyName } from "@shandalar/world";
import type { LabBonus, LabSide, ResolvedSide } from "./lab-types.js";

/** The world's JSON, bundled the way engine-bridge bundles the catalog (import.meta.glob; no json modules). */
const WORLD = import.meta.glob("../../../../data/world/*.json", { eager: true }) as Record<string, { default: unknown }>;
const worldJson = (name: string): unknown => {
  const key = Object.keys(WORLD).find((k) => k.endsWith(`/${name}.json`));
  if (!key) throw new Error(`data/world/${name}.json not bundled`);
  return WORLD[key]!.default;
};

export type Archetype = "aggro" | "midrange" | "control";
export type Profile = "apprentice" | "journeyman" | "master";
export type Decklist = { cardId: string; count: number }[];

export interface LabDeck {
  key: string;
  group: "mages" | "beasts" | "starters" | "roads" | "bosses" | "slices" | "custom";
  name: string;
  label: string;
  archetype: Archetype;
  decklist: Decklist;
  /** The defaults the world would give this deck: its tier life, profile and entrance. */
  life: number;
  profile: Profile;
  basics: number;
  /** A fixed entrance (the road decks carry theirs); otherwise the basics come from the colours by pips. */
  entrance?: string[];
  /** The world's starting bonuses for this deck (a boss's law, roots, signature — data-model §5). */
  bonuses?: LabBonus[];
  /** The catalog tier (mages and beasts) — the roster grid aggregates by it. */
  tier?: 1 | 2 | 3;
}

const TIER_PROFILE = { 1: "apprentice", 2: "journeyman", 3: "master" } as const;
export type LabMode = DifficultyName;
const BASIC_OF: Record<string, string> = { W: "plains", U: "island", B: "swamp", R: "mountain", G: "forest" };

type StarterRow = { id: string; name: string; archetype: Archetype; basicLand: string; decklist: Decklist };
type OpponentRow = { id: string; deck: string; tier: 1 | 2 | 3; difficulty: Profile; worldLife: number; worldLifeOffset?: number; kind?: string };
type LawBoth = { type: "permanentOnBattlefield"; cardId: string } | { type: "extraCards"; count: number };
type DungeonsJson = {
  mox: { id: string; color: string; guardian: { key: string; name: string; life: number }; law: { name: string; both: LawBoth[] } }[];
  powerDungeons: { id: string; color: string; guardian: { key: string; name: string; life: number } }[];
  strongholds: { id: string; color: string; lord: { key: string; name: string; cardId: string; baseLife: number }; law: { cardId: string; name: string } }[];
  corolla: { bossLife: number; petals: { color: string; boss: { key: string; name: string }; signature: string }[]; heart?: { boss: { name: string; cardId: string } } };
};
/** The Heart's roots (corolla.ts HEART_ROOTS) — the five basics on the Manafleur's side. */
const HEART_ROOTS = ["plains", "island", "swamp", "mountain", "forest"];
/** The standard heartLife (knobs: 35 easy / 40 standard / 45 hard). */
const HEART_LIFE_STANDARD = 40;

/** S34: the mages' and beasts' world defaults come from the resolver's tier tables at a MODE (the knobs'
 * easy / standard / hard bundles) — a saved run names the mode it measured. */
export function labDecks(mode: LabMode = "standard"): LabDeck[] {
  const knobs = resolveKnobs({ difficulty: DIFFICULTIES[mode] });
  const out: LabDeck[] = [];
  const mageRows = (worldJson("opponents") as { opponents: OpponentRow[] }).opponents.filter((o) => (o.kind ?? "mage") === "mage");
  for (const [k, m] of Object.entries(MAGE_DECKS)) {
    const row = mageRows.find((o) => o.deck === `mage:${k}`);
    out.push({ key: `mage:${k}`, group: "mages", name: m.name, label: `${m.name} (T${m.tier} ${m.colors}) — ${m.epithet}`, archetype: m.archetype, decklist: m.decklist, life: knobs.mageTierLife[m.tier] + (row?.worldLifeOffset ?? 0), profile: TIER_PROFILE[m.tier], basics: knobs.mageTierEntrance[m.tier], tier: m.tier });
  }
  const rows = (worldJson("opponents") as { opponents: OpponentRow[] }).opponents.filter((o) => o.kind === "beast");
  for (const [k, b] of Object.entries(EXPANSION_DECKS)) {
    const row = rows.find((o) => o.deck === `beast:${k}`) ?? rows.find((o) => o.deck === `beast:${k}` && o.tier === b.tier);
    const tier = row?.tier ?? b.tier;
    out.push({ key: `beast:${k}`, group: "beasts", name: b.name, label: `${b.name} (T${b.tier} ${b.color})`, archetype: b.archetype, decklist: b.decklist, life: (row?.worldLife ?? 8) + knobs.beastTierLifeDelta[tier] + (row?.worldLifeOffset ?? 0), profile: row?.difficulty ?? TIER_PROFILE[b.tier], basics: 0, tier });
  }
  for (const s of (worldJson("starters") as { starters: StarterRow[] }).starters) {
    out.push({ key: `starter:${s.id}`, group: "starters", name: s.name, label: `${s.name} — starter:${s.id}`, archetype: s.archetype, decklist: s.decklist, life: 10, profile: "journeyman", basics: 0, entrance: [s.basicLand] });
  }
  for (const [k, r] of Object.entries(ROAD_DECKS)) {
    out.push({ key: `road:${k}`, group: "roads", name: r.name, label: `${r.name} (${r.decklist.reduce((n, e) => n + e.count, 0)} cards, ${r.life} life, ${r.entrance.length} in play)`, archetype: r.archetype, decklist: r.decklist, life: r.life, profile: "journeyman", basics: r.entrance.length, entrance: [...r.entrance] });
  }
  // The bosses (S33 director round): each with the world's anchors — life, law, entrance — as default bonuses.
  const dj = worldJson("dungeons") as DungeonsJson;
  for (const pd of dj.powerDungeons) {
    const g = GUARDIAN_DECKS[pd.guardian.key];
    if (!g) continue;
    out.push({ key: `boss:power:${pd.guardian.key}`, group: "bosses", name: g.name, label: `${g.name} — power guardian (${pd.color}, ${pd.guardian.life} life)`, archetype: g.archetype, decklist: g.decklist, life: pd.guardian.life, profile: "master", basics: 0, bonuses: [] });
  }
  for (const m of dj.mox) {
    const c = COURT_DECKS[m.guardian.key];
    if (!c) continue;
    const law: LabBonus[] = m.law.both.map((b) => (b.type === "extraCards" ? { type: "extraCards", count: b.count, both: true } : { type: "permanent", cardId: b.cardId, both: true }));
    out.push({ key: `boss:mox:${m.guardian.key}`, group: "bosses", name: c.name, label: `${c.name} — Mox court (${m.color}, ${m.guardian.life} life; law: ${m.law.name}, both sides)`, archetype: c.archetype, decklist: c.decklist, life: m.guardian.life, profile: "master", basics: 0, bonuses: law });
  }
  for (const s of dj.strongholds) {
    const l = LORD_DECKS[s.lord.key];
    if (!l) continue;
    out.push({ key: `boss:lord:${s.lord.key}`, group: "bosses", name: l.name, label: `${l.name} — stronghold lord (${s.color}, ${s.lord.baseLife} base life; law ${s.law.name} in play, the signature to hand)`, archetype: l.archetype, decklist: l.decklist, life: s.lord.baseLife, profile: "master", basics: 0, bonuses: [{ type: "permanent", cardId: s.law.cardId }, { type: "cardInHand", cardId: s.lord.cardId }] });
  }
  for (const p of dj.corolla.petals) {
    const c = COROLLA_DECKS[p.boss.key];
    if (!c) continue;
    const law = dj.strongholds.find((s) => s.color === p.color)?.law;
    out.push({ key: `boss:petal:${p.boss.key}`, group: "bosses", name: c.name, label: `${c.name} — petal boss (${p.color}, ${dj.corolla.bossLife} life; the ${law?.name ?? "chamber's"} law returned)`, archetype: c.archetype, decklist: c.decklist, life: dj.corolla.bossLife, profile: "master", basics: 0, bonuses: law ? [{ type: "permanent", cardId: law.cardId }] : [] });
  }
  out.push({ key: "boss:heart", group: "bosses", name: HEART_DECK.name, label: `${HEART_DECK.name} — the Heart (${HEART_LIFE_STANDARD} life standard; five roots, the flower to hand, the law ring)`, archetype: HEART_DECK.archetype, decklist: HEART_DECK.decklist, life: HEART_LIFE_STANDARD, profile: "master", basics: 0, bonuses: [...HEART_ROOTS.map((cardId) => ({ type: "permanent" as const, cardId })), { type: "cardInHand", cardId: HEART_DECK.signature }, { type: "lawSequence" }] });
  for (const k of Object.keys(DECKS) as DeckKey[]) {
    out.push({ key: `slice:${k}`, group: "slices", name: DECKS[k].name, label: `${k} · ${DECKS[k].name} (slice)`, archetype: DECK_ARCHETYPES[k], decklist: DECKS[k].decklist, life: 20, profile: "journeyman", basics: 0 });
  }
  return out;
}

/** A custom deck (the Lab's editor; saved under analysis/decks/). */
export interface CustomDeck { name: string; archetype: Archetype; decklist: Decklist; basedOn?: string; when?: string; notes?: string }
export function customAsLabDeck(c: CustomDeck): LabDeck {
  return { key: `custom:${c.name}`, group: "custom", name: c.name, label: `${c.name} (custom${c.basedOn ? `, from ${c.basedOn}` : ""}; ${c.decklist.reduce((n, e) => n + e.count, 0)} cards)`, archetype: c.archetype, decklist: c.decklist, life: 20, profile: "journeyman", basics: 0 };
}

/** Deck stats for the editor: cards, lands, average mana value of the nonland cards, unknown ids. */
export function deckStats(decklist: Decklist, pool: Map<string, CardDef>): { cards: number; lands: number; avgMv: number; unknown: string[] } {
  let cards = 0, lands = 0, mv = 0, nonland = 0; const unknown: string[] = [];
  for (const e of decklist) {
    const d = pool.get(e.cardId);
    if (!d) { unknown.push(e.cardId); continue; }
    cards += e.count;
    if (d.types.includes("Land")) lands += e.count;
    else { nonland += e.count; mv += e.count * manaValue(d.manaCost); }
  }
  return { cards, lands, avgMv: nonland ? mv / nonland : 0, unknown };
}
export function manaValue(cost: string): number {
  let n = 0;
  for (const sym of cost.match(/\{[^}]+\}/g) ?? []) { const inner = sym.slice(1, -1); n += /^\d+$/.test(inner) ? Number(inner) : inner === "X" ? 0 : 1; }
  return n;
}

/** Resolve a side for the worker: the deck (catalogue or custom), its entrance basics, its bonuses. */
export function resolveSide(side: LabSide, decks: Map<string, LabDeck>, pool: Map<string, CardDef>): ResolvedSide {
  const deck = decks.get(side.deck);
  if (!deck) throw new Error(`unknown deck ${side.deck}`);
  return { name: deck.name, decklist: deck.decklist.map((e) => ({ ...e })), archetype: deck.archetype, life: side.life, profile: side.profile, entrance: entranceBasics(deck, side.basics, pool), bonuses: side.bonuses.map((b) => ({ ...b })) };
}

/** A side's engine modifiers for a seat — the entrance basics and every bonus; `both` bonuses also land on the other seat. */
export function sideModifiers(side: ResolvedSide, seat: 0 | 1): Modifier[] {
  const other = (1 - seat) as 0 | 1;
  const out: Modifier[] = [{ type: "startingLife", player: seat, value: side.life }];
  for (const cardId of side.entrance) out.push({ type: "permanentOnBattlefield", player: seat, cardId });
  for (const b of side.bonuses) {
    const seats: (0 | 1)[] = b.both ? [seat, other] : [seat];
    for (const p of seats) {
      if (b.type === "permanent") out.push({ type: "permanentOnBattlefield", player: p, cardId: b.cardId });
      else if (b.type === "cardInHand") out.push({ type: "signatureToHand", player: p, cardId: b.cardId });
      else if (b.type === "extraCards") out.push({ type: "extraCards", player: p, count: b.count });
      else if (b.type === "lawSequence" && p === seat) out.push({ type: "lawSequence" });
    }
  }
  return out;
}

/** A deck's colours ranked by the list's pip count — the S33 entrance rule (one basic = the primary). */
export function colorsByPips(decklist: Decklist, pool: Map<string, CardDef>): string[] {
  const pips: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  for (const e of decklist) {
    const cost = pool.get(e.cardId)?.manaCost ?? "";
    for (const c of Object.keys(pips)) pips[c]! += e.count * ((cost.match(new RegExp(`\\{${c}\\}`, "g")) ?? []).length);
  }
  return Object.keys(pips).filter((c) => pips[c]! > 0).sort((a, b) => pips[b]! - pips[a]!);
}

/** The N entrance basics for a deck: its fixed entrance first (a road's, a starter's basic), then its colours by pips, repeating. */
export function entranceBasics(deck: LabDeck, n: number, pool: Map<string, CardDef>): string[] {
  const fixed = deck.entrance ?? [];
  const mageKey = deck.key.startsWith("mage:") ? deck.key.slice(5) : null;
  const colours = mageKey && MAGE_DECKS[mageKey] ? [...MAGE_DECKS[mageKey].primaryColors] : colorsByPips(deck.decklist, pool);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    if (i < fixed.length) out.push(fixed[i]!);
    else if (colours.length > 0) out.push(BASIC_OF[colours[(i - fixed.length) % colours.length]!]!);
    else out.push(fixed[0] ?? "plains");
  }
  return out;
}
