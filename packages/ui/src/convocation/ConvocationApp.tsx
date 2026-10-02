import { useEffect, useMemo, useState } from "react";
import type { CardDef } from "@shandalar/cards";
import { BRACKET_ROUND_NAMES, type DifficultyName, type Standing } from "@shandalar/world";
import { loadConvocationData, loadOracle, loadPool, loadWorldCatalog, type OracleEntry } from "../engine-bridge";
import { DeckEditor } from "../components/DeckEditor";
import { CardFrame } from "../components/CardFrame";
import { PlayMatch } from "../play/PlayMatch";
import { ConvocationController } from "./convocation-controller";

/**
 * S48 (Part 4): the Convocation's shell — one Sealed event of eight, four screens over the controller: the pool and
 * the build (the deck editor over the sealed pool), the pairings and standings, the series over the match, the
 * prize. The text is the S48 brief's Part 5 (the planner's; Chris's pen).
 */
const ORDINAL = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth", "thirteenth", "fourteenth", "fifteenth", "sixteenth"];
const COUNT: Record<number, string> = { 8: "eight", 15: "fifteen", 16: "sixteen" };
const PIP: Record<string, string> = { W: "white", U: "blue", B: "black", R: "red", G: "green" };

function Face({ slug, size = 56 }: { slug?: string | undefined; size?: number }) {
  return slug ? <img src={`/portraits/${slug}.png`} alt="" style={{ width: size, height: size, objectFit: "cover", borderRadius: 6, border: "1.5px solid var(--ink)" }} /> : <div style={{ width: size, height: size, borderRadius: 6, border: "1.5px solid var(--ink)", display: "grid", placeItems: "center", fontFamily: "var(--serif)" }}>you</div>;
}
function Pips({ colors }: { colors: string }) {
  return <span style={{ display: "inline-flex", gap: 2, verticalAlign: -2 }}>{[...colors].map((c) => <img key={c} src={`/icons/mana-${PIP[c] ?? "colorless"}.svg`} alt={c} style={{ width: 13, height: 13 }} />)}</span>;
}

