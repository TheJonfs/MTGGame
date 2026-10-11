import { useMemo, useState } from "react";
import type { PlayerId } from "@shandalar/engine";
import type { Difficulty } from "@shandalar/agents";
import type { CardDef } from "@shandalar/cards";
import { addCopy, checkDeck, removeCopy, type Decklist } from "@shandalar/world";
import { DeckEditor, type DeckEditorHost } from "../components/DeckEditor";
import type { OracleEntry } from "../engine-bridge";
import { BUILD_RULE, PLAY_CATEGORIES, buildPool, deckSummary, deleteBuiltDeck, playChoices, readBuiltDecks, saveBuiltDeck, type PlayArchetype, type PlayChoice } from "./play-decks";

/**
 * Post-S58 (Chris: the single match "still [uses] a menu of specific decks that results in a lot of options, rather
 * than something like a clean set of menus plus an option to build a deck for each side"): the single match's setup.
 * Each side picks a CATEGORY, then a DECK in it; either side's deck can be BUILT here (the deck editor over every card
 * legal in the Open), starting from whatever is selected, and is kept in the browser under "Decks built here".
 */
/** `match` (post-S60, Chris: games against one list as the event plays them): best of three, sideboarded from game two. */
export interface PlaySetup { human: PlayChoice; enemy: PlayChoice; difficulty: Difficulty; humanSeat: PlayerId; seed: string; match?: boolean }
const SIDE_MAX = 15;
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
  const [match, setMatch] = useState(() => { try { return store()?.getItem("shandalar-play-match") === "1"; } catch { return false; } });
  /** `board`: the editor is on a built deck's SIDEBOARD (up to fifteen, from what the deck leaves of each card's cap) — the value is the deck. */
  const [edit, setEdit] = useState<null | { side: Side; name: string; archetype: PlayArchetype; draft: Decklist; saved: Decklist; savedName: string; notice: string | null; board?: Decklist }>(null);
  const picked = (side: Side) => choices.find((c) => c.key === keys[side]) ?? choices[0];
  const collection = useMemo(() => buildPool(pool), [pool]);

  if (edit) {
    const change = (r: ReturnType<typeof addCopy>) => setEdit(r.ok ? { ...edit, draft: r.deck, notice: null } : { ...edit, notice: r.reason });
    const board = edit.board, used = (id: string) => board?.find((e) => e.cardId === id)?.count ?? 0;
    const left = board ? Object.fromEntries(Object.entries(collection).map(([id, n]) => [id, Math.max(0, n - used(id))])) : collection; // the sideboard draws on what the deck leaves
    const sideN = edit.draft.reduce((n, e) => n + e.count, 0);
    const host: DeckEditorHost = {
      title: board ? `The sideboard of ${edit.name} — up to ${SIDE_MAX}` : edit.side === "human" ? "Build your deck" : "Build the opponent's deck",
      draft: edit.draft, name: edit.name, notice: edit.notice,
      source: { collection: left, savedDeck: edit.saved, activeDeckName: edit.savedName },
      legality: () => (board ? { ok: sideN <= SIDE_MAX, problems: sideN > SIDE_MAX ? [`the sideboard has ${sideN} cards; a match allows ${SIDE_MAX}`] : [] } as ReturnType<typeof checkDeck> : checkDeck(edit.draft, null, BUILD_RULE, pool)),
      add: (id) => change(addCopy(left, edit.draft, id)),
      remove: (id) => change(removeCopy(edit.draft, id)),
      reset: () => setEdit({ ...edit, draft: edit.saved.map((e) => ({ ...e })), notice: null }),
      ...(board ? {} : { rename: (name: string) => setEdit({ ...edit, name }) }),
      save: () => {
        if (board) {
          if (sideN > SIDE_MAX) return setEdit({ ...edit, notice: `the sideboard has ${sideN} cards; a match allows ${SIDE_MAX}` });
          saveBuiltDeck(store(), { name: edit.name, archetype: edit.archetype, decklist: board, sideboard: edit.draft });
          setVersion(version + 1); return setEdit(null);
        }
        const check = checkDeck(edit.draft, null, BUILD_RULE, pool), name = edit.name.trim() || "My deck";
        if (!check.ok) return setEdit({ ...edit, notice: check.problems.join("; ") });
        const kept = readBuiltDecks(store()).find((d) => d.name === name)?.sideboard; // the deck's sideboard stays with it
        saveBuiltDeck(store(), { name, archetype: edit.archetype, decklist: edit.draft, ...(kept?.length ? { sideboard: kept } : {}) });
        setKeys({ ...keys, [edit.side]: `built:${name}` }); setVersion(version + 1); setEdit(null);
      },
      saveLabel: board ? `Keep this sideboard (${sideN}/${SIDE_MAX})` : "Save and use this deck",
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
        <div style={{ color: "var(--ink-soft)" }}>{deckSummary(deck.decklist, pool)}{side === "enemy" ? ` · played as ${deck.archetype}` : ""}{match ? (deck.sideboard?.length ? ` · sideboard of ${deck.sideboard.reduce((n, e) => n + e.count, 0)}` : " · the field builder's sideboard") : ""}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button title="open the deck editor on a copy of this deck" onClick={() => setEdit({ side, name: deck.group === "built" ? deck.name : `${deck.name} (mine)`, archetype: deck.archetype === "combo" ? "midrange" : deck.archetype, draft: deck.decklist.map((e) => ({ ...e })), saved: deck.decklist.map((e) => ({ ...e })), savedName: deck.name, notice: null })}>{deck.group === "built" ? "Edit this deck" : "Build from this deck"}</button>
          <button title="open the deck editor on an empty deck" onClick={() => setEdit({ side, name: "My deck", archetype: "midrange", draft: [], saved: [], savedName: "", notice: null })}>Build a new deck</button>
          {deck.group === "built" && !deck.key.includes("~") && <button title="the fifteen this deck brings to a match — changed between its games" onClick={() => setEdit({ side, name: deck.name, archetype: deck.archetype === "combo" ? "midrange" : deck.archetype, draft: (deck.sideboard ?? []).map((e) => ({ ...e })), saved: (deck.sideboard ?? []).map((e) => ({ ...e })), savedName: deck.name, notice: null, board: deck.decklist.map((e) => ({ ...e })) })}>Sideboard ({(deck.sideboard ?? []).reduce((n, e) => n + e.count, 0)}/{SIDE_MAX})</button>}
          {deck.group === "built" && !deck.key.includes("~") && <button className="linkish" title="remove this built deck from the browser" onClick={() => { deleteBuiltDeck(store(), deck.name); setVersion(version + 1); }}>delete</button>}
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
            <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>the format
              <select aria-label="format" value={match ? "match" : "game"} onChange={(e) => { const m = e.target.value === "match"; setMatch(m); try { store()?.setItem("shandalar-play-match", m ? "1" : "0"); } catch { /* not kept */ } }}><option value="game">one game</option><option value="match">a match — best of three, sideboards</option></select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>the opponent plays as
              <select aria-label="difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>{DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}</select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>{match ? "in game one you play" : "you play"}
              <select aria-label="turn order" value={humanSeat} onChange={(e) => setHumanSeat(Number(e.target.value) as PlayerId)}><option value={0}>first (on the play)</option><option value={1}>second (on the draw)</option></select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>seed
              <input type="text" placeholder="random" value={seed} onChange={(e) => setSeed(e.target.value)} style={{ width: 110 }} />
            </label>
          </div>
        </div>
        <p>
          <button className="primary" disabled={!human || !enemy} onClick={() => human && enemy && onStart({ human, enemy, difficulty, humanSeat, seed, match })}>{match ? "Start the match" : "Start match"}</button>{" "}
          <a className="linkish" href="/">⟵ main menu</a>
          {onDev && <>{" "}<button className="linkish" title="the Matchup Lab's dials on a duel you pilot (dev)" onClick={onDev}>dev setup</button></>}
        </p>
      </div>
    </div>
  );
}
