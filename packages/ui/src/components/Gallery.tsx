import { useEffect, useMemo, useState } from "react";
import { cardColors, type CardDef } from "@shandalar/cards";
import { DECKS, type DeckKey } from "@shandalar/sim/decks";
import { loadOracle, loadPool, type OracleEntry } from "../engine-bridge";
import { CardFrame } from "./CardFrame";

/**
 * Card gallery (ADR-046, S7 brief Part 2): every pool card in our frame,
 * captioned from the Scryfall printings data, filterable, with a per-card
 * art-note flow into docs/art/art-notes.md and the ADR-043 size-comparison
 * strip. The pool registry is the source of truth for membership and
 * session batches (served by the dev endpoint /__registry).
 */

interface RegistryRow {
  batch: string; // "S1".."S5"
  status: string; // planned | implemented | tested | cut
}

/** Parse the "## Session N ..." tables out of pool-registry.md. */
function parseRegistry(md: string): Map<string, RegistryRow> {
  const rows = new Map<string, RegistryRow>();
  let batch: string | null = null;
  for (const line of md.split("\n")) {
    const h = line.match(/^## Session (\d+)/);
    if (h) {
      batch = `S${h[1]}`;
      continue;
    }
    if (line.startsWith("## ")) {
      batch = null; // ceiling anchors / decklists / test-only / printings sections
      continue;
    }
    if (!batch || !line.startsWith("|")) continue;
    const cells = line.split("|").map((c) => c.trim());
    // | cardId | name | status | vocabulary | notes | -> ["", cardId, name, status, ...]
    const cardId = cells[1];
    const status = cells[3];
    if (!cardId || cardId === "cardId" || /^-+$/.test(cardId)) continue;
    rows.set(cardId, { batch, status: status ?? "" });
  }
  return rows;
}

const COLOR_FILTERS = ["all", "W", "U", "B", "R", "G", "multicolor", "colorless", "land"] as const;
const TYPE_FILTERS = ["all", "Creature", "Instant", "Sorcery", "Enchantment", "Artifact", "Land", "Token"] as const;

function colorBucket(def: CardDef): (typeof COLOR_FILTERS)[number] {
  if (def.types.includes("Land")) return "land";
  const c = cardColors(def);
  if (c.length === 0) return "colorless";
  if (c.length > 1) return "multicolor";
  return c[0]!;
}

function deckMembership(): Map<string, DeckKey[]> {
  const m = new Map<string, DeckKey[]>();
  for (const key of Object.keys(DECKS) as DeckKey[]) {
    for (const { cardId } of DECKS[key].decklist) {
      m.set(cardId, [...(m.get(cardId) ?? []), key]);
    }
  }
  return m;
}

/** Chosen art style + year for custom cards (ADR-052: Chris's pick, logged in MANIFEST). */
const CUSTOM_ART_META: Record<string, { style: string; year: number }> = {
  cunning_tactician: { style: "classical oil", year: 2026 },
};

function caption(def: CardDef, oracle?: OracleEntry | undefined): string {
  if (!oracle) {
    if (def.isTokenDef) return "token";
    const meta = CUSTOM_ART_META[def.id];
    return meta ? `custom · ${meta.style} · ${meta.year}` : "custom";
  }
  return `${oracle.set.toUpperCase()} #${oracle.collector_number} · ${oracle.artist}`;
}

function NoteButton({ cardId, small }: { cardId: string; small?: boolean }) {
  const [state, setState] = useState<"idle" | "open" | "saved" | "error">("idle");
  const [text, setText] = useState("");
  const submit = () => {
    const note = text.trim();
    if (!note) return;
    fetch("/__art-note", { method: "POST", body: JSON.stringify({ cardId, note }) })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        setState("saved");
        setText("");
        setTimeout(() => setState("idle"), 1500);
      })
      .catch(() => {
        // Download fallback (mirrors the flag button): hand the entry to the user.
        const blob = new Blob(
          [JSON.stringify({ cardId, note, date: new Date().toISOString().slice(0, 10) }, null, 2)],
          { type: "application/json" },
        );
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `art-note-${cardId}.json`;
        a.click();
        setState("error");
        setText("");
        setTimeout(() => setState("idle"), 1500);
      });
  };
  if (state === "open") {
    return (
      <span className="note-form" onClick={(e) => e.stopPropagation()}>
        <input
          type="text"
          autoFocus
          placeholder={`Art note for ${cardId}…`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") { setText(""); setState("idle"); }
          }}
        />
        <button className="linkish" onClick={submit}>save</button>
        <button className="linkish" onClick={() => { setText(""); setState("idle"); }}>✕</button>
      </span>
    );
  }
  return (
    <button
      className="linkish"
      onClick={(e) => { e.stopPropagation(); setState("open"); }}
      title="Append an art note to docs/art/art-notes.md"
    >
      {state === "saved" ? "noted ✓" : state === "error" ? "saved as download" : small ? "✎" : "✎ note"}
    </button>
  );
}