function Table({ c, rows, swiss = false }: { c: ConvocationController; rows: Standing[]; /** S50: the finish's table is ordered by final place; its record columns are the Swiss rounds'. */ swiss?: boolean }) {
  const e = c.event!;
  return (
    <table className="convocation-table" style={{ borderCollapse: "collapse", width: "100%", fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
      <thead><tr style={{ textAlign: "left", borderBottom: "1.5px solid var(--ink)" }}><th style={{ padding: "4px 6px" }}></th><th>Seat</th><th>Deck</th><th style={{ textAlign: "right" }}>{swiss ? "Swiss record" : "Record"}</th><th style={{ textAlign: "right" }}>{swiss ? "Swiss points" : "Points"}</th><th style={{ textAlign: "right" }} title="opponents' match-win share — the tiebreak">Opp.</th><th style={{ textAlign: "right" }} title="games won of games played">Games</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.seat} style={{ borderBottom: "1px solid var(--ink-soft)", fontWeight: r.seat === 0 ? 700 : 400 }}>
            <td style={{ padding: "4px 6px" }}>{r.place}</td>
            <td>{r.name}</td>
            <td><Pips colors={e.field[r.seat]!.colors} /></td>
            <td style={{ textAlign: "right" }}>{r.wins}–{r.losses}{r.draws ? `–${r.draws}` : ""}</td>
            <td style={{ textAlign: "right" }}>{r.points}</td>
            <td style={{ textAlign: "right" }}>{r.wins + r.losses + r.draws ? `${Math.round(r.omw * 100)}%` : "—"}</td>
            <td style={{ textAlign: "right" }}>{r.gameWins}/{r.gamesPlayed}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Page({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return <div className="loader" style={{ overflowY: "auto", alignItems: "safe center", padding: "16px 0" }}><div className="box play-setup world-start" style={{ maxWidth: wide ? 760 : 560, textAlign: "left" }}>{children}</div></div>;
}

function Door({ c }: { c: ConvocationController }) {
  const [seed, setSeed] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [size, setSize] = useState<"sixteen" | "eight">("sixteen");
  const [difficulty, setDifficulty] = useState<DifficultyName>("standard");
  const ledger = c.ledger();
  const start = () => c.newEvent(seed.trim() && Number.isFinite(Number(seed)) ? Number(seed) : undefined, size === "sixteen" ? { seats: 16, rounds: 5, top8: true, difficulty } : { seats: 8, rounds: 3, difficulty });
  return (
    <Page>
      <h2 style={{ fontFamily: "var(--serif)", margin: "0 0 4px" }}>The Convocation</h2>
      <p style={{ margin: "0 0 10px" }}>{size === "sixteen" ? "A Convocation — Sealed, sixteen seats, five rounds, and the Umbel: a final table of eight." : "A Convocation — Sealed, eight seats, three rounds."}</p>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 12px" }}>Open six packs, build forty cards from them, and play rounds of best-of-three against the field.</p>
      <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 14, fontSize: 13 }}>
        <label className={size === "sixteen" ? "picked" : ""}><input type="radio" checked={size === "sixteen"} onChange={() => setSize("sixteen")} /> sixteen seats, five rounds, a Top 8</label>
        <label className={size === "eight" ? "picked" : ""}><input type="radio" checked={size === "eight"} onChange={() => setSize("eight")} /> eight seats, three rounds</label>
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as DifficultyName)} title="the field's entrance: Easy is flat; Standard and Hard give the later rounds' opponents more life" style={{ marginLeft: "auto" }}>
          <option value="easy">easy</option><option value="standard">standard</option><option value="hard">hard</option>
        </select>
      </div>
      {c.hasSave() && c.event!.phase !== "over" && !confirm && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
          <button className="primary" onClick={() => c.resume()}>Continue the event</button>
          <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>{c.event!.phase === "build" ? "your pool is open" : c.event!.phase === "bracket" ? "the Umbel" : `round ${c.event!.round} of ${c.event!.rounds}`}</span>
        </div>
      )}
      {c.hasSave() && c.event!.phase === "over" && <div style={{ marginBottom: 12 }}><button onClick={() => c.resume()}>See the finish</button></div>}
      {confirm ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 13 }}>Starting a new event abandons the one in progress.</span>
          <button className="danger" onClick={() => { setConfirm(false); start(); }}>Start anew</button>
          <button onClick={() => setConfirm(false)}>Keep it</button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button className={c.hasSave() && c.event!.phase !== "over" ? "" : "primary"} onClick={() => (c.hasSave() && c.event!.phase !== "over" ? setConfirm(true) : start())}>Enter a new event</button>
          <input type="text" placeholder="seed (random)" value={seed} onChange={(e) => setSeed(e.target.value)} style={{ width: 110 }} />
          <a href="/" style={{ marginLeft: "auto", fontSize: 12 }}>⟵ the menu</a>
        </div>
      )}
      {ledger.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div className="flyout-title">The ledger</div>
          <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 12.5 }}>
            {[...ledger].reverse().slice(0, 8).map((l, i) => <li key={i}>{l.when.slice(0, 10)} — {ORDINAL[l.place] ?? l.place} of {l.seats}, {l.record} <span style={{ color: "var(--ink-soft)" }}>(seed {l.seed})</span></li>)}
          </ul>
        </div>
      )}
    </Page>
  );
}

function Pairings({ c }: { c: ConvocationController }) {
  const e = c.event!, opp = c.opponentSeat(), rows = c.standings();
  const them = opp !== null ? e.field[opp]! : null, rec = opp !== null ? rows.find((r) => r.seat === opp)! : null;
  return (
    <Page wide>
      <h2 style={{ fontFamily: "var(--serif)", margin: "0 0 10px" }}>{them ? `Round ${e.round}. You are paired with ${them.name}.` : `Round ${e.round}. You have the bye.`}</h2>
      {!them && <div style={{ marginBottom: 14 }}><button className="primary" onClick={() => c.sitOut()}>Sit out the round</button> <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>a bye is a win</span></div>}
      {them && rec && (
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
          <Face slug={them.face} size={72} />
          <div><b>{them.name}</b><div style={{ fontSize: 13 }}><Pips colors={them.colors} /> · {rec.wins}–{rec.losses}{rec.draws ? `–${rec.draws}` : ""}</div></div>
          <span style={{ flex: 1 }} />
          <button className="primary" onClick={() => c.playMatch()}>Play the match</button>
        </div>
      )}
      <div className="flyout-title">The pairings</div>
      <ul style={{ margin: "4px 0 12px", paddingLeft: 18, fontSize: 13 }}>
        {e.pairings.map((p, i) => <li key={i} style={{ fontWeight: p.a === 0 || p.b === 0 ? 700 : 400 }}>{e.field[p.a]!.name} — {p.b === null ? "the bye" : e.field[p.b]!.name}</li>)}
      </ul>
      {e.round > 1 && <><div className="flyout-title">The table after round {e.round - 1}.</div><Table c={c} rows={rows} /></>}
      <div style={{ marginTop: 12 }}><button className="linkish" onClick={() => c.toDoor()}>⟵ leave for now (the event is saved)</button></div>
    </Page>
  );
}

