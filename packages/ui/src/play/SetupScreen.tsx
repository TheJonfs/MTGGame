import { useMemo, useState } from "react";
import type { PlayerId } from "@shandalar/engine";
import type { Difficulty } from "@shandalar/agents";
import type { CardDef } from "@shandalar/cards";
import { addCopy, checkDeck, removeCopy, type Decklist } from "@shandalar/world";
import { DeckEditor, type DeckEditorHost } from "../components/DeckEditor";
import type { OracleEntry } from "../engine-bridge";
import { BUILD_RULE, PLAY_CATEGORIES, buildPool, deckSummary, deleteBuiltDeck, playChoices, saveBuiltDeck, type PlayArchetype, type PlayChoice } from "./play-decks";

/**
 * Post-S58 (Chris: the single match "still [uses] a menu of specific decks that results in a lot of options, rather
 * than something like a clean set of menus plus an option to build a deck for each side"): the single match's setup.
 * Each side picks a CATEGORY, then a DECK in it; either side's deck can be BUILT here (the deck editor over every card
 * legal in the Open), starting from whatever is selected, and is kept in the browser under "Decks built here".
 */
export interface PlaySetup { human: PlayChoice; enemy: PlayChoice; difficulty: Difficulty; humanSeat: PlayerId; seed: string }
type Side = "human" | "enemy";
const DIFFICULTIES: Difficulty[] = ["apprentice", "journeyman", "master"];
const ARCHETYPES: PlayArchetype[] = ["aggro", "midrange", "control"];
const store = () => (typeof localStorage !== "undefined" ? localStorage : null);

