/**
 * The Lab's shared panels (S34 director round): a side's deck / life / entrance / AI / starting bonuses,
 * the bonus editor over the modifier vocabulary, and the deck editor. Used by the Matchup Lab and by
 * the single match's dev setup (Chris: test a matchup by playing it under the same dials).
 */
import { useMemo, useState } from "react";
import type { CardDef } from "@shandalar/cards";
import { deckStats, entranceBasics, manaValue, type Archetype, type CustomDeck, type LabDeck, type Profile } from "./lab-decks";
import type { LabBonus, LabSide } from "./lab-types";

export const PROFILES: Profile[] = ["apprentice", "journeyman", "master"];
export const ARCHETYPES: Archetype[] = ["aggro", "midrange", "control"];
export const GROUPS = ["mages", "beasts", "starters", "roads", "bosses", "custom", "slices"] as const;
export const sideFromDeck = (d: LabDeck): LabSide => ({ deck: d.key, life: d.life, basics: d.basics, profile: d.profile, bonuses: (d.bonuses ?? []).map((b) => ({ ...b })) });

export function SidePanel({ label, side, decks, byKey, pool, onPick, onPatch, onEdit, title, showProfile = true }: { label: "a" | "b"; side: LabSide; decks: LabDeck[]; byKey: Map<string, LabDeck>; pool: Map<string, CardDef>; onPick: (key: string) => void; onPatch: (p: Partial<LabSide>) => void; onEdit: () => void; title?: string; showProfile?: boolean }) {
  const d = byKey.get(side.deck);
  const entrance = d ? entranceBasics(d, side.basics, pool) : [];
  const stats = d ? deckStats(d.decklist, pool) : null;
  return (
    <div className="panel" style={{ padding: 10, minWidth: 340, maxWidth: 420 }}>
      <div style={{ fontFamily: "var(--serif)", fontSize: 15, marginBottom: 6, display: "flex", gap: 8, alignItems: "baseline" }}>
        <span>{title ?? (label === "a" ? "Side A — the grid varies this side" : "Side B — the reference, fixed")}</span>
        <button className="linkish" style={{ marginLeft: "auto", fontSize: 11 }} onClick={onEdit} title="open a copy of this deck in the editor">edit a copy</button>
      </div>
      <select value={side.deck} onChange={(e) => onPick(e.target.value)} style={{ width: "100%" }}>
        {GROUPS.map((g) => {
          const inGroup = decks.filter((x) => x.group === g);
          return inGroup.length ? <optgroup key={g} label={g}>{inGroup.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}</optgroup> : null;
        })}
      </select>
      <div style={{ display: "flex", gap: 10, marginTop: 6, alignItems: "center", flexWrap: "wrap", fontSize: 12 }}>
        <label>life <input type="number" value={side.life} min={1} max={99} style={{ width: 52 }} onChange={(e) => onPatch({ life: Number(e.target.value) })} /></label>
        <label>entrance basics <input type="number" value={side.basics} min={0} max={5} style={{ width: 44 }} onChange={(e) => onPatch({ basics: Number(e.target.value) })} /></label>
        {showProfile && <label>AI <select value={side.profile} onChange={(e) => onPatch({ profile: e.target.value as Profile })}>{PROFILES.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>}
      </div>
      <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 4 }}>
        {d && stats ? `${stats.cards} cards (${stats.lands} lands, avg MV ${stats.avgMv.toFixed(2)}) · ${d.archetype} · world default ${d.life} life / ${d.profile} / ${d.basics} in play${d.bonuses?.length ? ` / ${d.bonuses.length} bonus${d.bonuses.length === 1 ? "" : "es"}` : ""}` : ""}
        {entrance.length ? ` · entrance: ${entrance.map((id) => pool.get(id)?.name ?? id).join(", ")}` : ""}
      </div>
      <BonusEditor bonuses={side.bonuses} pool={pool} onChange={(bonuses) => onPatch({ bonuses })} onReset={() => onPatch({ bonuses: (d?.bonuses ?? []).map((b) => ({ ...b })) })} />
    </div>
  );
}