function SeriesLine({ c }: { c: ConvocationController }) {
  const s = c.series, e = c.event!, opp = c.opponentSeat();
  if (!s || opp === null) return null;
  const [a, b] = s.wins;
  const stage = e.phase === "bracket" && e.bracket ? ["The quarter-final", "The semi-final", "The final"][e.bracket.rounds.length - 1] : `Round ${e.round}`;
  return <span>{stage} · {e.field[0]!.name} {a} – {b} {e.field[opp]!.name}{s.draws ? ` · ${s.draws} drawn` : ""}</span>;
}

function PlayDraw({ c }: { c: ConvocationController }) {
  const n = (c.series?.games.length ?? 0) + 1;
  return (
    <Page>
      <h2 style={{ fontFamily: "var(--serif)", margin: "0 0 6px" }}>Game {n} of 3</h2>
      <p style={{ margin: "0 0 12px" }}>{n === 1 ? "You won the coin. " : ""}The choice is yours: take the first turn, or draw first.</p>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="primary" onClick={() => c.choose("play")}>Play first</button>
        <button onClick={() => c.choose("draw")}>Draw first</button>
      </div>
    </Page>
  );
}

function Between({ c }: { c: ConvocationController }) {
  const s = c.series!, last = s.games[s.games.length - 1], e = c.event!, opp = c.opponentSeat()!;
  return (
    <Page>
      <h2 style={{ fontFamily: "var(--serif)", margin: "0 0 6px" }}>{last ? (last.winner === 0 ? `Game ${last.index + 1} is yours.` : last.winner === 1 ? `Game ${last.index + 1} goes to ${e.field[opp]!.name}.` : `Game ${last.index + 1} is drawn.`) : "The match waits."}</h2>
      <p style={{ margin: "0 0 12px" }}><SeriesLine c={c} /></p>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button className="primary" onClick={() => c.nextGame()}>Game {s.games.length + 1} of 3</button>
        <button onClick={() => c.openSideboard()} title="change your deck from your pool before the next game">Sideboard</button>
        <button className="linkish" style={{ marginLeft: "auto" }} onClick={() => c.toDoor()}>leave for now</button>
      </div>
    </Page>
  );
}

