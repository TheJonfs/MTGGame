/**
 * S73a Part 4 (ADR-201) — the High Grounds worklist.   npx tsx analysis/s73/grounds-worklist.mts [--json file]
 * Per active list of every field format: the grounds whose two colours its mana makes (`castingColours` of its nonland
 * cards), that the format allows beside it and that it does not play. Whose list it is (the planner's, or Chris's and
 * the ports of his — ADR-200) and the basics it holds of each colour of the pair.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { loadCardPool } from "../../packages/cards/src/loader.ts";
import { castingColours, parseManaCost } from "../../packages/cards/src/mana.ts";
import { FORMAT_DECKS } from "../../packages/sim/src/open-decks.ts";
import { CONSTRUCTED_FORMATS, FIELD_FORMAT_IDS, HIGH_GROUNDS } from "../../packages/world/src/formats.ts";
import { checkDeck } from "../../packages/world/src/legality.ts";
import { loadMetas } from "../../packages/world/src/vintage-audit-cli.ts";
import { readAt } from "../../packages/world/src/vintage.ts";

const pool = loadCardPool("data/cards").cards, metas = loadMetas(".");
const CHRIS_OPEN = new Set(["sweep", "depths", "hearth", "pall", "kiln", "cinder", "writ", "rabble", "countersnake", "reaper", "reaperclio", "marducontrol", "emeraldsnakes", "pinnacle", "minefield", "lumenclio", "earthrise", "funpolice"]);
const CHRIS_OWN = new Set(["abzan:bwmassacrats", "bant:sourworms", "bodies:bantsnake", "grixis:mbclio", "grixis:massacrats", "jeskai:minefield", "jund:bfh", "jund:dragons", "mardu:witch", "naya:snakes", "peasant:wskies", "peasant:wbbasilisk", "sultai:massocrafts", "temur:temurcontrol"]);
const BASIC: Record<string, string> = { W: "plains", U: "island", B: "swamp", R: "mountain", G: "forest" };
const pairOf = (g: string): string[] => { const m = pool.get(g)!.abilities!.filter((a) => a.kind === "activated" && a.effects.some((e) => e.type === "addMana")).map((a) => (a.effects.find((e) => e.type === "addMana") as { mana: string }).mana.replace(/[{}]/g, "")); return [...new Set(m.join("").split(""))]; };
const rows: unknown[] = [];
for (const id of FIELD_FORMAT_IDS) {
  const format = CONSTRUCTED_FORMATS.find((f) => f.id === id)!;
  for (const [k, l] of Object.entries(FORMAT_DECKS[id]!)) {
    const key = `${id}:${k}`, m = metas[key];
    if (m?.archived || l.archived) continue;
    const root = readAt(key, metas).root, [rf, rk] = root.split(":");
    const chris = (rf === "open" && CHRIS_OPEN.has(rk!)) || CHRIS_OWN.has(root) || CHRIS_OWN.has(key);
    const cols = castingColours(l.decklist.filter((e) => !pool.get(e.cardId)!.types.includes("Land")).map((e) => pool.get(e.cardId)!));
    const pips: Record<string, number> = {};
    for (const e of l.decklist) { const c = parseManaCost(pool.get(e.cardId)!.manaCost); for (const x of "WUBRG") pips[x] = (pips[x] ?? 0) + e.count * (c.colored[x as "W"] ?? 0); }
    const has = (c: string) => l.decklist.find((e) => e.cardId === c)?.count ?? 0;
    for (const g of HIGH_GROUNDS) {
      const pair = pairOf(g);
      if (!pair.every((c) => cols.has(c as never))) continue;
      const plays = has(g) > 0;
      const withIt = l.decklist.map((e) => ({ ...e })); const b = withIt.find((e) => pair.some((c) => e.cardId === BASIC[c]) && e.count > 0);
      let legal = true;
      if (!plays) { const trial = b ? withIt.map((e) => (e === b ? { ...e, count: e.count - 1 } : e)).filter((e) => e.count > 0).concat([{ cardId: g, count: 1 }]) : withIt.concat([{ cardId: g, count: 1 }]); legal = checkDeck(trial, null, format.rule, pool).problems.length === 0; }
      rows.push({ format: id, key: k, name: l.name, ground: g, pair: pair.join(""), plays, legal, chris, root, pips: Object.fromEntries(pair.map((c) => [c, pips[c]])), basics: Object.fromEntries(pair.map((c) => [c, has(BASIC[c]!)])), archetype: l.archetype });
    }
  }
}
const j = process.argv.indexOf("--json"); if (j > 0) writeFileSync(process.argv[j + 1]!, JSON.stringify(rows, null, 1) + "\n");
const by = (f: (r: any) => boolean) => rows.filter(f as never) as any[];
for (const g of HIGH_GROUNDS) {
  const lack = by((r) => r.ground === g && !r.plays);
  console.log(`\n${g} (${pairOf(g).join("")}): plays ${by((r) => r.ground === g && r.plays).length}; lacks — planner ${lack.filter((r) => !r.chris && r.legal).length}, Chris ${lack.filter((r) => r.chris && r.legal).length}, not legal ${lack.filter((r) => !r.legal).length}`);
  for (const r of lack.filter((x) => !x.chris)) console.log(`  ${r.legal ? "" : "(not legal) "}${r.format}:${r.key} ${r.archetype} pips ${JSON.stringify(r.pips)} basics ${JSON.stringify(r.basics)}`);
}