/** The starting-bonus editor: rows over the modifier vocabulary; `both` for symmetric laws. */
export function BonusEditor({ bonuses, pool, onChange, onReset }: { bonuses: LabBonus[]; pool: Map<string, CardDef>; onChange: (b: LabBonus[]) => void; onReset: () => void }) {
  const [pick, setPick] = useState("");
  const [kind, setKind] = useState<LabBonus["type"]>("permanent");
  const listId = useMemo(() => `lab-cards-${Math.random().toString(36).slice(2, 8)}`, []);
  const cards = useMemo(() => [...pool.values()].sort((a, b) => a.name.localeCompare(b.name)), [pool]);
  const byName = (s: string): string | null => { const t = s.trim().toLowerCase(); if (!t) return null; if (pool.has(t)) return t; const hit = cards.find((c) => c.name.toLowerCase() === t) ?? cards.find((c) => c.name.toLowerCase().startsWith(t)); return hit?.id ?? null; };
  const set = (i: number, patch: Partial<LabBonus>) => onChange(bonuses.map((b, j) => (j === i ? ({ ...b, ...patch } as LabBonus) : b)));
  const add = () => {
    if (kind === "lawSequence") { onChange([...bonuses, { type: "lawSequence" }]); return; }
    if (kind === "extraCards") { onChange([...bonuses, { type: "extraCards", count: 1 }]); return; }
    const id = byName(pick); if (!id) return;
    onChange([...bonuses, { type: kind, cardId: id }]); setPick("");
  };
  const name = (id: string) => pool.get(id)?.name ?? id;
  return (
    <div style={{ marginTop: 8, fontSize: 12 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
        <span style={{ fontFamily: "var(--serif)" }}>Starting bonuses</span>
        <span className="seed">the world's modifiers: in play, to hand, bonus cards, the law ring</span>
        <button className="linkish" style={{ marginLeft: "auto", fontSize: 11 }} onClick={onReset}>reset to the deck's</button>
      </div>
      {bonuses.map((b, i) => (
        <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", padding: "2px 0" }}>
          <span style={{ flex: 1 }}>
            {b.type === "permanent" ? <>{name(b.cardId)} <span className="seed">in play</span></> : b.type === "cardInHand" ? <>{name(b.cardId)} <span className="seed">to hand after the mulligans</span></> : b.type === "extraCards" ? <>+<input type="number" value={b.count} min={1} max={7} style={{ width: 36 }} onChange={(e) => set(i, { count: Number(e.target.value) } as Partial<LabBonus>)} /> bonus card{b.count === 1 ? "" : "s"}</> : <>the law ring <span className="seed">(the Heart's sequence)</span></>}
          </span>
          <label title="apply to both seats (a symmetric law)"><input type="checkbox" checked={!!b.both} onChange={(e) => set(i, { both: e.target.checked || undefined } as Partial<LabBonus>)} /> both</label>
          <button className="linkish" onClick={() => onChange(bonuses.filter((_, j) => j !== i))}>remove</button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
        <select value={kind} onChange={(e) => setKind(e.target.value as LabBonus["type"])}>
          <option value="permanent">in play</option><option value="cardInHand">to hand</option><option value="extraCards">bonus cards</option><option value="lawSequence">the law ring</option>
        </select>
        {(kind === "permanent" || kind === "cardInHand") && <><input list={listId} value={pick} onChange={(e) => setPick(e.target.value)} placeholder="card name or id (tokens, laws, basics…)" style={{ flex: 1 }} onKeyDown={(e) => { if (e.key === "Enter") add(); }} /><datalist id={listId}>{cards.map((c) => <option key={c.id} value={c.name} />)}</datalist></>}
        <button onClick={add}>add</button>
      </div>
    </div>
  );
}

/** The deck editor: a copy of any deck, counts up and down, cards added from the pool, saved as a custom deck. */
export function DeckEditor({ deck, pool, onChange, onSave, onUse, onClose }: { deck: CustomDeck; pool: Map<string, CardDef>; onChange: (d: CustomDeck) => void; onSave: () => void; onUse: (side: "a" | "b") => void; onClose: () => void }) {
  const [pick, setPick] = useState("");
  const cards = useMemo(() => [...pool.values()].filter((c) => !c.isTokenDef).sort((a, b) => a.name.localeCompare(b.name)), [pool]);
  const stats = deckStats(deck.decklist, pool);
  const rows = [...deck.decklist].sort((x, y) => {
    const a = pool.get(x.cardId), b = pool.get(y.cardId);
    const la = a?.types.includes("Land") ? 0 : 1, lb = b?.types.includes("Land") ? 0 : 1;
    if (la !== lb) return la - lb;
    const ma = manaValue(a?.manaCost ?? ""), mb = manaValue(b?.manaCost ?? "");
    return ma !== mb ? ma - mb : (a?.name ?? x.cardId).localeCompare(b?.name ?? y.cardId);
  });
  const setCount = (cardId: string, count: number) => onChange({ ...deck, decklist: count <= 0 ? deck.decklist.filter((e) => e.cardId !== cardId) : deck.decklist.some((e) => e.cardId === cardId) ? deck.decklist.map((e) => (e.cardId === cardId ? { ...e, count } : e)) : [...deck.decklist, { cardId, count }] });
  const add = () => {
    const t = pick.trim().toLowerCase(); if (!t) return;
    const hit = pool.has(t) ? pool.get(t)! : cards.find((c) => c.name.toLowerCase() === t) ?? cards.find((c) => c.name.toLowerCase().startsWith(t));
    if (!hit) return;
    setCount(hit.id, (deck.decklist.find((e) => e.cardId === hit.id)?.count ?? 0) + 1); setPick("");
  };
  return (
    <div className="panel" style={{ padding: 10, minWidth: 380, maxWidth: 520 }}>
      <div style={{ fontFamily: "var(--serif)", fontSize: 15, marginBottom: 6, display: "flex", gap: 8, alignItems: "baseline" }}>
        <span>Deck editor</span>
        <span className="seed">{stats.cards} cards · {stats.lands} lands · avg MV {stats.avgMv.toFixed(2)}{stats.unknown.length ? ` · unknown: ${stats.unknown.join(", ")}` : ""}{stats.cards < 30 ? " · under 30 cards" : ""}</span>
        <button className="linkish" style={{ marginLeft: "auto", fontSize: 11 }} onClick={onClose}>close</button>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", fontSize: 12 }}>
        <input value={deck.name} onChange={(e) => onChange({ ...deck, name: e.target.value })} placeholder="deck name" style={{ width: 180 }} />
        <select value={deck.archetype} onChange={(e) => onChange({ ...deck, archetype: e.target.value as Archetype })}>{ARCHETYPES.map((a) => <option key={a} value={a}>{a}</option>)}</select>
        {deck.basedOn && <span className="seed">from {deck.basedOn}</span>}
      </div>
      <div style={{ maxHeight: 260, overflow: "auto", marginTop: 6, fontSize: 12 }}>
        {rows.map((e) => {
          const c = pool.get(e.cardId);
          return (
            <div key={e.cardId} style={{ display: "flex", gap: 6, alignItems: "center", padding: "1px 0", borderTop: "1px solid rgba(43,37,32,0.08)" }}>
              <span style={{ width: 26, textAlign: "right", fontWeight: 600 }}>{e.count}</span>
              <span style={{ flex: 1 }}>{c?.name ?? e.cardId} <span className="seed">{c?.manaCost ?? ""}</span></span>
              <button className="linkish" onClick={() => setCount(e.cardId, e.count - 1)}>−</button>
              <button className="linkish" onClick={() => setCount(e.cardId, e.count + 1)}>+</button>
              <button className="linkish" onClick={() => setCount(e.cardId, 0)}>×</button>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 6 }}>
        <input list="lab-deck-cards" value={pick} onChange={(e) => setPick(e.target.value)} placeholder="add a card (name or id)" style={{ flex: 1 }} onKeyDown={(e) => { if (e.key === "Enter") add(); }} />
        <datalist id="lab-deck-cards">{cards.map((c) => <option key={c.id} value={c.name} />)}</datalist>
        <button onClick={add}>add</button>
      </div>
      <textarea value={deck.notes ?? ""} onChange={(e) => onChange({ ...deck, notes: e.target.value })} placeholder="what this variation tries" style={{ width: "100%", minHeight: 36, marginTop: 6, fontSize: 12, boxSizing: "border-box" }} />
      <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
        <button onClick={onSave}>Save to analysis/decks/</button>
        <button className="linkish" onClick={() => onUse("a")}>use on side A</button>
        <button className="linkish" onClick={() => onUse("b")}>use on side B</button>
        <span className="seed">saved decks appear in both pickers under "custom"</span>
      </div>
    </div>
  );
}
