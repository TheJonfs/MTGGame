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
import { customAsLabDeck, deckStats, entranceBasics, labDecks, manaValue, resolveSide, type Archetype, type CustomDeck, type Decklist, type LabDeck, type Profile } from "./lab-decks";
import type { LabBonus, LabCell, LabJob, LabSide, ResolvedSide, WorkerOut } from "./lab-types";

const PROFILES: Profile[] = ["apprentice", "journeyman", "master"];
const ARCHETYPES: Archetype[] = ["aggro", "midrange", "control"];
const GROUPS = ["mages", "beasts", "starters", "roads", "bosses", "custom", "slices"] as const;
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
interface SavedRun { name: string; when: string; setup: RunSetup; cells: Record<string, LabCell>; notes?: string; resolved?: { a: ResolvedSide; b: ResolvedSide } }

const pct = (n: number, d: number) => (d > 0 ? (100 * n) / d : 0);
const ci95 = (p: number, n: number) => (n > 0 ? 1.96 * Math.sqrt((p * (1 - p)) / n) : 0);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const cellId = (life: number, basics: number) => `${life}/${basics}`;
const sideFromDeck = (d: LabDeck): LabSide => ({ deck: d.key, life: d.life, basics: d.basics, profile: d.profile, bonuses: (d.bonuses ?? []).map((b) => ({ ...b })) });

