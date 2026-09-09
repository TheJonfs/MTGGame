/**
 * The Matchup Lab (S33 director round — Chris): explore any pairing under chosen conditions — life,
 * entrance basics, starting bonuses (a boss's law, roots, signature, tokens, bonus cards), the AI
 * profile — as a live grid of simulated games in web workers, with the band of interest shaded.
 * Dev-only surface. Runs and custom decks save to the gitignored analysis/ folder through the dev
 * server. The Lab re-implements no rules: every number is a MatchResult from the real engine and
 * the real heuristic agents (the sweep's call).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { CardDef } from "@shandalar/cards";
import { loadPool } from "../engine-bridge";
import { customAsLabDeck, deckStats, entranceBasics, labDecks, manaValue, resolveSide, type Archetype, type CustomDeck, type Decklist, type LabDeck, type LabMode, type Profile } from "./lab-decks";
import type { LabBonus, LabCell, LabJob, LabSide, ResolvedSide } from "./lab-types";
import { LabWorkerPool, type PoolStatus } from "./lab-pool";
import { BonusEditor, DeckEditor, PROFILES, SidePanel, sideFromDeck } from "./lab-panels";
import { DIFFICULTIES, resolveKnobs } from "@shandalar/world";

const parseList = (s: string): number[] => s.split(/[,\s]+/).map((x) => Number(x)).filter((n) => Number.isFinite(n));

interface RunSetup {
  a: LabSide;
  b: LabSide;
  /** The grid varies side A over these (life × basics); a single value each = one cell. */
  lives: number[];
  basics: number[];
  games: number;
  seed: number;
}
interface SavedRun { name: string; when: string; setup: RunSetup; cells: Record<string, LabCell>; notes?: string; resolved?: { a: ResolvedSide; b: ResolvedSide }; roster?: RosterSetup }
/** The roster grid (Chris, the baseline): rows (the starters, at their defaults or an override) against a
 * roster of opponents at THEIR world defaults — every mage at its tier, every beast at its catalog row. */
interface RosterSetup {
  rows: string[];
  rowLife: number | null;
  rowProfile: Profile | null;
  rowBasics: number | null;
  mages: boolean;
  beasts: boolean;
  games: number;
  seed: number;
  /** The target band per opponent tier (the row's win rate): high at tier 1, even at tier 2, unfavourable at tier 3. */
  bands: Record<1 | 2 | 3, [number, number]>;
  /** The differential (Chris): shifts in life and entrance basics per enemy GROUP — the three tiers of mages
   * and the three tiers of beasts. A second sweep runs with the shifts applied and every cell shows its delta. */
  shifts: Record<GroupKey, { life: number; basics: number }>;
  /** Run the second (shifted) sweep at all. */
  differential: boolean;
  /** S34: the difficulty mode whose tier tables set the columns' defaults. */
  mode?: LabMode;
  /** "fresh": the shifted sweep uses new seeds, so unshifted cells show the Monte Carlo noise floor; "paired":
   * the same seeds, so unshifted cells are exactly zero and shifted cells are a paired comparison. */
  shiftSeeds: "fresh" | "paired";
}
type GroupKey = "M1" | "M2" | "M3" | "B1" | "B2" | "B3";
const GROUP_KEYS: GroupKey[] = ["M1", "M2", "M3", "B1", "B2", "B3"];
const groupOf = (d: LabDeck): GroupKey | null => (d.tier && (d.group === "mages" || d.group === "beasts") ? (`${d.group === "mages" ? "M" : "B"}${d.tier}` as GroupKey) : null);
const ZERO_SHIFTS: Record<GroupKey, { life: number; basics: number }> = { M1: { life: 0, basics: 0 }, M2: { life: 0, basics: 0 }, M3: { life: 0, basics: 0 }, B1: { life: 0, basics: 0 }, B2: { life: 0, basics: 0 }, B3: { life: 0, basics: 0 } };

const pct = (n: number, d: number) => (d > 0 ? (100 * n) / d : 0);
const rosterId = (row: string, col: string, phase: "base" | "shift" = "base") => `${phase}|${row}|${col}`;
const ci95 = (p: number, n: number) => (n > 0 ? 1.96 * Math.sqrt((p * (1 - p)) / n) : 0);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const cellId = (life: number, basics: number) => `${life}/${basics}`;