export function SetupScreen({ pool, oracle, onStart, onDev }: { pool: Map<string, CardDef>; oracle: Record<string, OracleEntry>; onStart: (s: PlaySetup) => void; onDev?: () => void }) {
  const revealAll = new URLSearchParams(window.location.search).get("all") === "1" || !!onDev;
  const [version, setVersion] = useState(0); // bumped when a built deck is saved or deleted
  const choices = useMemo(() => playChoices(pool, { revealAll }), [pool, revealAll, version]);
  const first = (group: string) => choices.find((c) => c.group === group)?.key;
  const [keys, setKeys] = useState<Record<Side, string>>({ human: first("open") ?? first("mages") ?? choices[0]?.key ?? "", enemy: choices.filter((c) => c.group === "open")[1]?.key ?? choices.filter((c) => c.group === "mages")[1]?.key ?? choices[0]?.key ?? "" });
  const [difficulty, setDifficulty] = useState<Difficulty>("master");
  const [humanSeat, setHumanSeat] = useState<PlayerId>(0);
  const [seed, setSeed] = useState("");
  const [edit, setEdit] = useState<null | { side: Side; name: string; archetype: PlayArchetype; draft: Decklist; saved: Decklist; savedName: string; notice: string | null }>(null);
  const picked = (side: Side) => choices.find((c) => c.key === keys[side]) ?? choices[0];
  const collection = useMemo(() => buildPool(pool), [pool]);

  if (edit) {
    const change = (r: ReturnType<typeof addCopy>) => setEdit(r.ok ? { ...edit, draft: r.deck, notice: null } : { ...edit, notice: r.reason });
    const host: DeckEditorHost = {
      title: edit.side === "human" ? "Build your deck" : "Build the opponent's deck",
      draft: edit.draft, name: edit.name, notice: edit.notice,
      source: { collection, savedDeck: edit.saved, activeDeckName: edit.savedName },
      legality: () => checkDeck(edit.draft, null, BUILD_RULE, pool),
      add: (id) => change(addCopy(collection, edit.draft, id)),
      remove: (id) => change(removeCopy(edit.draft, id)),
      reset: () => setEdit({ ...edit, draft: edit.saved.map((e) => ({ ...e })), notice: null }),
      rename: (name) => setEdit({ ...edit, name }),
      save: () => {
        const check = checkDeck(edit.draft, null, BUILD_RULE, pool), name = edit.name.trim() || "My deck";
        if (!check.ok) return setEdit({ ...edit, notice: check.problems.join("; ") });
        saveBuiltDeck(store(), { name, archetype: edit.archetype, decklist: edit.draft });
        setKeys({ ...keys, [edit.side]: `built:${name}` }); setVersion(version + 1); setEdit(null);
      },
      saveLabel: "Save and use this deck",
      close: () => setEdit(null), closeLabel: "Cancel",
      sparesLabel: "Every card legal in the Open",
    };
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ padding: "5px 12px", fontSize: 13, display: "flex", gap: 10, alignItems: "center", background: "var(--ink)", color: "var(--parchment)" }}>
          <span>Saved under "Decks built here" in this browser. Forty cards or more; the Open's limits on a card (four of each, the power at one).</span>
          <span style={{ flex: 1 }} />
          <label>the AI plays it as <select value={edit.archetype} onChange={(e) => setEdit({ ...edit, archetype: e.target.value as PlayArchetype })}>{ARCHETYPES.map((a) => <option key={a} value={a}>{a}</option>)}</select></label>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}><DeckEditor host={host} pool={pool} oracle={oracle} /></div>
      </div>
    );
  }

  const panel = (side: Side, title: string) => {
    const deck = picked(side);
    if (!deck) return null;
    const groups = PLAY_CATEGORIES.filter((g) => choices.some((c) => c.group === g.group));
    const inGroup = choices.filter((c) => c.group === deck.group);
    return (
      <div className="deck-picker" style={{ width: 250, gap: 6 }}>
        <div className="flyout-title">{title}</div>
        <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>from
          <select style={{ width: "100%" }} aria-label={`${title}: category`} value={deck.group} onChange={(e) => setKeys({ ...keys, [side]: choices.find((c) => c.group === e.target.value)!.key })}>{groups.map((g) => <option key={g.group} value={g.group}>{g.title} ({choices.filter((c) => c.group === g.group).length})</option>)}</select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>deck
          <select style={{ width: "100%" }} aria-label={`${title}: deck`} value={deck.key} onChange={(e) => setKeys({ ...keys, [side]: e.target.value })}>{inGroup.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select>
        </label>
        <div style={{ color: "var(--ink-soft)" }}>{deckSummary(deck.decklist, pool)}{side === "enemy" ? ` · played as ${deck.archetype}` : ""}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button title="open the deck editor on a copy of this deck" onClick={() => setEdit({ side, name: deck.group === "built" ? deck.name : `${deck.name} (mine)`, archetype: deck.archetype === "combo" ? "midrange" : deck.archetype, draft: deck.decklist.map((e) => ({ ...e })), saved: deck.decklist.map((e) => ({ ...e })), savedName: deck.name, notice: null })}>{deck.group === "built" ? "Edit this deck" : "Build from this deck"}</button>
          <button title="open the deck editor on an empty deck" onClick={() => setEdit({ side, name: "My deck", archetype: "midrange", draft: [], saved: [], savedName: "", notice: null })}>Build a new deck</button>
          {deck.group === "built" && <button className="linkish" title="remove this built deck from the browser" onClick={() => { deleteBuiltDeck(store(), deck.name); setVersion(version + 1); }}>delete</button>}
        </div>
      </div>
    );
  };
  const human = picked("human"), enemy = picked("enemy");
  return (
    <div className="loader">
      <div className="box play-setup" style={{ maxWidth: 820 }}>
        <h2 style={{ fontFamily: "var(--serif)", marginTop: 0 }}>New Match</h2>
        <div style={{ display: "flex", gap: 28, textAlign: "left", justifyContent: "center", flexWrap: "wrap" }}>
          {panel("human", "Your deck")}
          {panel("enemy", "Opponent's deck")}
          <div className="deck-picker" style={{ gap: 6 }}>
            <div className="flyout-title">The match</div>
            <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>the opponent plays as
              <select aria-label="difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>{DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}</select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>you play
              <select aria-label="turn order" value={humanSeat} onChange={(e) => setHumanSeat(Number(e.target.value) as PlayerId)}><option value={0}>first (on the play)</option><option value={1}>second (on the draw)</option></select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>seed
              <input type="text" placeholder="random" value={seed} onChange={(e) => setSeed(e.target.value)} style={{ width: 110 }} />
            </label>
          </div>
        </div>
        <p>
          <button className="primary" disabled={!human || !enemy} onClick={() => human && enemy && onStart({ human, enemy, difficulty, humanSeat, seed })}>Start match</button>{" "}
          <a className="linkish" href="/">⟵ main menu</a>
          {onDev && <>{" "}<button className="linkish" title="the Matchup Lab's dials on a duel you pilot (dev)" onClick={onDev}>dev setup</button></>}
        </p>
      </div>
    </div>
  );
}
