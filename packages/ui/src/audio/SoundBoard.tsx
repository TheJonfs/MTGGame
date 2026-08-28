import { useMemo, useState } from "react";
import { audio, type MusicCue, type SfxCue, type StingCue } from "./audio.js";

/**
 * S24 r2 — the /sound board (dev surface): every mapped cue, playable in place, with a live
 * volume slider for the SFX family. Chris's tuning loop: drag, click, read the number off,
 * and the chosen values go into data/audio/mapping.json's {file, volume} entries — the board
 * itself persists nothing (the mapping stays the one source of truth).
 */
export function SoundBoard() {
  const entries = useMemo(() => audio.entries().sort((a, b) => a.cue.localeCompare(b.cue)), []);
  const [vols, setVols] = useState<Record<string, number>>({});
  const [enabled, setEnabled] = useState(audio.isEnabled());
  const groups: [string, typeof entries][] = [
    ["The SFX channel (per-action; slider = live volume audition)", entries.filter((e) => e.cue.startsWith("sfx."))],
    ["Stingers (one voice — a new sting fades the last)", entries.filter((e) => e.cue.startsWith("sting."))],
    ["Music & splashes (looping; crossfade — playing one replaces the last)", entries.filter((e) => e.cue.startsWith("music.") || e.cue.startsWith("splash."))],
  ];
  const play = (cue: string) => {
    if (cue.startsWith("sfx.")) audio.sfx(cue as SfxCue, vols[cue]);
    else if (cue.startsWith("sting.")) audio.sting(cue as StingCue);
    else audio.music(cue as MusicCue);
  };
  return (
    <div className="app" style={{ maxWidth: 860, margin: "0 auto", padding: 20 }}>
      <h1 style={{ fontFamily: "var(--serif)" }}>The sound board</h1>
      <p style={{ fontSize: 13, color: "var(--ink-soft)" }}>
        Every mapped cue (data/audio/mapping.json), playable in place. SFX sliders audition a volume live —
        nothing persists: put the numbers you like into the mapping's <code>{"{file, volume}"}</code> entries.
        Sound needs one click anywhere first (the browser's rule).{" "}
        <button onClick={() => { audio.setEnabled(!enabled); setEnabled(!enabled); }}>{enabled ? "mute" : "unmute"}</button>{" "}
        <button onClick={() => audio.music("music.overworld")}>stop music</button>{" "}
        <a className="linkish" href="/">⟵ main menu</a>
      </p>
      {groups.map(([title, list]) => (
        <div key={title} className="panel" style={{ marginBottom: 14 }}>
          <h3>{title}</h3>
          {list.length === 0 && <p style={{ fontSize: 12, color: "var(--ink-soft)" }}>nothing mapped</p>}
          {list.map((e) => (
            <div key={e.cue} style={{ display: "flex", alignItems: "center", gap: 10, padding: "3px 0", fontSize: 13 }}>
              <button style={{ minWidth: 200, textAlign: "left" }} onClick={() => play(e.cue)}>▶ {e.cue}</button>
              <span style={{ color: "var(--ink-soft)", minWidth: 160 }}>{e.file}</span>
              {e.cue.startsWith("sfx.") ? (
                <>
                  <input
                    type="range" min={0} max={1} step={0.05}
                    value={vols[e.cue] ?? e.volume}
                    onChange={(ev) => setVols({ ...vols, [e.cue]: Number(ev.target.value) })}
                    onInput={() => audio.sfx(e.cue as SfxCue, vols[e.cue])}
                    style={{ width: 160 }}
                  />
                  <b style={{ minWidth: 44 }}>{(vols[e.cue] ?? e.volume).toFixed(2)}</b>
                  {vols[e.cue] !== undefined && vols[e.cue] !== e.volume && (
                    <span style={{ color: "var(--brass)", fontSize: 11.5 }}>mapping has {e.volume.toFixed(2)}</span>
                  )}
                </>
              ) : (
                <span style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>vol ×{e.volume.toFixed(2)}</span>
              )}
            </div>
          ))}
        </div>
      ))}
      <p style={{ fontSize: 12, color: "var(--ink-soft)" }}>
        Unmapped cue families (guild pairs <code>sfx.cast.WU</code>…, <code>sfx.cast.artifact</code>, <code>music.menu</code>…)
        do not appear here — map them and they will.
      </p>
    </div>
  );
}
