import { useEffect, useMemo, useRef, useState } from "react";
import type { CardDef } from "@shandalar/cards";
import { cardColors } from "@shandalar/cards";
import { DECKS, type DeckKey } from "@shandalar/sim/decks";
import { buyOffPrice, deckSize, deckStats, isBasic, sellPrice, spares, BASIC_LANDS, type DifficultyName, type ShopItem } from "@shandalar/world";
import { loadOracle, loadPool, loadWorldCatalog, type OracleEntry, type SavedGame } from "../engine-bridge";
import { CardFrame } from "../components/CardFrame";
import { PlayMatch, loadStops } from "../play/PlayMatch";
import { WorldController, type NewGameChoice } from "./world-controller";
import { WorldMapView } from "./WorldMap";

/**
 * /world (S13): the overworld shell — start → map → encounter/parley → duel
 * (the play client) → consequences → town/shop/collection → save/load →
 * game over. Presentation only; every decision goes through WorldController.
 */

const STARTERS: { deck: DeckKey; colour: string; label: string }[] = [
  { deck: "A", colour: "R", label: "Red — Red Aggro" },
  { deck: "B", colour: "WU", label: "White-Blue — WU Skies" },
  { deck: "C", colour: "G", label: "Green — Mono Green" },
  { deck: "D", colour: "B", label: "Black — Mono Black" },
  { deck: "E", colour: "GU", label: "Green-Blue — Simic Tempo" },
];
const TIER_BADGE = { 1: "I", 2: "II", 3: "III" } as const;

