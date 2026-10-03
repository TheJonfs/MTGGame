import { useEffect, useMemo, useState } from "react";
import type { CardDef } from "@shandalar/cards";
import { BRACKET_ROUND_NAMES, CONSTRUCTED_FORMATS, keepAllowance, lastLimitedPool, type DifficultyName, type Standing } from "@shandalar/world";
import { loadConvocationData, loadOracle, loadPool, loadWorldCatalog, type OracleEntry } from "../engine-bridge";
import { DeckEditor } from "../components/DeckEditor";
import { CardFrame } from "../components/CardFrame";
import { FloatingCardInspector } from "../world/FloatingCardInspector";
import { cardColors } from "@shandalar/cards";
import { PlayMatch } from "../play/PlayMatch";
import { ConvocationController, finishTitle, stageName } from "./convocation-controller";

/**
 * S48 (Part 4): the Convocation's shell — one Sealed event of eight, four screens over the controller: the pool and
 * the build (the deck editor over the sealed pool), the pairings and standings, the series over the match, the
 * prize. The text is the S48 brief's Part 5 (the planner's; Chris's pen).
 */
const ORDINAL = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth", "thirteenth", "fourteenth", "fifteenth", "sixteenth"];
const COUNT: Record<number, string> = { 8: "eight", 15: "fifteen", 16: "sixteen", 32: "thirty-two", 128: "a hundred and twenty-eight" };
const DAY = ["", "one", "two", "three", "four", "five", "six"];
const PIP: Record<string, string> = { W: "white", U: "blue", B: "black", R: "red", G: "green" };

/** A seat's portrait; without one (S53: 38 portraits for 127 seats), its initials — "you" only for the player. */
function Face({ slug, size = 56, name }: { slug?: string | undefined; size?: number; /** a faceless AI seat's name, for its initials */ name?: string }) {
  const initials = name ? name.split(/\s+/).filter((w) => /^[A-Z]/.test(w)).slice(0, 2).map((w) => w[0]).join("") : "you";
  return slug ? <img src={`/portraits/${slug}.png`} alt="" style={{ width: size, height: size, objectFit: "cover", borderRadius: 6, border: "1.5px solid var(--ink)" }} /> : <div style={{ width: size, height: size, borderRadius: 6, border: "1.5px solid var(--ink)", display: "grid", placeItems: "center", fontFamily: "var(--serif)", fontSize: name ? size / 2.6 : undefined }}>{initials}</div>;
}
function Pips({ colors }: { colors: string }) {
  return <span style={{ display: "inline-flex", gap: 2, verticalAlign: -2 }}>{[...colors].map((c) => <img key={c} src={`/icons/mana-${PIP[c] ?? "colorless"}.svg`} alt={c} style={{ width: 13, height: 13 }} />)}</span>;
}

