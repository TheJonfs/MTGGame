import { useEffect, useMemo, useRef, useState } from "react";
import type { DecisionPoint } from "@shandalar/engine";
import { loadOracle, loadPool, viewCtx, ReplaySession, type OracleEntry, type SavedGame } from "./engine-bridge";
import { Board } from "./components/Board";
import { Rail } from "./components/Rail";
import { Transport } from "./components/Transport";
import { LogPanel, buildLogLines } from "./components/LogPanel";
import { Gallery } from "./components/Gallery";
import { PlayApp } from "./play/PlayApp";
import { WorldApp } from "./world/WorldApp";

const VIEWER_VERSION = "s6-0.1";
/** Log placement is an open art-direction decision (§7): rail tab by default,
 *  bottom row behind ?log=bottom for Chris to compare. */
const LOG_BOTTOM = new URLSearchParams(window.location.search).get("log") === "bottom";

function Loader({ onLoad }: { onLoad: (g: SavedGame) => void }) {
  const [error, setError] = useState<string | null>(null);
  const pick = (file: File) => {
    file.text().then((text) => {
      try {
        const parsed = JSON.parse(text) as SavedGame;
        if (parsed.format !== "shandalar-log-v1") throw new Error("not a shandalar-log-v1 file");
        onLoad(parsed);
      } catch (e) {
        setError(String(e));
      }
    });
  };
  return (
    <div className="loader">
      <div className="box">
        <h2 style={{ fontFamily: "var(--serif)", marginTop: 0 }}>Replay Viewer</h2>
        <p>Open a saved game log (from <code>pnpm fuzz --save</code> or <code>pnpm play-random</code>).</p>
        <input type="file" accept=".json" onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])} />
        <p>
          <button
            onClick={() =>
              fetch("/sample-game.json")
                .then((r) => r.json())
                .then(onLoad)
                .catch((e) => setError(String(e)))
            }
          >
            Load the bundled sample game
          </button>{" "}
          <button
            onClick={() =>
              fetch("/sample-game-sane.json")
                .then((r) => r.json())
                .then(onLoad)
                .catch((e) => setError(String(e)))
            }
          >
            Load the sane-agents sample (S7)
          </button>
        </p>
        <p>
          <a className="linkish" href="/world"><b>Walk the world</b></a> · <a className="linkish" href="/play">play a match</a> · <a className="linkish" href="/gallery">card gallery</a>
        </p>
        {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      </div>
    </div>
  );
}

function Viewer({ game }: { game: SavedGame }) {
  const pool = useMemo(loadPool, []);
  const session = useMemo(() => new ReplaySession(game, pool), [game, pool]);
  const [oracle, setOracle] = useState<Record<string, OracleEntry>>({});
  const [index, setIndex] = useState(0);
  const [point, setPoint] = useState<DecisionPoint | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [printed, setPrinted] = useState(true); // S10 playtest: default to the printed card
  const [reveal, setReveal] = useState(false);
  const [replayMs, setReplayMs] = useState(0);
  const [flagNote, setFlagNote] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    loadOracle().then(setOracle);
  }, []);

  useEffect(() => {
    const mySeq = ++seq.current;
    session.at(index).then((p) => {
      if (seq.current === mySeq) {
        setPoint(p);
        setReplayMs(session.lastReplayMs);
      }
    });
  }, [index, session]);

  const logLines = useMemo(() => buildLogLines(game, pool), [game, pool]);

  if (!point) return <div className="loader">reconstructing…</div>;
  const ctx = viewCtx(point.state, pool);
  const inspected = pinned ?? hovered;

  const flag = async () => {
    const note = window.prompt("What looks wrong or interesting here?", "");
    if (note === null) return;
    const info = session.decisions[Math.min(index, session.total - 1)];
    const entry = {
      matchSpec: game.spec,
      actionIndex: index,
      turn: info?.turn ?? 0,
      step: info?.step ?? "",
      note,
      flaggedAt: new Date().toISOString(),
      viewerVersion: VIEWER_VERSION,
    };
    try {
      const resp = await fetch("/__flag", { method: "POST", body: JSON.stringify(entry) });
      const j = (await resp.json()) as { ok: boolean; file?: string };
      setFlagNote(j.ok ? `Flagged → ${j.file}` : "Flag failed");
    } catch {
      // Static build: no dev endpoint — download instead (brief Part 3).
      const blob = new Blob([JSON.stringify(entry, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${game.spec.seed}-t${entry.turn}-a${index}.json`;
      a.click();
      setFlagNote("Flag downloaded (no dev server)");
    }
    setTimeout(() => setFlagNote(null), 4000);
  };

  const logPanel = <LogPanel lines={logLines} current={index} onSeek={setIndex} />;
  return (
    <div className="app">
      <Board
        ctx={ctx}
        oracle={oracle}
        revealOpponent={reveal}
        onHover={setHovered}
        onClick={(id) => setPinned((p) => (p === id ? null : id))}
        selected={pinned}
      />
      <Rail
        ctx={ctx}
        point={point}
        poolMap={pool}
        oracle={oracle}
        inspected={inspected}
        printed={printed}
        onTogglePrinted={() => setPrinted((p) => !p)}
        logTab={
          <>
            <div className="panel toggle-row">
              <label>
                <input type="checkbox" checked={reveal} onChange={(e) => setReveal(e.target.checked)} /> Reveal opponent hand
              </label>
              {flagNote && <span style={{ color: "var(--brass)" }}>{flagNote}</span>}
            </div>
            {!LOG_BOTTOM && logPanel}
          </>
        }
      />
      {LOG_BOTTOM && <div className="log-bottom">{logPanel}</div>}
      <Transport
        session={session}
        index={index}
        setIndex={setIndex}
        playing={playing}
        setPlaying={setPlaying}
        speed={speed}
        setSpeed={setSpeed}
        onFlag={flag}
        replayMs={replayMs}
      />
    </div>
  );
}

export default function App() {
  const [game, setGame] = useState<SavedGame | null>(null);
  const [replayFromPlay, setReplayFromPlay] = useState<SavedGame | null>(null);
  if (window.location.pathname === "/gallery") return <Gallery />;
  if (window.location.pathname === "/world") {
    // S13: the overworld; duel replays hand off to the viewer like /play does.
    if (replayFromPlay) return <Viewer game={replayFromPlay} />;
    return <WorldApp onWatchReplay={setReplayFromPlay} />;
  }
  if (window.location.pathname === "/play") {
    // "Watch replay" hands the finished game straight to the viewer.
    if (replayFromPlay) return <Viewer game={replayFromPlay} />;
    return <PlayApp onWatchReplay={setReplayFromPlay} />;
  }
  return game ? <Viewer game={game} /> : <Loader onLoad={setGame} />;
}
