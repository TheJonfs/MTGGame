/**
 * The Matchup Lab (S33 director round — Chris): explore any pairing under chosen conditions —
 * life, entrance basics, AI profile — as a live grid of simulated games in web workers, with the
 * band of interest shaded. Dev-only surface; runs save to the gitignored analysis/runs/ folder
 * through the dev server and load back for comparison. The Lab re-implements no rules: every number
 * is a MatchResult from the real engine and the real heuristic agents (the sweep's call).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { loadPool } from "../engine-bridge";
import { entranceBasics, labDecks, type LabDeck, type Profile } from "./lab-decks";
import type { LabCell, LabJob, LabSide, WorkerOut } from "./lab-types";

const PROFILES: Profile[] = ["apprentice", "journeyman", "master"];
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
interface SavedRun { name: string; when: string; setup: RunSetup; cells: Record<string, LabCell>; notes?: string }

const pct = (n: number, d: number) => (d > 0 ? (100 * n) / d : 0);
const ci95 = (p: number, n: number) => (n > 0 ? 1.96 * Math.sqrt((p * (1 - p)) / n) : 0);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const cellId = (life: number, basics: number) => `${life}/${basics}`;

function useWorkerPool(n: number) {
  const workers = useRef<Worker[]>([]);
  useEffect(() => {
    workers.current = Array.from({ length: n }, () => new Worker(new URL("./lab-worker.ts", import.meta.url), { type: "module" }));
    return () => { for (const w of workers.current) w.terminate(); };
  }, [n]);
  return workers;
}

export function LabApp() {
  const pool = useMemo(() => loadPool(), []);
  const decks = useMemo(() => labDecks(), []);
  const byKey = useMemo(() => new Map(decks.map((d) => [d.key, d])), [decks]);
  const threads = Math.max(1, Math.min(6, (navigator.hardwareConcurrency || 4) - 1));
  const workers = useWorkerPool(threads);

  const [setup, setSetup] = useState<RunSetup>(() => ({
    a: { deck: "mage:corvane", life: 12, basics: 0, profile: "master" },
    b: { deck: "road:roadMidW", life: 12, basics: 1, profile: "journeyman" },
    lives: [12, 16, 20], basics: [0, 1, 2], games: 50, seed: 1,
  }));
  const [livesText, setLivesText] = useState("12, 16, 20");
  const [basicsText, setBasicsText] = useState("0, 1, 2");
  const [band, setBand] = useState<[number, number]>([55, 65]);
  const [show, setShow] = useState<"b" | "a">("b");
  const [cells, setCells] = useState<Record<string, LabCell>>({});
  const [running, setRunning] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedRun[]>([]);
  const [compare, setCompare] = useState<SavedRun | null>(null);
  const [runName, setRunName] = useState("");
  const [notes, setNotes] = useState("");
  const queue = useRef<LabJob[]>([]);
  const busy = useRef<Set<Worker>>(new Set());

  const pickDeck = (side: "a" | "b", key: string) => {
    const d = byKey.get(key);
    if (!d) return;
    setSetup((s) => ({ ...s, [side]: { deck: key, life: d.life, basics: d.basics, profile: d.profile } }));
    if (side === "a") { setLivesText(String(d.life)); setBasicsText(String(d.basics)); }
  };

  const refreshSaved = async () => {
    try { const r = await fetch("/__lab-list"); if (r.ok) setSaved((await r.json()) as SavedRun[]); } catch { /* no dev server */ }
  };
  useEffect(() => { void refreshSaved(); }, []);

  const start = () => {
    const lives = parseList(livesText).length ? parseList(livesText) : [setup.a.life];
    const basics = parseList(basicsText).length ? parseList(basicsText) : [setup.a.basics];
    const s = { ...setup, lives, basics };
    setSetup(s);
    setCells({}); setErrors([]); setPicked(null);
    queue.current = lives.flatMap((life) => basics.map((nb) => ({ id: cellId(life, nb), seed: s.seed, games: s.games, a: { ...s.a, life, basics: nb }, b: { ...s.b } })));
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
  const stop = () => { queue.current = []; for (const w of workers.current) { w.terminate(); } busy.current.clear(); setRunning(false); workers.current = Array.from({ length: threads }, () => new Worker(new URL("./lab-worker.ts", import.meta.url), { type: "module" })); };

  const save = async () => {
    const name = runName.trim() || `${setup.a.deck.replace(":", "-")}_vs_${setup.b.deck.replace(":", "-")}_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}`;
    const run: SavedRun = { name, when: new Date().toISOString(), setup, cells, notes };
    const r = await fetch("/__lab-save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(run) });
    if (r.ok) { setRunName(""); void refreshSaved(); }
  };
  const download = () => {
    const run: SavedRun = { name: runName || "lab-run", when: new Date().toISOString(), setup, cells, notes };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(run, null, 2)], { type: "application/json" }));
    a.download = `${run.name}.json`; a.click();
  };
  const load = (run: SavedRun) => {
    setSetup(run.setup); setLivesText(run.setup.lives.join(", ")); setBasicsText(run.setup.basics.join(", ")); setCells(run.cells); setNotes(run.notes ?? ""); setPicked(null);
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

  const sidePanel = (label: "a" | "b", s: LabSide) => {
    const d = byKey.get(s.deck);
    const entrance = d ? entranceBasics(d, s.basics, pool) : [];
    return (
      <div className="panel" style={{ padding: 10, minWidth: 300 }}>
        <div style={{ fontFamily: "var(--serif)", fontSize: 15, marginBottom: 6 }}>{label === "a" ? "Side A — the grid varies this side" : "Side B — the reference, fixed"}</div>
        <select value={s.deck} onChange={(e) => pickDeck(label, e.target.value)} style={{ width: "100%" }}>
          {(["mages", "beasts", "starters", "roads", "slices"] as const).map((g) => (
            <optgroup key={g} label={g}>
              {decks.filter((x) => x.group === g).map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
            </optgroup>
          ))}
        </select>
        <div style={{ display: "flex", gap: 10, marginTop: 6, alignItems: "center", flexWrap: "wrap", fontSize: 12 }}>
          <label>life <input type="number" value={s.life} min={1} max={60} style={{ width: 52 }} onChange={(e) => setSetup((st) => ({ ...st, [label]: { ...st[label], life: Number(e.target.value) } }))} /></label>
          <label>basics in play <input type="number" value={s.basics} min={0} max={5} style={{ width: 44 }} onChange={(e) => setSetup((st) => ({ ...st, [label]: { ...st[label], basics: Number(e.target.value) } }))} /></label>
          <label>AI <select value={s.profile} onChange={(e) => setSetup((st) => ({ ...st, [label]: { ...st[label], profile: e.target.value as Profile } }))}>{PROFILES.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 4 }}>
          {d ? `${d.decklist.reduce((n, e) => n + e.count, 0)} cards · ${d.archetype} · world default ${d.life} life / ${d.profile} / ${d.basics} in play` : ""}
          {entrance.length ? ` · entrance: ${entrance.join(", ")}` : ""}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: 16, overflow: "auto", height: "100%", boxSizing: "border-box", background: "var(--parchment) url(\"/panel-parchment.png\")", backgroundSize: "512px", color: "var(--ink)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
        <h2 style={{ fontFamily: "var(--serif)", margin: 0 }}>Matchup Lab</h2>
        <a href="/" className="linkish">← menu</a>
        <span className="seed" style={{ marginLeft: "auto" }}>{threads} worker{threads === 1 ? "" : "s"} · the engine and the heuristic agents, live · dev surface</span>
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}>
        {sidePanel("a", setup.a)}
        {sidePanel("b", setup.b)}
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
            {!running ? <button onClick={start}>Run {lives.length * basicsList.length || 1} cell{lives.length * basicsList.length === 1 ? "" : "s"} × {setup.games}</button> : <button onClick={stop}>Stop</button>}
            <button className="linkish" onClick={() => setSetup((s) => ({ ...s, a: s.b, b: s.a }))} disabled={running}>swap sides</button>
            {running && <span className="seed">{doneGames}/{total} games</span>}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, marginTop: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div className="panel" style={{ padding: 10 }}>
          <div style={{ fontFamily: "var(--serif)", fontSize: 15, marginBottom: 6 }}>
            {show === "b" ? `${B?.name ?? "B"}'s` : `${A?.name ?? "A"}'s`} win rate — {A?.name} at life × basics vs {B?.name} at {setup.b.life} / {setup.b.basics} in play / {setup.b.profile}
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
            <div style={{ fontFamily: "var(--serif)", fontSize: 15, marginBottom: 6 }}>Cell {pickedCell.id} — {A?.name} at {pickedCell.id.split("/")[0]} life, {pickedCell.aEntrance.length ? pickedCell.aEntrance.join(" + ") : "no basics"} in play</div>
            <table style={{ fontSize: 12, borderCollapse: "collapse" }}>
              <tbody>
                <tr><td style={{ padding: "2px 8px 2px 0" }}>games</td><td>{pickedCell.games}{pickedCell.draws ? ` (${pickedCell.draws} draws)` : ""}{pickedCell.errors ? ` · ${pickedCell.errors} errors` : ""}</td></tr>
                <tr><td style={{ padding: "2px 8px 2px 0" }}>{A?.name} wins</td><td>{pct(pickedCell.aWins, pickedCell.games).toFixed(0)}% — on the play {pct(pickedCell.aWinsBySeat[0], pickedCell.gamesBySeat[0]).toFixed(0)}%, on the draw {pct(pickedCell.aWinsBySeat[1], pickedCell.gamesBySeat[1]).toFixed(0)}%{pickedCell.aDecked ? ` · ${pickedCell.aDecked} by library` : ""}</td></tr>
                <tr><td style={{ padding: "2px 8px 2px 0" }}>{B?.name} wins</td><td>{pct(pickedCell.bWins, pickedCell.games).toFixed(0)}%{pickedCell.bDecked ? ` · ${pickedCell.bDecked} by library` : ""}</td></tr>
                <tr><td style={{ padding: "2px 8px 2px 0" }}>winner's life left</td><td>{A?.name}: {mean(pickedCell.aMargin).toFixed(1)} · {B?.name}: {mean(pickedCell.bMargin).toFixed(1)} (the margin — how close the losses were)</td></tr>
                <tr><td style={{ padding: "2px 8px 2px 0" }}>turns</td><td>mean {mean(pickedCell.turns).toFixed(1)} · min {Math.min(...pickedCell.turns)} · max {Math.max(...pickedCell.turns)}</td></tr>
              </tbody>
            </table>
            <Histogram values={pickedCell.turns} />
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 16, marginTop: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div className="panel" style={{ padding: 10, minWidth: 320 }}>
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