export function LabApp() {
  const pool = useMemo(() => loadPool(), []);
  // S34: the world defaults (a mage's tier life and entrance, a beast's tier delta) come from the resolver's
  // tables at a MODE; the selector sits beside the roster's columns and a saved run names it.
  const [labMode, setLabMode] = useState<LabMode>("standard");
  const baseDecks = useMemo(() => labDecks(labMode), [labMode]);
  const [customs, setCustoms] = useState<CustomDeck[]>([]);
  const decks = useMemo(() => [...baseDecks, ...customs.map(customAsLabDeck)], [baseDecks, customs]);
  const byKey = useMemo(() => new Map(decks.map((d) => [d.key, d])), [decks]);
  // Round three (Chris: grids ended with cells never run — a worker that fails to load loses its job
  // silently): a pool with a ready handshake, error replacement and a stall watchdog; four workers by
  // default (the dev server serves every module to every worker; six was the failure mode).
  const threads = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));
  const workerPool = useRef<LabWorkerPool | null>(null);
  const [poolStatus, setPoolStatus] = useState<PoolStatus>({ workers: 0, ready: 0, busy: 0, failed: 0, queued: 0 });

  const [setup, setSetup] = useState<RunSetup>(() => ({
    a: { deck: "mage:corvane", life: 12, basics: 0, profile: "master", bonuses: [] },
    b: { deck: "road:roadMidW", life: 12, basics: 1, profile: "journeyman", bonuses: [] },
    lives: [12, 16, 20], basics: [0, 1, 2], games: 50, seed: 1,
  }));
  const [livesText, setLivesText] = useState("12, 16, 20");
  const [basicsText, setBasicsText] = useState("0, 1, 2");
  const [band, setBand] = useState<[number, number]>([55, 65]);
  const [show, setShow] = useState<"b" | "a">("b");
  const [cells, setCells] = useState<Record<string, LabCell>>({});
  const [resolved, setResolved] = useState<{ a: ResolvedSide; b: ResolvedSide } | null>(null);
  const [running, setRunning] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedRun[]>([]);
  const [compare, setCompare] = useState<SavedRun | null>(null);
  const [runName, setRunName] = useState("");
  const [notes, setNotes] = useState("");
  const [editor, setEditor] = useState<CustomDeck | null>(null);
  const [mode, setMode] = useState<"grid" | "roster">("grid");
  const [roster, setRoster] = useState<RosterSetup>(() => ({ rows: ["starter:white", "starter:blue", "starter:black", "starter:red", "starter:green"], rowLife: null, rowProfile: null, rowBasics: null, mages: true, beasts: true, games: 50, seed: 1, bands: { 1: [65, 80], 2: [45, 55], 3: [30, 45] }, shifts: { ...ZERO_SHIFTS }, differential: true, shiftSeeds: "fresh" }));
  const rosterCols = useMemo(() => decks.filter((d) => (roster.mages && d.group === "mages") || (roster.beasts && d.group === "beasts")), [decks, roster.mages, roster.beasts]);
  useEffect(() => {
    const p = new LabWorkerPool(threads, () => new Worker(new URL("./lab-worker.ts", import.meta.url), { type: "module" }));
    p.onCell = (cell) => setCells((c) => ({ ...c, [cell.id]: cell }));
    p.onError = (m) => setErrors((e) => [...e.slice(-19), m]);
    p.onStatus = setPoolStatus;
    p.onIdle = () => setRunning(false);
    workerPool.current = p;
    return () => { p.dispose(); workerPool.current = null; };
  }, [threads]);

  const pickDeck = (side: "a" | "b", key: string) => {
    const d = byKey.get(key);
    if (!d) return;
    setSetup((s) => ({ ...s, [side]: sideFromDeck(d) }));
    if (side === "a") { setLivesText(String(d.life)); setBasicsText(String(d.basics)); }
  };
  const patchSide = (side: "a" | "b", patch: Partial<LabSide>) => setSetup((s) => ({ ...s, [side]: { ...s[side], ...patch } }));

  const refresh = async () => {
    try { const r = await fetch("/__lab-list"); if (r.ok) setSaved((await r.json()) as SavedRun[]); } catch { /* no dev server */ }
    try { const r = await fetch("/__lab-deck-list"); if (r.ok) setCustoms((await r.json()) as CustomDeck[]); } catch { /* no dev server */ }
  };
  useEffect(() => { void refresh(); }, []);

  const start = () => {
    const lives = parseList(livesText).length ? parseList(livesText) : [setup.a.life];
    const basics = parseList(basicsText).length ? parseList(basicsText) : [setup.a.basics];
    const s = { ...setup, lives, basics };
    let rb: ResolvedSide, ra0: ResolvedSide;
    try { rb = resolveSide(s.b, byKey, pool); ra0 = resolveSide(s.a, byKey, pool); } catch (e) { setErrors([String((e as Error).message)]); return; }
    setSetup(s); setResolved({ a: ra0, b: rb });
    setCells({}); setErrors([]); setPicked(null);
    const jobs: LabJob[] = lives.flatMap((life) => basics.map((nb) => ({ id: cellId(life, nb), seed: s.seed, games: s.games, a: resolveSide({ ...s.a, life, basics: nb }, byKey, pool), b: rb })));
    if (!workerPool.current || jobs.length === 0) return;
    setRunning(true);
    workerPool.current.run(jobs);
  };
  const stop = () => { workerPool.current?.stop(); setRunning(false); };
  const startRoster = () => {
    const jobs: LabJob[] = [];
    try {
      for (const rk of roster.rows) {
        const rd = byKey.get(rk); if (!rd) continue;
        const rowSide: LabSide = { deck: rk, life: roster.rowLife ?? rd.life, basics: roster.rowBasics ?? rd.basics, profile: roster.rowProfile ?? rd.profile, bonuses: (rd.bonuses ?? []).map((b) => ({ ...b })) };
        for (const cd of rosterCols) {
          const colSide: LabSide = sideFromDeck(cd);
          jobs.push({ id: rosterId(rk, cd.key, "base"), seed: roster.seed, games: roster.games, a: resolveSide(rowSide, byKey, pool), b: resolveSide(colSide, byKey, pool) });
        }
      }
      if (roster.differential) {
        // The second sweep: every column at its defaults PLUS its group's shift; fresh seeds by default (the
        // noise floor shows on the unshifted cells), paired seeds on request. Queued after the base sweep.
        const seed2 = roster.shiftSeeds === "paired" ? roster.seed : roster.seed + 100_003;
        for (const rk of roster.rows) {
          const rd = byKey.get(rk); if (!rd) continue;
          const rowSide: LabSide = { deck: rk, life: roster.rowLife ?? rd.life, basics: roster.rowBasics ?? rd.basics, profile: roster.rowProfile ?? rd.profile, bonuses: (rd.bonuses ?? []).map((b) => ({ ...b })) };
          for (const cd of rosterCols) {
            const g = groupOf(cd); const sh = g ? roster.shifts[g] : { life: 0, basics: 0 };
            const colSide: LabSide = { ...sideFromDeck(cd), life: Math.max(1, cd.life + sh.life), basics: Math.max(0, cd.basics + sh.basics) };
            jobs.push({ id: rosterId(rk, cd.key, "shift"), seed: seed2, games: roster.games, a: resolveSide(rowSide, byKey, pool), b: resolveSide(colSide, byKey, pool) });
          }
        }
      }
    } catch (e) { setErrors([String((e as Error).message)]); return; }
    if (!workerPool.current || jobs.length === 0) return;
    setCells({}); setErrors([]); setPicked(null); setResolved(null);
    setRunning(true);
    workerPool.current.run(jobs);
  };

  const save = async () => {
    const name = runName.trim() || `${setup.a.deck.replace(/[:]/g, "-")}_vs_${setup.b.deck.replace(/[:]/g, "-")}_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}`;
    const run: SavedRun = { name, when: new Date().toISOString(), setup, cells, notes, ...(resolved ? { resolved } : {}), ...(mode === "roster" ? { roster: { ...roster, mode: labMode } } : {}) };
    const r = await fetch("/__lab-save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(run) });
    if (r.ok) { setRunName(""); void refresh(); }
  };
  const download = () => {
    const run: SavedRun = { name: runName || "lab-run", when: new Date().toISOString(), setup, cells, notes, ...(resolved ? { resolved } : {}), ...(mode === "roster" ? { roster } : {}) };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(run, null, 2)], { type: "application/json" }));
    a.download = `${run.name}.json`; a.click();
  };
  const load = (run: SavedRun) => {
    const fix = (s: LabSide): LabSide => ({ ...s, bonuses: s.bonuses ?? [] });
    setSetup({ ...run.setup, a: fix(run.setup.a), b: fix(run.setup.b) }); setLivesText(run.setup.lives.join(", ")); setBasicsText(run.setup.basics.join(", ")); setCells(run.cells); setNotes(run.notes ?? ""); setPicked(null); setResolved(run.resolved ?? null);
    if (run.roster) { setRoster({ ...run.roster, shifts: { ...ZERO_SHIFTS, ...(run.roster.shifts ?? {}) }, differential: run.roster.differential ?? false, shiftSeeds: run.roster.shiftSeeds ?? "fresh" }); if (run.roster.mode) setLabMode(run.roster.mode); setMode("roster"); } else setMode("grid");
  };

  // ---- the deck editor
  const openEditor = (fromKey: string) => {
    const d = byKey.get(fromKey);
    if (!d) return;
    setEditor({ name: d.group === "custom" ? d.name : `${d.name} v2`, archetype: d.archetype, decklist: d.decklist.map((e) => ({ ...e })), basedOn: d.group === "custom" ? (customs.find((c) => c.name === d.name)?.basedOn ?? d.name) : d.name });
  };
  const saveDeck = async () => {
    if (!editor) return;
    const deck: CustomDeck = { ...editor, name: editor.name.trim() || "custom", when: new Date().toISOString() };
    const r = await fetch("/__lab-deck-save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(deck) });
    if (r.ok) { await refresh(); setEditor({ ...deck }); }
  };
  const useDeck = (side: "a" | "b") => {
    if (!editor) return;
    const key = `custom:${editor.name.trim() || "custom"}`;
    // Use the editor's list even before it is saved: an unsaved custom deck lives only in this page.
    const asDeck = customAsLabDeck({ ...editor, name: editor.name.trim() || "custom" });
    if (!byKey.has(key)) setCustoms((c) => [...c.filter((x) => x.name !== asDeck.name), { ...editor, name: asDeck.name }]);
    setSetup((s) => ({ ...s, [side]: { ...s[side], deck: key } }));
  };

  const A = byKey.get(setup.a.deck), B = byKey.get(setup.b.deck);
  const lives = setup.lives, basicsList = setup.basics;
  const shownPct = (c: LabCell) => (show === "b" ? pct(c.bWins, c.games) : pct(c.aWins, c.games));
  const inBand = (p: number) => p >= band[0] && p <= band[1];
  const shade = (p: number, done: boolean) => {
    if (!done) return "rgba(176,138,62,0.08)";
    if (inBand(p)) return "rgba(120,170,90,0.35)";
    const d = p < band[0] ? band[0] - p : p - band[1];
    return `rgba(190,80,60,${Math.min(0.45, 0.08 + d / 60)})`;
  };
  const total = lives.length * basicsList.length * setup.games;
  const doneGames = Object.values(cells).reduce((n, c) => n + c.games, 0);
  const pickedCell = picked ? cells[picked] : undefined;
  const cmpCell = (id: string) => compare?.cells[id];

  return (
    <div style={{ padding: 16, overflow: "auto", height: "100%", boxSizing: "border-box", background: "var(--parchment) url(\"/panel-parchment.png\")", backgroundSize: "512px", color: "var(--ink)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
        <h2 style={{ fontFamily: "var(--serif)", margin: 0 }}>Matchup Lab</h2>
        <a href="/" className="linkish">← menu</a>
        <span style={{ fontSize: 12 }}>
          <label style={{ marginRight: 8 }}><input type="radio" checked={mode === "grid"} onChange={() => setMode("grid")} /> one pairing over a grid</label>
          <label><input type="radio" checked={mode === "roster"} onChange={() => setMode("roster")} /> a roster (rows × every mage and beast at their defaults)</label>
        </span>
        <span className="seed" style={{ marginLeft: "auto" }} title="workers load the whole engine each; a worker that fails is replaced and its cell re-queued">{poolStatus.workers} worker{poolStatus.workers === 1 ? "" : "s"}: {poolStatus.ready} ready{poolStatus.busy ? `, ${poolStatus.busy} busy` : ""}{poolStatus.queued ? `, ${poolStatus.queued} cells queued` : ""}{poolStatus.failed ? `, ${poolStatus.failed} failed and replaced` : ""} · the engine and the heuristic agents, live · dev surface</span>
      </div>
      {mode === "roster" && (
        <RosterView roster={roster} setRoster={setRoster} decks={decks} byKey={byKey} cols={rosterCols} cells={cells} running={running} onRun={startRoster} onStop={stop} picked={picked} setPicked={setPicked} labMode={labMode} setLabMode={setLabMode} />
      )}
      <div style={{ display: mode === "grid" ? "flex" : "none", gap: 12, marginTop: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
        <SidePanel label="a" side={setup.a} decks={decks} byKey={byKey} pool={pool} onPick={(k) => pickDeck("a", k)} onPatch={(p) => patchSide("a", p)} onEdit={() => openEditor(setup.a.deck)} />
        <SidePanel label="b" side={setup.b} decks={decks} byKey={byKey} pool={pool} onPick={(k) => pickDeck("b", k)} onPatch={(p) => patchSide("b", p)} onEdit={() => openEditor(setup.b.deck)} />
        <div className="panel" style={{ padding: 10, minWidth: 280 }}>
          <div style={{ fontFamily: "var(--serif)", fontSize: 15, marginBottom: 6 }}>The grid (side A over life × basics)</div>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 8px", fontSize: 12, alignItems: "center" }}>
            <span>A's lives</span><input value={livesText} onChange={(e) => setLivesText(e.target.value)} placeholder="12, 16, 20" />
            <span>A's basics</span><input value={basicsText} onChange={(e) => setBasicsText(e.target.value)} placeholder="0, 1, 2" />
            <span>games / cell</span><input type="number" value={setup.games} min={2} max={2000} step={2} onChange={(e) => setSetup((s) => ({ ...s, games: Number(e.target.value) }))} />
            <span>seed</span><input type="number" value={setup.seed} onChange={(e) => setSetup((s) => ({ ...s, seed: Number(e.target.value) }))} />
            <span>band</span><span><input type="number" value={band[0]} style={{ width: 48 }} onChange={(e) => setBand([Number(e.target.value), band[1]])} /> – <input type="number" value={band[1]} style={{ width: 48 }} onChange={(e) => setBand([band[0], Number(e.target.value)])} /> % for <select value={show} onChange={(e) => setShow(e.target.value as "a" | "b")}><option value="b">B (the reference)</option><option value="a">A</option></select></span>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
            {!running ? <button onClick={start}>Run {Math.max(1, parseList(livesText).length || 1) * Math.max(1, parseList(basicsText).length || 1)} cell{(parseList(livesText).length || 1) * (parseList(basicsText).length || 1) === 1 ? "" : "s"} × {setup.games}</button> : <button onClick={stop}>Stop</button>}
            <button className="linkish" onClick={() => { setSetup((s) => ({ ...s, a: s.b, b: s.a })); setLivesText(String(setup.b.life)); setBasicsText(String(setup.b.basics)); }} disabled={running}>swap sides</button>
            {running && <span className="seed">{doneGames}/{total} games</span>}
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 6 }}>The grid's basics are A's entrance by the pip rule; A's bonus list (a law, roots, a token, a card to hand) rides every cell as set in its panel. B is fixed as set.</div>
        </div>
      </div>

      <div style={{ display: mode === "grid" ? "flex" : "none", gap: 16, marginTop: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div className="panel" style={{ padding: 10 }}>
          <div style={{ fontFamily: "var(--serif)", fontSize: 15, marginBottom: 6 }}>
            {show === "b" ? `${B?.name ?? "B"}'s` : `${A?.name ?? "A"}'s`} win rate — {A?.name} at life × basics vs {B?.name} at {setup.b.life} / {setup.b.basics} in play / {setup.b.profile}{setup.b.bonuses.length ? ` / ${setup.b.bonuses.length} bonus${setup.b.bonuses.length === 1 ? "" : "es"}` : ""}
            {compare ? <span className="seed" style={{ marginLeft: 8 }}>Δ vs {compare.name}</span> : null}
          </div>
          <table style={{ borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead><tr><th style={{ textAlign: "left", padding: "4px 8px" }}>life \ basics</th>{basicsList.map((b) => <th key={b} style={{ padding: "4px 8px" }}>{b}</th>)}</tr></thead>
            <tbody>
              {lives.map((life) => (
                <tr key={life}>
                  <td style={{ padding: "4px 8px", fontWeight: 600 }}>{life}</td>
                  {basicsList.map((b) => {
                    const id = cellId(life, b); const c = cells[id]; const done = !!c && c.games >= setup.games;
                    const p = c ? shownPct(c) : 0; const err = c ? 100 * ci95(p / 100, c.games) : 0;
                    const cmp = cmpCell(id); const cmpP = cmp ? (show === "b" ? pct(cmp.bWins, cmp.games) : pct(cmp.aWins, cmp.games)) : null;
                    return (
                      <td key={id} onClick={() => c && setPicked(id)} title={c ? `${c.games} games · click for detail` : "not run"} style={{ padding: "6px 10px", textAlign: "center", cursor: c ? "pointer" : "default", background: shade(p, done), outline: picked === id ? "2px solid var(--brass)" : "none", minWidth: 96 }}>
                        {c ? <>
                          <div style={{ fontSize: 15, fontWeight: 600 }}>{p.toFixed(0)}%<span style={{ fontSize: 10, fontWeight: 400, color: "var(--ink-soft)" }}> ±{err.toFixed(0)}</span></div>
                          <div style={{ fontSize: 10.5, color: "var(--ink-soft)" }}>{mean(c.turns).toFixed(1)} turns{(show === "b" ? c.bDecked : c.aDecked) > 0 ? ` · ${pct(show === "b" ? c.bDecked : c.aDecked, show === "b" ? c.bWins : c.aWins).toFixed(0)}% by library` : ""}{!done ? ` · ${c.games}/${setup.games}` : ""}</div>
                          {cmpP !== null && <div style={{ fontSize: 10.5 }}>{p - cmpP >= 0 ? "+" : ""}{(p - cmpP).toFixed(0)} vs saved</div>}
                        </> : <span style={{ color: "var(--ink-soft)" }}>—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 6 }}>Shaded green inside the band; redder the further outside. ± is the 95% interval at this cell's game count. Both seats alternate; click a cell for the play/draw split, margins and the turn histogram.</div>
        </div>

        {pickedCell && (
          <div className="panel" style={{ padding: 10, minWidth: 300 }}>
            <div style={{ fontFamily: "var(--serif)", fontSize: 15, marginBottom: 6 }}>Cell {pickedCell.id} — {A?.name} at {pickedCell.id.split("/")[0]} life, {pickedCell.aEntrance.length ? pickedCell.aEntrance.join(" + ") : "no entrance basics"}</div>
            <table style={{ fontSize: 12, borderCollapse: "collapse" }}>
              <tbody>
                <tr><td style={{ padding: "2px 8px 2px 0" }}>games</td><td>{pickedCell.games}{pickedCell.draws ? ` (${pickedCell.draws} draws)` : ""}{pickedCell.errors ? ` · ${pickedCell.errors} errors` : ""}</td></tr>
                <tr><td style={{ padding: "2px 8px 2px 0" }}>{A?.name} wins</td><td>{pct(pickedCell.aWins, pickedCell.games).toFixed(0)}% — on the play {pct(pickedCell.aWinsBySeat[0], pickedCell.gamesBySeat[0]).toFixed(0)}%, on the draw {pct(pickedCell.aWinsBySeat[1], pickedCell.gamesBySeat[1]).toFixed(0)}%{pickedCell.aDecked ? ` · ${pickedCell.aDecked} by library` : ""}</td></tr>
                <tr><td style={{ padding: "2px 8px 2px 0" }}>{B?.name} wins</td><td>{pct(pickedCell.bWins, pickedCell.games).toFixed(0)}%{pickedCell.bDecked ? ` · ${pickedCell.bDecked} by library` : ""}</td></tr>
                <tr><td style={{ padding: "2px 8px 2px 0" }}>winner's life left</td><td>{A?.name}: {mean(pickedCell.aMargin).toFixed(1)} · {B?.name}: {mean(pickedCell.bMargin).toFixed(1)} (the margin — how close the losses were)</td></tr>
                <tr><td style={{ padding: "2px 8px 2px 0" }}>turns</td><td>mean {mean(pickedCell.turns).toFixed(1)} · min {Math.min(...pickedCell.turns)} · max {Math.max(...pickedCell.turns)}</td></tr>
                {resolved && <tr><td style={{ padding: "2px 8px 2px 0" }}>as run</td><td style={{ fontSize: 11, color: "var(--ink-soft)" }}>{describe(resolved.a, pool)} · vs · {describe(resolved.b, pool)}</td></tr>}
              </tbody>
            </table>
            <Histogram values={pickedCell.turns} />
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 16, marginTop: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
        {editor && <DeckEditor deck={editor} pool={pool} onChange={setEditor} onSave={() => void saveDeck()} onUse={useDeck} onClose={() => setEditor(null)} />}
        <div className="panel" style={{ padding: 10, minWidth: 320, maxWidth: 560 }}>
          <div style={{ fontFamily: "var(--serif)", fontSize: 15, marginBottom: 6 }}>Runs (analysis/runs/, gitignored)</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <input value={runName} onChange={(e) => setRunName(e.target.value)} placeholder="run name (optional)" style={{ width: 200 }} />
            <button onClick={() => void save()} disabled={!Object.keys(cells).length}>Save run</button>
            <button className="linkish" onClick={download} disabled={!Object.keys(cells).length}>download JSON</button>
          </div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="notes for this run — what you were looking for, what you saw" style={{ width: "100%", minHeight: 48, marginTop: 6, fontSize: 12, boxSizing: "border-box" }} />
          {saved.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, maxHeight: 220, overflow: "auto" }}>
              {saved.map((r) => (
                <div key={r.name} style={{ display: "flex", gap: 8, alignItems: "baseline", padding: "2px 0", borderTop: "1px solid rgba(43,37,32,0.12)" }}>
                  <span style={{ flex: 1 }}><b>{r.name}</b> <span className="seed">{r.when.slice(0, 16).replace("T", " ")} · {r.setup.a.deck} vs {r.setup.b.deck} · {r.setup.games}/cell</span>{r.notes ? <div style={{ color: "var(--ink-soft)" }}>{r.notes}</div> : null}</span>
                  <button className="linkish" onClick={() => load(r)}>load</button>
                  <button className="linkish" onClick={() => setCompare(compare?.name === r.name ? null : r)}>{compare?.name === r.name ? "comparing" : "compare"}</button>
                </div>
              ))}
            </div>
          )}
        </div>
        {errors.length > 0 && <div className="panel" style={{ padding: 10, fontSize: 11, color: "#8a3b2c", maxWidth: 420 }}>{errors.map((e, i) => <div key={i}>{e}</div>)}</div>}
      </div>
    </div>
  );
}

const TIERS = [1, 2, 3] as const;
const resolveKnobsDelta = (mode: LabMode, t: 1 | 2 | 3): number => resolveKnobs({ difficulty: DIFFICULTIES[mode] }).beastTierLifeDelta[t];

/** The roster grid: rows' win rates against every column, shaded by the column's TIER band; per-row
 * aggregates by tier for the mages and the beasts (a number and a bar each); a column-mean row. */
function RosterView({ roster, setRoster, decks, byKey, cols, cells, running, onRun, onStop, picked, setPicked, labMode, setLabMode }: {
  roster: RosterSetup; setRoster: (r: RosterSetup) => void; decks: LabDeck[]; byKey: Map<string, LabDeck>; cols: LabDeck[];
  cells: Record<string, LabCell>; running: boolean; onRun: () => void; onStop: () => void; picked: string | null; setPicked: (id: string | null) => void;
  labMode: LabMode; setLabMode: (m: LabMode) => void;
}) {
  const rows = roster.rows.map((k) => byKey.get(k)).filter((d): d is LabDeck => !!d);
  const rowPct = (rk: string, ck: string, phase: "base" | "shift" = "base"): number | null => { const c = cells[rosterId(rk, ck, phase)]; return c && c.games > 0 ? pct(c.aWins, c.games) : null; };
  const done = (rk: string, ck: string, phase: "base" | "shift" = "base") => { const c = cells[rosterId(rk, ck, phase)]; return !!c && c.games >= roster.games; };
  const delta = (rk: string, ck: string): number | null => { const b = rowPct(rk, ck, "base"), s = rowPct(rk, ck, "shift"); return b === null || s === null || !done(rk, ck, "shift") ? null : s - b; };
  const shifted = (d: LabDeck): boolean => { const g = groupOf(d); return !!g && (roster.shifts[g].life !== 0 || roster.shifts[g].basics !== 0); };
  const setShift = (g: GroupKey, patch: Partial<{ life: number; basics: number }>) => setRoster({ ...roster, shifts: { ...roster.shifts, [g]: { ...roster.shifts[g], ...patch } } });
  const anyShift = GROUP_KEYS.some((g) => roster.shifts[g].life !== 0 || roster.shifts[g].basics !== 0);
  /** The noise floor: the standard error of a difference of two independent proportions near 50%, at this cell size. */
  const noise = 100 * Math.sqrt((2 * 0.25) / Math.max(1, roster.games));
  const shade = (p: number | null, tier: 1 | 2 | 3 | undefined, isDone: boolean) => {
    if (p === null) return "transparent";
    if (!isDone) return "rgba(176,138,62,0.08)";
    const band: [number, number] = tier ? roster.bands[tier] : [0, 100];
    if (p >= band[0] && p <= band[1]) return "rgba(120,170,90,0.35)";
    const d = p < band[0] ? band[0] - p : p - band[1];
    return `rgba(190,80,60,${Math.min(0.45, 0.08 + d / 60)})`;
  };
  const agg = (rk: string, group: "mages" | "beasts" | "any", tier: 1 | 2 | 3 | 0, phase: "base" | "shift" = "base"): { p: number; n: number } => {
    const xs = cols.filter((c) => (group === "any" || c.group === group) && (tier === 0 || c.tier === tier)).map((c) => rowPct(rk, c.key, phase)).filter((x): x is number => x !== null);
    return { p: mean(xs), n: xs.length };
  };
  const total = rows.length * cols.length * roster.games * (roster.differential ? 2 : 1);
  const doneGames = Object.values(cells).reduce((n, c) => n + c.games, 0);
  const pickedCell = picked ? cells[picked] : undefined;
  const pickedParts = picked ? picked.split("|") : [];
  const pickedNames = pickedParts.length === 3 ? pickedParts.slice(1).map((k) => byKey.get(k)?.name ?? k) : [];
  const pickedShift = pickedParts.length === 3 ? cells[rosterId(pickedParts[1]!, pickedParts[2]!, "shift")] : undefined;
  const groups: { label: string; group: "mages" | "beasts" | "any"; tier: 1 | 2 | 3 | 0 }[] = [
    ...(roster.mages ? TIERS.map((t) => ({ label: `T${t} mages`, group: "mages" as const, tier: t })) : []),
    ...(roster.beasts ? TIERS.map((t) => ({ label: `T${t} beasts`, group: "beasts" as const, tier: t })) : []),
    ...(roster.mages ? [{ label: "all mages", group: "mages" as const, tier: 0 as const }] : []),
    ...(roster.beasts ? [{ label: "all beasts", group: "beasts" as const, tier: 0 as const }] : []),
    ...(roster.mages && roster.beasts ? [{ label: "everyone", group: "any" as const, tier: 0 as const }] : []),
  ];
  // The bar: the baseline in brass, the shifted value as a dark marker, the band as an outlined box in a
  // higher-contrast green (Chris: delineate the bounds), the tick at 50.
  const Bar = ({ p, s, band }: { p: number; s?: number; band?: [number, number] }) => (
    <div style={{ position: "relative", height: 12, background: "rgba(43,37,32,0.10)", borderRadius: 2, width: 140 }} title={`${band ? `band ${band[0]}–${band[1]}; ` : ""}baseline ${p.toFixed(0)}%${s !== undefined ? `, shifted ${s.toFixed(0)}%` : ""}`}>
      {band && <div style={{ position: "absolute", left: `${band[0]}%`, width: `${band[1] - band[0]}%`, top: 0, bottom: 0, background: "rgba(84,160,74,0.28)", border: "1px solid rgba(60,130,50,0.9)", boxSizing: "border-box" }} />}
      <div style={{ position: "absolute", left: 0, top: 3, bottom: 3, width: `${Math.max(0, Math.min(100, p))}%`, background: "var(--brass)", opacity: 0.95 }} />
      {s !== undefined && <div style={{ position: "absolute", left: `calc(${Math.max(0, Math.min(100, s))}% - 1.5px)`, top: -2, bottom: -2, width: 3, background: "var(--ink)", borderRadius: 1 }} title={`shifted ${s.toFixed(0)}%`} />}
      <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "rgba(43,37,32,0.45)" }} />
    </div>
  );
  const Delta = ({ d, small }: { d: number | null; small?: boolean }) => d === null ? null : (
    <span style={{ fontSize: small ? 9.5 : 11, color: Math.abs(d) > noise ? (d < 0 ? "#8a3b2c" : "#2f6b8a") : "var(--ink-soft)", fontWeight: Math.abs(d) > noise ? 600 : 400 }} title={`shifted − baseline; the noise floor at ${roster.games} games is about ±${noise.toFixed(0)}`}>{d >= 0 ? "+" : "−"}{Math.abs(d).toFixed(0)}</span>
  );
  return (
    <>
      <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div className="panel" style={{ padding: 10, minWidth: 360 }}>
          <div style={{ fontFamily: "var(--serif)", fontSize: 15, marginBottom: 6 }}>Rows — the decks whose win rate is read</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px", fontSize: 12, maxHeight: 130, overflow: "auto" }}>
            {decks.filter((d) => d.group !== "custom" || true).filter((d) => ["starters", "roads", "custom", "slices"].includes(d.group)).map((d) => (
              <label key={d.key} style={{ whiteSpace: "nowrap" }}><input type="checkbox" checked={roster.rows.includes(d.key)} onChange={(e) => setRoster({ ...roster, rows: e.target.checked ? [...roster.rows, d.key] : roster.rows.filter((k) => k !== d.key) })} /> {d.name}</label>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 6, alignItems: "center", flexWrap: "wrap", fontSize: 12 }}>
            <label>life <input type="number" value={roster.rowLife ?? ""} placeholder="default" style={{ width: 60 }} onChange={(e) => setRoster({ ...roster, rowLife: e.target.value === "" ? null : Number(e.target.value) })} /></label>
            <label>basics <input type="number" value={roster.rowBasics ?? ""} placeholder="default" style={{ width: 60 }} onChange={(e) => setRoster({ ...roster, rowBasics: e.target.value === "" ? null : Number(e.target.value) })} /></label>
            <label>AI <select value={roster.rowProfile ?? ""} onChange={(e) => setRoster({ ...roster, rowProfile: (e.target.value || null) as Profile | null })}><option value="">default</option>{PROFILES.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
            <span className="seed">blank = each row's world default (a starter: 10 / journeyman / none)</span>
          </div>
        </div>
        <div className="panel" style={{ padding: 10, minWidth: 320 }}>
          <div style={{ fontFamily: "var(--serif)", fontSize: 15, marginBottom: 6 }}>Columns — the roster at its world defaults</div>
          <div style={{ fontSize: 12, display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
            <span>mode</span>
            {(["easy", "standard", "hard"] as LabMode[]).map((m) => <label key={m}><input type="radio" checked={labMode === m} onChange={() => setLabMode(m)} /> {m}</label>)}
            <span className="seed">the resolver's tier tables (knobs: mageTierLife / mageTierEntrance / beastTierLifeDelta) set every column's life and entrance</span>
          </div>
          <div style={{ fontSize: 12, display: "flex", gap: 12 }}>
            <label><input type="checkbox" checked={roster.mages} onChange={(e) => setRoster({ ...roster, mages: e.target.checked })} /> the fifteen mages ({[1, 2, 3].map((t) => { const d = decks.find((x) => x.group === "mages" && x.tier === t); return d ? `T${t} ${d.profile} ${d.life}/${d.basics}` : ""; }).join(" · ")})</label>
          </div>
          <div style={{ fontSize: 12, display: "flex", gap: 12 }}>
            <label><input type="checkbox" checked={roster.beasts} onChange={(e) => setRoster({ ...roster, beasts: e.target.checked })} /> the beasts (catalog life + the tier delta {[1, 2, 3].map((t) => `T${t} +${resolveKnobsDelta(labMode, t as 1 | 2 | 3)}`).join(" · ")}, their catalog profile)</label>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 8px", fontSize: 12, alignItems: "center", marginTop: 6 }}>
            <span>games / cell</span><input type="number" value={roster.games} min={2} max={1000} step={2} onChange={(e) => setRoster({ ...roster, games: Number(e.target.value) })} />
            <span>seed</span><input type="number" value={roster.seed} onChange={(e) => setRoster({ ...roster, seed: Number(e.target.value) })} />
            {TIERS.map((t) => (
              <span key={t} style={{ display: "contents" }}>
                <span>T{t} band</span>
                <span><input type="number" value={roster.bands[t][0]} style={{ width: 48 }} onChange={(e) => setRoster({ ...roster, bands: { ...roster.bands, [t]: [Number(e.target.value), roster.bands[t][1]] } })} /> – <input type="number" value={roster.bands[t][1]} style={{ width: 48 }} onChange={(e) => setRoster({ ...roster, bands: { ...roster.bands, [t]: [roster.bands[t][0], Number(e.target.value)] } })} /> % <span className="seed">the row's win rate against a tier-{t} opponent</span></span>
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
            {!running ? <button onClick={onRun}>Run {rows.length} × {cols.length} cells × {roster.games}{roster.differential ? " × 2 sweeps" : ""}</button> : <button onClick={onStop}>Stop</button>}
            {running && <span className="seed">{doneGames}/{total} games</span>}
          </div>
        </div>
        <div className="panel" style={{ padding: 10, minWidth: 300 }}>
          <div style={{ fontFamily: "var(--serif)", fontSize: 15, marginBottom: 6 }}>Shifts — the differential, per enemy group</div>
          <div style={{ fontSize: 12 }}><label><input type="checkbox" checked={roster.differential} onChange={(e) => setRoster({ ...roster, differential: e.target.checked })} /> run a second sweep with these shifts; every cell then carries baseline and Δ</label></div>
          <table style={{ fontSize: 12, borderCollapse: "collapse", marginTop: 4 }}>
            <thead><tr><th></th><th style={{ fontWeight: 500, padding: "2px 6px" }}>life</th><th style={{ fontWeight: 500, padding: "2px 6px" }}>basics in play</th></tr></thead>
            <tbody>
              {GROUP_KEYS.map((g) => (
                <tr key={g}>
                  <td style={{ padding: "2px 6px", fontWeight: 600 }}>{g.startsWith("M") ? "tier-" + g[1] + " mages" : "tier-" + g[1] + " beasts"}</td>
                  <td style={{ padding: "2px 6px" }}><input type="number" value={roster.shifts[g].life} step={1} style={{ width: 56 }} onChange={(e) => setShift(g, { life: Number(e.target.value) })} /></td>
                  <td style={{ padding: "2px 6px" }}><input type="number" value={roster.shifts[g].basics} step={1} min={0} style={{ width: 56 }} onChange={(e) => setShift(g, { basics: Number(e.target.value) })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 12, marginTop: 4, display: "flex", gap: 10, alignItems: "center" }}>
            <span>seeds for the shifted sweep</span>
            <label title="new seeds: unshifted cells show the Monte Carlo noise floor, so effect sizes can be read against it"><input type="radio" checked={roster.shiftSeeds === "fresh"} onChange={() => setRoster({ ...roster, shiftSeeds: "fresh" })} /> fresh</label>
            <label title="the same seeds: unshifted cells are exactly zero; shifted cells are a paired comparison (lower variance)"><input type="radio" checked={roster.shiftSeeds === "paired"} onChange={() => setRoster({ ...roster, shiftSeeds: "paired" })} /> paired</label>
            <button className="linkish" onClick={() => setRoster({ ...roster, shifts: { ...ZERO_SHIFTS } })}>zero all</button>
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 4 }}>Shifts add to each column's world default (a tier-3 mage at 12 with +4 life and +2 basics fights at 16 with two of its colours in play). The noise floor for a Δ at {roster.games} games per cell is about ±{noise.toFixed(0)} points; Δs beyond it are coloured.{!anyShift && roster.differential ? " No shift set: the second sweep measures the noise floor alone." : ""}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, marginTop: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div className="panel" style={{ padding: 10, overflowX: "auto", maxWidth: "100%" }}>
          <div style={{ fontFamily: "var(--serif)", fontSize: 15, marginBottom: 6 }}>The rows' win rate against the roster — shaded by the column's tier band</div>
          <table style={{ borderCollapse: "collapse", fontSize: 11.5 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "3px 6px" }}></th>
                {cols.map((c) => <th key={c.key} style={{ padding: "3px 4px", fontWeight: 500, maxWidth: 64, fontSize: 10.5, verticalAlign: "bottom", background: shifted(c) ? "rgba(47,107,138,0.10)" : "transparent" }} title={`${c.label}${shifted(c) ? ` — shifted: life ${roster.shifts[groupOf(c)!].life >= 0 ? "+" : ""}${roster.shifts[groupOf(c)!].life}, basics +${roster.shifts[groupOf(c)!].basics}` : ""}`}><div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", whiteSpace: "nowrap", maxHeight: 120, overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div><div style={{ fontSize: 9.5, color: "var(--ink-soft)" }}>{c.group === "mages" ? "M" : "B"}{c.tier}{shifted(c) ? " ▲" : ""}</div></th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td style={{ padding: "3px 6px", fontWeight: 600, whiteSpace: "nowrap" }}>{r.name}</td>
                  {cols.map((c) => {
                    const id = rosterId(r.key, c.key); const p = rowPct(r.key, c.key); const isDone = done(r.key, c.key); const cell = cells[id]; const d = roster.differential ? delta(r.key, c.key) : null;
                    return (
                      <td key={c.key} onClick={() => cell && setPicked(id)} title={cell ? `${r.name} vs ${c.name}: ${cell.games} games · baseline ${p?.toFixed(0)}%${d !== null ? `, shifted ${(p! + d).toFixed(0)}% (Δ ${d >= 0 ? "+" : ""}${d.toFixed(0)})` : ""} · click for detail` : "not run"} style={{ padding: "3px 4px", textAlign: "center", background: shade(p, c.tier, isDone), cursor: cell ? "pointer" : "default", outline: picked === id ? "2px solid var(--brass)" : "none", minWidth: 40, lineHeight: 1.1 }}>
                        {p === null ? <span style={{ color: "var(--ink-soft)" }}>—</span> : <><div style={{ fontWeight: 600 }}>{p.toFixed(0)}</div>{roster.differential && <div style={{ minHeight: 11 }}>{d === null ? <span style={{ color: "var(--ink-soft)", fontSize: 9.5 }}>{cells[rosterId(r.key, c.key, "shift")] ? "…" : ""}</span> : <Delta d={d} small />}</div>}</>}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr style={{ borderTop: "1.5px solid var(--ink)" }}>
                <td style={{ padding: "3px 6px", fontStyle: "italic" }}>rows' mean</td>
                {cols.map((c) => { const xs = rows.map((r) => rowPct(r.key, c.key)).filter((x): x is number => x !== null); const ds = rows.map((r) => delta(r.key, c.key)).filter((x): x is number => x !== null); return <td key={c.key} style={{ textAlign: "center", padding: "3px 4px", color: "var(--ink-soft)", lineHeight: 1.1 }}>{xs.length ? mean(xs).toFixed(0) : "—"}{roster.differential && ds.length === rows.length && ds.length > 0 ? <div><Delta d={mean(ds)} small /></div> : null}</td>; })}
              </tr>
            </tbody>
          </table>
          <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 6 }}>Numbers are the ROW's win rate (%): the baseline sweep on top{roster.differential ? ", the shifted sweep's Δ beneath (▲ marks a shifted column; Δs beyond the ±" + noise.toFixed(0) + " noise floor are coloured — blue when the row wins more, red when less)" : ""}. M/B = mage/beast, the digit its tier. ± on a single cell at {roster.games} games is about {(100 * ci95(0.5, roster.games)).toFixed(0)} points.</div>
        </div>

        <div className="panel" style={{ padding: 10 }}>
          <div style={{ fontFamily: "var(--serif)", fontSize: 15, marginBottom: 6 }}>Aggregate by tier — each row's mean win rate over the group (bar: baseline in brass, the shifted mean as the dark marker, the band outlined in green, the tick at 50)</div>
          <table style={{ borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr><th></th>{groups.map((g) => <th key={g.label} style={{ padding: "3px 8px", fontWeight: 500 }}>{g.label}</th>)}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td style={{ padding: "3px 8px", fontWeight: 600, whiteSpace: "nowrap" }}>{r.name}</td>
                  {groups.map((g) => {
                    const a = agg(r.key, g.group, g.tier); const band = g.tier ? roster.bands[g.tier] : undefined;
                    const sAgg = roster.differential ? agg(r.key, g.group, g.tier, "shift") : { p: 0, n: 0 };
                    const complete = sAgg.n === a.n && a.n > 0;
                    return <td key={g.label} style={{ padding: "3px 8px" }}>{a.n ? <><div style={{ fontWeight: 600 }}>{a.p.toFixed(0)}%{complete ? <> → {sAgg.p.toFixed(0)}% <Delta d={sAgg.p - a.p} /></> : null} <span className="seed">n={a.n}</span></div><Bar p={a.p} {...(complete ? { s: sAgg.p } : {})} {...(band ? { band } : {})} /></> : <span style={{ color: "var(--ink-soft)" }}>—</span>}</td>;
                  })}
                </tr>
              ))}
              <tr style={{ borderTop: "1.5px solid var(--ink)" }}>
                <td style={{ padding: "3px 8px", fontStyle: "italic" }}>all rows</td>
                {groups.map((g) => { const xs = rows.map((r) => agg(r.key, g.group, g.tier)).filter((a) => a.n > 0).map((a) => a.p); const ss = roster.differential ? rows.map((r) => agg(r.key, g.group, g.tier, "shift")).filter((a) => a.n > 0).map((a) => a.p) : []; return <td key={g.label} style={{ padding: "3px 8px", color: "var(--ink-soft)" }}>{xs.length ? `${mean(xs).toFixed(0)}%` : "—"}{ss.length === xs.length && ss.length > 0 ? <> → {mean(ss).toFixed(0)}% <Delta d={mean(ss) - mean(xs)} /></> : null}</td>; })}
              </tr>
            </tbody>
          </table>
        </div>

        {pickedCell && (
          <div className="panel" style={{ padding: 10, minWidth: 280 }}>
            <div style={{ fontFamily: "var(--serif)", fontSize: 15, marginBottom: 6 }}>{pickedNames[0]} vs {pickedNames[1]} <span className="seed">baseline</span></div>
            <table style={{ fontSize: 12, borderCollapse: "collapse" }}>
              <tbody>
                <tr><td style={{ padding: "2px 8px 2px 0" }}>games</td><td>{pickedCell.games}{pickedCell.draws ? ` (${pickedCell.draws} draws)` : ""}</td></tr>
                {pickedShift && <tr><td style={{ padding: "2px 8px 2px 0" }}>shifted sweep</td><td>{pct(pickedShift.aWins, pickedShift.games).toFixed(0)}% for {pickedNames[0]} over {pickedShift.games} games ({pickedShift.bEntrance.length ? `${pickedNames[1]} with ${pickedShift.bEntrance.length} in play` : "no basics"}; Δ <Delta d={pct(pickedShift.aWins, pickedShift.games) - pct(pickedCell.aWins, pickedCell.games)} />)</td></tr>}
                <tr><td style={{ padding: "2px 8px 2px 0" }}>{pickedNames[0]} wins</td><td>{pct(pickedCell.aWins, pickedCell.games).toFixed(0)}% ±{(100 * ci95(pct(pickedCell.aWins, pickedCell.games) / 100, pickedCell.games)).toFixed(0)} — on the play {pct(pickedCell.aWinsBySeat[0], pickedCell.gamesBySeat[0]).toFixed(0)}%, on the draw {pct(pickedCell.aWinsBySeat[1], pickedCell.gamesBySeat[1]).toFixed(0)}%{pickedCell.aDecked ? ` · ${pickedCell.aDecked} by library` : ""}</td></tr>
                <tr><td style={{ padding: "2px 8px 2px 0" }}>{pickedNames[1]} wins</td><td>{pct(pickedCell.bWins, pickedCell.games).toFixed(0)}%{pickedCell.bDecked ? ` · ${pickedCell.bDecked} by library` : ""}</td></tr>
                <tr><td style={{ padding: "2px 8px 2px 0" }}>winner's life left</td><td>{mean(pickedCell.aMargin).toFixed(1)} · {mean(pickedCell.bMargin).toFixed(1)}</td></tr>
                <tr><td style={{ padding: "2px 8px 2px 0" }}>turns</td><td>mean {mean(pickedCell.turns).toFixed(1)}</td></tr>
              </tbody>
            </table>
            <Histogram values={pickedCell.turns} />
          </div>
        )}
      </div>
    </>
  );
}

/** A one-line description of a resolved side, for the detail panel and the saved run. */
function describe(s: ResolvedSide, pool: Map<string, CardDef>): string {
  const name = (id: string) => pool.get(id)?.name ?? id;
  const bits = [`${s.name} ${s.life} life ${s.profile}`];
  if (s.entrance.length) bits.push(`entrance ${s.entrance.map(name).join(", ")}`);
  for (const b of s.bonuses) bits.push(b.type === "permanent" ? `${name(b.cardId)} in play${b.both ? " (both)" : ""}` : b.type === "cardInHand" ? `${name(b.cardId)} to hand${b.both ? " (both)" : ""}` : b.type === "extraCards" ? `+${b.count} card${b.count === 1 ? "" : "s"}${b.both ? " (both)" : ""}` : "the law ring");
  return bits.join(" · ");
}




function Histogram({ values }: { values: number[] }) {
  if (values.length === 0) return null;
  const lo = Math.min(...values), hi = Math.max(...values);
  const bins = Math.min(16, Math.max(4, hi - lo + 1));
  const width = (hi - lo + 1) / bins;
  const counts = Array.from({ length: bins }, () => 0);
  for (const v of values) counts[Math.min(bins - 1, Math.floor((v - lo) / width))]! += 1;
  const max = Math.max(...counts);
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>turns to a result</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 48 }}>
        {counts.map((c, i) => <div key={i} title={`${Math.round(lo + i * width)}–${Math.round(lo + (i + 1) * width - 1)} turns: ${c}`} style={{ flex: 1, background: "var(--brass)", height: `${(100 * c) / max}%`, minHeight: c ? 2 : 0, opacity: 0.8 }} />)}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--ink-soft)" }}><span>{lo}</span><span>{hi}</span></div>
    </div>
  );
}
