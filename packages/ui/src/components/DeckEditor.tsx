import { useState } from "react";
import type { CardDef } from "@shandalar/cards";
import { cardColors } from "@shandalar/cards";
import { BASIC_LANDS, deckStats, isBasic, spares } from "@shandalar/world";
import type { OracleEntry } from "../engine-bridge";
import { CardFrame } from "./CardFrame";
import { FloatingCardInspector } from "../world/FloatingCardInspector";

import type { DeckEditorHost } from "./deck-editor-host";
export type { DeckEditorHost } from "./deck-editor-host";

export function DeckEditor({ host: h, pool, oracle }: { host: DeckEditorHost; pool: Map<string, CardDef>; oracle: Record<string, OracleEntry> }) {
  const [filter, setFilter] = useState<"all" | "W" | "U" | "B" | "R" | "G" | "Creature" | "Instant" | "Sorcery" | "Enchantment" | "Artifact" | "Land">("all");
  const [sort, setSort] = useState<"name" | "cost" | "colour">("cost");
  const [search, setSearch] = useState("");
  const [printed, setPrinted] = useState(true); // S14 round 1 (Chris): printed by default in the editor too
  const [inspect, setInspect] = useState<string | null>(null); // S14 round 2: hover → floating inspector
  // S18 rider (deck-picker polish): in-page deck ops replace the browser prompt() dialogs.
  const [op, setOp] = useState<null | { kind: "new" | "duplicate" | "delete" | "switch"; value: string }>(null);
  const { draft, name, notice } = h;
  const savedDeck = h.source.savedDeck, activeName = h.source.activeDeckName;
  const deckNames = h.decks?.names() ?? [activeName];
  const dirty = name !== activeName || draft.length !== savedDeck.length || draft.some((e) => savedDeck.find((x) => x.cardId === e.cardId)?.count !== e.count);
  const sp = spares(h.source.collection, draft);
  const legality = h.legality();
  const stats = deckStats(pool, draft);
  const mv = (id: string) => { const d = pool.get(id)!; return d.types.includes("Land") ? -1 : deckStats(pool, [{ cardId: id, count: 1 }]).curve.findIndex((n) => n > 0); };
  const passes = (id: string) => {
    const def = pool.get(id);
    if (!def) return false;
    if (search && !def.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "all") return true;
    if (["W", "U", "B", "R", "G"].includes(filter)) return cardColors(def).includes(filter as "W");
    return (def.types as string[]).includes(filter);
  };
  const order = (a: string, b: string) => {
    const da = pool.get(a)!, db = pool.get(b)!;
    if (sort === "name") return da.name.localeCompare(db.name);
    if (sort === "colour") return (cardColors(da).join("") || "z").localeCompare(cardColors(db).join("") || "z") || da.name.localeCompare(db.name);
    return mv(a) - mv(b) || da.name.localeCompare(db.name);
  };
  const spareIds = Object.keys(sp).filter(passes).sort(order);
  const deckIds = draft.map((e) => e.cardId).filter(passes).sort(order);
  const cell = (id: string, n: number, onClick: () => void, label: string) => (
    <div key={id} className="editor-card" onClick={onClick} onMouseEnter={() => setInspect(id)} title={label}>
      <div className="editor-slot"><CardFrame def={pool.get(id)!} oracle={oracle[id]} showPrinted={printed} /></div>
      <div className="editor-count">×{n}</div>
    </div>
  );
  const maxCurve = Math.max(1, ...stats.curve);
  return (
    <div className="gallery world-editor">
      <div className="gallery-header">
        <b style={{ fontFamily: "var(--serif)" }}>{h.title}</b>
        {h.decks && (<>
        {/* S16 (v3): the deck picker — switch / new / duplicate / delete. S18: in-page ops, dirty-draft guard on switch. */}
        <select value={activeName} title={dirty ? "your saved decks (you have unsaved changes — switching asks first)" : "your saved decks"} onChange={(e) => { const n = e.target.value; if (n === activeName) return; if (dirty) setOp({ kind: "switch", value: n }); else h.decks!.switch(n); }}>
          {deckNames.map((n) => <option key={n} value={n}>{n}{n === activeName ? " (active)" : ""}</option>)}
        </select>
        <button className="linkish" title="a new deck of 30 basics to build from" onClick={() => setOp({ kind: "new", value: `Deck ${deckNames.length + 1}` })}>new</button>
        <button className="linkish" title="copy the active deck" onClick={() => setOp({ kind: "duplicate", value: `${activeName} (copy)` })}>duplicate</button>
        <button className="linkish" title="delete a non-active deck" disabled={deckNames.length < 2} onClick={() => setOp({ kind: "delete", value: deckNames.find((n) => n !== activeName) ?? "" })}>delete</button>
        </>)}
        {h.rename ? <input type="text" value={name} onChange={(e) => h.rename!(e.target.value)} style={{ width: 140 }} title="deck name (saved with the deck)" /> : <span style={{ fontSize: 12 }}>{name}</span>}
        {dirty && <span className="draft-dirty" title="unsaved changes to this deck">unsaved</span>}
        <span className={legality.ok ? "legal" : "illegal"} style={{ fontSize: 12 }} title={legality.ok ? "the floor, the cap and ownership hold" : legality.problems.join("; ")}>
          {stats.size} cards · {stats.lands} lands · avg MV {stats.avgMv.toFixed(2)} · {legality.ok ? "legal" : `${legality.problems.length} problem${legality.problems.length === 1 ? "" : "s"}`}
        </span>
        <span className="curve" title="mana curve (nonland, by mana value; last bar 7+)">
          {stats.curve.map((n, i) => (
            <span key={i} className="curve-bar" title={`mv ${i === 7 ? "7+" : i}: ${n}`}>
              <i style={{ height: `${Math.round((n / maxCurve) * 22) + 2}px` }} /><small>{i === 7 ? "7+" : i}</small>
            </span>
          ))}
        </span>
        <span className="colour-id">{Object.entries(stats.colors).map(([col, n]) => <span key={col} title={`${n} ${col}`}><i className={`colour-pip c-${col}`} /> {n}</span>)}</span>
        <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>{Object.entries(stats.types).filter(([t]) => t !== "Land").map(([t, n]) => `${t} ${n}`).join(" · ")}</span>
        <span style={{ flex: 1 }} />
        <input type="text" placeholder="search" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 110 }} />
        <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          {["all", "W", "U", "B", "R", "G", "Creature", "Instant", "Sorcery", "Enchantment", "Artifact", "Land"].map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="cost">by cost</option><option value="name">by name</option><option value="colour">by colour</option>
        </select>
        <button className="linkish" onClick={() => setPrinted(!printed)}>{printed ? "our frame" : "printed card"}</button>
        <button className="primary" disabled={!legality.ok} title={legality.ok ? h.saveLabel : legality.problems.join("; ")} onClick={() => h.save()}>{h.saveLabel}</button>
        <button onClick={() => h.reset()} title="discard draft changes (back to the saved deck)">Reset</button>
        {h.close && <button disabled={!!h.mustLeaveLegal && !legality.ok} title={h.mustLeaveLegal && !legality.ok ? h.mustLeaveLegal : ""} onClick={() => h.close!()}>{h.closeLabel ?? "Cancel"}</button>}
      </div>
      {op && (
        <div className="deck-op-row">
          {op.kind === "switch" ? (
            <>
              <span>Switch to <b>{op.value}</b>? Your unsaved changes to <b>{activeName}</b> will be discarded.</span>
              <button className="primary" onClick={() => { h.decks!.switch(op.value); setOp(null); }}>Switch</button>
              <button onClick={() => setOp(null)}>Keep editing</button>
            </>
          ) : op.kind === "delete" ? (
            <>
              <span>Delete which deck?</span>
              <select value={op.value} onChange={(e) => setOp({ ...op, value: e.target.value })}>
                {deckNames.filter((n) => n !== activeName).map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <button className="danger" disabled={!op.value} onClick={() => { if (h.decks!.remove(op.value)) setOp(null); }}>Delete</button>
              <button onClick={() => setOp(null)}>Cancel</button>
            </>
          ) : (
            <>
              <span>{op.kind === "new" ? "Name the new deck (30 basics to build from):" : `Copy "${activeName}" as:`}</span>
              <input type="text" autoFocus value={op.value} onChange={(e) => setOp({ ...op, value: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter" && op.value.trim()) { if ((op.kind === "new" ? h.decks!.create(op.value) : h.decks!.duplicate(op.value))) setOp(null); } if (e.key === "Escape") setOp(null); }} style={{ width: 180 }} />
              <button className="primary" disabled={!op.value.trim() || deckNames.includes(op.value.trim())} title={deckNames.includes(op.value.trim()) ? "a deck with that name exists" : ""} onClick={() => { if ((op.kind === "new" ? h.decks!.create(op.value) : h.decks!.duplicate(op.value))) setOp(null); }}>{op.kind === "new" ? "Create" : "Duplicate"}</button>
              <button onClick={() => setOp(null)}>Cancel</button>
            </>
          )}
        </div>
      )}
      <FloatingCardInspector def={inspect ? pool.get(inspect) ?? null : null} oracle={oracle} printed={printed} onTogglePrinted={() => setPrinted(!printed)} />
      {notice && <div style={{ color: "var(--danger)", fontSize: 12, padding: "0 6px 6px" }}>{notice}</div>}
      {/* S37 (ADR-123): the legality panel — every problem as a sentence, live; and the door the draft is
          checked against (a template's deckRule: the label, the rule, its verdict). A door never blocks Save. */}
      {(() => {
        const doors = h.doors?.list() ?? [];
        const rule = h.doors?.check() ?? null;
        if (legality.ok && doors.length === 0) return null;
        return (
          <div className="editor-legality">
            {!legality.ok && <ul className="illegal">{legality.problems.map((p, i) => <li key={i}>{p}</li>)}</ul>}
            {doors.length > 0 && (
              <div className="editor-door">
                <label>check against a door: <select value={h.doors!.selected ?? ""} onChange={(e) => h.doors!.select(e.target.value || null)}>
                  <option value="">none</option>
                  {doors.map((d) => <option key={d.id} value={d.id}>{d.name} — {d.label}</option>)}
                </select></label>
                {rule && <span className={rule.check.ok ? "legal" : "door-shut"}>{rule.label} ({rule.description}): {rule.check.ok ? "the gate opens" : "the gate is shut"}</span>}
                {rule && !rule.check.ok && <ul className="door-shut">{rule.check.problems.map((p, i) => <li key={i}>{p}</li>)}</ul>}
              </div>
            )}
          </div>
        );
      })()}
      <div className="editor-panes">
        <div className="editor-pane">
          <div className="flyout-title">{h.sparesLabel ?? "Spares"} — click to add ({spareIds.reduce((n, id) => n + (sp[id] ?? 0), 0)} owned, not in deck)</div>
          <div className="editor-grid">{spareIds.map((id) => cell(id, sp[id]!, () => h.add(id), "add one copy to the deck"))}</div>
          <div className="flyout-title" style={{ marginTop: 8 }}>Basic lands — free and infinite</div>
          <div className="basics-row">
            {BASIC_LANDS.map((b) => (
              <button key={b} onClick={() => h.add(b)}>+ {pool.get(b)?.name ?? b}</button>
            ))}
          </div>
        </div>
        <div className="editor-pane">
          <div className="flyout-title">Deck — click to remove ({stats.size})</div>
          <div className="editor-grid">
            {deckIds.map((id) => cell(id, draft.find((e) => e.cardId === id)!.count, () => h.remove(id), isBasic(id) ? "remove one (basics are free to re-add)" : "remove one copy (back to spares)"))}
          </div>
        </div>
      </div>
    </div>
  );
}
