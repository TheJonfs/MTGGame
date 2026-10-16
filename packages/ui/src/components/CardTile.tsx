import { characteristics, characteristicsTrace, type EngineCtx, type GameObject } from "@shandalar/engine";
import { inPlayLines } from "./in-play";

/** Battlefield presentation (art-direction §3): art crop, name strip, live P/T badge. */
export function CardTile({
  ctx,
  obj,
  small,
  onHover,
  onClick,
  selected,
  extraClass,
  controller,
}: {
  ctx: EngineCtx;
  obj: GameObject;
  small?: boolean;
  selected?: boolean;
  onHover?: (id: string) => void;
  onClick?: (id: string) => void;
  /** Play-mode interaction states (castable / target / staged / dimmed …). */
  extraClass?: string | undefined;
  /** S18: whose permanent this is, relative to the seated player — a brass (yours) / slate (theirs)
   * stripe so a stolen creature or an enemy aura on your creature reads at a glance. */
  controller?: "you" | "them";
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
    controller ? `ctl-${controller}` : "",
    extraClass ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  // S65 (Chris: a gained keyword showed nowhere): the keywords gained and lost against the printed card, as glyphs —
  // green gained, red lost (the P/T badge's colours); the printed ones stay off the tile.
  const kwTrace = obj.zone === "battlefield" ? characteristicsTrace(ctx, obj.id) : null;
  const kwSource = (k: string) => { const c = kwTrace?.contributions.find((x) => x.what === "keyword" && x.keyword === k); return c?.sourceCardId ? ` (${ctx.defs.def(c.sourceCardId).name})` : ""; };
  const kwFile = (k: string) => `/icons/kw-${k.replace(/ /g, "-")}.svg`;
  const plus = obj.counters["+1/+1"] ?? 0;
  const minus = obj.counters["-1/-1"] ?? 0;

  return (
    <div
      className={classes}
      onMouseEnter={() => onHover?.(obj.id)}
      onClick={() => onClick?.(obj.id)}
      title={[def.name, ...inPlayLines(ctx, obj.id).map((l) => l.text)].join("\n")} // S65: the changes against the printed card, under the name
    >
      {def.source === "real" && !def.art?.asset ? (
        // Tile-size derivative (art-tiles.py): prefiltered downscale kills the
        // halftone moire the browser's own resize produces at this size.
        <img
          className="art"
          src={`/real-art/${obj.cardId}.tile.jpg`}
          onError={(e) => { (e.target as HTMLImageElement).src = `/real-art/${obj.cardId}.art.jpg`; }}
          alt=""
          loading="lazy"
        />
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
        {Object.entries(obj.counters)
          .filter(([k, n]) => k !== "+1/+1" && k !== "-1/-1" && n > 0)
          .map(([k, n]) => (
            // S26: named counters (Clio's depth) — a text pip; the kind is the word on the card.
            <span key={k} className="counter-pip" title={`${k} counter x${n}`}>{k} {n}</span>
          ))}
        {kwTrace?.gained.map((k) => <img key={`g-${k}`} className="kw gained" src={kwFile(k)} alt={`gained ${k}`} title={`Gained: ${k}${kwSource(k)}`} />)}
        {kwTrace?.lost.map((k) => <span key={`l-${k}`} className="kw-lost" title={`Lost: ${k}`}><img className="kw lost" src={kwFile(k)} alt={`lost ${k}`} /></span>)}
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