/** Battlefield-tile rendering from a bare CardDef (no game state) for the size strip. */
function StripTile({ def }: { def: CardDef }) {
  return (
    <div className="tile" title={def.name} style={{ cursor: "default" }}>
      {def.source === "real" ? (
        <img className="art" src={`/real-art/${def.id}.art.jpg`} alt="" />
      ) : def.art?.asset ? (
        <img className="art" src={def.art.asset} alt="" />
      ) : (
        <div className="art" style={{ display: "grid", placeItems: "center", height: 52 }}>
          <img src={`/icons/${def.types.includes("Land") ? "mana-colorless" : "zone-hand"}.svg`} width={22} alt="" style={{ mixBlendMode: "multiply" }} />
        </div>
      )}
      <div className="name">{def.name}</div>
      {def.types.includes("Creature") && <div className="pt">{def.power}/{def.toughness}</div>}
    </div>
  );
}

/** ADR-043 evidence: battlefield tile / hand frame (no oracle) / inspector frame, side by side. */
function SizeStrip({ def, oracle }: { def: CardDef; oracle?: OracleEntry | undefined }) {
  return (
    <div className="panel" style={{ marginBottom: 12 }}>
      <h3>Size comparison (ADR-043) — click any card below to switch its subject</h3>
      <div style={{ display: "flex", gap: 18, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ textAlign: "center" }}>
          <StripTile def={def} />
          <div className="strip-label">battlefield tile</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <CardFrame def={def} oracle={oracle} mini hand />
          <div className="strip-label">hand frame (ADR-043: no oracle)</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <CardFrame def={def} oracle={oracle} />
          <div className="strip-label">inspector frame</div>
        </div>
      </div>
    </div>
  );
}

function InspectorModal({
  def,
  oracle,
  onClose,
}: {
  def: CardDef;
  oracle?: OracleEntry | undefined;
  onClose: () => void;
}) {
  const [printed, setPrinted] = useState(false);
  return (
    <div className="gallery-modal" onClick={onClose}>
      <div className="gallery-modal-box" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "var(--serif)", fontWeight: 700 }}>{def.name}</span>
          <span>
            {def.source === "real" && (
              <button className="linkish" onClick={() => setPrinted(!printed)}>{printed ? "our frame" : "printed card"}</button>
            )}
            <NoteButton cardId={def.id} />
            <button className="linkish" onClick={onClose}>close</button>
          </span>
        </div>
        <div className="gallery-modal-card">
          <CardFrame def={def} oracle={oracle} showPrinted={printed} />
        </div>
        <div className="caption" style={{ textAlign: "center" }}>{caption(def, oracle)}</div>
      </div>
    </div>
  );
}

