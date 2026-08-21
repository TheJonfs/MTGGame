import { useEffect, useMemo, useState } from "react";
import type { CardDef, ResolvedTarget } from "@shandalar/cards";
import { STEPS, getObject, type PlayerId, type Step } from "@shandalar/engine";
import { Board } from "../components/Board";
import { Inspector, StackPanel, StatusBlock } from "../components/Rail";
import { CardFrame } from "../components/CardFrame";
import { actionLabel, cardName, stepLabel } from "../labels";
import type { OracleEntry } from "../engine-bridge";
import type { MatchController, UiPhase } from "./match-controller";

/**
 * The play screen (S10, ADR-058): Board + rail + prompt bar wired to the
 * MatchController. All legality flows from the controller's phases (which
 * flow from the enumerated actions); this file is presentation only.
 */

const STOPS_KEY = "shandalar-stops";
const DELAY_KEY = "shandalar-ai-delay";

export function loadStops(): Set<Step> {
  try {
    const raw = localStorage.getItem(STOPS_KEY);
    return raw ? new Set(JSON.parse(raw) as Step[]) : new Set();
  } catch {
    return new Set();
  }
}

function PromptBar({ c, phase }: { c: MatchController; phase: UiPhase }) {
  const [confirmingConcede, setConfirmingConcede] = useState(false);
  const [hold, setHold] = useState(false);

  const prompt = (() => {
    switch (phase.kind) {
      case "waiting":
        return "Opponent is thinking…";
      case "priority":
        return "You have priority.";
      case "chooseX":
        return "Choose X.";
      case "targeting":
        return `Choose a target (${phase.chosen.length + 1}/${phase.targetsNeeded}).`;
      case "confirmCast":
        return "Confirm?";
      case "attackers":
        return "Declare attackers: click creatures to stage, then confirm.";
      case "blockers":
        return phase.mustAddBlocker
          ? "A menace attacker needs a second blocker."
          : phase.pendingBlocker
            ? "Now click the attacker to block."
            : "Declare blockers: click a blocker, then an attacker.";
      case "dialog":
        return "Make a choice.";
      case "gameOver":
        return "Game over.";
    }
  })();

  return (
    <div className="transport play-prompt">
      <span className="prompt-text">{prompt}</span>
      {phase.kind === "priority" && (
        <button className="primary" onClick={() => c.pass()}>Pass</button>
      )}
      {phase.kind === "confirmCast" && (
        <>
          <button className="primary" onClick={() => c.confirmCast(hold)}>Confirm</button>
          <button onClick={() => c.cancel()}>Cancel</button>
          <label className="hold-toggle" title="Retain priority to respond to your own spell (ADR-058)">
            <input type="checkbox" checked={hold} onChange={(e) => setHold(e.target.checked)} /> hold priority
          </label>
        </>
      )}
      {(phase.kind === "targeting" || phase.kind === "chooseX") && (
        <button onClick={() => c.cancel()}>Cancel</button>
      )}
      {phase.kind === "attackers" && (
        <>
          <button className="primary" onClick={() => c.confirmAttackers()}>
            Confirm attackers ({phase.staged.size})
          </button>
          <button onClick={() => c.cancel()}>Clear</button>
        </>
      )}
      {phase.kind === "blockers" && (
        <>
          {!phase.mustAddBlocker && (
            <button className="primary" onClick={() => c.confirmBlocks()}>
              Confirm blocks ({phase.stagedPairs.length})
            </button>
          )}
          <button onClick={() => c.cancel()}>Clear</button>
        </>
      )}
      <span style={{ flex: 1 }} />
      {confirmingConcede ? (
        <>
          <span style={{ fontSize: 11 }}>Concede the game?</span>
          <button className="danger" onClick={() => { c.concede(); setConfirmingConcede(false); }}>Yes, concede</button>
          <button onClick={() => setConfirmingConcede(false)}>No</button>
        </>
      ) : (
        <button onClick={() => setConfirmingConcede(true)}>Concede</button>
      )}
    </div>
  );
}

function StopsFlyout({ c }: { c: MatchController }) {
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);
  const toggle = (s: Step) => {
    if (c.stops.has(s)) c.stops.delete(s);
    else c.stops.add(s);
    localStorage.setItem(STOPS_KEY, JSON.stringify([...c.stops]));
    force((n) => n + 1);
  };
  return (
    <span className="stops-flyout">
      <button className="linkish" onClick={() => setOpen(!open)}>stops ▾</button>
      {open && (
        <div className="flyout">
          <div className="flyout-title">Always stop at…</div>
          {STEPS.filter((s) => !["UNTAP", "CLEANUP"].includes(s)).map((s) => (
            <label key={s}>
              <input type="checkbox" checked={c.stops.has(s)} onChange={() => toggle(s)} /> {stepLabel(s)}
            </label>
          ))}
          <div className="flyout-title" style={{ marginTop: 6 }}>AI pacing</div>
          <label>
            delay{" "}
            <select
              value={c.aiDelayMs}
              onChange={(e) => {
                c.aiDelayMs = Number(e.target.value);
                localStorage.setItem(DELAY_KEY, e.target.value);
              }}
            >
              {[0, 200, 400, 800].map((ms) => <option key={ms} value={ms}>{ms}ms</option>)}
            </select>
          </label>
        </div>
      )}
    </span>
  );
}

