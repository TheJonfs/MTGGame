/**
 * pnpm rating:view [--in data/convocation/card-rating.json] [--compare other.json] [--out analysis/rating-view.html]
 *
 * S47 follow-up (Chris): the card rating as a STANDALONE page — not part of the game's interface. One self-contained
 * HTML file (the table and the card facts embedded; no network): sort by any column, filter by tier, colour, type and
 * sample, search by name. `--compare` adds an earlier (or later) table's rating and the change beside each card, so a
 * future update of the rating reads against this one.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCardPool } from "@shandalar/cards/loader";
import { cardColors, manaValue, parseManaCost } from "@shandalar/cards";
import type { CardRatingRow } from "./rating.js";

const arg = (k: string, d: string) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 ? process.argv[i + 1]! : d; };
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = loadCardPool(join(ROOT, "data/cards")).cards;
type Table = { version?: number; run?: Record<string, unknown>; cards: Record<string, CardRatingRow> };
const load = (f: string) => JSON.parse(readFileSync(resolve(ROOT, f), "utf8")) as Table;
const inFile = arg("in", "data/convocation/card-rating.json"), cmpFile = arg("compare", "");
const table = load(inFile), cmp = cmpFile ? load(cmpFile) : undefined;
const power: string[] = JSON.parse(readFileSync(join(ROOT, "data/convocation/sets.json"), "utf8")).power;

const TYPES = ["Creature", "Land", "Instant", "Sorcery", "Enchantment", "Artifact"];
const rows = Object.entries(table.cards).map(([id, r]) => {
  const d = pool.get(id)!;
  return {
    id, name: d.name, tier: d.shopTier !== undefined ? String(d.shopTier) : power.includes(id) ? "power" : "legend",
    colors: cardColors(d).join(""), cost: d.manaCost ?? "", mv: d.types.includes("Land") ? null : manaValue(parseManaCost(d.manaCost)),
    type: TYPES.find((t) => (d.types as string[]).includes(t)) ?? d.types[0], text: d.text ?? "",
    ...r, was: cmp?.cards[id]?.rating ?? null,
  };
});
const payload = JSON.stringify({ source: inFile, compare: cmpFile || null, version: table.version ?? null, run: table.run ?? {}, rows }).replace(/</g, "\\u003c");

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cinquefoil card rating</title>
<style>
:root{--bg:#f6f4ee;--panel:#fffdf8;--ink:#23201a;--mute:#7a7365;--line:#ddd6c6;--accent:#2f6b4f;--pos:#2f7d57;--neg:#b4513c;--chip:#ebe6d8;--chipOn:#23201a;--chipOnInk:#fffdf8;--bar:#e9e3d3}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#16171a;--panel:#1e2024;--ink:#e9e6df;--mute:#9a958a;--line:#33363c;--accent:#7cc7a0;--pos:#6fc497;--neg:#e08a74;--chip:#2a2d33;--chipOn:#e9e6df;--chipOnInk:#16171a;--bar:#2a2d33}}
:root[data-theme="dark"]{--bg:#16171a;--panel:#1e2024;--ink:#e9e6df;--mute:#9a958a;--line:#33363c;--accent:#7cc7a0;--pos:#6fc497;--neg:#e08a74;--chip:#2a2d33;--chipOn:#e9e6df;--chipOnInk:#16171a;--bar:#2a2d33}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
header{padding:20px 16px 8px;max-width:1180px;margin:0 auto}h1{font:600 22px/1.2 ui-serif,Georgia,serif;margin:0 0 4px}
.sub{color:var(--mute);font-size:13px}.sub code{font:12px ui-monospace,Menlo,monospace}
.controls{position:sticky;top:0;z-index:2;background:var(--bg);border-bottom:1px solid var(--line)}
.controls>div{max-width:1180px;margin:0 auto;padding:10px 16px;display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center}
input[type=search]{flex:1 1 180px;min-width:150px;padding:7px 10px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink);font:inherit}
.group{display:flex;gap:4px;align-items:center;flex-wrap:wrap}.group>span{color:var(--mute);font-size:12px;margin-right:2px}
button.chip{border:0;border-radius:999px;padding:4px 10px;background:var(--chip);color:var(--ink);font:inherit;font-size:12px;cursor:pointer}
button.chip[aria-pressed=true]{background:var(--chipOn);color:var(--chipOnInk)}
select{padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink);font:inherit;font-size:12px}
main{max-width:1180px;margin:0 auto;padding:8px 16px 40px}.count{color:var(--mute);font-size:12px;margin:6px 0}
.wrap{overflow-x:auto;border:1px solid var(--line);border-radius:8px;background:var(--panel)}
table{border-collapse:collapse;width:100%;min-width:860px;font-variant-numeric:tabular-nums}
th,td{padding:6px 10px;text-align:right;border-bottom:1px solid var(--line);white-space:nowrap}
th{font-weight:600;font-size:12px;color:var(--mute);cursor:pointer;user-select:none;position:relative}
th:first-child,td:first-child,th.l,td.l{text-align:left}th[aria-sort]{color:var(--ink)}th[aria-sort=descending]::after{content:" ↓"}th[aria-sort=ascending]::after{content:" ↑"}
tr:last-child td{border-bottom:0}tbody tr:hover{background:color-mix(in srgb,var(--accent) 8%,transparent)}
td.name{font-weight:600;white-space:normal;min-width:170px}td.name small{display:block;font-weight:400;color:var(--mute);font-size:11px}
.tier{display:inline-block;min-width:22px;padding:1px 6px;border-radius:4px;background:var(--chip);font-size:11px;text-align:center}
.pip{display:inline-block;width:10px;height:10px;border-radius:50%;margin-left:2px;border:1px solid var(--line);vertical-align:middle}
.W{background:#f3ecc9}.U{background:#5b93cf}.B{background:#4a4350}.R{background:#cf5b45}.G{background:#4f9a62}
.bar{display:inline-block;width:64px;height:8px;background:var(--bar);border-radius:2px;position:relative;vertical-align:middle;margin-left:6px}
.bar i{position:absolute;top:0;bottom:0;border-radius:2px}.bar::after{content:"";position:absolute;left:50%;top:-2px;bottom:-2px;width:1px;background:var(--mute)}
.pos{color:var(--pos)}.neg{color:var(--neg)}.dim{color:var(--mute)}
.rating{font-weight:700;font-size:15px}details{margin:14px 0 0;color:var(--mute);font-size:13px}details p{max-width:70ch}
</style></head><body>
<header><h1>Cinquefoil card rating</h1><div class="sub" id="meta"></div>
<details><summary>How to read the columns</summary>
<p><b>Rating</b> is the tier's starting number (tier 1 → 1.0, 2 → 1.5, 3 → 2.0, R, legends and power → 2.5) moved by two measurements. <b>vs tier</b> is how far the measurements moved it.</p>
<p><b>Presence</b>: the win rate of the lists that play the card, less the field's, in points. A card in one strong list inherits that list. <b>Lists</b> is how many lists play it.</p>
<p><b>Lift</b>: in games where the pilot saw the card in hand, how much better the deck did than its own average, in points. <b>Seen</b> is the number of such games; below a few hundred the lift is mostly noise and is shrunk hard.</p>
<p><b>Cast</b>: of the games it was seen, the share in which it was cast (a land: played). Shown, not used in the rating.</p></details></header>
<div class="controls"><div>
<input type="search" id="q" placeholder="Search name or text" aria-label="Search">
<div class="group" id="tiers"><span>Tier</span></div>
<div class="group" id="colors"><span>Colour</span></div>
<select id="type" aria-label="Type"><option value="">All types</option></select>
<select id="seen" aria-label="Minimum sample"><option value="0">Any sample</option><option value="300">Seen ≥ 300</option><option value="1000">Seen ≥ 1,000</option><option value="3000">Seen ≥ 3,000</option></select>
</div></div>
<main><div class="count" id="count"></div><div class="wrap"><table><thead><tr id="head"></tr></thead><tbody id="body"></tbody></table></div></main>
<script>
const DATA = ${payload};
const $ = (id) => document.getElementById(id);
const hasCmp = !!DATA.compare;
const cols = [
  { k: "name", t: "Card", l: 1 }, { k: "tier", t: "Tier", l: 1 }, { k: "colors", t: "Colour", l: 1 }, { k: "mv", t: "MV" }, { k: "type", t: "Type", l: 1 },
  { k: "rating", t: "Rating" }, { k: "gap", t: "vs tier" }, ...(hasCmp ? [{ k: "delta", t: "Change" }] : []),
  { k: "lists", t: "Lists" }, { k: "presence", t: "Presence" }, { k: "seen", t: "Seen" }, { k: "lift", t: "Lift" }, { k: "castWhenDrawn", t: "Cast" },
];
const TIER_ORDER = { "1": 1, "2": 2, "3": 3, R: 4, legend: 5, power: 6 };
for (const r of DATA.rows) { r.gap = r.rating - r.prior; r.delta = r.was === null ? null : r.rating - r.was; }
const state = { sort: "rating", dir: -1, tiers: new Set(), colors: new Set(), q: "", type: "", seen: 0 };
const run = DATA.run || {};
$("meta").innerHTML = (DATA.version !== null ? "Version " + DATA.version + " · " : "") + (run.games ? Number(run.games).toLocaleString() + " games over " + run.lists + " lists · " : "") + DATA.rows.length + " cards · <code>" + DATA.source + "</code>" + (hasCmp ? " against <code>" + DATA.compare + "</code>" : "");
const chip = (host, label, set, value) => { const b = document.createElement("button"); b.className = "chip"; b.textContent = label; b.setAttribute("aria-pressed", "false"); b.onclick = () => { set.has(value) ? set.delete(value) : set.add(value); b.setAttribute("aria-pressed", String(set.has(value))); render(); }; host.appendChild(b); };
for (const t of ["1", "2", "3", "R", "legend", "power"]) if (DATA.rows.some((r) => r.tier === t)) chip($("tiers"), t, state.tiers, t);
for (const [v, label] of [["W", "W"], ["U", "U"], ["B", "B"], ["R", "R"], ["G", "G"], ["gold", "Gold"], ["none", "Colourless"]]) chip($("colors"), label, state.colors, v);
for (const t of [...new Set(DATA.rows.map((r) => r.type))].sort()) { const o = document.createElement("option"); o.value = t; o.textContent = t; $("type").appendChild(o); }
$("q").oninput = (e) => { state.q = e.target.value.toLowerCase(); render(); };
$("type").onchange = (e) => { state.type = e.target.value; render(); };
$("seen").onchange = (e) => { state.seen = Number(e.target.value); render(); };
for (const c of cols) { const th = document.createElement("th"); th.textContent = c.t; if (c.l) th.className = "l"; th.onclick = () => { if (state.sort === c.k) state.dir = -state.dir; else { state.sort = c.k; state.dir = c.l ? 1 : -1; } render(); }; th.dataset.k = c.k; $("head").appendChild(th); }
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const signed = (x, d) => (x === null || x === undefined ? '<span class="dim">—</span>' : '<span class="' + (x > 0 ? "pos" : x < 0 ? "neg" : "dim") + '">' + (x > 0 ? "+" : x < 0 ? "−" : "") + Math.abs(x).toFixed(d) + "</span>");
const bar = (x, max) => { if (x === null || x === undefined) return ""; const w = Math.min(50, (Math.abs(x) / max) * 50); return '<span class="bar"><i style="background:var(' + (x >= 0 ? "--pos" : "--neg") + ");width:" + w + "%;" + (x >= 0 ? "left:50%" : "right:50%") + '"></i></span>'; };
const colorMatch = (r) => { if (!state.colors.size) return true; const n = r.colors.length; for (const v of state.colors) { if (v === "gold" ? n > 1 : v === "none" ? n === 0 : r.colors.includes(v)) return true; } return false; };
function render() {
  const rows = DATA.rows.filter((r) => (!state.tiers.size || state.tiers.has(r.tier)) && colorMatch(r) && (!state.type || r.type === state.type) && r.seen >= state.seen && (!state.q || r.name.toLowerCase().includes(state.q) || r.text.toLowerCase().includes(state.q)));
  const k = state.sort, val = (r) => (k === "tier" ? TIER_ORDER[r.tier] : r[k]);
  rows.sort((a, b) => { const x = val(a), y = val(b); if (x === null || x === undefined) return 1; if (y === null || y === undefined) return -1; return (typeof x === "string" ? x.localeCompare(y) : x - y) * state.dir || a.name.localeCompare(b.name); });
  for (const th of $("head").children) { if (th.dataset.k === k) th.setAttribute("aria-sort", state.dir < 0 ? "descending" : "ascending"); else th.removeAttribute("aria-sort"); }
  $("count").textContent = rows.length + " of " + DATA.rows.length + " cards";
  $("body").innerHTML = rows.map((r) => "<tr><td class='name'>" + esc(r.name) + "<small>" + esc(r.cost || "") + "</small></td><td class='l'><span class='tier'>" + r.tier + "</span></td><td class='l'>" + (r.colors ? [...r.colors].map((c) => "<span class='pip " + c + "' title='" + c + "'></span>").join("") : "<span class='dim'>—</span>") + "</td><td>" + (r.mv === null ? "<span class='dim'>—</span>" : r.mv) + "</td><td class='l'>" + r.type + "</td><td class='rating'>" + r.rating.toFixed(2) + "</td><td>" + signed(r.gap, 2) + bar(r.gap, 1.25) + "</td>" + (hasCmp ? "<td>" + signed(r.delta, 2) + "</td>" : "") + "<td>" + r.lists + "</td><td>" + signed(r.presence === null ? null : r.presence * 100, 1) + bar(r.presence === null ? null : r.presence * 100, 20) + "</td><td>" + r.seen.toLocaleString() + "</td><td>" + signed(r.lift === null ? null : r.lift * 100, 1) + bar(r.lift === null ? null : r.lift * 100, 8) + "</td><td>" + (r.castWhenDrawn === null ? "<span class='dim'>—</span>" : Math.round(r.castWhenDrawn * 100) + "%") + "</td></tr>").join("");
}
render();
</script></body></html>
`;
const out = resolve(ROOT, arg("out", "analysis/rating-view.html"));
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`rating:view — ${rows.length} cards → ${out}`);