function Standings({ c }: { c: ConvocationController }) {
  const e = c.event!, mine = e.results.find((r) => r.round === e.round && (r.a === 0 || r.b === 0));
  const dev = import.meta.env.DEV && c.fieldMs !== null;
  return (
    <Page wide>
      <h2 style={{ fontFamily: "var(--serif)", margin: "0 0 10px" }}>The table after round {e.round}.</h2>
      {mine && <p style={{ margin: "0 0 10px", fontSize: 13 }}>Your match: {mine.series.winner === "draw" ? "drawn" : mine.series.winner === 0 ? "won" : "lost"}, {mine.series.wins[0]}–{mine.series.wins[1]}.</p>}
      <Table c={c} rows={c.standings()} />
      <div className="flyout-title" style={{ marginTop: 12 }}>The round's matches</div>
      <ul style={{ margin: "4px 0 12px", paddingLeft: 18, fontSize: 12.5 }}>
        {e.results.filter((r) => r.round === e.round).map((r, i) => <li key={i}>{e.field[r.a]!.name} {r.series.wins[0]} – {r.series.wins[1]} {e.field[r.b]!.name}{r.series.winner === "draw" ? " (drawn)" : ""}</li>)}
      </ul>
      <button className="primary" onClick={() => c.next()}>{e.round < e.rounds ? `Round ${e.round + 1}` : e.top8 ? "To the Umbel" : "To the finish"}</button>
      {dev && <span style={{ marginLeft: 12, fontSize: 11, color: "var(--ink-soft)" }}>dev: the field's series took {c.fieldMs} ms on the main thread</span>}
    </Page>
  );
}

/** S49: the Top 8 — the bracket as three columns; the human plays their match live, the rest resolves here. */
function Bracket({ c }: { c: ConvocationController }) {
  const e = c.event!, b = e.bracket!, opp = c.opponentSeat(), over = e.phase === "over";
  const seedOf = (s: number) => b.seeds.indexOf(s) + 1, inEight = b.seeds.includes(0);
  const name = (s: number) => `${seedOf(s)}. ${e.field[s]!.name}`;
  const round = b.rounds.length - 1;
  return (
    <Page wide>
      <img src="/convocation-umbel.png" alt="" style={{ float: "right", width: 96, height: 96, objectFit: "cover", borderRadius: 8, border: "1.5px solid var(--ink)", marginLeft: 12 }} onError={(ev) => { (ev.target as HTMLImageElement).style.display = "none"; }} />
      <h2 style={{ fontFamily: "var(--serif)", margin: "0 0 4px" }}>The Umbel — {over ? "decided" : BRACKET_ROUND_NAMES[round]}</h2>
      <p style={{ margin: "0 0 12px", fontSize: 13 }}>{over ? (b.rounds[b.rounds.length - 1]![0]!.winner === 0 ? "The Umbel is yours." : `${e.field[b.rounds[b.rounds.length - 1]![0]!.winner!]!.name} takes the Umbel.`) : inEight ? (opp !== null ? `You are seeded ${ORDINAL[seedOf(0)]}. You meet ${e.field[opp]!.name}.` : "You are out of the eight's running; the bracket plays on.") : "You finished outside the eight. The final table plays without you."}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, clear: "both" }}>
        {[0, 1, 2].map((r) => (
          <div key={r}>
            <div className="flyout-title" style={{ textTransform: "capitalize" }}>{BRACKET_ROUND_NAMES[r]}</div>
            {(b.rounds[r] ?? []).map((m, i) => (
              <div key={i} style={{ border: "1.5px solid var(--ink)", borderRadius: 6, padding: "6px 8px", margin: "6px 0", fontSize: 12.5, background: m.a === 0 || m.b === 0 ? "rgba(160,120,40,0.12)" : "transparent" }}>
                {[m.a, m.b].map((s, k) => (
                  <div key={s} style={{ display: "flex", justifyContent: "space-between", fontWeight: m.winner === s ? 700 : 400, opacity: m.winner !== undefined && m.winner !== s ? 0.55 : 1 }}>
                    <span>{name(s)}</span><span>{m.series ? m.series.wins[k] : ""}</span>
                  </div>
                ))}
              </div>
            ))}
            {!b.rounds[r] && <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 6 }}>—</div>}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14, display: "flex", gap: 8, alignItems: "center" }}>
        {over ? <button className="primary" onClick={() => c.toPrize()}>To the finish</button>
          : opp !== null ? <button className="primary" onClick={() => c.playMatch()}>Play {["the quarter-final", "the semi-final", "the final"][round]}</button>
          : <button className="primary" onClick={() => void c.resolveBracket()}>Watch the bracket resolve</button>}
        {!over && <button className="linkish" style={{ marginLeft: "auto" }} onClick={() => c.toDoor()}>leave for now</button>}
      </div>
    </Page>
  );
}

