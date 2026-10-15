/**
 * pnpm format:census [--max-tier 1|2|3] [--colors WUB] | --triads [--max-tier N]
 *
 * S63 (Part 3): `--colors` narrows the shelf to cards within those colours (\`colorsWithin\`, the triads' rule; colourless
 * and lands pass) — with or without a tier ceiling; the Open's lists are then ranked by legal share. `--triads` prints
 * the ten three-colour shelves side by side: their size by role and tier, and what each lacks of the gaps list's shape.
 * S64 (ADR-181): both apply the land rule — a land or a mana artifact makes only the shelf's colours.
 *
 * S61 (the Pauper read; then Chris's "Penny" — tiers 1 and 2): what a tier ceiling leaves of the Open's pool. Counts by
 * colour and role, the creature curves, the lands, the answers by name, the card rating's spread on that shelf, and
 * how much of each Open list survives (with what it loses). A census: it changes nothing.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { cardColors, manaValue, parseManaCost, type CardDef } from "@shandalar/cards";
import { OPEN_FIELD } from "@shandalar/sim/open-decks";
import { OPEN_FORMAT } from "./formats.js";
import { cardLegal } from "./constructed-builder.js";
import { cardRating, type CardRatingTable } from "./rating.js";
import { isBasic, type DeckColor, type DeckRule } from "./legality.js";
import { answersCreatures, answersGraveyards, answersRelics, isCounter, isSweeper, stealsCreatures } from "./sideboard-ai.js";

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1]! : d; };
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const rating = JSON.parse(readFileSync(join(ROOT, "data/convocation/card-rating.json"), "utf8")) as CardRatingTable;
const colorsArg = arg("colors", "").toUpperCase(), triads = process.argv.includes("--triads");
// S63: with --colors or --triads and no --max-tier, the whole of the Open's shelf (no ceiling)
const tierGiven = process.argv.includes("--max-tier");
const maxTier = Number(arg("max-tier", colorsArg || triads ? "3" : "1")) as 1 | 2 | 3;
const ceiling = tierGiven || !(colorsArg || triads);
const colours = colorsArg ? ([...colorsArg] as DeckColor[]) : undefined;
const rule: DeckRule = { label: `${ceiling ? `tier ${maxTier} and below` : "the Open's shelf"}${colours ? `, within ${colorsArg}` : ""}`, minCards: 60, ...(ceiling ? { maxTier } : {}), ...(colours ? { colorsWithin: colours, manaWithin: true } : {}), banned: OPEN_FORMAT.rule.banned! };
const openCards = [...pool.values()].filter((d) => !isBasic(d.id) && cardLegal(d, OPEN_FORMAT.rule));
const legal = openCards.filter((d) => cardLegal(d, rule));
const below = ceiling && maxTier > 1 ? new Set(openCards.filter((d) => cardLegal(d, { ...rule, maxTier: (maxTier - 1) as 1 | 2 })).map((d) => d.id)) : new Set<string>();
const mv = (d: CardDef) => manaValue(parseManaCost(d.manaCost));
const col = (d: CardDef) => { const c = cardColors(d); return d.types.includes("Land") ? "land" : c.length === 0 ? "colourless" : c.length > 1 ? "gold" : c[0]!; };
const fx = (d: CardDef) => [...(d.spellEffect ?? []), ...(d.modes ?? []).flatMap((m) => m.effects)] as { type: string }[];
const role = (d: CardDef): string =>
  d.types.includes("Land") ? "land" : d.types.includes("Creature") ? "creature" : isCounter(d) ? "counter" : isSweeper(d) ? "sweeper" : stealsCreatures(d) ? "steal"
  : answersCreatures(d) || fx(d).some((e) => e.type === "damage") ? "removal/burn" : answersGraveyards(d) ? "graveyard hate" : fx(d).some((e) => e.type === "draw") ? "draw" : answersRelics(d) ? "relic answer"
  : d.subtypes?.includes("Aura") ? "aura" : d.types.includes("Artifact") ? "artifact" : d.types.includes("Enchantment") ? "enchantment" : "other spell";
const names = (xs: CardDef[]) => xs.map((d) => `${d.name}${below.size && !below.has(d.id) ? "*" : ""}`).sort().join(", ");

const tierOf = (d: CardDef): string => (d.prizeOnly ? "prize" : String(d.shopTier ?? "R"));
if (triads) {
  const TRIADS = ["WUB", "UBR", "BRG", "RGW", "GWU", "WBG", "URW", "BGU", "RWB", "GUR"];
  const base = { minCards: 60, ...(tierGiven ? { maxTier } : {}), banned: OPEN_FORMAT.rule.banned! };
  const GAPS = ["sweeper", "draw", "counter"] as const;
  console.log(`# The ten triads${tierGiven ? ` at tier ${maxTier} and below` : " on the Open's shelf"} — nonland cards within the three colours (colourless included)\n`);
  console.log(`| triad | nonland | creatures | removal/burn | sweeper | counter | draw | power ≥ 4 creatures | tier 1/2/3/R/prize | best Open lists (legal share; ties by colours used) |\n|---|---|---|---|---|---|---|---|---|---|`);
  const rows: { t: string; n: number }[] = [];
  for (const t of TRIADS) {
    const r: DeckRule = { label: t, ...base, colorsWithin: [...t] as DeckColor[], manaWithin: true }; // S64: ADR-181 — lands and mana artifacts too
    const xs = openCards.filter((d) => !d.types.includes("Land") && cardLegal(d, r));
    const by = (k: string) => xs.filter((d) => role(d) === k).length;
    const share = Object.values(OPEN_FIELD).map((l) => { const nb = l.decklist.filter((e) => !isBasic(e.cardId)); const n = (ys: typeof nb) => ys.reduce((a, e) => a + e.count, 0); const used = new Set(l.decklist.flatMap((e) => cardColors(pool.get(e.cardId)!))); return { l, s: n(nb.filter((e) => cardLegal(pool.get(e.cardId)!, r))) / Math.max(1, n(nb)), u: [...t].filter((c) => used.has(c as never)).length }; }).sort((a, b) => b.s - a.s || b.u - a.u); // a tie broken by how many of the three colours the list uses
    rows.push({ t, n: xs.length });
    console.log(`| ${t} | ${xs.length} | ${by("creature")} | ${by("removal/burn")} | ${by("sweeper")} | ${by("counter")} | ${by("draw")} | ${xs.filter((d) => d.types.includes("Creature") && (d.power ?? 0) >= 4).length} | ${["1", "2", "3", "R", "prize"].map((k) => xs.filter((d) => tierOf(d) === k).length).join("/")} | ${share[0]!.l.name} (${Math.round(100 * share[0]!.s)}%), ${share[1]!.l.name} (${Math.round(100 * share[1]!.s)}%) |`);
    const lack = GAPS.filter((g) => by(g) === 0);
    if (lack.length) console.log(`|  | lacks: ${lack.join(", ")} | | | | | | | | |`);
  }
  rows.sort((a, b) => b.n - a.n);
  console.log(`\nDeepest: ${rows[0]!.t} (${rows[0]!.n}); shallowest: ${rows[rows.length - 1]!.t} (${rows[rows.length - 1]!.n}).`);
  process.exit(0);
}
console.log(`# Census: ${rule.label} — ${legal.length} of the Open's ${openCards.length} cards (basics apart)${below.size ? `; * = new at tier ${maxTier} (${legal.length - below.size})` : ""}\n`);
const ROLES = ["creature", "removal/burn", "sweeper", "counter", "steal", "draw", "graveyard hate", "relic answer", "aura", "enchantment", "artifact", "other spell", "land"];
console.log(`| colour | all | ${ROLES.join(" | ")} |\n|---|---|${ROLES.map(() => "---").join("|")}|`);
for (const c of ["W", "U", "B", "R", "G", "gold", "colourless", "land"]) { const xs = legal.filter((d) => col(d) === c); console.log(`| ${c} | ${xs.length} | ${ROLES.map((r) => xs.filter((d) => role(d) === r).length || "").join(" | ")} |`); }
console.log(`\n## Creatures by colour: mana value 1/2/3/4/5/6+ · power ≥ 3 · power ≥ 4 · fliers · legends`);
for (const c of ["W", "U", "B", "R", "G", "gold", "colourless"]) { const xs = legal.filter((d) => col(d) === c && d.types.includes("Creature")); if (xs.length) console.log(`- ${c}: ${[1, 2, 3, 4, 5, 6].map((m) => xs.filter((d) => Math.min(6, Math.max(1, mv(d))) === m).length).join("/")} · ${xs.filter((d) => (d.power ?? 0) >= 3).length} · ${xs.filter((d) => (d.power ?? 0) >= 4).length} · ${xs.filter((d) => d.keywords?.includes("flying")).length} · ${xs.filter((d) => d.supertypes?.includes("Legendary")).length}`); }
console.log(`\n## By name`);
for (const r of ["removal/burn", "sweeper", "counter", "steal", "draw", "graveyard hate", "relic answer", "land"]) console.log(`- **${r}** (${legal.filter((d) => role(d) === r).length}): ${names(legal.filter((d) => role(d) === r)) || "—"}`);
console.log(`- **legendary creatures**: ${names(legal.filter((d) => d.types.includes("Creature") && d.supertypes?.includes("Legendary"))) || "—"}`);
console.log(`- **gold cards**: ${names(legal.filter((d) => col(d) === "gold")) || "—"}`);
console.log(`- **creatures of power 4 or more**: ${names(legal.filter((d) => d.types.includes("Creature") && (d.power ?? 0) >= 4)) || "—"}`);
const rated = legal.filter((d) => !d.types.includes("Land")).map((d) => ({ d, r: cardRating(d, rating) })).sort((a, b) => b.r - a.r);
const q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.floor(p * (xs.length - 1))]!;
const R = rated.map((x) => x.r), RO = openCards.filter((d) => !d.types.includes("Land")).map((d) => cardRating(d, rating));
console.log(`\n## The card rating on this shelf\n- 10/25/50/75/90th percentiles: ${[0.1, 0.25, 0.5, 0.75, 0.9].map((p) => q(R, p).toFixed(1)).join(" / ")} (the Open: ${[0.1, 0.25, 0.5, 0.75, 0.9].map((p) => q(RO, p).toFixed(1)).join(" / ")})`);
console.log(`- top 20: ${rated.slice(0, 20).map((x) => `${x.d.name} ${x.r.toFixed(1)}`).join("; ")}`);
console.log(`\n## The Open's lists on this shelf (nonbasic cards legal / all; what is lost)${colours ? " — by legal share" : ""}`);
const shareOf = (l: (typeof OPEN_FIELD)[string]) => { const nb = l.decklist.filter((e) => !isBasic(e.cardId)); const n = (xs: typeof nb) => xs.reduce((a, e) => a + e.count, 0); return n(nb.filter((e) => cardLegal(pool.get(e.cardId)!, rule))) / Math.max(1, n(nb)); };
for (const l of Object.values(OPEN_FIELD).sort((a, b) => (colours ? shareOf(b) - shareOf(a) : 0))) {
  const nb = l.decklist.filter((e) => !isBasic(e.cardId)), ok = nb.filter((e) => cardLegal(pool.get(e.cardId)!, rule)), lost = nb.filter((e) => !cardLegal(pool.get(e.cardId)!, rule));
  const n = (xs: typeof nb) => xs.reduce((a, e) => a + e.count, 0);
  console.log(`- **${l.name}** ${n(ok)}/${n(nb)} — loses ${lost.sort((a, b) => b.count - a.count).map((e) => `${e.count} ${pool.get(e.cardId)!.name}`).join(", ") || "nothing"}`);
}