function Table({ c, rows: all, swiss = false }: { c: ConvocationController; rows: Standing[]; /** S50: the finish's table is ordered by final place; its record columns are the Swiss rounds'. */ swiss?: boolean }) {
  const e = c.event!;
  const [full, setFull] = useState(false);
  // S53: a field of 128 shows the top sixteen and the four rows around the player; the rest on request
  const me = all.findIndex((r) => r.seat === 0), big = all.length > 32 && !full;
  const rows = big ? all.filter((_, i) => i < 16 || Math.abs(i - me) <= 2) : all;
  return (<>
    <table className="convocation-table" style={{ borderCollapse: "collapse", width: "100%", fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
      <thead><tr style={{ textAlign: "left", borderBottom: "1.5px solid var(--ink)" }}><th style={{ padding: "4px 6px" }}></th><th>Seat</th><th>Deck</th><th style={{ textAlign: "right" }}>{swiss ? "Swiss record" : "Record"}</th><th style={{ textAlign: "right" }}>{swiss ? "Swiss points" : "Points"}</th><th style={{ textAlign: "right" }} title="opponents' match-win share — the tiebreak">Opp.</th><th style={{ textAlign: "right" }} title="games won of games played">Games</th></tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.seat} className={big && i > 0 && rows[i - 1]!.place + 1 !== r.place ? "gap-above" : ""} style={{ borderBottom: "1px solid var(--ink-soft)", fontWeight: r.seat === 0 ? 700 : 400 }}>
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
    {all.length > 32 && <button className="linkish" style={{ fontSize: 12, marginTop: 4 }} onClick={() => setFull(!full)}>{full ? "the top sixteen and your place" : `all ${all.length} seats`}</button>}
  </>);
}

function Page({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return <div className="loader" style={{ overflowY: "auto", alignItems: "safe center", padding: "16px 0" }}><div className="box play-setup world-start" style={{ maxWidth: wide ? 760 : 560, textAlign: "left" }}>{children}</div></div>;
}

const title = (id: string) => { const n = CONSTRUCTED_FORMATS.find((f) => f.id === id)?.name ?? id; return n.replace(/^The /, "the "); };

function Door({ c }: { c: ConvocationController }) {
  const [seed, setSeed] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [size, setSize] = useState<"convocation" | "draft" | "sixteen" | "eight" | "open">("convocation");
  const [day2, setDay2] = useState("open"), [day4, setDay4] = useState("open"); // S53: the two Constructed days
  const [difficulty, setDifficulty] = useState<DifficultyName>("standard");
  const ledger = c.ledger();
  const seedOf = () => (seed.trim() && Number.isFinite(Number(seed)) ? Number(seed) : undefined);
  const start = () => size === "convocation" ? c.newConvocation(seedOf(), { difficulty, first: day2, second: day4 }) : c.newEvent(seed.trim() && Number.isFinite(Number(seed)) ? Number(seed) : undefined, size === "open" ? { constructed: "open", seats: 32, rounds: 5, top8: true, difficulty } : size === "draft" ? { draft: true, seats: 32, rounds: 5, top8: true, difficulty } : size === "sixteen" ? { seats: 32, rounds: 5, top8: true, difficulty } : { seats: 8, rounds: 3, difficulty });
  return (
    <Page>
      <h2 style={{ fontFamily: "var(--serif)", margin: "0 0 4px" }}>The Convocation</h2>
      <p style={{ margin: "0 0 10px" }}>{size === "convocation" ? `The Convocation — four days: a draft, ${title(day2)}, a draft, ${title(day4)}; the Umbel of Eight.` : size === "open" ? "A Convocation — the Open, thirty-two seats, five rounds, the Umbel." : size === "draft" ? "A Convocation — Draft, thirty-two seats in pods of eight: three packs, five rounds, the Umbel." : size === "sixteen" ? "A Convocation — Sealed, thirty-two seats, five rounds, and the Umbel: a final table of eight." : "A Convocation — Sealed, eight seats, three rounds."}</p>
      <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: "0 0 12px" }}>{size === "convocation" ? "A hundred and twenty-eight seats and sixteen Swiss rounds: draft three rounds inside your pod, play five in a Constructed format, draft again with the seven nearest your record, five more rounds — and the eight best meet in the Umbel." : size === "open" ? "Constructed: bring sixty cards — any card the Open allows, the power restricted to one of each — and play rounds of best-of-three against a field of thirty-one." : size === "draft" ? "Pick one card from each pack as it comes round, build forty cards from your picks, and play rounds of best-of-three against the whole field — your pod and three others." : "Open six packs, build forty cards from them, and play rounds of best-of-three against the field."}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14, fontSize: 13 }}>
        <label className={size === "convocation" ? "picked" : ""}><input type="radio" checked={size === "convocation"} onChange={() => setSize("convocation")} /> The Convocation — four days, 128 seats, sixteen rounds, the Umbel</label>
        {size === "convocation" && (
          <div style={{ display: "flex", gap: 10, paddingLeft: 22, fontSize: 12.5 }}>
            <label>Day two <select value={day2} onChange={(e) => setDay2(e.target.value)}>{CONSTRUCTED_FORMATS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
            <label>Day four <select value={day4} onChange={(e) => setDay4(e.target.value)}>{CONSTRUCTED_FORMATS.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
          </div>
        )}
        <label className={size === "draft" ? "picked" : ""}><input type="radio" checked={size === "draft"} onChange={() => setSize("draft")} /> Draft — thirty-two seats in pods of eight, five rounds, the Umbel</label>
        <label className={size === "sixteen" ? "picked" : ""}><input type="radio" checked={size === "sixteen"} onChange={() => setSize("sixteen")} /> Sealed — thirty-two seats, five rounds, the Umbel</label>
        <label className={size === "eight" ? "picked" : ""}><input type="radio" checked={size === "eight"} onChange={() => setSize("eight")} /> Sealed — eight seats, three rounds</label>
        <label className={size === "open" ? "picked" : ""}><input type="radio" checked={size === "open"} onChange={() => setSize("open")} /> The Open (Constructed) — thirty-two seats, five rounds, the Umbel</label>
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as DifficultyName)} title="the field's entrance by round — flat at every difficulty for now" style={{ alignSelf: "flex-start", marginTop: 4 }}>
          <option value="easy">easy</option><option value="standard">standard</option><option value="hard">hard</option>
        </select>
      </div>
      {c.hasSave() && c.event!.phase !== "over" && !confirm && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
          <button className="primary" onClick={() => c.resume()}>Continue the event</button>
          <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>{c.isStaged() ? `${c.stageLabel()} · ` : ""}{c.event!.phase === "interlude" ? "the day has ended" : c.event!.phase === "draft" ? `the draft — pick ${c.event!.draft!.pick}` : c.event!.phase === "build" ? "your pool is open" : c.event!.phase === "bracket" ? "the Umbel" : `round ${c.event!.round} of ${c.event!.rounds}`}</span>
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
          <div className="flyout-title">The ledger {ledger.some((l) => l.stages) && <button className="linkish" style={{ fontSize: 12, marginLeft: 8 }} onClick={() => c.toTrophies()}>the trophy room</button>}</div>
          <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 12.5 }}>
            {[...ledger].reverse().slice(0, 8).map((l, i) => <li key={i}>{l.when.slice(0, 10)} — {l.stages ? <><b>{l.title}</b> · the Convocation, </> : ""}{ORDINAL[l.place] ?? l.place} of {l.seats}, {l.record} <span style={{ color: "var(--ink-soft)" }}>(seed {l.seed})</span></li>)}
          </ul>
        </div>
      )}
    </Page>
  );
}

