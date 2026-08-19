import { useEffect } from "react";
import { stepLabel } from "../labels";
import type { ReplaySession } from "../engine-bridge";

export function Transport({
  session,
  index,
  setIndex,
  playing,
  setPlaying,
  speed,
  setSpeed,
  onFlag,
  replayMs,
}: {
  session: ReplaySession;
  index: number;
  setIndex: (i: number) => void;
  playing: boolean;
  setPlaying: (p: boolean) => void;
  speed: number;
  setSpeed: (s: number) => void;
  onFlag: () => void;
  replayMs: number;
}) {
  const total = session.total;
  const info = session.decisions[Math.min(index, total - 1)];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" && (e.target as HTMLInputElement).type === "text") return;
      if (e.key === "ArrowRight") setIndex(e.shiftKey ? session.stepJump(index, 1) : Math.min(index + 1, total));
      else if (e.key === "ArrowLeft") setIndex(e.shiftKey ? session.stepJump(index, -1) : Math.max(index - 1, 0));
      else if (e.key === " ") {
        e.preventDefault();
        setPlaying(!playing);
      } else return;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, playing, session, setIndex, setPlaying, total]);

  useEffect(() => {
    if (!playing) return;
    if (index >= total) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setIndex(index + 1), 1000 / speed);
    return () => clearTimeout(t);
  }, [playing, index, speed, setIndex, setPlaying, total]);

  return (
    <div className="transport">
      <button onClick={() => setIndex(0)} title="First">⏮</button>
      <button onClick={() => setIndex(session.stepJump(index, -1))} title="Previous step (shift+←)">⏪</button>
      <button onClick={() => setIndex(Math.max(index - 1, 0))} title="Previous action (←)">◀</button>
      <button className={playing ? "playing" : ""} onClick={() => setPlaying(!playing)} title="Play/pause (space)">
        {playing ? "❚❚" : "▶"}
      </button>
      <button onClick={() => setIndex(Math.min(index + 1, total))} title="Next action (→)">▶▶</button>
      <button onClick={() => setIndex(session.stepJump(index, 1))} title="Next step (shift+→)">⏩</button>
      <button onClick={() => setIndex(total)} title="Last">⏭</button>
      <input type="range" min={0} max={total} value={index} onChange={(e) => setIndex(Number(e.target.value))} />
      <span className="where">
        {index >= total ? "Final state" : info ? `T${info.turn} · ${stepLabel(info.step)} · ${index + 1}/${total}` : ""}
        <span style={{ color: "var(--ink-soft)", fontSize: 10 }}> {replayMs > 0 ? ` · ${replayMs.toFixed(0)}ms` : ""}</span>
      </span>
      <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} title="Speed">
        {[1, 2, 4, 8].map((s) => (
          <option key={s} value={s}>{s}×</option>
        ))}
      </select>
      <button className="flag-btn" onClick={onFlag} title="Flag this moment for the fixtures inbox">
        <img src="/icons/ui-flag.svg" width={13} style={{ mixBlendMode: "multiply", verticalAlign: -2 }} alt="" /> Flag
      </button>
    </div>
  );
}