function Prize({ c, pool, oracle }: { c: ConvocationController; pool: Map<string, CardDef>; oracle: Record<string, OracleEntry> }) {
  const e = c.event!, places = c.places(), place = places.find((p) => p.seat === 0)!.place;
  const rows = [...c.standings()].sort((x, y) => places.find((p) => p.seat === x.seat)!.place - places.find((p) => p.seat === y.seat)!.place).map((r) => ({ ...r, place: places.find((p) => p.seat === r.seat)!.place }));
  const me = rows.find((r) => r.seat === 0)!;
  const ids = [...new Set(e.field[0]!.pool)].sort((a, b) => pool.get(a)!.name.localeCompare(pool.get(b)!.name));
  return (
    <Page wide>
      <h2 style={{ fontFamily: "var(--serif)", margin: "0 0 4px" }}>You finish {ORDINAL[place] ?? place} of {COUNT[e.field.length] ?? e.field.length}.</h2>
      {place === 1 && <p style={{ margin: "0 0 8px", fontFamily: "var(--serif)", fontSize: 17 }}>The Umbel is yours.</p>}
      <p style={{ margin: "0 0 10px", fontSize: 13 }}>{me.wins}–{me.losses}{me.draws ? `–${me.draws}` : ""} · {me.points} points · entered in the ledger (seed {e.seed}).</p>
      <Table c={c} rows={rows} swiss={!!e.bracket} />
      <div className="flyout-title" style={{ marginTop: 14 }}>{e.kept ? `You keep ${pool.get(e.kept)?.name ?? e.kept}.` : "Keep one card from your pool"}</div>
      {!e.kept && (
        <div className="editor-grid" style={{ maxHeight: 300, overflowY: "auto", marginTop: 6 }}>
          {ids.map((id) => <div key={id} className="editor-card" title={`keep ${pool.get(id)!.name}`} onClick={() => c.keep(id)}><div className="editor-slot"><CardFrame def={pool.get(id)!} oracle={oracle[id]} showPrinted /></div></div>)}
        </div>
      )}
      <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
        <button className="primary" onClick={() => c.leave()}>Leave the hall</button>
      </div>
    </Page>
  );
}

export function ConvocationApp() {
  const pool = useMemo(loadPool, []);
  const [oracle, setOracle] = useState<Record<string, OracleEntry>>({});
  useEffect(() => { void loadOracle().then(setOracle); }, []);
  const c = useMemo(() => { const d = loadConvocationData(); return new ConvocationController(pool, d.packs, d.rating, loadWorldCatalog()); }, [pool]);
  const [, force] = useState(0);
  useEffect(() => c.subscribe(() => force((n) => n + 1)), [c]);
  (globalThis as { __cc?: ConvocationController }).__cc = c;

  const k = c.screen.kind;
  if (k === "door" || !c.event) return <Door c={c} />;
  if (k === "build") {
    const host = c.editorHost();
    if (!host) return null;
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <div className="convocation-banner" style={{ padding: "6px 12px", background: "var(--ink)", color: "var(--parchment)", fontSize: 13, display: "flex", gap: 12, alignItems: "center" }}>
          <b style={{ fontFamily: "var(--serif)" }}>{c.screen.sideboarding ? "Between games" : `A Convocation — Sealed, ${COUNT[c.event.field.length] ?? c.event.field.length} seats.`}</b>
          <span>{c.screen.sideboarding ? "Change your deck from your pool; forty cards or more." : "Six packs are open. Build at least forty cards; basic lands are free."}</span>
          <span style={{ flex: 1 }} />
          {!c.screen.sideboarding && <button onClick={() => c.suggestDeck()} title="a deck built from this pool by the rating — a starting point you can change">Suggest a deck</button>}
          {!c.screen.sideboarding && <button className="linkish" style={{ color: "var(--parchment)" }} onClick={() => c.toDoor()}>leave for now</button>}
        </div>
        <div style={{ flex: 1, minHeight: 0 }}><DeckEditor host={host} pool={pool} oracle={oracle} /></div>
      </div>
    );
  }
  if (k === "pairings") return <Pairings c={c} />;
  if (k === "playDraw") return <PlayDraw c={c} />;
  if (k === "match" && c.match) {
    const s = c.series!;
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <div className="convocation-banner" style={{ padding: "5px 12px", background: "var(--ink)", color: "var(--parchment)", fontSize: 13, display: "flex", gap: 14 }}>
          <b style={{ fontFamily: "var(--serif)" }}>Game {s.games.length + 1} of 3</b>
          <SeriesLine c={c} />
          <span>{c.match.spec.rules.startingPlayer === 0 ? "you play first" : "you draw first"}</span>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}><PlayMatch key={c.match.seed} c={c.match} pool={pool} oracle={oracle} onGameOver={() => { /* the controller's series takes over */ }} /></div>
      </div>
    );
  }
  if (k === "between") return <Between c={c} />;
  if (k === "field") return <Page><h2 style={{ fontFamily: "var(--serif)", margin: 0 }}>The other tables finish their matches…</h2></Page>;
  if (k === "standings") return <Standings c={c} />;
  if (k === "bracket") return <Bracket c={c} />;
  if (k === "prize") return <Prize c={c} pool={pool} oracle={oracle} />;
  return null;
}