/** S51: the draft — the pack in hand (click a card to take it; no take-backs), the picks so far by colour. */
function Draft({ c, pool, oracle }: { c: ConvocationController; pool: Map<string, CardDef>; oracle: Record<string, OracleEntry> }) {
  const [inspect, setInspect] = useState<string | null>(null);
  const [printed, setPrinted] = useState(true);
  const v = c.draftView();
  if (!v) return null;
  const group = (id: string) => { const d = pool.get(id)!; const cs = cardColors(d); return d.types.includes("Land") ? "Land" : cs.length === 0 ? "Colourless" : cs.length > 1 ? "Gold" : cs[0]!; };
  const GROUPS = ["W", "U", "B", "R", "G", "Gold", "Colourless", "Land"];
  const byGroup = new Map<string, string[]>(GROUPS.map((g) => [g, []]));
  for (const id of v.picks) byGroup.get(group(id))!.push(id);
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div className="convocation-banner" style={{ padding: "6px 12px", background: "var(--ink)", color: "var(--parchment)", fontSize: 13, display: "flex", gap: 14, alignItems: "center" }}>
        {c.isStaged() && <span style={{ opacity: 0.85 }}>{c.stageLabel()}</span>}
        <b style={{ fontFamily: "var(--serif)" }}>Pick {v.pick} of {v.total} — pack {v.packRound}.</b>
        <span>{c.passNote ?? (v.pick === 1 ? "Take one card; the rest goes round the table." : (v.pick - 1) % (v.total / v.packs) === 0 ? `Pack ${v.packRound} is opened.` : "")}</span>
        <span style={{ flex: 1 }} />
        <span style={{ opacity: 0.8 }}>click a card to take it — no take-backs</span>
        <button className="linkish" style={{ color: "var(--parchment)" }} onClick={() => setPrinted(!printed)}>{printed ? "our frame" : "printed card"}</button>
        <button className="linkish" style={{ color: "var(--parchment)" }} onClick={() => c.toDoor()}>leave for now</button>
      </div>
      <FloatingCardInspector def={inspect ? pool.get(inspect) ?? null : null} oracle={oracle} printed={printed} onTogglePrinted={() => setPrinted(!printed)} />
      <div className="gallery world-editor" style={{ flex: 1, minHeight: 0 }}>
        <div className="editor-panes draft-panes">
          <div className="editor-pane draft-pack">
            <div className="flyout-title">The pack — {v.pack.length} card{v.pack.length === 1 ? "" : "s"}; it goes {v.direction} next</div>
            <div className="editor-grid">
              {v.pack.map((id, i) => (
                <div key={`${id}-${i}`} className="editor-card" title={`take ${pool.get(id)!.name}`} onClick={() => { setInspect(null); c.pickCard(id); }} onMouseEnter={() => setInspect(id)}>
                  <div className="editor-slot"><CardFrame def={pool.get(id)!} oracle={oracle[id]} showPrinted={printed} /></div>
                </div>
              ))}
            </div>
          </div>
          <div className="editor-pane">
            <div className="flyout-title">Your picks ({v.picks.length})</div>
            {GROUPS.filter((g) => byGroup.get(g)!.length > 0).map((g) => (
              <div key={g} style={{ marginBottom: 8, fontSize: 12.5 }}>
                <div style={{ fontWeight: 700 }}>{PIP[g] ? <img src={`/icons/mana-${PIP[g]}.svg`} alt={g} style={{ width: 13, height: 13, verticalAlign: -2, marginRight: 4 }} /> : null}{PIP[g] ? "" : g} <span style={{ fontWeight: 400, color: "var(--ink-soft)" }}>{byGroup.get(g)!.length}</span></div>
                {byGroup.get(g)!.map((id, i) => <div key={i} onMouseEnter={() => setInspect(id)} style={{ paddingLeft: 17, cursor: "default" }}>{pool.get(id)!.name}</div>)}
              </div>
            ))}
            {v.picks.length === 0 && <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>Nothing yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Pairings({ c }: { c: ConvocationController }) {
  const e = c.event!, opp = c.opponentSeat(), rows = c.standings();
  const them = opp !== null ? e.field[opp]! : null, rec = opp !== null ? rows.find((r) => r.seat === opp)! : null;
  return (
    <Page wide>
      {c.isStaged() && <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 2 }}>{c.stageLabel()}</div>}
      <h2 style={{ fontFamily: "var(--serif)", margin: "0 0 10px" }}>{them ? `Round ${e.round}. You are paired with ${them.name}.` : `Round ${e.round}. You have the bye.`}</h2>
      {!them && <div style={{ marginBottom: 14 }}><button className="primary" onClick={() => c.sitOut()}>Sit out the round</button> <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>a bye is a win</span></div>}
      {them && rec && (
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
          <Face slug={them.face} size={72} name={them.name} />
          <div><b>{them.name}</b><div style={{ fontSize: 13 }}><Pips colors={them.colors} /> · {rec.wins}–{rec.losses}{rec.draws ? `–${rec.draws}` : ""}</div></div>
          <span style={{ flex: 1 }} />
          <button className="primary" onClick={() => c.playMatch()}>Play the match</button>
        </div>
      )}
      <div className="flyout-title">The pairings</div>
      <ul style={{ margin: "4px 0 12px", paddingLeft: 18, fontSize: 13 }}>
        {e.pairings.filter((p, i) => e.pairings.length <= 16 || i < 8 || p.a === 0 || p.b === 0).map((p, i) => <li key={i} style={{ fontWeight: p.a === 0 || p.b === 0 ? 700 : 400 }}>{e.field[p.a]!.name} — {p.b === null ? "the bye" : e.field[p.b]!.name}</li>)}
      </ul>
      {e.pairings.length > 16 && <p style={{ fontSize: 12, color: "var(--ink-soft)", margin: "-6px 0 12px" }}>…and {e.pairings.length - 9} more tables{c.isStaged() && e.pods ? " (this round pairs inside the pods)" : ""}.</p>}
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
        {!c.isConstructed() && <button onClick={() => c.openSideboard()} title="change your deck from your pool before the next game">Sideboard</button>}
        <button className="linkish" style={{ marginLeft: "auto" }} onClick={() => c.toDoor()}>leave for now</button>
      </div>
    </Page>
  );
}