export function LabApp() {
  const pool = useMemo(() => loadPool(), []);
  const baseDecks = useMemo(() => labDecks(), []);
  const [customs, setCustoms] = useState<CustomDeck[]>([]);
  const decks = useMemo(() => [...baseDecks, ...customs.map(customAsLabDeck)], [baseDecks, customs]);
  const byKey = useMemo(() => new Map(decks.map((d) => [d.key, d])), [decks]);
  const threads = Math.max(1, Math.min(6, (navigator.hardwareConcurrency || 4) - 1));
  const workers = useRef<Worker[]>([]);
  const spawn = () => Array.from({ length: threads }, () => new Worker(new URL("./lab-worker.ts", import.meta.url), { type: "module" }));
  useEffect(() => { workers.current = spawn(); return () => { for (const w of workers.current) w.terminate(); }; }, [threads]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const queue = useRef<LabJob[]>([]);
  const busy = useRef<Set<Worker>>(new Set());

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
    queue.current = lives.flatMap((life) => basics.map((nb) => ({ id: cellId(life, nb), seed: s.seed, games: s.games, a: resolveSide({ ...s.a, life, basics: nb }, byKey, pool), b: rb })));
    setRunning(true);
    for (const w of workers.current) {
      w.onmessage = (ev: MessageEvent<WorkerOut>) => {
        const m = ev.data;
        if (m.type === "error") { setErrors((e) => [...e.slice(-19), m.message]); return; }
        setCells((c) => ({ ...c, [m.cell.id]: m.cell }));
        if (m.type === "done") {
          busy.current.delete(w);
          const next = queue.current.shift();
          if (next) { busy.current.add(w); w.postMessage({ type: "run", job: next }); }
          else if (busy.current.size === 0) setRunning(false);
        }
      };
    }
    for (const w of workers.current) {
      const next = queue.current.shift();
      if (!next) break;
      busy.current.add(w); w.postMessage({ type: "run", job: next });
    }
    if (busy.current.size === 0) setRunning(false);
  };
  const stop = () => { queue.current = []; for (const w of workers.current) w.terminate(); busy.current.clear(); setRunning(false); workers.current = spawn(); };

  const save = async () => {
    const name = runName.trim() || `${setup.a.deck.replace(/[:]/g, "-")}_vs_${setup.b.deck.replace(/[:]/g, "-")}_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}`;
    const run: SavedRun = { name, when: new Date().toISOString(), setup, cells, notes, ...(resolved ? { resolved } : {}) };
    const r = await fetch("/__lab-save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(run) });
    if (r.ok) { setRunName(""); void refresh(); }
  };
  const download = () => {
    const run: SavedRun = { name: runName || "lab-run", when: new Date().toISOString(), setup, cells, notes, ...(resolved ? { resolved } : {}) };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(run, null, 2)], { type: "application/json" }));
    a.download = `${run.name}.json`; a.click();
  };
  const load = (run: SavedRun) => {
    const fix = (s: LabSide): LabSide => ({ ...s, bonuses: s.bonuses ?? [] });
    setSetup({ ...run.setup, a: fix(run.setup.a), b: fix(run.setup.b) }); setLivesText(run.setup.lives.join(", ")); setBasicsText(run.setup.basics.join(", ")); setCells(run.cells); setNotes(run.notes ?? ""); setPicked(null); setResolved(run.resolved ?? null);
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
        <span className="seed" style={{ marginLeft: "auto" }}>{threads} worker{threads === 1 ? "" : "s"} · the engine and the heuristic agents, live · dev surface</span>
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
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

      <div style={{ display: "flex", gap: 16, marginTop: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
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

/** A one-line description of a resolved side, for the detail panel and the saved run. */
function describe(s: ResolvedSide, pool: Map<string, CardDef>): string {
  const name = (id: string) => pool.get(id)?.name ?? id;
  const bits = [`${s.name} ${s.life} life ${s.profile}`];
  if (s.entrance.length) bits.push(`entrance ${s.entrance.map(name).join(", ")}`);
  for (const b of s.bonuses) bits.push(b.type === "permanent" ? `${name(b.cardId)} in play${b.both ? " (both)" : ""}` : b.type === "cardInHand" ? `${name(b.cardId)} to hand${b.both ? " (both)" : ""}` : b.type === "extraCards" ? `+${b.count} card${b.count === 1 ? "" : "s"}${b.both ? " (both)" : ""}` : "the law ring");
  return bits.join(" · ");
}

function SidePanel({ label, side, decks, byKey, pool, onPick, onPatch, onEdit }: { label: "a" | "b"; side: LabSide; decks: LabDeck[]; byKey: Map<string, LabDeck>; pool: Map<string, CardDef>; onPick: (key: string) => void; onPatch: (p: Partial<LabSide>) => void; onEdit: () => void }) {
  const d = byKey.get(side.deck);
  const entrance = d ? entranceBasics(d, side.basics, pool) : [];
  const stats = d ? deckStats(d.decklist, pool) : null;
  return (
    <div className="panel" style={{ padding: 10, minWidth: 340, maxWidth: 420 }}>
      <div style={{ fontFamily: "var(--serif)", fontSize: 15, marginBottom: 6, display: "flex", gap: 8, alignItems: "baseline" }}>
        <span>{label === "a" ? "Side A — the grid varies this side" : "Side B — the reference, fixed"}</span>
        <button className="linkish" style={{ marginLeft: "auto", fontSize: 11 }} onClick={onEdit} title="open a copy of this deck in the editor">edit a copy</button>
      </div>
      <select value={side.deck} onChange={(e) => onPick(e.target.value)} style={{ width: "100%" }}>
        {GROUPS.map((g) => {
          const inGroup = decks.filter((x) => x.group === g);
          return inGroup.length ? <optgroup key={g} label={g}>{inGroup.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</optgroup> : null;
        })}
      </select>
      <div style={{ display: "flex", gap: 10, marginTop: 6, alignItems: "center", flexWrap: "wrap", fontSize: 12 }}>
        <label>life <input type="number" value={side.life} min={1} max={99} style={{ width: 52 }} onChange={(e) => onPatch({ life: Number(e.target.value) })} /></label>
        <label>entrance basics <input type="number" value={side.basics} min={0} max={5} style={{ width: 44 }} onChange={(e) => onPatch({ basics: Number(e.target.value) })} /></label>
        <label>AI <select value={side.profile} onChange={(e) => onPatch({ profile: e.target.value as Profile })}>{PROFILES.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
      </div>
      <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 4 }}>
        {d && stats ? `${stats.cards} cards (${stats.lands} lands, avg MV ${stats.avgMv.toFixed(2)}) · ${d.archetype} · world default ${d.life} life / ${d.profile} / ${d.basics} in play${d.bonuses?.length ? ` / ${d.bonuses.length} bonus${d.bonuses.length === 1 ? "" : "es"}` : ""}` : ""}
        {entrance.length ? ` · entrance: ${entrance.map((id) => pool.get(id)?.name ?? id).join(", ")}` : ""}
      </div>
      <BonusEditor bonuses={side.bonuses} pool={pool} onChange={(bonuses) => onPatch({ bonuses })} onReset={() => onPatch({ bonuses: (d?.bonuses ?? []).map((b) => ({ ...b })) })} />
    </div>
  );
}

/** The starting-bonus editor: rows over the modifier vocabulary; `both` for symmetric laws. */
function BonusEditor({ bonuses, pool, onChange, onReset }: { bonuses: LabBonus[]; pool: Map<string, CardDef>; onChange: (b: LabBonus[]) => void; onReset: () => void }) {
  const [pick, setPick] = useState("");
  const [kind, setKind] = useState<LabBonus["type"]>("permanent");
  const listId = useMemo(() => `lab-cards-${Math.random().toString(36).slice(2, 8)}`, []);
  const cards = useMemo(() => [...pool.values()].sort((a, b) => a.name.localeCompare(b.name)), [pool]);
  const byName = (s: string): string | null => { const t = s.trim().toLowerCase(); if (!t) return null; if (pool.has(t)) return t; const hit = cards.find((c) => c.name.toLowerCase() === t) ?? cards.find((c) => c.name.toLowerCase().startsWith(t)); return hit?.id ?? null; };
  const set = (i: number, patch: Partial<LabBonus>) => onChange(bonuses.map((b, j) => (j === i ? ({ ...b, ...patch } as LabBonus) : b)));
  const add = () => {
    if (kind === "lawSequence") { onChange([...bonuses, { type: "lawSequence" }]); return; }
    if (kind === "extraCards") { onChange([...bonuses, { type: "extraCards", count: 1 }]); return; }
    const id = byName(pick); if (!id) return;
    onChange([...bonuses, { type: kind, cardId: id }]); setPick("");
  };
  const name = (id: string) => pool.get(id)?.name ?? id;
  return (
    <div style={{ marginTop: 8, fontSize: 12 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
        <span style={{ fontFamily: "var(--serif)" }}>Starting bonuses</span>
        <span className="seed">the world's modifiers: in play, to hand, bonus cards, the law ring</span>
        <button className="linkish" style={{ marginLeft: "auto", fontSize: 11 }} onClick={onReset}>reset to the deck's</button>
      </div>
      {bonuses.map((b, i) => (
        <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", padding: "2px 0" }}>
          <span style={{ flex: 1 }}>
            {b.type === "permanent" ? <>{name(b.cardId)} <span className="seed">in play</span></> : b.type === "cardInHand" ? <>{name(b.cardId)} <span className="seed">to hand after the mulligans</span></> : b.type === "extraCards" ? <>+<input type="number" value={b.count} min={1} max={7} style={{ width: 36 }} onChange={(e) => set(i, { count: Number(e.target.value) } as Partial<LabBonus>)} /> bonus card{b.count === 1 ? "" : "s"}</> : <>the law ring <span className="seed">(the Heart's sequence)</span></>}
          </span>
          <label title="apply to both seats (a symmetric law)"><input type="checkbox" checked={!!b.both} onChange={(e) => set(i, { both: e.target.checked || undefined } as Partial<LabBonus>)} /> both</label>
          <button className="linkish" onClick={() => onChange(bonuses.filter((_, j) => j !== i))}>remove</button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
        <select value={kind} onChange={(e) => setKind(e.target.value as LabBonus["type"])}>
          <option value="permanent">in play</option><option value="cardInHand">to hand</option><option value="extraCards">bonus cards</option><option value="lawSequence">the law ring</option>
        </select>
        {(kind === "permanent" || kind === "cardInHand") && <><input list={listId} value={pick} onChange={(e) => setPick(e.target.value)} placeholder="card name or id (tokens, laws, basics…)" style={{ flex: 1 }} onKeyDown={(e) => { if (e.key === "Enter") add(); }} /><datalist id={listId}>{cards.map((c) => <option key={c.id} value={c.name} />)}</datalist></>}
        <button onClick={add}>add</button>
      </div>
    </div>
  );
}

/** The deck editor: a copy of any deck, counts up and down, cards added from the pool, saved as a custom deck. */
function DeckEditor({ deck, pool, onChange, onSave, onUse, onClose }: { deck: CustomDeck; pool: Map<string, CardDef>; onChange: (d: CustomDeck) => void; onSave: () => void; onUse: (side: "a" | "b") => void; onClose: () => void }) {
  const [pick, setPick] = useState("");
  const cards = useMemo(() => [...pool.values()].filter((c) => !c.isTokenDef).sort((a, b) => a.name.localeCompare(b.name)), [pool]);
  const stats = deckStats(deck.decklist, pool);
  const rows = [...deck.decklist].sort((x, y) => {
    const a = pool.get(x.cardId), b = pool.get(y.cardId);
    const la = a?.types.includes("Land") ? 0 : 1, lb = b?.types.includes("Land") ? 0 : 1;
    if (la !== lb) return la - lb;
    const ma = manaValue(a?.manaCost ?? ""), mb = manaValue(b?.manaCost ?? "");
    return ma !== mb ? ma - mb : (a?.name ?? x.cardId).localeCompare(b?.name ?? y.cardId);
  });
  const setCount = (cardId: string, count: number) => onChange({ ...deck, decklist: count <= 0 ? deck.decklist.filter((e) => e.cardId !== cardId) : deck.decklist.some((e) => e.cardId === cardId) ? deck.decklist.map((e) => (e.cardId === cardId ? { ...e, count } : e)) : [...deck.decklist, { cardId, count }] });
  const add = () => {
    const t = pick.trim().toLowerCase(); if (!t) return;
    const hit = pool.has(t) ? pool.get(t)! : cards.find((c) => c.name.toLowerCase() === t) ?? cards.find((c) => c.name.toLowerCase().startsWith(t));
    if (!hit) return;
    setCount(hit.id, (deck.decklist.find((e) => e.cardId === hit.id)?.count ?? 0) + 1); setPick("");
  };
  return (
    <div className="panel" style={{ padding: 10, minWidth: 380, maxWidth: 520 }}>
      <div style={{ fontFamily: "var(--serif)", fontSize: 15, marginBottom: 6, display: "flex", gap: 8, alignItems: "baseline" }}>
        <span>Deck editor</span>
        <span className="seed">{stats.cards} cards · {stats.lands} lands · avg MV {stats.avgMv.toFixed(2)}{stats.unknown.length ? ` · unknown: ${stats.unknown.join(", ")}` : ""}{stats.cards < 30 ? " · under 30 cards" : ""}</span>
        <button className="linkish" style={{ marginLeft: "auto", fontSize: 11 }} onClick={onClose}>close</button>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", fontSize: 12 }}>
        <input value={deck.name} onChange={(e) => onChange({ ...deck, name: e.target.value })} placeholder="deck name" style={{ width: 180 }} />
        <select value={deck.archetype} onChange={(e) => onChange({ ...deck, archetype: e.target.value as Archetype })}>{ARCHETYPES.map((a) => <option key={a} value={a}>{a}</option>)}</select>
        {deck.basedOn && <span className="seed">from {deck.basedOn}</span>}
      </div>
      <div style={{ maxHeight: 260, overflow: "auto", marginTop: 6, fontSize: 12 }}>
        {rows.map((e) => {
          const c = pool.get(e.cardId);
          return (
            <div key={e.cardId} style={{ display: "flex", gap: 6, alignItems: "center", padding: "1px 0", borderTop: "1px solid rgba(43,37,32,0.08)" }}>
              <span style={{ width: 26, textAlign: "right", fontWeight: 600 }}>{e.count}</span>
              <span style={{ flex: 1 }}>{c?.name ?? e.cardId} <span className="seed">{c?.manaCost ?? ""}</span></span>
              <button className="linkish" onClick={() => setCount(e.cardId, e.count - 1)}>−</button>
              <button className="linkish" onClick={() => setCount(e.cardId, e.count + 1)}>+</button>
              <button className="linkish" onClick={() => setCount(e.cardId, 0)}>×</button>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}>
        <input list="lab-deck-cards" value={pick} onChange={(e) => setPick(e.target.value)} placeholder="add a card (name or id)" style={{ flex: 1 }} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
        <datalist id="lab-deck-cards">{cards.map((c) => <option key={c.id} value={c.name} />)}</datalist>
        <button onClick={add}>add</button>
      </div>
      <textarea value={deck.notes ?? ""} onChange={(e) => onChange({ ...deck, notes: e.target.value })} placeholder="what this variation tries" style={{ width: "100%", minHeight: 36, marginTop: 6, fontSize: 12, boxSizing: "border-box" }} />
      <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
        <button onClick={onSave}>Save to analysis/decks/</button>
        <button className="linkish" onClick={() => onUse("a")}>use on side A</button>
        <button className="linkish" onClick={() => onUse("b")}>use on side B</button>
        <span className="seed">saved decks appear in both pickers under "custom"</span>
      </div>
    </div>
  );
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
