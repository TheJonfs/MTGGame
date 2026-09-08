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
import type { CardDef } from "@shandalar/cards";

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
  group: "mages" | "beasts" | "starters" | "roads" | "slices";
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
}

const TIER_LIFE = { 1: 8, 2: 10, 3: 12 } as const;
const TIER_PROFILE = { 1: "apprentice", 2: "journeyman", 3: "master" } as const;
const BASIC_OF: Record<string, string> = { W: "plains", U: "island", B: "swamp", R: "mountain", G: "forest" };

type StarterRow = { id: string; name: string; archetype: Archetype; basicLand: string; decklist: Decklist };
type OpponentRow = { id: string; deck: string; tier: 1 | 2 | 3; difficulty: Profile; worldLife: number; kind?: string };

export function labDecks(): LabDeck[] {
  const out: LabDeck[] = [];
  for (const [k, m] of Object.entries(MAGE_DECKS)) {
    out.push({ key: `mage:${k}`, group: "mages", name: m.name, label: `${m.name} (T${m.tier} ${m.colors}) — ${m.epithet}`, archetype: m.archetype, decklist: m.decklist, life: TIER_LIFE[m.tier], profile: TIER_PROFILE[m.tier], basics: 0 });
  }
  const rows = (worldJson("opponents") as { opponents: OpponentRow[] }).opponents.filter((o) => o.kind === "beast");
  for (const [k, b] of Object.entries(EXPANSION_DECKS)) {
    const row = rows.find((o) => o.deck === `beast:${k}`) ?? rows.find((o) => o.deck === `beast:${k}` && o.tier === b.tier);
    out.push({ key: `beast:${k}`, group: "beasts", name: b.name, label: `${b.name} (T${b.tier} ${b.color})`, archetype: b.archetype, decklist: b.decklist, life: row?.worldLife ?? TIER_LIFE[b.tier], profile: row?.difficulty ?? TIER_PROFILE[b.tier], basics: 0 });
  }
  for (const s of (worldJson("starters") as { starters: StarterRow[] }).starters) {
    out.push({ key: `starter:${s.id}`, group: "starters", name: s.name, label: `${s.name} — starter:${s.id}`, archetype: s.archetype, decklist: s.decklist, life: 10, profile: "journeyman", basics: 0, entrance: [s.basicLand] });
  }
  for (const [k, r] of Object.entries(ROAD_DECKS)) {
    out.push({ key: `road:${k}`, group: "roads", name: r.name, label: `${r.name} (${r.decklist.reduce((n, e) => n + e.count, 0)} cards, ${r.life} life, ${r.entrance.length} in play)`, archetype: r.archetype, decklist: r.decklist, life: r.life, profile: "journeyman", basics: r.entrance.length, entrance: [...r.entrance] });
  }
  for (const k of Object.keys(DECKS) as DeckKey[]) {
    out.push({ key: `slice:${k}`, group: "slices", name: DECKS[k].name, label: `${k} · ${DECKS[k].name} (slice)`, archetype: DECK_ARCHETYPES[k], decklist: DECKS[k].decklist, life: 20, profile: "journeyman", basics: 0 });
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
  const colours = colorsByPips(deck.decklist, pool);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    if (i < fixed.length) out.push(fixed[i]!);
    else if (colours.length > 0) out.push(BASIC_OF[colours[(i - fixed.length) % colours.length]!]!);
    else out.push(fixed[0] ?? "plains");
  }
  return out;
}
