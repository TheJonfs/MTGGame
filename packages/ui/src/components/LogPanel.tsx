import { Fragment } from "react";
import type { CardDef } from "@shandalar/cards";
import type { SavedGame } from "../engine-bridge";
import { eventLabel, stepLabel } from "../labels";

interface Line {
  kind: "action" | "event" | "stephead";
  text: string;
  /** Decision index this line seeks to. */
  index: number;
}

export function buildLogLines(game: SavedGame, poolMap: Map<string, CardDef>): Line[] {
  const lines: Line[] = [];
  let actionIndex = -1;
  let lastKey = "";
  for (const entry of game.log) {
    if (entry.t === "ACTION") {
      actionIndex += 1;
      const key = `${entry.turn}:${entry.step}`;
      if (key !== lastKey) {
        lastKey = key;
        lines.push({ kind: "stephead", text: `Turn ${entry.turn} — ${stepLabel(entry.step)}`, index: actionIndex });
      }
      const who = entry.player === 0 ? "You" : "Opp";
      lines.push({ kind: "action", text: `${who}: ${summarize(entry.action)}`, index: actionIndex });
    } else if (entry.t === "EVENT") {
      const text = eventLabel(poolMap, entry.name, entry.payload as Record<string, unknown>);
      if (text) lines.push({ kind: "event", text, index: (entry.afterAction ?? -1) + 1 });
    }
  }
  return lines;

  function summarize(action: unknown): string {
    const a = action as { type: string; objectId?: string; x?: number };
    // Object ids are stale across states; keep log lines structural and let
    // the decision panel do the pretty naming for the current index.
    switch (a.type) {
      case "pass": return "pass";
      case "doneDeclaringAttackers": return "done declaring attackers";
      case "doneDeclaringBlockers": return "done declaring blockers";
      case "mulligan": return "mulligan";
      case "keepHand": return "keep hand";
      case "castSpell": return `cast${a.x !== undefined ? ` X=${a.x}` : ""}`;
      case "activateAbility": return "activate ability";
      case "tapForMana": return "tap for mana";
      case "playLand": return "play land";
      case "declareAttacker": return "declare attacker";
      case "declareBlocker": return "declare blocker";
      default: return a.type;
    }
  }
}

export function LogPanel({
  lines,
  current,
  onSeek,
}: {
  lines: Line[];
  current: number;
  onSeek: (i: number) => void;
}) {
  return (
    <div className="panel">
      <h3>Play-by-play</h3>
      <div className="log-panel">
        {lines.map((l, i) => (
          <Fragment key={i}>
            {l.kind === "stephead" ? (
              <div className="stephead">{l.text}</div>
            ) : (
              <div
                className={`line ${l.kind}${l.kind === "action" && l.index === current ? " current" : ""}`}
                onClick={() => onSeek(l.index)}
              >
                {l.text}
              </div>
            )}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
