/**
 * pnpm pack --set plane --recipe classic --seed N       one pack, printed by slot
 * pnpm sealed-pool [--set plane] [--recipe classic] [--seed N] [--packs 6] [--json]   a Sealed pool
 * pnpm pack --validate                                  the data's errors and every set's size by tier
 *
 * S47 (Part 3): the Convocation's packs from data/convocation/{sets,recipes}.json (world/packs.ts).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { cardColors } from "@shandalar/cards";
import { PACK_TIERS, fillErrors, resolveSet, rollPack, rollSealedPool, validatePackData, type ConvocationPackData } from "./packs.js";
import { WorldRng } from "./rng.js";

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1]! : d; };
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
const read = (f: string) => JSON.parse(readFileSync(join(ROOT, "data/convocation", f), "utf8"));
const data: ConvocationPackData = { sets: read("sets.json").sets, recipes: read("recipes.json").recipes };
const errors = validatePackData(data, pool);
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }

const line = (id: string) => { const d = pool.get(id)!; return `  ${String(d.shopTier).padEnd(2)} ${(cardColors(d).join("") || (d.types.includes("Land") ? "land" : "—")).padEnd(5)} ${(d.manaCost || "").padEnd(12)} ${d.name}`; };

if (process.argv.includes("--validate")) {
  console.log("data/convocation: valid.\n\n| set | recipe | T1 | T2 | T3 | R | total | also fills |\n|---|---|---|---|---|---|---|---|");
  for (const s of data.sets) { const c = resolveSet(s, pool); console.log(`| ${s.id} | ${s.recipe} | ${PACK_TIERS.map((t) => c[t].length).join(" | ")} | ${PACK_TIERS.reduce((n, t) => n + c[t].length, 0)} | ${data.recipes.filter((r) => r.id !== s.recipe && !fillErrors(s, r, pool).length).map((r) => r.id).join(", ") || "—"} |`); }
} else {
  const set = data.sets.find((s) => s.id === arg("set", "plane")); if (!set) throw new Error(`unknown set ${arg("set", "plane")}`);
  const recipe = data.recipes.find((r) => r.id === arg("recipe", set.recipe)); if (!recipe) throw new Error(`unknown recipe`);
  const fill = fillErrors(set, recipe, pool); if (fill.length) { console.error(fill.join("\n")); process.exit(1); }
  const seed = Number(arg("seed", "1"));
  if (process.argv.includes("--sealed")) {
    const packs = rollSealedPool(set, recipe, pool, seed, Number(arg("packs", "6")));
    if (process.argv.includes("--json")) console.log(JSON.stringify({ set: set.id, recipe: recipe.id, seed, packs }));
    else {
      const all = packs.flat(), byColor: Record<string, number> = {}, byTier: Record<string, number> = {};
      for (const id of all) { const d = pool.get(id)!; const c = cardColors(d); const k = d.types.includes("Land") ? "land" : c.length === 0 ? "colourless" : c.length > 1 ? "gold" : c[0]!; byColor[k] = (byColor[k] ?? 0) + 1; byTier[String(d.shopTier)] = (byTier[String(d.shopTier)] ?? 0) + 1; }
      console.log(`Sealed pool — ${set.name}, ${packs.length} × ${recipe.name}, seed ${seed}: ${all.length} cards (${new Set(all).size} distinct)`);
      console.log(`by colour: ${Object.entries(byColor).map(([k, n]) => `${k} ${n}`).join(" · ")}\nby tier: ${Object.entries(byTier).map(([k, n]) => `${k} ${n}`).join(" · ")}`);
      const sorted = [...all].sort((a, b) => (cardColors(pool.get(a)!).join("") || "~").localeCompare(cardColors(pool.get(b)!).join("") || "~") || a.localeCompare(b));
      for (const id of sorted) console.log(line(id));
    }
  } else {
    console.log(`${set.name} — a ${recipe.name} pack, seed ${seed}`);
    for (const id of rollPack(resolveSet(set, pool), recipe, new WorldRng(seed))) console.log(line(id));
  }
}