function StartScreen({ c, onStart }: { c: WorldController; onStart: (choice: NewGameChoice) => void }) {
  const [deck, setDeck] = useState<DeckKey>("A");
  const [difficulty, setDifficulty] = useState<DifficultyName>("standard");
  const [seed, setSeed] = useState("");
  const [name, setName] = useState("You");
  const [error, setError] = useState<string | null>(null);
  const upload = (file: File) => {
    file.text().then((t) => {
      try {
        c.loadText(t);
      } catch (e) {
        setError(String(e));
      }
    });
  };
  return (
    <div className="loader">
      <div className="box play-setup world-start">
        <h2 style={{ fontFamily: "var(--serif)", marginTop: 0 }}>Shandalar — a new journey</h2>
        <div style={{ display: "flex", gap: 24, textAlign: "left", justifyContent: "center" }}>
          <div className="deck-picker">
            <div className="flyout-title">Your colour (starter deck)</div>
            {STARTERS.map((s) => (
              <label key={s.deck} className={deck === s.deck ? "picked" : ""}>
                <input type="radio" checked={deck === s.deck} onChange={() => setDeck(s.deck)} /> {s.label}
              </label>
            ))}
          </div>
          <div className="deck-picker">
            <div className="flyout-title">Difficulty</div>
            {(["easy", "standard", "hard"] as DifficultyName[]).map((d) => (
              <label key={d} className={difficulty === d ? "picked" : ""}>
                <input type="radio" checked={difficulty === d} onChange={() => setDifficulty(d)} /> {d}
                {d !== "standard" ? " (untuned)" : ""}
              </label>
            ))}
            <div className="flyout-title" style={{ marginTop: 8 }}>Name</div>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={{ width: 120 }} />
            <div className="flyout-title" style={{ marginTop: 8 }}>Seed</div>
            <input type="text" placeholder="random" value={seed} onChange={(e) => setSeed(e.target.value)} style={{ width: 90 }} />
          </div>
        </div>
        <p>
          <button className="primary" onClick={() => onStart({ starterDeck: deck, difficulty, name, ...(seed.trim() ? { seed: Number(seed) } : {}) })}>New game</button>{" "}
          {c.hasAutosave() && <button onClick={() => c.continueFromAutosave()}>Continue</button>}{" "}
          <label className="linkish" style={{ cursor: "pointer" }}>
            load a save file
            <input type="file" accept=".json" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
        </p>
        <p style={{ fontSize: 11 }}>
          <a className="linkish" href="/play">single match</a> · <a className="linkish" href="/">viewer</a> · <a className="linkish" href="/gallery">gallery</a>
        </p>
        {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      </div>
    </div>
  );
}

function Chrome({ c, onDownload }: { c: WorldController; onDownload: () => void }) {
  const w = c.world!;
  return (
    <div className="play-ribbon world-chrome">
      <span className="turn">{w.player.name} · {c.regionName()}</span>
      <span className="stat" title="world life"><img src="/icons/stat-life.svg" alt="" /> {w.player.worldLife}</span>
      <span className="stat" title="gold">◉ {w.player.gold}</span>
      <span className="stat" title="steps (the clock)">⟳ {w.player.stepsTaken} steps</span>
      <span style={{ flex: 1 }} />
      <button className="linkish" title={c.canEdit().ok ? "edit your deck (clock-free)" : c.canEdit().reason} disabled={!c.canEdit().ok} onClick={() => c.openEditor()}>deck</button>
      <button className="linkish" onClick={() => c.openCollection()}>collection</button>
      <button className="linkish" onClick={() => c.save()}>save</button>
      <button className="linkish" onClick={onDownload}>download</button>
      <span className="seed">seed {w.seed} · {w.difficulty}</span>
    </div>
  );
}

function ParleyPanel({ c }: { c: WorldController }) {
  if (c.screen.kind !== "encounter") return null;
  const { encounter, tmpl, knobs, notice } = c.screen;
  const beast = tmpl.kind === "beast";
  const price = buyOffPrice(knobs, encounter.tier, tmpl);
  const gold = c.world!.player.gold;
  const odds = Math.round(knobs.fleeOddsByTier[encounter.tier] * 100);
  const stake = knobs.anteCount;
  const unbuyable = tmpl.buyable === false;
  const verdict = (v: "kept" | "rejected") => {
    void fetch("/__art-note", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cardId: `portrait:${tmpl.portrait}`, note: `${v} (director round, in situ)` }) });
  };
  return (
    <div className="gallery-modal">
      <div className="gallery-modal-box play-dialog parley">
        <div className="parley-head">
          <img className="parley-portrait" src={`/portraits/${tmpl.portrait}.png`} alt="" />
          <div>
            <h3 style={{ margin: 0, fontFamily: "var(--serif)" }}>{tmpl.name}</h3>
            <div className="parley-sub">
              <span className={`tier-badge t${tmpl.tier}`}>{TIER_BADGE[tmpl.tier]}</span>
              <span className="colour-id">{tmpl.colors.split("").map((ch) => <i key={ch} className={`colour-pip c-${ch}`} title={ch} />)}</span>
              {DECKS[tmpl.deck].name} · {tmpl.difficulty} · world life {tmpl.worldLife}
            </div>
            <div className="parley-sub">Stakes: {stake} card{stake === 1 ? "" : "s"} each (ante). You have {gold} gold.</div>
          </div>
        </div>
        <div className="parley-options">
          <button className="primary" onClick={() => c.parley("fight")}>
            Fight
            <small>Duel at your world life ({c.world!.player.worldLife}). Win: their stake + gold. Lose: your stake and 1 world life.</small>
          </button>
          <button onClick={() => c.parley("flee")}>
            Flee ({odds}%)
            <small>Forfeit your stake either way; if caught you fight and stake again.</small>
          </button>
          <button disabled={unbuyable || gold < price} title={unbuyable ? "This one cannot be bought" : gold < price ? `You have ${gold}; it costs ${price}` : ""} onClick={() => c.parley("buyoff")}>
            {beast ? "Distract" : "Buy off"} ({price} gold)
            <small>
              {unbuyable
                ? "Cannot be bought — it wants the fight."
                : gold < price
                  ? `Unaffordable — ${price} gold needed.`
                  : beast
                    ? `Not negotiation — a distraction, at ${knobs.beastBuyOffMultiplier}× the mage price.`
                    : "They take the gold and let you pass."}
            </small>
          </button>
        </div>
        {notice && <p style={{ color: "var(--danger)", fontSize: 12 }}>{notice}</p>}
        {import.meta.env.DEV && (
          <p style={{ fontSize: 10.5, color: "var(--ink-soft)" }}>
            portrait verdict (dev → docs/art/art-notes.md): <button className="linkish" onClick={() => verdict("kept")}>keep</button> · <button className="linkish" onClick={() => verdict("rejected")}>reject</button>
          </p>
        )}
        <p style={{ fontSize: 10.5, color: "var(--ink-soft)" }}>
          Fleeing picks your stake from your deck's nonland cards at random; a duel's stake is the top nonland card{stake === 1 ? "" : "s"} of each shuffled library.
        </p>
      </div>
    </div>
  );
}