const stageEnd = (c: ConvocationController) => { const e = c.event!; return (e.stages ?? []).slice(0, (e.stage ?? 0) + 1).reduce((n, s) => n + s.rounds, 0); };

/** S53: the day's end between stages (Part 5's line). */
function Interlude({ c }: { c: ConvocationController }) {
  const e = c.event!, me = c.standings().find((r) => r.seat === 0)!, n = (e.stage ?? 0) + 1;
  return (
    <Page wide>
      <h2 style={{ fontFamily: "var(--serif)", margin: "0 0 6px" }}>Day {DAY[n] ?? n} ends. The table stands at {me.wins}–{me.losses}{me.draws ? `–${me.draws}` : ""}. Tomorrow: {c.nextStageName()}.</h2>
      <p style={{ margin: "0 0 12px", fontSize: 13 }}>You stand {ORDINAL[me.place] ?? me.place} of {e.field.length} after {e.round} rounds.{e.stages![n]?.kind === "draft" ? " The next draft seats you with the seven nearest your record." : ""}</p>
      <Table c={c} rows={c.standings()} />
      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button className="primary" onClick={() => c.toNextStage()}>Day {DAY[n + 1] ?? n + 1} — {c.nextStageName()}</button>
        <button className="linkish" style={{ marginLeft: "auto" }} onClick={() => c.toDoor()}>leave for now (the event is saved)</button>
      </div>
    </Page>
  );
}

