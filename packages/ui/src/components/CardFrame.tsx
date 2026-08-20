import type { CardDef } from "@shandalar/cards";
import { frameColors, type OracleEntry } from "../engine-bridge";

/** S7 feedback round: deep saturated 1993–97-style body colors for the frame. */
const BODY: Record<string, string> = {
  W: "var(--frame-w)", U: "var(--frame-u)", B: "var(--frame-b)",
  R: "var(--frame-r)", G: "var(--frame-g)", C: "var(--frame-c)", LAND: "var(--frame-land)",
};
/** Round 2: rendered per-color body textures (marble/water/crackle/stone/wood/gold). */
const BODY_TEX: Record<string, string> = {
  W: "w", U: "u", B: "b", R: "r", G: "g", C: "c", LAND: "land",
};
/** Rounds 4–5: R then LAND dropped — those textures are light enough up top
 * that ink names read better there, matching white (Chris-directed). */
const LIGHT_TEXT = new Set(["U", "B", "G"]);

const MANA_ICON: Record<string, string> = {
  W: "mana-white", U: "mana-blue", B: "mana-black", R: "mana-red", G: "mana-green",
  C: "mana-colorless", T: "status-tapped",
};
/** Bold-stroke chip variants of the glyphs (round 3): the traced outlines
 * vanish at chip size, so chips use fattened copies of the same paths. */
const CHIP_ICON: Record<string, string> = {
  W: "chip-w", U: "chip-u", B: "chip-b", R: "chip-r", G: "chip-g",
  C: "chip-c", T: "chip-t",
};

/** Real-mana-symbol coloration (S7 feedback round 2): the classic pale
 * saturated disc colors under a black symbol. The five images are WotC's;
 * these are just colors. Generic/X/tap ride the neutral gray. */
const CHIP_BG: Record<string, string> = {
  W: "#fffbd5", U: "#aae0fa", B: "#cbc2bf", R: "#f9aa8f", G: "#9bd3ae",
};
const CHIP_NEUTRAL = "#cac5c0";

/** One mana/tap symbol as a high-contrast chip: colored disc, bold ink symbol, ink ring. */
export function ManaChip({ sym }: { sym: string }) {
  const icon = CHIP_ICON[sym];
  return (
    <span className="mana-chip" style={{ background: CHIP_BG[sym] ?? CHIP_NEUTRAL }}>
      {icon ? <img src={`/icons/${icon}.svg`} alt={sym} /> : <span>{sym}</span>}
    </span>
  );
}

export function ManaCostRow({ cost }: { cost: string }) {
  const syms = [...cost.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]!);
  if (syms.length === 0) return null;
  return (
    <span className="mana-cost">
      {syms.map((s, i) => <ManaChip key={i} sym={s} />)}
    </span>
  );
}

/** Rules text with {W}{2}{T}-style symbols rendered as chips. */
export function TextWithMana({ text }: { text: string }) {
  const parts = text.split(/(\{[^}]+\})/g);
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^\{([^}]+)\}$/);
        return m ? <ManaChip key={i} sym={m[1]!} /> : <span key={i}>{p}</span>;
      })}
    </>
  );
}

/** Vocabulary-derived rules text for cards with no oracle entry (customs, tokens). */
function derivedText(def: CardDef): string {
  const bits: string[] = [];
  if (def.keywords?.length) bits.push(def.keywords.join(", "));
  if (def.isTokenDef) bits.push("Token creature.");
  return bits.join("\n");
}

function typeLine(def: CardDef): string {
  const supers = def.supertypes?.length ? def.supertypes.join(" ") + " " : "";
  const subs = def.subtypes?.length ? ` — ${def.subtypes.join(" ")}` : "";
  return `${supers}${def.types.join(" ")}${subs}`;
}