function DuelResultScreen({ c, pool, oracle, onWatch }: { c: WorldController; pool: Map<string, CardDef>; oracle: Record<string, OracleEntry>; onWatch: () => void }) {
  if (c.screen.kind !== "duelResult") return null;
  const { record, duel, before, after } = c.screen;
  const won = record.outcome === "win";
  // S13 (Chris): printed card by default everywhere in the world (custom cards fall back to our frame).
  const frames = (ids: string[]) => ids.map((id, i) => <div className="card-slot" key={`${id}${i}`}><CardFrame def={pool.get(id)!} oracle={oracle[id]} showPrinted /></div>);
  return (
    <div className="loader">
      <div className="box play-setup world-result">
        <h2 style={{ fontFamily: "var(--serif)", marginTop: 0 }}>{won ? "Victory" : record.outcome === "loss" ? "Defeat" : "Draw"} — {duel.enemy.name}</h2>
        {won && record.anteWon.length > 0 && (
          <>
            <div className="flyout-title">You claim their stake</div>
            <div className="dialog-cards">{frames(record.anteWon)}</div>
          </>
        )}
        {record.outcome === "loss" && record.anteLost.length > 0 && (
          <>
            <div className="flyout-title">Your stake is lost</div>
            <div className="dialog-cards">{frames(record.anteLost)}</div>
            <p style={{ fontSize: 11 }}>Your deck refilled with {record.anteLost.length} {c.world!.player.basicLand.replace(/_/g, " ")}{record.anteLost.length === 1 ? "" : "s"} (the editor is M6b).</p>
          </>
        )}
        {record.outcome === "draw" && <p>No stakes change hands.</p>}
        <table className="end-stats">
          <tbody>
            <tr><td>Gold</td><td>{before.gold} → <b>{after.gold}</b>{after.gold !== before.gold ? ` (${after.gold > before.gold ? "+" : ""}${after.gold - before.gold})` : ""}</td></tr>
            <tr><td>World life</td><td>{before.life} → <b>{after.life}</b>{after.life !== before.life ? ` (${after.life - before.life})` : ""}{after.life === 0 ? " — fatal" : ""}</td></tr>
            {won && <tr><td>{duel.enemy.name}</td><td>defeated — this region grows quieter</td></tr>}
          </tbody>
        </table>
        <p>
          <button className="primary" onClick={() => c.continueAfterDuel()}>{c.world!.gameOver ? "Your journey ends" : "Continue"}</button>{" "}
          <button onClick={onWatch}>Watch replay</button>
        </p>
      </div>
    </div>
  );
}

