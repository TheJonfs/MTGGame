/**
 * Scryfall art fetch (S6 brief Part 2, ADR-008, docs/art/printings.md).
 *
 * For every real card in the pool: resolve a printing (default = oldest
 * English paper printing with a highres scan; overrides per printings.md),
 * download art_crop and normal into data/art/real/ (gitignored), record
 * oracle data in data/art/real/oracle.json, and rewrite the pool registry's
 * "Scryfall printings" section. Idempotent: existing images are not
 * re-downloaded; resolution is re-checked cheaply from oracle.json.
 *
 * Etiquette per Scryfall docs: identified client, >=150ms between requests,
 * everything cached locally, nothing fetched at runtime.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "../packages/cards/src/loader.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "data/art/real");
const ORACLE = join(OUT, "oracle.json");
const HEADERS = { "User-Agent": "ShandalarLike/0.1 (personal project)", Accept: "application/json" };
const DELAY_MS = 150;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let lastCall = 0;
async function api(url: string): Promise<Record<string, unknown>> {
  const wait = lastCall + DELAY_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();
  const resp = await fetch(url, { headers: HEADERS });
  if (!resp.ok) throw new Error(`Scryfall ${resp.status} for ${url}: ${(await resp.text()).slice(0, 200)}`);
  return (await resp.json()) as Record<string, unknown>;
}

interface Printing {
  id: string;
  set: string;
  set_name: string;
  collector_number: string;
  artist: string;
  image_status: string;
  name: string;
  mana_cost?: string;
  type_line: string;
  oracle_text?: string;
  image_uris?: { art_crop?: string; normal?: string };
}

/** printings.md overrides. Everything else takes the default rule. */
const OVERRIDES: Record<string, { set: string; collector?: string }> = {
  hymn_to_tourach: { set: "fem", collector: "38b" },
  // S8 feedback round: Beta over Unlimited — black borders like the new frame.
  mountain: { set: "leb" },
  plains: { set: "leb" },
  island: { set: "leb" },
  swamp: { set: "leb" },
  forest: { set: "leb" },
  mind_rot: { set: "7ed" },
  phyrexian_rager: { set: "apc" }, // ADR-044: oldest-highres resolved to PMEI (magazine promo)
  black_lotus: { set: "lea" }, // S15 (ADR-068): Christopher Rush — the point of the exercise
  demonic_tutor: { set: "lea" }, // S15: Douglas Shuler (planner suggestion; default rule agrees)
  cathartic_adept: { set: "ala" }, // S16 (brief): Shards of Alara, Carl Critchlow — its only original
  restoration_angel: { set: "avr" }, // S17: oldest-highres resolves to the PAVR prerelease promo (Wesley Burt alt art); Avacyn Restored (Johannes Voss) is the original — the Rager precedent
};

async function search(q: string): Promise<Printing[]> {
  const out: Printing[] = [];
  let url: string | null = `https://api.scryfall.com/cards/search?unique=prints&order=released&dir=asc&q=${encodeURIComponent(q)}`;
  while (url) {
    const page = await api(url);
    out.push(...((page.data as Printing[]) ?? []));
    url = page.has_more ? (page.next_page as string) : null;
  }
  return out;
}

function numericCollector(c: string): number {
  const n = parseInt(c, 10);
  return Number.isFinite(n) ? n : Infinity;
}

async function resolve(cardId: string, name: string): Promise<{ printing: Printing; via: string } | { flag: string }> {
  const override = OVERRIDES[cardId];
  if (override) {
    const prints = await search(`!"${name}" set:${override.set}`);
    if (prints.length === 0) return { flag: `override set ${override.set} has no "${name}" — not guessing (printings.md)` };
    if (override.collector) {
      const exact = prints.find((p) => p.collector_number === override.collector);
      if (!exact) return { flag: `override ${override.set} #${override.collector} not found for "${name}"` };
      return { printing: exact, via: `override ${override.set} #${override.collector}` };
    }
    const lowest = [...prints].sort((a, b) => numericCollector(a.collector_number) - numericCollector(b.collector_number))[0]!;
    return { printing: lowest, via: `override ${override.set} lowest collector` };
  }
  const prints = await search(`!"${name}" lang:en game:paper`);
  const pick = prints.find((p) => p.image_status === "highres_scan" && p.image_uris?.art_crop);
  if (!pick) return { flag: `no highres English printing found for "${name}"` };
  return { printing: pick, via: "default oldest-highres" };
}

async function download(url: string, dest: string): Promise<void> {
  if (existsSync(dest)) return;
  const wait = lastCall + DELAY_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();
  const resp = await fetch(url, { headers: { "User-Agent": HEADERS["User-Agent"] } });
  if (!resp.ok) throw new Error(`image ${resp.status} for ${url}`);
  writeFileSync(dest, Buffer.from(await resp.arrayBuffer()));
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const oracle: Record<string, unknown> = existsSync(ORACLE) ? JSON.parse(readFileSync(ORACLE, "utf8")) : {};
  const pool = loadCardPool(join(ROOT, "data/cards"));
  const flags: string[] = [];
  const rows: string[] = [];

  for (const [cardId, def] of [...pool.cards].sort(([a], [b]) => a.localeCompare(b))) {
    if (def.source !== "real" || def.isTokenDef) continue;
    const artPath = join(OUT, `${cardId}.art.jpg`);
    const fullPath = join(OUT, `${cardId}.full.jpg`);

    let entry = oracle[cardId] as Record<string, string> | undefined;
    if (!entry) {
      const resolved = await resolve(cardId, def.name);
      if ("flag" in resolved) {
        flags.push(`${cardId}: ${resolved.flag}`);
        continue;
      }
      const p = resolved.printing;
      entry = {
        scryfallId: p.id,
        set: p.set,
        set_name: p.set_name,
        collector_number: p.collector_number,
        artist: p.artist,
        name: p.name,
        mana_cost: p.mana_cost ?? "",
        type_line: p.type_line,
        oracle_text: p.oracle_text ?? "",
        art_crop: p.image_uris?.art_crop ?? "",
        normal: p.image_uris?.normal ?? "",
        via: resolved.via,
      };
      oracle[cardId] = entry;
      console.log(`${cardId}: ${p.set.toUpperCase()} #${p.collector_number} (${p.artist}) [${resolved.via}]`);
    }
    if (entry.art_crop) await download(entry.art_crop, artPath);
    if (entry.normal) await download(entry.normal, fullPath);
    rows.push(`| ${cardId} | ${entry.set} | ${entry.collector_number} | ${entry.artist} | ${entry.scryfallId} |`);
  }

  writeFileSync(ORACLE, JSON.stringify(oracle, null, 2) + "\n");

  // Rewrite the registry's printings section (repo-canonical record of ids/artists).
  const regPath = join(ROOT, "docs/registries/pool-registry.md");
  let reg = readFileSync(regPath, "utf8");
  const section = `## Scryfall printings (art:fetch)

Resolved per \`docs/art/printings.md\`; regenerate with \`pnpm art:fetch\`. Flagged rows appear in the session handoff, not here.

| cardId | set | collector | artist | scryfallId |
|---|---|---|---|---|
${rows.join("\n")}
`;
  reg = reg.includes("## Scryfall printings")
    ? reg.replace(/## Scryfall printings[\s\S]*?(?=\n## |$)/, section + "\n")
    : reg + "\n" + section;
  writeFileSync(regPath, reg);

  console.log(`\n${rows.length} cards resolved; oracle.json written; registry section updated.`);
  if (flags.length) {
    console.log(`FLAGGED (${flags.length}):`);
    for (const f of flags) console.log("  " + f);
  }
}

await main();