/**
 * Our frame, for every card (art-direction §0, amended by the S7 feedback
 * round): deep saturated color-identity body in the 1993–97 spirit (gold for
 * multicolor), parchment panels tinted with the body color, ink borders,
 * corner flourishes, 5:4 art window (the classic printed art box — no more
 * top/bottom cropping of art_crop), mana symbols as high-contrast chips.
 * The full (non-mini) frame keeps real-card proportions (63:88) with the
 * P/T cartouche on the text box's lower-right corner, clear of the text.
 * Mini/hand frames stay compressed (ADR-043).
 */
export function CardFrame({
  def,
  oracle,
  mini,
  pt,
  showPrinted,
  hand,
}: {
  def: CardDef;
  oracle?: OracleEntry | undefined;
  mini?: boolean;
  pt?: { power: number; toughness: number } | null;
  showPrinted?: boolean;
  /** ADR-043 hand variant: name/art/cost/P&T only — no type line, no oracle text. */
  hand?: boolean;
}) {
  if (showPrinted && oracle) {
    return <img className="printed-scan" src={`/real-art/${def.id}.full.jpg`} alt={def.name} />;
  }
  const colors = frameColors(def);
  const body = colors.length === 1 ? BODY[colors[0]!] : "var(--frame-gold)";
  const bodyTex = colors.length === 1 ? BODY_TEX[colors[0]!] : "gold";
  const light = colors.length === 1 && LIGHT_TEXT.has(colors[0]!);
  const isReal = def.source === "real";
  const isCreature = def.types.includes("Creature");
  const placeholderIcon = MANA_ICON[colors[0] === "LAND" ? "C" : colors[0]!] ?? "mana-colorless";
  const tint = colors.length === 1 ? BODY[colors[0]!] : "var(--frame-gold)";

  return (
    <div
      className={`frame${mini ? " mini" : " full"}${hand ? " hand" : ""}`}
      style={{
        background: `url(/frame-tex/frame-${bodyTex}.jpg) ${body}`,
        backgroundSize: "280px",
        ["--frame-tint" as string]: tint,
      }}
    >
      <img className="corner" src="/frame-corner.png" style={{ left: 1, bottom: 1 }} alt="" />
      <img className="corner" src="/frame-corner.png" style={{ right: 1, bottom: 1, transform: "scaleX(-1)" }} alt="" />
      <img className="corner" src="/frame-corner.png" style={{ left: 1, top: 1, transform: "scaleY(-1)" }} alt="" />
      <img className="corner" src="/frame-corner.png" style={{ right: 1, top: 1, transform: "scale(-1)" }} alt="" />
      {/* Round 3: the name sits directly on the textured frame body (classic design). */}
      <div
        className="name-strip"
        style={{
          color: light ? "var(--parchment)" : "var(--ink)",
          textShadow: light ? "0 1px 2px rgba(20,16,12,0.75)" : "0 1px 1px rgba(255,250,235,0.6)",
        }}
      >
        <span>{def.name}</span>
        <ManaCostRow cost={def.manaCost} />
      </div>
      <div className="art-window">
        {isReal ? (
          <img src={`/real-art/${def.id}.art.jpg`} alt="" loading="lazy" />
        ) : def.art?.asset ? (
          <img src={def.art.asset} alt="" loading="lazy" />
        ) : (
          <img className="placeholder" src={`/icons/${placeholderIcon}.svg`} alt="" />
        )}
      </div>
      {!hand && <div className="type-line">{oracle?.type_line ?? typeLine(def)}</div>}
      {!hand && (
        <div className="oracle">
          {/* ADR-053: customs carry their own rules text; real cards use oracle.json. */}
          <TextWithMana text={oracle?.oracle_text ?? (def.text || derivedText(def))} />
        </div>
      )}
      {isCreature && (
        <div className="pt-cartouche">
          {pt ? `${pt.power}/${pt.toughness}` : `${def.power}/${def.toughness}`}
        </div>
      )}
    </div>
  );
}
