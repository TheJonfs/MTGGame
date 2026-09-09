/**
 * The single match's DEV setup (S34 director round — Chris: "test a matchup by playing it"): the Lab's
 * dials on a playable duel. A deck picker over every deck the game has (plus the custom decks from the
 * Lab's editor), per side life / entrance basics / starting bonuses (in play, to hand, bonus cards, the
 * law ring), the opponent's AI profile, the mode whose tier tables set the defaults, play/draw, seed.
 * Production keeps the plain setup screen; this one shows in the dev server (and `?dev=1`).
 */
import { useEffect, useMemo, useState } from "react";
import type { CardDef } from "@shandalar/cards";
import type { PlayerId } from "@shandalar/engine";
import type { CustomMatch } from "./match-controller";
import { customAsLabDeck, labDecks, resolveSide, sideModifiers, type CustomDeck, type LabDeck, type LabMode } from "../lab/lab-decks";
import type { LabSide } from "../lab/lab-types";
import { DeckEditor, SidePanel, sideFromDeck } from "../lab/lab-panels";

export interface DevMatch { custom: CustomMatch; humanSeat: PlayerId; seed?: number; summary: string }

export function DevSetup({ pool, onStart }: { pool: Map<string, CardDef>; onStart: (m: DevMatch) => void }) {
  const [mode, setMode] = useState<LabMode>("standard");
  const [customs, setCustoms] = useState<CustomDeck[]>([]);
  const baseDecks = useMemo(() => labDecks(mode), [mode]);
  const decks = useMemo(() => [...baseDecks, ...customs.map(customAsLabDeck)], [baseDecks, customs]);
  const byKey = useMemo(() => new Map(decks.map((d) => [d.key, d])), [decks]);
  const [you, setYou] = useState<LabSide>({ deck: "starter:white", life: 10, basics: 0, profile: "journeyman", bonuses: [] });
  const [them, setThem] = useState<LabSide>(() => sideFromDeck(labDecks("standard").find((d) => d.key === "mage:corvane")!));
  const [seat, setSeat] = useState<"first" | "second" | "flip">("flip");
  const [seed, setSeed] = useState("");
  const [editor, setEditor] = useState<CustomDeck | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => { try { const r = await fetch("/__lab-deck-list"); if (r.ok) setCustoms((await r.json()) as CustomDeck[]); } catch { /* no dev server */ } };
  useEffect(() => { void refresh(); }, []);
  // A mode change re-seats the opponent at that mode's defaults (the deck is kept).
  useEffect(() => { const d = byKey.get(them.deck); if (d) setThem((t) => ({ ...sideFromDeck(d), deck: t.deck })); }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (side: "you" | "them", key: string) => { const d = byKey.get(key); if (!d) return; (side === "you" ? setYou : setThem)(sideFromDeck(d)); };
  const openEditor = (key: string) => { const d = byKey.get(key); if (!d) return; setEditor({ name: d.group === "custom" ? d.name : `${d.name} v2`, archetype: d.archetype, decklist: d.decklist.map((e) => ({ ...e })), basedOn: d.group === "custom" ? (customs.find((c) => c.name === d.name)?.basedOn ?? d.name) : d.name }); };
  const saveDeck = async () => { if (!editor) return; const deck: CustomDeck = { ...editor, name: editor.name.trim() || "custom", when: new Date().toISOString() }; const r = await fetch("/__lab-deck-save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(deck) }); if (r.ok) { await refresh(); setEditor({ ...deck }); } };
  const useDeck = (side: "a" | "b") => { if (!editor) return; const name = editor.name.trim() || "custom"; const key = `custom:${name}`; if (!byKey.has(key)) setCustoms((c) => [...c.filter((x) => x.name !== name), { ...editor, name }]); (side === "a" ? setYou : setThem)((s) => ({ ...s, deck: key })); };

  const start = () => {
    try {
      const me = resolveSide(you, byKey, pool), foe = resolveSide(them, byKey, pool);
      const humanSeat: PlayerId = seat === "first" ? 0 : seat === "second" ? 1 : (Math.random() < 0.5 ? 0 : 1);
      const theirSeat = (1 - humanSeat) as PlayerId;
      // The human's life rides the rules (seat 0's startingLife) when the human is first; otherwise the modifier
      // path sets both — sideModifiers gives startingLife + entrance + bonuses per seat; drop the redundant one.
      const modifiers = [...sideModifiers(me, humanSeat), ...sideModifiers(foe, theirSeat)].filter((m) => !(m.type === "startingLife" && m.player === 0));
      const p0Life = humanSeat === 0 ? me.life : foe.life;
      const foeDeck = byKey.get(them.deck);
      const custom: CustomMatch = {
        human: { name: `You · ${me.name}`, decklist: me.decklist },
        enemy: { name: foe.name, decklist: foe.decklist, difficulty: foe.profile, archetype: foe.archetype, ...(foeDeck?.portrait ? { portrait: foeDeck.portrait } : {}) },
        rules: { startingLife: p0Life, ante: 0, startingPlayer: 0 },
        modifiers,
      };
      const seedN = seed.trim() !== "" ? Number(seed) : undefined;
      const summary = `${me.name} (${me.life} life${me.entrance.length ? `, ${me.entrance.length} in play` : ""}${me.bonuses.length ? `, ${me.bonuses.length} bonus` : ""}) vs ${foe.name} (${foe.life} life${foe.entrance.length ? `, ${foe.entrance.length} in play` : ""}${foe.bonuses.length ? `, ${foe.bonuses.length} bonus` : ""}, ${foe.profile}; ${mode} tables)`;
      onStart({ custom, humanSeat, ...(seedN !== undefined && Number.isFinite(seedN) ? { seed: seedN } : {}), summary });
    } catch (e) { setError((e as Error).message); }
  };

  return (
    <div style={{ padding: 16, overflow: "auto", height: "100%", boxSizing: "border-box", background: "var(--parchment) url(\"/panel-parchment.png\")", backgroundSize: "512px", color: "var(--ink)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
        <h2 style={{ fontFamily: "var(--serif)", margin: 0 }}>New Match</h2>
        <a href="/" className="linkish">← menu</a>
        <a href="/lab" className="linkish">the Matchup Lab</a>
        <span className="seed" style={{ marginLeft: "auto" }}>dev setup — the Lab's dials on a duel you pilot; production keeps the plain screen</span>
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
        <SidePanel label="a" title="You" showProfile={false} side={you} decks={decks} byKey={byKey} pool={pool} onPick={(k) => pick("you", k)} onPatch={(p) => setYou((s) => ({ ...s, ...p }))} onEdit={() => openEditor(you.deck)} />
        <SidePanel label="b" title="The opponent (the AI)" side={them} decks={decks} byKey={byKey} pool={pool} onPick={(k) => pick("them", k)} onPatch={(p) => setThem((s) => ({ ...s, ...p }))} onEdit={() => openEditor(them.deck)} />
        <div className="panel" style={{ padding: 10, minWidth: 260 }}>
          <div style={{ fontFamily: "var(--serif)", fontSize: 15, marginBottom: 6 }}>The match</div>
          <div style={{ fontSize: 12, display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 8px", alignItems: "center" }}>
            <span>defaults</span>
            <span>{(["easy", "standard", "hard"] as LabMode[]).map((m) => <label key={m} style={{ marginRight: 8 }}><input type="radio" checked={mode === m} onChange={() => setMode(m)} /> {m}</label>)}</span>
            <span>you play</span>
            <span>{([["first", "first (on the play)"], ["second", "second (on the draw)"], ["flip", "coin flip"]] as const).map(([k, t]) => <label key={k} style={{ marginRight: 8 }}><input type="radio" checked={seat === k} onChange={() => setSeat(k)} /> {t}</label>)}</span>
            <span>seed</span>
            <input type="text" placeholder="random" value={seed} onChange={(e) => setSeed(e.target.value)} style={{ width: 100 }} />
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 6 }}>Picking a deck loads its world defaults at the chosen mode (a mage's tier life and entrance, a boss's law and signature, a starter at 10). Zero ante. Every dial is the same modifier the world would apply.</div>
          <p style={{ marginTop: 10 }}><button className="primary" onClick={start}>Start match</button></p>
          {error && <div style={{ fontSize: 11, color: "#8a3b2c" }}>{error}</div>}
        </div>
      </div>
      {editor && <div style={{ marginTop: 14 }}><DeckEditor deck={editor} pool={pool} onChange={setEditor} onSave={() => void saveDeck()} onUse={useDeck} onClose={() => setEditor(null)} /></div>}
    </div>
  );
}
