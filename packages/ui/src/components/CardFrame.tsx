import type { CardDef } from "@shandalar/cards";
import { frameColors, type OracleEntry } from "../engine-bridge";

const WASH: Record<string, string> = {
  W: "var(--mana-w)", U: "var(--mana-u)", B: "var(--mana-b)",
  R: "var(--mana-r)", G: "var(--mana-g)", C: "var(--mana-c)", LAND: "var(--wood)",
};
const LIGHT_TEXT = new Set(["U", "B", "R", "G", "LAND"]);

const MANA_ICON: Record<string, string> = {
  W: "mana-white", U: "mana-blue", B: "mana-black", R: "mana-red", G: "mana-green",
};

export function ManaCostRow({ cost }: { cost: string }) {
  const syms = [...cost.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]!);
  if (syms.length === 0) return null;
  return (
    <span className="mana-cost">
      {syms.map((s, i) =>
        MANA_ICON[s] ? (
          <img key={i} src={`/icons/${MANA_ICON[s]}.svg`} width={11} height={11} alt={s} style={{ mixBlendMode: "multiply" }} />
        ) : (
          <span key={i}>{s === "C" ? "◇" : s}</span>
        ),
      )}
    </span>
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
 * Our frame, for every card (art-direction §0): parchment body, ink border,
 * corner flourishes, color-identity wash band behind the name, art window
 * with the Scryfall art_crop (or an ink-glyph placeholder), P/T cartouche.
 */
export function CardFrame({
  def,
  oracle,
  mini,
  pt,
  showPrinted,
}: {
  def: CardDef;
  oracle?: OracleEntry | undefined;
  mini?: boolean;
  pt?: { power: number; toughness: number } | null;
  showPrinted?: boolean;
}) {
  if (showPrinted && oracle) {
    return <img src={`/real-art/${def.id}.full.jpg`} alt={def.name} style={{ width: 240, borderRadius: 12 }} />;
  }
  const colors = frameColors(def);
  const band =
    colors.length === 1
      ? WASH[colors[0]!]
      : `linear-gradient(90deg, ${colors.map((c) => WASH[c]).join(", ")})`;
  const light = colors.length === 1 && LIGHT_TEXT.has(colors[0]!);
  const isReal = def.source === "real";
  const isCreature = def.types.includes("Creature");
  const placeholderIcon = MANA_ICON[colors[0]!] ?? "mana-colorless";

  return (
    <div className={`frame${mini ? " mini" : ""}`}>
      <img className="corner" src="/frame-corner.png" style={{ left: 1, bottom: 1 }} alt="" />
      <img className="corner" src="/frame-corner.png" style={{ right: 1, bottom: 1, transform: "scaleX(-1)" }} alt="" />
      <img className="corner" src="/frame-corner.png" style={{ left: 1, top: 1, transform: "scaleY(-1)" }} alt="" />
      <img className="corner" src="/frame-corner.png" style={{ right: 1, top: 1, transform: "scale(-1)" }} alt="" />
      <div className="name-strip" style={{ background: band, color: light ? "var(--parchment)" : "var(--ink)" }}>
        <span>{def.name}</span>
        <ManaCostRow cost={def.manaCost} />
      </div>
      <div className="art-window">
        {isReal ? (
          <img src={`/real-art/${def.id}.art.jpg`} alt="" loading="lazy" />
        ) : (
          <img className="placeholder" src={`/icons/${placeholderIcon}.svg`} alt="" />
        )}
      </div>
      <div className="type-line">{oracle?.type_line ?? typeLine(def)}</div>
      <div className="oracle">{oracle?.oracle_text ?? derivedText(def)}</div>
      {isCreature && (
        <div className="pt-cartouche">
          {pt ? `${pt.power}/${pt.toughness}` : `${def.power}/${def.toughness}`}
        </div>
      )}
    </div>
  );
}