function TownScreen({ c, pool, oracle }: { c: WorldController; pool: Map<string, CardDef>; oracle: Record<string, OracleEntry> }) {
  const [printed, setPrinted] = useState(true); // S13 (Chris): printed by default
  if (c.screen.kind !== "town") return null;
  const { town, stock, notice } = c.screen;
  const w = c.world!;
  const region = w.map.regions[town.region]!;
  return (
    <div className="gallery-modal">
      <div className="gallery-modal-box play-dialog world-town">
        <h2 style={{ fontFamily: "var(--serif)", marginTop: 0 }}>{town.name}</h2>
        <p style={{ fontSize: 12, marginTop: 0 }}>{region.name} · a safe town — <i>clock-free: deliberation costs nothing here</i> · you have <b>{w.player.gold}</b> gold</p>
        <div className="flyout-title">
          Shop (buy only; stock refreshes every {c.knobs.shopRefreshSteps} steps)
          <button className="linkish" onClick={() => setPrinted(!printed)}>{printed ? "our frame" : "printed card"}</button>
        </div>
        <div className="shop-grid">
          {stock.map((item: ShopItem) => (
            <div key={item.cardId} className={`shop-item${item.remaining === 0 ? " sold-out" : ""}`}>
              <div className="card-slot"><CardFrame def={pool.get(item.cardId)!} oracle={oracle[item.cardId]} showPrinted={printed} /></div>
              <div className="shop-buttons">
                <button className={w.player.gold >= item.price && item.remaining > 0 ? "primary" : ""} disabled={w.player.gold < item.price || item.remaining === 0} onClick={() => c.buy(item)} title="buy to collection">
                  {item.remaining === 0 ? "sold out" : `${item.price} gold`}
                </button>
                <button disabled={w.player.gold < item.price || item.remaining === 0} onClick={() => c.buy(item, true)} title="buy and add to your deck if legal">+deck</button>
              </div>
              <div className="shop-stock">{item.remaining}/{item.stock} left</div>
            </div>
          ))}
        </div>
        <div className="flyout-title" style={{ marginTop: 8 }}>Sell spares (half price; basics and deck copies excluded)</div>
        <div className="sell-row">
          {Object.entries(spares(w.player.collection, w.player.activeDeck)).map(([id, n]) => (
            <button key={id} className="sell-chip" onClick={() => c.sell(id)} title={`sell one ${pool.get(id)?.name ?? id}`}>
              {pool.get(id)?.name ?? id} ×{n} · {sellPrice(pool.get(id)!, c.knobs)}g
            </button>
          ))}
          {Object.keys(spares(w.player.collection, w.player.activeDeck)).length === 0 && <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>no spares to sell</span>}
        </div>
        {notice && <p style={{ fontSize: 12, color: "var(--brass)" }}>{notice}</p>}
        <p>
          <button onClick={() => c.openEditor()}>Edit deck</button>{" "}
          <button onClick={() => c.openCollection()}>Collection</button>{" "}
          <button onClick={() => c.save()}>Save</button>{" "}
          <button className="primary" onClick={() => c.leaveTown()}>Leave town</button>
        </p>
      </div>
    </div>
  );
}

