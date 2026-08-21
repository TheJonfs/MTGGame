import { characteristics, type EngineCtx, type GameObject } from "@shandalar/engine";

/** Battlefield presentation (art-direction §3): art crop, name strip, live P/T badge. */
export function CardTile({
  ctx,
  obj,
  small,
  onHover,
  onClick,
  selected,
  extraClass,
}: {
  ctx: EngineCtx;
  obj: GameObject;
  small?: boolean;
  selected?: boolean;
  onHover?: (id: string) => void;
  onClick?: (id: string) => void;
  /** Play-mode interaction states (castable / target / staged / dimmed …). */
  extraClass?: string | undefined;
}) {
  const def = ctx.defs.def(obj.cardId);
  const isCreature = def.types.includes("Creature");
  const chars = isCreature ? characteristics(ctx, obj.id) : null;
  const printedP = def.power ?? 0;
  const printedT = def.toughness ?? 0;
  const delta = chars ? chars.power + chars.toughness - printedP - printedT : 0;
  const classes = [
    "tile",
    small ? "small" : "",
    obj.tapped ? "tapped" : "",
    obj.summoningSick && isCreature ? "sick" : "",
    selected ? "selected" : "",
    extraClass ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const plus = obj.counters["+1/+1"] ?? 0;
  const minus = obj.counters["-1/-1"] ?? 0;

  return (
    <div
      className={classes}
      onMouseEnter={() => onHover?.(obj.id)}
      onClick={() => onClick?.(obj.id)}
      title={def.name}
    >
      {def.source === "real" ? (
        <img className="art" src={`/real-art/${obj.cardId}.art.jpg`} alt="" loading="lazy" />
      ) : def.art?.asset ? (
        <img className="art" src={def.art.asset} alt="" loading="lazy" />
      ) : (
        <div className="art" style={{ display: "grid", placeItems: "center", height: small ? 38 : 52 }}>
          <img src={`/icons/${def.types.includes("Land") ? "mana-colorless" : "zone-hand"}.svg`} width={22} alt="" style={{ mixBlendMode: "multiply" }} />
        </div>
      )}
      <div className="badges">
        {obj.summoningSick && isCreature && <img src="/icons/status-sick.svg" alt="summoning sick" />}
        {plus > 0 && <img src="/icons/counter-plus.svg" alt={`+1/+1 x${plus}`} />}
        {minus > 0 && <img src="/icons/counter-minus.svg" alt={`-1/-1 x${minus}`} />}
      </div>
      <div className="name">{def.name}</div>
      {chars && (
        <div className={`pt ${delta > 0 ? "boosted" : delta < 0 ? "reduced" : ""}`}>
          {chars.power}/{chars.toughness}
          {obj.damage > 0 ? `·${obj.damage}` : ""}
        </div>
      )}
    </div>
  );
}
