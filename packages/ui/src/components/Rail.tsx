import { MANA_SYMBOLS } from "@shandalar/cards";
import { characteristics, getObject, type EngineCtx, type PlayerId } from "@shandalar/engine";
import type { DecisionPoint } from "@shandalar/engine";
import { actionLabel, cardName, targetLabel } from "../labels";
import type { OracleEntry } from "../engine-bridge";
import { CardFrame } from "./CardFrame";

/** S11 round 4: panel icons on an ivory chip. The glyph is a CSS MASK over
 * solid ink (no <img>, no blur): five copies of the mask offset ±0.5px union
 * into a crisp, evenly dilated stroke that stays centered. Weight knob:
 * `--glyph-dilate` in theme.css. */
/** Bump when an icon file changes — mask images are cached hard by browsers
 * (S11 round 4: the re-centred viewBoxes didn't show until the URL changed). */
const ICON_VERSION = "s11c";

function IconChip({ src, alt, size = 24, scale = 0.8 }: { src: string; alt: string; size?: number; scale?: number }) {
  return (
    <span className="icon-chip" style={{ width: size, height: size }} role="img" aria-label={alt} title={alt}>
      <i className="glyph" style={{ "--icon": `url(${src}?v=${ICON_VERSION})`, width: `${scale * 100}%`, height: `${scale * 100}%` } as React.CSSProperties} />
    </span>
  );
}

const MANA_ICON: Record<string, string> = {
  W: "mana-white", U: "mana-blue", B: "mana-black", R: "mana-red", G: "mana-green", C: "mana-colorless",
};

export function StatusBlock({
  ctx,
  player,
  youSeat = 0,
  onZoneClick,
  emphasizeHand = false,
  name,
  portraitSrc,
}: {
  ctx: EngineCtx;
  player: PlayerId;
  /** Which seat is "You" (play mode may seat the human as player 1). */
  youSeat?: PlayerId;
  /** Play mode: open a zone browser (graveyard/exile are public). */
  onZoneClick?: (player: PlayerId, zone: "graveyard" | "exile") => void;
  /** S11 (note 4): the opponent's hand is no longer drawn on the board — the
   * count here is its only display, so make it read at a glance. */
  emphasizeHand?: boolean;
  /** S13: world duels name the enemy and show their portrait. */
  name?: string;
  portraitSrc?: string | null;
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
  const zoneLabel: Record<string, string> = { "zone-library": "library", "zone-graveyard": "graveyard", "zone-exile": "exile" };
  // S11 round 4 (Chris): portrait | name / life / hand | a roomier column for
  // library / graveyard / exile on the right — bigger figures, lighter glyphs.
  return (
    <div className="panel">
      <div className="status-block">
        <img className="portrait" src={portraitSrc ?? (you ? "/portrait-you.png" : "/portrait-opponent.png")} alt="" />
        <div className="status-main">
          <div className="who">
            {name ?? (you ? "You" : "Opponent")}
            {ctx.state.activePlayer === player ? " · active" : ""}
          </div>
          <div className="life">
            <IconChip src="/icons/stat-life.svg" alt="life" size={34} scale={0.86} />
            {p.life}
          </div>
          <div className={`hand-line${emphasizeHand ? " emph" : ""}`}>
            <IconChip src="/icons/zone-hand.svg" alt="cards in hand" size={emphasizeHand ? 32 : 26} scale={0.82} />
            {p.hand.length}
            {pool.length > 0 && (
              <span className="mana-pool">
                {pool.flatMap((s) => Array.from({ length: p.manaPool[s] }, (_, i) => (
                  <img key={`${s}${i}`} src={`/icons/${MANA_ICON[s]}.svg`} alt={s} />
                )))}
              </span>
            )}
          </div>
        </div>
        <div className="status-zones">
          {zones.filter(([icon]) => icon !== "zone-hand").map(([icon, n]) => {
            const zone = icon === "zone-graveyard" ? "graveyard" : icon === "zone-exile" ? "exile" : null;
            const clickable = !!(zone && onZoneClick);
            return (
              <div
                key={icon}
                className={`zone${clickable ? " clickable" : ""}`}
                onClick={clickable ? () => onZoneClick!(player, zone!) : undefined}
                title={zoneLabel[icon]}
              >
                <IconChip src={`/icons/${icon}.svg`} alt={zoneLabel[icon] ?? icon} size={30} scale={icon === "zone-exile" ? 0.66 : 0.8} />
                <span className="count">{n}</span>
              </div>
            );
          })}
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
        <h3><IconChip src="/icons/zone-stack.svg" alt="" size={22} />Stack</h3>
        <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>empty</div>
      </div>
    );
  }
  const defsPool = new Map(state.stack.map((s) => [s.sourceCardId, ctx.defs.def(s.sourceCardId)] as const));
  return (
    <div className="panel stack-panel">
      <h3><IconChip src="/icons/zone-stack.svg" alt="" size={22} />Stack (top resolves first)</h3>
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
  fallbackCardId,
  oracle,
  printed,
  onTogglePrinted,
}: {
  ctx: EngineCtx;
  objectId: string | null;
  /** Play mode: a cardId to show when no object is hovered (stack snap). */
  fallbackCardId?: string | null;
  oracle: Record<string, OracleEntry>;
  printed: boolean;
  onTogglePrinted: () => void;
}) {
  const obj = objectId ? ctx.state.objects[objectId] : undefined;
  const fallbackDef = !obj && fallbackCardId ? ctx.defs.def(fallbackCardId) : undefined;
  return (
    <div className="panel">
      <h3>
        <IconChip src="/icons/ui-inspect.svg" alt="" size={22} />
        Inspector
        {(obj ? ctx.defs.def(obj.cardId).source === "real" : fallbackDef?.source === "real") && (
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
      ) : fallbackDef ? (
        <div style={{ display: "flex", justifyContent: "center" }}>
          <CardFrame def={fallbackDef} oracle={oracle[fallbackDef.id]} showPrinted={printed} />
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