/** S53 (Part 2): the trophy room — the full Convocations played, their finishes, the kept cards, the champion's decks. */
function Trophies({ c, pool }: { c: ConvocationController; pool: Map<string, CardDef> }) {
  const runs = c.ledger().filter((l) => l.stages).reverse();
  const name = (id: string) => pool.get(id)?.name ?? id;
  return (
    <Page wide>
      <h2 style={{ fontFamily: "var(--serif)", margin: "0 0 10px" }}>The trophy room</h2>
      {runs.length === 0 && <p style={{ fontSize: 13 }}>No full Convocation played yet.</p>}
      {runs.map((l, i) => (
        <div key={i} style={{ borderBottom: "1px solid var(--ink-soft)", padding: "8px 0", fontSize: 13 }}>
          <div><b style={{ fontFamily: "var(--serif)", fontSize: 15 }}>{l.title}</b> · {l.when.slice(0, 10)} · {l.record} · {l.stages!.map((s) => stageName(s)).join(", ")} <span style={{ color: "var(--ink-soft)" }}>(seed {l.seed})</span></div>
          {l.keptCards?.length ? <div>Kept: {l.keptCards.map(name).join(", ")}</div> : null}
          {l.place === 1 && l.decks && <details style={{ marginTop: 4 }}><summary>The champion's decks</summary>{l.decks.map((d, k) => <div key={k} style={{ margin: "4px 0 0 12px" }}><i>Day {DAY[d.stage + 1]}:</i> {d.deck.filter((e) => !["plains", "island", "swamp", "mountain", "forest"].includes(e.cardId)).map((e) => `${e.count} ${name(e.cardId)}`).join(", ")}</div>)}</details>}
        </div>
      ))}
      <div style={{ marginTop: 12 }}><button onClick={() => c.toDoor()}>⟵ the door</button></div>
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
        {e.results.filter((r) => r.round === e.round).filter((r, i, xs) => xs.length <= 16 || i < 8 || r.a === 0 || r.b === 0).map((r, i) => <li key={i}>{e.field[r.a]!.name} {r.series.wins[0]} – {r.series.wins[1]} {e.field[r.b]!.name}{r.series.winner === "draw" ? " (drawn)" : ""}</li>)}
      </ul>
      <button className="primary" onClick={() => c.next()}>{c.isStaged() && e.round < e.rounds && e.round === stageEnd(c) ? "The day ends" : e.round < e.rounds ? `Round ${e.round + 1}` : e.top8 ? "To the Umbel" : "To the finish"}</button>
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
      {c.isStaged() && round === 0 && !b.rounds[0]!.some((m) => m.series) && <p style={{ margin: "0 0 6px", fontFamily: "var(--serif)", fontSize: 16 }}>Eight remain. The Umbel opens in {c.formatName().replace(/^The /, "the ")}.</p>}
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
  const staged = !!e.stages, allowance = staged ? keepAllowance(e) : 1, kept = staged ? e.keptCards ?? [] : e.kept ? [e.kept] : [];
  const ids = [...new Set(staged ? lastLimitedPool(e) : e.field[0]!.pool)].sort((a, b) => pool.get(a)!.name.localeCompare(pool.get(b)!.name));
  return (
    <Page wide>
      <h2 style={{ fontFamily: "var(--serif)", margin: "0 0 4px" }}>You finish {ORDINAL[place] ?? place} of {COUNT[e.field.length] ?? e.field.length}.</h2>
      {place === 1 && <p style={{ margin: "0 0 8px", fontFamily: "var(--serif)", fontSize: 17 }}>{staged ? "Champion of the Umbel." : "The Umbel is yours."}</p>}
      {staged && place > 1 && <p style={{ margin: "0 0 8px", fontFamily: "var(--serif)", fontSize: 15 }}>{finishTitle(place, e.field.length).replace(/^./, (x) => x.toUpperCase())}.</p>}
      <p style={{ margin: "0 0 10px", fontSize: 13 }}>{me.wins}–{me.losses}{me.draws ? `–${me.draws}` : ""} · {me.points} points · entered in the ledger (seed {e.seed}).</p>
      <Table c={c} rows={rows} swiss={!!e.bracket} />
      <div className="flyout-title" style={{ marginTop: 14 }}>{allowance === 0 ? "The eight keep a card from their last draft; you finished outside them." : kept.length ? `You keep ${kept.map((k) => pool.get(k)?.name ?? k).join(" and ")}.${kept.length < allowance ? " Choose one more." : ""}` : allowance === 2 ? "Keep two cards from your last draft" : staged ? "Keep one card from your last draft" : "Keep one card from your pool"}</div>
      {kept.length < allowance && (
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
  if (k === "trophies") return <Trophies c={c} pool={pool} />;
  if (k === "door" || !c.event) return <Door c={c} />;
  if (k === "interlude") return <Interlude c={c} />;
  if (k === "draft") return <Draft c={c} pool={pool} oracle={oracle} />;
  if (k === "build") {
    const host = c.editorHost();
    if (!host) return null;
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <div className="convocation-banner" style={{ padding: "6px 12px", background: "var(--ink)", color: "var(--parchment)", fontSize: 13, display: "flex", gap: 12, alignItems: "center" }}>
          {c.isStaged() && !c.screen.sideboarding && !c.registration() && <span style={{ opacity: 0.85 }}>{c.stageLabel()}</span>}
          {c.registration() && <span style={{ opacity: 0.85 }}>Decklists{c.registration()!.left > 1 ? ` (${c.registration()!.left} to register)` : ""}</span>}
          <b style={{ fontFamily: "var(--serif)" }}>{c.registration() ? `Register your deck for ${c.registration()!.formatName.replace(/^The /, "the ")} — it plays Day ${c.registration()!.days.join(" and Day ")}${c.registration()!.days.includes(c.event.stages!.length) ? ", and the Umbel" : ""}.` : c.screen.sideboarding ? "Between games" : c.isConstructed() ? `A Convocation — ${c.formatName()}.` : c.isDraft() ? "Forty-five picks. Build from them." : `A Convocation — Sealed, ${COUNT[c.event.field.length] ?? c.event.field.length} seats.`}</b>
          <span>{c.registration() ? "As at the Pro Tour, the deck is registered before the first draft and cannot change." : c.screen.sideboarding ? "Change your deck from your pool; forty cards or more." : c.isConstructed() ? "Every card the format allows is yours. Build sixty or more, take a suggestion, or bring a saved deck." : c.isDraft() ? "Build at least forty cards from your picks; basic lands are free." : "Six packs are open. Build at least forty cards; basic lands are free."}</span>
          <span style={{ flex: 1 }} />
          {!c.screen.sideboarding && c.isConstructed() && (
            <select value="" onChange={(e) => { if (e.target.value) c.startFromList(e.target.value); }} title="start from one of the lists the field is drawn from — repaired to this format, as written">
              <option value="">start from a list…</option>
              {c.startingLists().map((l) => <option key={l.key} value={l.key}>{l.label} — {l.archetype}</option>)}
            </select>
          )}
          {!c.screen.sideboarding && c.isConstructed() && c.savedDecks().length > 0 && (
            <select value="" onChange={(e) => { if (e.target.value) c.useSavedDeck(e.target.value); }} title="your saved decks from the journey — the format checks the one you bring">
              <option value="">bring a saved deck…</option>
              {c.savedDecks().map((d) => <option key={d.name} value={d.name}>{d.name}{d.ok ? "" : " (not legal here)"}</option>)}
            </select>
          )}
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
  if (k === "field") return <Page><h2 style={{ fontFamily: "var(--serif)", margin: 0 }}>The other tables finish their matches…</h2>{c.fieldProgress && <p style={{ fontSize: 13, margin: "8px 0 0" }}>{c.fieldProgress.done} of {c.fieldProgress.of} matches played.</p>}</Page>;
  if (k === "standings") return <Standings c={c} />;
  if (k === "bracket") return <Bracket c={c} />;
  if (k === "prize") return <Prize c={c} pool={pool} oracle={oracle} />;
  return null;
}