export function Gallery() {
  const pool = useMemo(loadPool, []);
  const decks = useMemo(deckMembership, []);
  const [oracle, setOracle] = useState<Record<string, OracleEntry>>({});
  const [registry, setRegistry] = useState<Map<string, RegistryRow> | null>(null);
  const [color, setColor] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [batch, setBatch] = useState<string>("all");
  const [deck, setDeck] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [printedAll, setPrintedAll] = useState(false);
  const [inspected, setInspected] = useState<string | null>(null);
  const [stripSubject, setStripSubject] = useState("serra_angel");

  useEffect(() => {
    loadOracle().then(setOracle);
    fetch("/__registry")
      .then((r) => r.text())
      .then((md) => setRegistry(parseRegistry(md)))
      .catch(() => setRegistry(new Map()));
  }, []);

  const cards = useMemo(() => {
    if (!registry) return [];
    const list = [...pool.values()]
      .filter((d) => (registry.get(d.id)?.status ?? "") !== "cut")
      .map((d) => ({
        def: d,
        batch: registry.get(d.id)?.batch ?? (d.isTokenDef ? "tokens" : "unregistered"),
        decks: decks.get(d.id) ?? [],
      }));
    return list.sort((a, b) => a.def.name.localeCompare(b.def.name));
  }, [pool, registry, decks]);

  const batches = useMemo(() => [...new Set(cards.map((c) => c.batch))].sort(), [cards]);

  const shown = cards.filter((c) => {
    if (color !== "all" && colorBucket(c.def) !== color) return false;
    if (type === "Token" ? !c.def.isTokenDef : type !== "all" && !c.def.types.includes(type as never)) return false;
    if (batch !== "all" && c.batch !== batch) return false;
    if (deck !== "all" && !c.decks.includes(deck as never)) return false;
    if (search && !c.def.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const inspectedDef = inspected ? pool.get(inspected) : undefined;
  const stripDef = pool.get(stripSubject);

  return (
    <div className="gallery">
      <div className="gallery-header">
        <h2 style={{ fontFamily: "var(--serif)", margin: 0 }}>Card Gallery</h2>
        <a href="/" className="linkish">← viewer</a>
        <span style={{ flex: 1 }} />
        <input
          type="text"
          placeholder="Search name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={color} onChange={(e) => setColor(e.target.value)} title="Color">
          {COLOR_FILTERS.map((c) => <option key={c} value={c}>{c === "all" ? "color: all" : c}</option>)}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} title="Type">
          {TYPE_FILTERS.map((t) => <option key={t} value={t}>{t === "all" ? "type: all" : t}</option>)}
        </select>
        <select value={batch} onChange={(e) => setBatch(e.target.value)} title="Session batch">
          <option value="all">batch: all</option>
          {batches.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={deck} onChange={(e) => setDeck(e.target.value)} title="Deck membership">
          <option value="all">deck: all</option>
          {(Object.keys(DECKS) as DeckKey[]).map((k) => <option key={k} value={k}>{k} · {DECKS[k].name}</option>)}
        </select>
        <label style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 3 }}>
          <input type="checkbox" checked={printedAll} onChange={(e) => setPrintedAll(e.target.checked)} />
          printed scans
        </label>
        <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>{shown.length}/{cards.length}</span>
      </div>

      {stripDef && <SizeStrip def={stripDef} oracle={oracle[stripDef.id]} />}

      {!registry && <div style={{ padding: 20 }}>Loading registry…</div>}
      <div className="gallery-grid">
        {shown.map(({ def, batch: b, decks: dm }) => (
          <div
            key={def.id}
            className="gallery-cell"
            onClick={() => { setInspected(def.id); setStripSubject(def.id); }}
          >
            <CardFrame def={def} oracle={oracle[def.id]} showPrinted={printedAll && def.source === "real"} />
            <div className="caption">
              <div style={{ fontWeight: 600 }}>{def.name}</div>
              <div>{caption(def, oracle[def.id])}</div>
              <div style={{ color: "var(--ink-soft)" }}>
                {b}{dm.length ? ` · decks ${dm.join(",")}` : ""} <NoteButton cardId={def.id} small />
              </div>
            </div>
          </div>
        ))}
      </div>

      {inspectedDef && (
        <InspectorModal def={inspectedDef} oracle={oracle[inspectedDef.id]} onClose={() => setInspected(null)} />
      )}
    </div>
  );
}