function Ribbon({ c }: { c: MatchController }) {
  const state = c.game.state;
  const yourTurn = state.activePlayer === c.humanSeat;
  return (
    <div className="play-ribbon">
      <span className="turn">Turn {state.turn} · {stepLabel(state.step)}</span>
      <span className={yourTurn ? "who you" : "who"}>{yourTurn ? "Your turn" : "Opponent's turn"}</span>
      <span style={{ flex: 1 }} />
      <StopsFlyout c={c} />
      <span className="seed">seed {c.seed}</span>
    </div>
  );
}

function DialogModal({ c, phase, pool, oracle }: { c: MatchController; phase: Extract<UiPhase, { kind: "dialog" }>; pool: Map<string, CardDef>; oracle: Record<string, OracleEntry> }) {
  const req = phase.request;
  const state = c.game.state;
  const titles: Record<string, string> = {
    mulligan: "Keep this hand?",
    bottomCards: "Choose a card to put on the bottom",
    discard: "Choose a card to discard",
    chooseSacrifice: "Choose a permanent to sacrifice",
    legendRule: "Legend rule: choose which to keep",
    orderTriggers: "Choose which trigger goes on the stack next",
    orderBlockerDamage: "Choose which blocker takes damage next",
    optionalTrigger: "Use this ability?",
    chooseTarget: "Choose targets",
  };
  const sourceName = req.source ? cardName(pool, req.source.cardId) : null;
  // Render actions as cards where the choice is over cards (ADR-058).
  const cardOf = (a: (typeof req.actions)[number]): string | null => {
    if ("objectId" in a && typeof a.objectId === "string") {
      const obj = state.objects[a.objectId];
      return obj ? obj.cardId : null;
    }
    if (a.type === "orderTrigger") return a.cardId;
    return null;
  };
  const asCards = req.actions.every((a) => cardOf(a) !== null);
  return (
    <div className="gallery-modal">
      <div className="gallery-modal-box play-dialog">
        <h3 style={{ marginTop: 0, fontFamily: "var(--serif)" }}>
          {titles[req.purpose] ?? req.purpose}
          {sourceName ? <span style={{ fontWeight: 400 }}> — {sourceName}</span> : null}
        </h3>
        {req.revealed && (
          <div className="revealed-strip">
            <div className="flyout-title">Revealed:</div>
            <div className="dialog-cards">
              {req.revealed.map((r) => (
                <CardFrame key={r.objectId} def={pool.get(r.cardId)!} oracle={oracle[r.cardId]} mini />
              ))}
            </div>
          </div>
        )}
        <div className={asCards ? "dialog-cards" : "dialog-list"}>
          {req.actions.map((a, i) => {
            const cid = cardOf(a);
            const selected = phase.selected === i;
            return (
              <div
                key={i}
                className={`dialog-option ${selected ? "selected" : ""}`}
                onClick={() => c.selectDialog(i)}
              >
                {asCards && cid ? (
                  <CardFrame def={pool.get(cid)!} oracle={oracle[cid]} mini hand />
                ) : (
                  <span>{actionLabel(state, pool, a)}</span>
                )}
                {asCards && <div className="dialog-caption">{actionLabel(state, pool, a)}</div>}
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 8, textAlign: "right" }}>
          <button className="primary" disabled={phase.selected === null} onClick={() => c.confirmDialog()}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

function XModal({ c, phase }: { c: MatchController; phase: Extract<UiPhase, { kind: "chooseX" }> }) {
  return (
    <div className="gallery-modal">
      <div className="gallery-modal-box play-dialog">
        <h3 style={{ marginTop: 0, fontFamily: "var(--serif)" }}>Choose X</h3>
        <div className="dialog-list" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {phase.xs.map((x) => (
            <button key={x} onClick={() => c.chooseX(x)}>X = {x}</button>
          ))}
        </div>
        <div style={{ marginTop: 8, textAlign: "right" }}>
          <button onClick={() => c.cancel()}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function ZoneModal({ c, pool, oracle, zone, onClose }: { c: MatchController; pool: Map<string, CardDef>; oracle: Record<string, OracleEntry>; zone: { player: PlayerId; zone: "graveyard" | "exile" }; onClose: () => void }) {
  const state = c.game.state;
  const ids = state.players[zone.player][zone.zone];
  const who = zone.player === c.humanSeat ? "Your" : "Opponent's";
  return (
    <div className="gallery-modal" onClick={onClose}>
      <div className="gallery-modal-box play-dialog" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0, fontFamily: "var(--serif)" }}>
          {who} {zone.zone} ({ids.length})
          <button className="linkish" onClick={onClose}>close</button>
        </h3>
        <div className="dialog-cards">
          {ids.length === 0 && <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>empty</span>}
          {ids.map((id) => {
            const obj = getObject(state, id);
            return <CardFrame key={id} def={pool.get(obj.cardId)!} oracle={oracle[obj.cardId]} mini />;
          })}
        </div>
      </div>
    </div>
  );
}

export function PlayMatch({
  c,
  pool,
  oracle,
  onGameOver,
}: {
  c: MatchController;
  pool: Map<string, CardDef>;
  oracle: Record<string, OracleEntry>;
  onGameOver: () => void;
}) {
  const [, force] = useState(0);
  const [inspected, setInspected] = useState<string | null>(null);
  const [printed, setPrinted] = useState(false);
  const [zoneOpen, setZoneOpen] = useState<{ player: PlayerId; zone: "graveyard" | "exile" } | null>(null);

  useEffect(() => c.onChange(() => force((n) => n + 1)), [c]);
  useEffect(() => {
    if (c.phase.kind === "gameOver") onGameOver();
  });

  const ctx = c.game.ctx;
  const phase = c.phase;
  const opp = (c.humanSeat === 0 ? 1 : 0) as PlayerId;

  const classFor = useMemo(() => {
    return (id: string): string => {
      switch (phase.kind) {
        case "priority":
          if (phase.castable.has(id) || phase.lands.has(id)) return "castable";
          if (phase.activatable.has(id)) return "castable";
          return "";
        case "targeting":
          return phase.highlightObjects.has(id) ? "target" : "dim";
        case "attackers":
          if (phase.staged.has(id)) return "staged";
          return phase.eligible.has(id) ? "castable" : "";
        case "blockers": {
          if (phase.stagedPairs.some((p) => p.blocker === id)) return "staged";
          if (phase.pendingBlocker === id) return "pending";
          if (phase.pendingBlocker) return phase.options.get(phase.pendingBlocker)?.has(id) ? "target" : "";
          return phase.options.has(id) ? "castable" : "";
        }
        default:
          return "";
      }
    };
  }, [phase]);

  return (
    <div className="app play-app">
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Ribbon c={c} />
        <Board
          ctx={ctx}
          oracle={oracle}
          revealOpponent={false}
          onHover={setInspected}
          onClick={(id) => {
            const obj = ctx.state.objects[id];
            if (obj?.zone === "hand") c.clickHand(id);
            else c.clickBattlefield(id);
          }}
          selected={inspected}
          bottomSeat={c.humanSeat}
          classFor={classFor}
        />
        <PromptBar c={c} phase={phase} />
      </div>
      <div className="rail">
        <div
          onClick={() => { if (phase.kind === "targeting" && phase.highlightPlayers.has(opp)) c.clickPlayer(opp); }}
          className={phase.kind === "targeting" && phase.highlightPlayers.has(opp) ? "player-target" : ""}
        >
          <StatusBlock ctx={ctx} player={opp} youSeat={c.humanSeat} onZoneClick={(player, zone) => setZoneOpen({ player, zone })} />
        </div>
        <StackPanel ctx={ctx} />
        <div
          onClick={() => { if (phase.kind === "targeting" && phase.highlightPlayers.has(c.humanSeat)) c.clickPlayer(c.humanSeat); }}
          className={phase.kind === "targeting" && phase.highlightPlayers.has(c.humanSeat) ? "player-target" : ""}
        >
          <StatusBlock ctx={ctx} player={c.humanSeat} youSeat={c.humanSeat} onZoneClick={(player, zone) => setZoneOpen({ player, zone })} />
        </div>
        <Inspector ctx={ctx} objectId={inspected} oracle={oracle} printed={printed} onTogglePrinted={() => setPrinted(!printed)} />
      </div>
      {phase.kind === "dialog" && <DialogModal c={c} phase={phase} pool={pool} oracle={oracle} />}
      {phase.kind === "chooseX" && <XModal c={c} phase={phase} />}
      {zoneOpen && <ZoneModal c={c} pool={pool} oracle={oracle} zone={zoneOpen} onClose={() => setZoneOpen(null)} />}
    </div>
  );
}