function CollectionScreen({ c, pool, oracle }: { c: WorldController; pool: Map<string, CardDef>; oracle: Record<string, OracleEntry> }) {
  const w = c.world!;
  const [filter, setFilter] = useState<"all" | "W" | "U" | "B" | "R" | "G" | "land">("all");
  const [printed, setPrinted] = useState(true); // S13 (Chris): printed by default
  const inDeck = new Map(w.player.activeDeck.map((e) => [e.cardId, e.count]));
  const entries = Object.entries(w.player.collection)
    .filter(([id]) => pool.has(id))
    .filter(([id]) => {
      const def = pool.get(id)!;
      if (filter === "all") return true;
      if (filter === "land") return def.types.includes("Land");
      return cardColors(def).includes(filter);
    })
    .sort((a, b) => (pool.get(a[0])!.name.localeCompare(pool.get(b[0])!.name)));
  return (
    <div className="gallery world-collection">
      <div className="gallery-header">
        <b style={{ fontFamily: "var(--serif)" }}>Collection</b>
        <span style={{ fontSize: 11 }}>{Object.values(w.player.collection).reduce((n, v) => n + v, 0)} cards · active deck {deckSize(w.player.activeDeck)} (read-only; the editor is M6b)</span>
        {(["all", "W", "U", "B", "R", "G", "land"] as const).map((f) => (
          <button key={f} className={filter === f ? "primary" : ""} onClick={() => setFilter(f)}>{f}</button>
        ))}
        <span style={{ flex: 1 }} />
        <button className="linkish" onClick={() => setPrinted(!printed)}>{printed ? "our frame" : "printed card"}</button>
        <button className="primary" onClick={() => c.closeCollection()}>Back</button>
      </div>
      <div className="gallery-grid">
        {entries.map(([id, n]) => (
          <div key={id} className="gallery-cell" style={{ textAlign: "center" }}>
            <CardFrame def={pool.get(id)!} oracle={oracle[id]} showPrinted={printed} />
            <div className="caption">
              ×{n}{inDeck.has(id) ? ` · in deck ×${inDeck.get(id)}` : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** S14 Part 2: the deck editor — spares | deck, click to move copies, basics row,
 * live legality (Save disabled with the reason), reading aids, name. */
function EditorScreen({ c, pool, oracle }: { c: WorldController; pool: Map<string, CardDef>; oracle: Record<string, OracleEntry> }) {
  const [filter, setFilter] = useState<"all" | "W" | "U" | "B" | "R" | "G" | "Creature" | "Instant" | "Sorcery" | "Enchantment" | "Artifact">("all");
  const [sort, setSort] = useState<"name" | "cost" | "colour">("cost");
  const [search, setSearch] = useState("");
  const [printed, setPrinted] = useState(false); // ADR-066: mini frames in the editor stay our frame; toggle available
  if (c.screen.kind !== "editor" || !c.world) return null;
  const { draft, name, notice } = c.screen;
  const w = c.world;
  const sp = spares(w.player.collection, draft);
  const legality = c.editorLegality();
  const stats = deckStats(pool, draft);
  const mv = (id: string) => { const d = pool.get(id)!; return d.types.includes("Land") ? -1 : deckStats(pool, [{ cardId: id, count: 1 }]).curve.findIndex((n) => n > 0); };
  const passes = (id: string) => {
    const def = pool.get(id);
    if (!def) return false;
    if (search && !def.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "all") return true;
    if (["W", "U", "B", "R", "G"].includes(filter)) return cardColors(def).includes(filter as "W");
    return def.types.includes(filter);
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
    <div key={id} className="editor-card" onClick={onClick} title={label}>
      <CardFrame def={pool.get(id)!} oracle={oracle[id]} mini showPrinted={printed} />
      <div className="editor-count">×{n}</div>
    </div>
  );
  const maxCurve = Math.max(1, ...stats.curve);
  return (
    <div className="gallery world-editor">
      <div className="gallery-header">
        <b style={{ fontFamily: "var(--serif)" }}>Deck editor</b>
        <input type="text" value={name} onChange={(e) => c.editorRename(e.target.value)} style={{ width: 140 }} title="deck name" />
        <span className={legality.ok ? "legal" : "illegal"} style={{ fontSize: 12 }}>
          {stats.size} cards · {stats.lands} lands · {legality.ok ? "legal" : legality.reason}
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
          {["all", "W", "U", "B", "R", "G", "Creature", "Instant", "Sorcery", "Enchantment", "Artifact"].map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="cost">by cost</option><option value="name">by name</option><option value="colour">by colour</option>
        </select>
        <button className="linkish" onClick={() => setPrinted(!printed)}>{printed ? "our frame" : "printed card"}</button>
        <button className="primary" disabled={!legality.ok} title={legality.ok ? "save this deck" : legality.reason} onClick={() => c.editorSave()}>Save deck</button>
        <button onClick={() => c.editorClose()}>Cancel</button>
      </div>
      {notice && <div style={{ color: "var(--danger)", fontSize: 12, padding: "0 6px 6px" }}>{notice}</div>}
      <div className="editor-panes">
        <div className="editor-pane">
          <div className="flyout-title">Spares — click to add ({spareIds.reduce((n, id) => n + (sp[id] ?? 0), 0)} owned, not in deck)</div>
          <div className="editor-grid">{spareIds.map((id) => cell(id, sp[id]!, () => c.editorAdd(id), "add one copy to the deck"))}</div>
          <div className="flyout-title" style={{ marginTop: 8 }}>Basic lands — free and infinite</div>
          <div className="basics-row">
            {BASIC_LANDS.map((b) => (
              <button key={b} onClick={() => c.editorAdd(b)}>+ {pool.get(b)?.name ?? b}</button>
            ))}
          </div>
        </div>
        <div className="editor-pane">
          <div className="flyout-title">Deck — click to remove ({stats.size})</div>
          <div className="editor-grid">
            {deckIds.map((id) => cell(id, draft.find((e) => e.cardId === id)!.count, () => c.editorRemove(id), isBasic(id) ? "remove one (basics are free to re-add)" : "remove one copy (back to spares)"))}
          </div>
        </div>
      </div>
    </div>
  );
}

function GameOverScreen({ c, onWatch, onNew }: { c: WorldController; onWatch: (() => void) | null; onNew: () => void }) {
  if (c.screen.kind !== "gameOver") return null;
  const w = c.world!;
  return (
    <div className="loader">
      <div className="box play-setup">
        <h2 style={{ fontFamily: "var(--serif)", marginTop: 0 }}>Your journey ends</h2>
        <p>World life reached 0 after {w.player.stepsTaken} steps and {w.duels.length} duel{w.duels.length === 1 ? "" : "s"}. Gold: {w.player.gold}. Cards: {Object.values(w.player.collection).reduce((n, v) => n + v, 0)}.</p>
        <p>
          {onWatch && <button onClick={onWatch}>Watch the fatal duel</button>}{" "}
          <button className="primary" onClick={onNew}>New journey</button>
        </p>
      </div>
    </div>
  );
}

export function WorldApp({ onWatchReplay }: { onWatchReplay: (game: SavedGame) => void }) {
  const pool = useMemo(loadPool, []);
  const catalog = useMemo(loadWorldCatalog, []);
  const [oracle, setOracle] = useState<Record<string, OracleEntry>>({});
  const controller = useMemo(() => new WorldController(pool, catalog), [pool, catalog]);
  const [, force] = useState(0);
  const lastDuel = useRef<{ match: import("../play/match-controller").MatchController } | null>(null);
  useEffect(() => controller.onChange(() => force((n) => n + 1)), [controller]);
  useMemo(() => {
    loadOracle().then(setOracle);
  }, []);
  useEffect(() => {
    controller.aiDelayMs = Number(localStorage.getItem("shandalar-ai-delay") ?? 400);
  }, [controller]);

  const c = controller;
  const download = () => {
    const blob = new Blob([c.saveText()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `world-${c.world!.seed}.json`;
    a.click();
  };
  const watch = (saved: unknown) => {
    c.save(); // never lose the journey to the viewer hand-off
    onWatchReplay(saved as SavedGame);
  };

  if (c.screen.kind === "start" || !c.world) return <StartScreen c={c} onStart={(choice) => c.newGame(choice)} />;
  if (c.screen.kind === "duel") {
    const m = c.screen.match;
    if (lastDuel.current?.match !== m) {
      m.stops = loadStops();
      lastDuel.current = { match: m };
    }
    return <PlayMatch c={m} pool={pool} oracle={oracle} onGameOver={() => { /* WorldController.finishDuel takes over */ }} />;
  }
  if (c.screen.kind === "duelResult") {
    const saved = c.screen.record.saved;
    return <DuelResultScreen c={c} pool={pool} oracle={oracle} onWatch={() => watch(saved)} />;
  }
  if (c.screen.kind === "collection") return <CollectionScreen c={c} pool={pool} oracle={oracle} />;
  if (c.screen.kind === "editor") return <EditorScreen c={c} pool={pool} oracle={oracle} />;
  if (c.screen.kind === "gameOver") {
    const fatal = c.screen.fatal;
    return <GameOverScreen c={c} onWatch={fatal ? () => onWatchReplay(fatal.saved as SavedGame) : null} onNew={() => { c.screen = { kind: "start" }; force((n) => n + 1); }} />;
  }
  // map / encounter / town share the map underneath
  const w = c.world;
  const screen = c.screen;
  return (
    <div className="app world-app">
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        <Chrome c={c} onDownload={download} />
        <div className="world-map-wrap">
          <WorldMapView
            map={w.map}
            player={w.player.position}
            portrait="/portrait-you.png"
            preview={screen.kind === "map" ? screen.preview : null}
            previewTarget={screen.kind === "map" ? screen.previewTarget : null}
            encounterAt={screen.kind === "encounter" ? screen.encounter.at : null}
            encounterPortrait={screen.kind === "encounter" ? `/portraits/${screen.tmpl.portraitChip ?? screen.tmpl.portrait}.png` : null}
            onClickCell={(p) => c.clickCell(p)}
          />
        </div>
        <div className="transport play-prompt">
          <span className="prompt-text">
            {screen.kind === "map"
              ? screen.notice ?? (screen.walking ? `Walking… step ${w.player.stepsTaken}` : screen.preview ? `Path: ${screen.preview.length} steps — click the destination again to walk.` : "Click a destination to preview the path.")
              : screen.kind === "encounter"
                ? `${screen.tmpl.name} blocks your way.`
                : screen.kind === "town"
                  ? `In ${screen.town.name}.`
                  : ""}
          </span>
          <span style={{ flex: 1 }} />
          {screen.kind === "map" && c.resumePath && c.resumePath.length > 0 && !screen.walking && (
            <button onClick={() => c.resumeWalk()}>Resume walk ({c.resumePath.length} steps)</button>
          )}
          <span className="seed">{w.map.regions.length} regions · {w.map.towns.length} towns</span>
        </div>
      </div>
      <div className="rail world-rail">
        <div className="panel">
          <h3>Journey</h3>
          <div style={{ fontSize: 12 }}>Duels: {w.duels.length} · won {w.duels.filter((d) => d.outcome === "win").length} · lost {w.duels.filter((d) => d.outcome === "loss").length}</div>
          <div style={{ fontSize: 12 }}>Opponents defeated: {w.opponents.filter((o) => o.defeated).length}/{w.opponents.length}</div>
          <div style={{ fontSize: 12 }}>Deck: {deckSize(w.player.activeDeck)} cards · basic {w.player.basicLand}</div>
        </div>
        <div className="panel">
          <h3>Regions</h3>
          {w.map.regions.map((r) => (
            <div key={r.index} style={{ fontSize: 12, display: "flex", justifyContent: "space-between" }}>
              <span>{r.name}</span><span style={{ color: "var(--ink-soft)" }}>{r.tier}</span>
            </div>
          ))}
        </div>
        <div className="panel">
          <h3>Recent duels</h3>
          {w.duels.slice(-6).reverse().map((d) => (
            <div key={d.index} style={{ fontSize: 11.5 }}>
              #{d.index + 1} {catalog.opponents.find((o) => o.id === d.catalogId)?.name ?? d.catalogId} — <b>{d.outcome}</b>{" "}
              <button className="linkish" onClick={() => watch(d.saved)}>replay</button>
            </div>
          ))}
          {w.duels.length === 0 && <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>none yet</div>}
        </div>
      </div>
      {screen.kind === "encounter" && <ParleyPanel c={c} />}
      {screen.kind === "town" && <TownScreen c={c} pool={pool} oracle={oracle} />}
    </div>
  );
}
