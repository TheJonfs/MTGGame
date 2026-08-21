import { MANA_SYMBOLS } from "@shandalar/cards";
import { characteristics, getObject, type EngineCtx, type PlayerId } from "@shandalar/engine";
import type { DecisionPoint } from "@shandalar/engine";
import { actionLabel, cardName, targetLabel } from "../labels";
import type { OracleEntry } from "../engine-bridge";
import { CardFrame } from "./CardFrame";

const MANA_ICON: Record<string, string> = {
  W: "mana-white", U: "mana-blue", B: "mana-black", R: "mana-red", G: "mana-green", C: "mana-colorless",
};

export function StatusBlock({
  ctx,
  player,
  youSeat = 0,
  onZoneClick,
}: {
  ctx: EngineCtx;
  player: PlayerId;
  /** Which seat is "You" (play mode may seat the human as player 1). */
  youSeat?: PlayerId;
  /** Play mode: open a zone browser (graveyard/exile are public). */
  onZoneClick?: (player: PlayerId, zone: "graveyard" | "exile") => void;
}) {
  const p = ctx.state.players[player];
  const you = player === youSeat;
  const zones: [string, number][] = [
    ["zone-hand", p.hand.length],
    ["zone-library", p.library.length],
    ["zone-graveyard", p.graveyard.length],
    ["zone-exile", p.exile.length],
  ];
  const pool = MANA_SYMBOLS.filter((s) => p.manaPool[s] > 0);
  return (
    <div className="panel">
      <div className="status-block">
        <img className="portrait" src={you ? "/portrait-you.png" : "/portrait-opponent.png"} alt="" />
        <div>
          <div style={{ fontFamily: "var(--serif)", fontWeight: 700 }}>
            {you ? "You" : "Opponent"}
            {ctx.state.activePlayer === player ? " · active" : ""}
          </div>
          <div className="life">
            <img src="/icons/stat-life.svg" width={17} height={17} style={{ mixBlendMode: "multiply" }} alt="life" />
            {p.life}
          </div>
          <div className="zones">
            {zones.map(([icon, n]) => {
              const zone = icon === "zone-graveyard" ? "graveyard" : icon === "zone-exile" ? "exile" : null;
              return (
                <span
                  key={icon}
                  onClick={zone && onZoneClick ? () => onZoneClick(player, zone) : undefined}
                  style={zone && onZoneClick ? { cursor: "pointer", textDecoration: "underline dotted" } : undefined}
                >
                  <img src={`/icons/${icon}.svg`} alt={icon} /> {n}
                </span>
              );
            })}
            {pool.length > 0 && (
              <span className="mana-pool">
                {pool.flatMap((s) => Array.from({ length: p.manaPool[s] }, (_, i) => (
                  <img key={`${s}${i}`} src={`/icons/${MANA_ICON[s]}.svg`} alt={s} />
                )))}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function StackPanel({ ctx }: { ctx: EngineCtx }) {
  const { state } = ctx;
  if (state.stack.length === 0) {
    return (
      <div className="panel stack-panel">
        <h3><img src="/icons/zone-stack.svg" width={15} style={{ mixBlendMode: "multiply" }} alt="" />Stack</h3>
        <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>empty</div>
      </div>
    );
  }
  const defsPool = new Map(state.stack.map((s) => [s.sourceCardId, ctx.defs.def(s.sourceCardId)] as const));
  return (
    <div className="panel stack-panel">
      <h3><img src="/icons/zone-stack.svg" width={15} style={{ mixBlendMode: "multiply" }} alt="" />Stack (top resolves first)</h3>
      {[...state.stack].reverse().map((item) => (
        <div className="item" key={item.id}>
          <div>
            {defsPool.get(item.sourceCardId)?.name ?? item.sourceCardId}
            <span style={{ color: "var(--ink-soft)" }}> · {item.kind}{item.x ? ` (X=${item.x})` : ""}</span>
          </div>
          {item.targets.length > 0 && (
            <div className="targets">
              → {item.targets.map((t) => targetLabel(state, defsPool as Map<string, import("@shandalar/cards").CardDef>, t)).join(", ")}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function DecisionPanel({ ctx, point, poolMap }: { ctx: EngineCtx; point: DecisionPoint; poolMap: Map<string, import("@shandalar/cards").CardDef> }) {
  if (!point.request) {
    return (
      <div className="panel decision">
        <h3>Decision</h3>
        <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>
          {point.gameOver ? "Game over." : "No decision at this point."}
        </div>
      </div>
    );
  }
  const req = point.request;
  const alts = req.actions.filter((a) => JSON.stringify(a) !== JSON.stringify(point.taken));
  return (
    <div className="panel decision">
      <h3>Decision</h3>
      <div className="who">
        {req.player === 0 ? "You" : "Opponent"} · {req.purpose}
        {req.revealed ? ` · revealed: ${req.revealed.map((r) => cardName(poolMap, r.cardId)).join(", ")}` : ""}
      </div>
      {point.taken && <div className="taken">▸ {actionLabel(ctx.state, poolMap, point.taken)}</div>}
      <div style={{ fontSize: 10, color: "var(--ink-soft)", margin: "4px 0 2px" }}>
        {alts.length} legal alternative{alts.length === 1 ? "" : "s"}:
      </div>
      <div style={{ maxHeight: 130, overflowY: "auto" }}>
        {alts.slice(0, 40).map((a, i) => (
          <div className="alt" key={i}>{actionLabel(ctx.state, poolMap, a)}</div>
        ))}
        {alts.length > 40 && <div className="alt">…and {alts.length - 40} more</div>}
      </div>
    </div>
  );
}

export function Inspector({
  ctx,
  objectId,
  oracle,
  printed,
  onTogglePrinted,
}: {
  ctx: EngineCtx;
  objectId: string | null;
  oracle: Record<string, OracleEntry>;
  printed: boolean;
  onTogglePrinted: () => void;
}) {
  const obj = objectId ? ctx.state.objects[objectId] : undefined;
  return (
    <div className="panel">
      <h3>
        <img src="/icons/ui-inspect.svg" width={15} style={{ mixBlendMode: "multiply" }} alt="" />
        Inspector
        {obj && ctx.defs.def(obj.cardId).source === "real" && (
          <button className="linkish" onClick={onTogglePrinted}>{printed ? "our frame" : "printed card"}</button>
        )}
      </h3>
      {obj ? (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <CardFrame
            def={ctx.defs.def(obj.cardId)}
            oracle={oracle[obj.cardId]}
            showPrinted={printed}
            pt={
              ctx.defs.def(obj.cardId).types.includes("Creature") && obj.zone === "battlefield"
                ? characteristics(ctx, obj.id)
                : null
            }
          />
        </div>
      ) : (
        <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>Hover a card; click to pin.</div>
      )}
    </div>
  );
}

export function Rail(props: {
  ctx: EngineCtx;
  point: DecisionPoint;
  poolMap: Map<string, import("@shandalar/cards").CardDef>;
  oracle: Record<string, OracleEntry>;
  inspected: string | null;
  printed: boolean;
  onTogglePrinted: () => void;
  logTab: React.ReactNode;
}) {
  const { ctx } = props;
  return (
    <div className="rail">
      <StatusBlock ctx={ctx} player={1} />
      <StackPanel ctx={ctx} />
      <DecisionPanel ctx={ctx} point={props.point} poolMap={props.poolMap} />
      <StatusBlock ctx={ctx} player={0} />
      <Inspector ctx={ctx} objectId={props.inspected} oracle={props.oracle} printed={props.printed} onTogglePrinted={props.onTogglePrinted} />
      {props.logTab}
    </div>
  );
}
