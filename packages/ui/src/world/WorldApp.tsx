import { useEffect, useMemo, useRef, useState } from "react";
import type { CardDef } from "@shandalar/cards";
import { cardColors } from "@shandalar/cards";
import { activeDeck, buyOffPrice, deckSize, deckStats, isBasic, isExplored, sellPrice, spares, BASIC_LANDS, type DifficultyName, type Point, type ShopItem, type StarterId } from "@shandalar/world";
import { loadOracle, loadPool, loadWorldCatalog, type OracleEntry, type SavedGame } from "../engine-bridge";
import { CardFrame } from "../components/CardFrame";
import { PlayMatch, loadStops } from "../play/PlayMatch";
import { WorldController, type NewGameChoice } from "./world-controller";
import { WorldMapView } from "./WorldMap";
import { FloatingCardInspector } from "./FloatingCardInspector";

/**
 * /world (S13): the overworld shell — start → map → encounter/parley → duel
 * (the play client) → consequences → town/shop/collection → save/load →
 * game over. Presentation only; every decision goes through WorldController.
 */

const COLOUR_NAME: Record<string, string> = { W: "White", U: "Blue", B: "Black", R: "Red", G: "Green" };
const TIER_BADGE = { 1: "I", 2: "II", 3: "III" } as const;

function StartScreen({ c, onStart }: { c: WorldController; onStart: (choice: NewGameChoice) => void }) {
  const starters = c.catalog.starters;
  const [starter, setStarter] = useState<StarterId>(starters[0]?.id ?? "green");
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
        {/* S18 rider (ADR-073): the Cinquefoil title — the S6 card back's five-petal compass rose is the device. */}
        <div className="title-plate">
          <div className="title-rose" aria-hidden="true"><img src="/card-back.png" alt="" /></div>
          <h1 className="title-name">Cinquefoil</h1>
          <div className="title-sub">five petals · three rings · one journey</div>
        </div>
        <div style={{ display: "flex", gap: 24, textAlign: "left", justifyContent: "center" }}>
          <div className="deck-picker">
            <div className="flyout-title">Your colour (starter deck)</div>
            {starters.map((s) => (
              <label key={s.id} className={starter === s.id ? "picked" : ""}>
                <input type="radio" checked={starter === s.id} onChange={() => setStarter(s.id)} /> {COLOUR_NAME[s.color] ?? s.color} — {s.name}
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
          <button className="primary" onClick={() => onStart({ starter, difficulty, name, ...(seed.trim() ? { seed: Number(seed) } : {}) })}>New game</button>{" "}
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
  // S18: parley voice from the catalog (verb/line/refusal), defaults by kind (ADR-066).
  const voice = tmpl.parley ?? {};
  const verb = voice.verb ?? (beast ? "Distract" : "Buy off");
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
              {tmpl.difficulty} · world life {tmpl.worldLife}
            </div>
            <div className="parley-sub">Stakes: {stake} card{stake === 1 ? "" : "s"} each (ante). You have {gold} gold.</div>
          </div>
        </div>
        {voice.line && <p className="parley-voice">{voice.line}</p>}
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
            {verb} ({price} gold)
            <small>
              {unbuyable
                ? voice.refusal ?? "Cannot be bought — it wants the fight."
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
            <p style={{ fontSize: 11 }}>Your deck refilled with {record.anteLost.length} {c.world!.player.basicLand.replace(/_/g, " ")}{record.anteLost.length === 1 ? "" : "s"} — swap a spare back in at the deck editor.</p>
          </>
        )}
        {record.outcome === "draw" && <p>No stakes change hands.</p>}
        {record.questRewards && record.questRewards.length > 0 && (
          <p style={{ color: "var(--brass)", fontSize: 12.5 }}><b>Bounty complete</b> — {record.questRewards.join("; ")}</p>
        )}
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

/** S19: the town's quest board — seeded offers (accept consumes for the game); card-courier offers
 * take a matching SPARE with the choice made here (the card leaves on acceptance — the text says so). */
function QuestBoard({ c, pool, onInspect }: { c: WorldController; pool: Map<string, CardDef>; onInspect: (id: string) => void }) {
  const [picks, setPicks] = useState<Record<string, string>>({});
  const offers = c.townQuestOffers();
  if (offers.length === 0) return <div className="flyout-title" style={{ marginTop: 8 }}>Quest board — nothing posted (all taken)</div>;
  return (
    <>
      <div className="flyout-title" style={{ marginTop: 8 }}>Quest board (accepting is free; the road is the cost)</div>
      <div className="quest-board">
        {offers.map((o) => {
          const options = o.kind === "cardCourier" ? c.questCardOptions(o) : [];
          const pick = picks[o.id] ?? options[0] ?? "";
          const rewardBits = [
            `${o.reward.gold} gold`,
            o.reward.cardId ? `+ ${pool.get(o.reward.cardId)?.name ?? o.reward.cardId}` : "",
            o.reward.manalink ? `+ a Manalink (${o.reward.manalink})` : "",
          ].filter(Boolean).join(" ");
          return (
            <div className="quest-offer" key={o.id}>
              <div className="quest-text">
                <span className={`tier-badge t${o.tier}`}>{["", "I", "II", "III"][o.tier]}</span> <b>{{ courier: "Courier", cardCourier: "Card courier", bounty: "Bounty" }[o.kind]}</b> — {o.text}
              </div>
              <div className="quest-meta">
                Reward: {rewardBits}{o.deadlineSteps > 0 ? ` · ${o.deadlineSteps} steps` : " · no deadline"}
                {o.kind === "cardCourier" && (
                  options.length > 0 ? (
                    <select value={pick} onChange={(e) => setPicks({ ...picks, [o.id]: e.target.value })} onMouseEnter={() => pick && onInspect(pick)}>
                      {options.map((id) => <option key={id} value={id}>{pool.get(id)?.name ?? id}</option>)}
                    </select>
                  ) : (
                    <span style={{ color: "var(--danger)" }}> — no spare matches</span>
                  )
                )}
                <button className="primary" disabled={o.kind === "cardCourier" && !pick} onClick={() => c.acceptQuest(o, o.kind === "cardCourier" ? pick : undefined)}>Accept</button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function TownScreen({ c, pool, oracle }: { c: WorldController; pool: Map<string, CardDef>; oracle: Record<string, OracleEntry> }) {
  const [printed, setPrinted] = useState(true); // S13 (Chris): printed by default
  const [inspect, setInspect] = useState<string | null>(null);
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
            <div key={item.cardId} className={`shop-item${item.remaining === 0 ? " sold-out" : ""}`} onMouseEnter={() => setInspect(item.cardId)}>
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
        <QuestBoard c={c} pool={pool} onInspect={setInspect} />
        <div className="flyout-title" style={{ marginTop: 8 }}>Sell spares (half price; basics and deck copies excluded)</div>
        <div className="sell-row">
          {Object.entries(spares(w.player.collection, activeDeck(w))).map(([id, n]) => (
            <button key={id} className="sell-chip" onClick={() => c.sell(id)} onMouseEnter={() => setInspect(id)} title={`sell one ${pool.get(id)?.name ?? id}`}>
              {pool.get(id)?.name ?? id} ×{n} · {sellPrice(pool.get(id)!, c.knobs)}g
            </button>
          ))}
          {Object.keys(spares(w.player.collection, activeDeck(w))).length === 0 && <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>no spares to sell</span>}
        </div>
        {notice && <p style={{ fontSize: 12, color: "var(--brass)" }}>{notice}</p>}
        <p>
          <button onClick={() => c.openEditor()}>Edit deck</button>{" "}
          <button onClick={() => c.openCollection()}>Collection</button>{" "}
          <button onClick={() => c.save()}>Save</button>{" "}
          <button className="primary" onClick={() => c.leaveTown()}>Leave town</button>
        </p>
      </div>
      <FloatingCardInspector def={inspect ? pool.get(inspect) ?? null : null} oracle={oracle} printed={printed} onTogglePrinted={() => setPrinted(!printed)} />
    </div>
  );
}

function CollectionScreen({ c, pool, oracle }: { c: WorldController; pool: Map<string, CardDef>; oracle: Record<string, OracleEntry> }) {
  const w = c.world!;
  const [filter, setFilter] = useState<"all" | "W" | "U" | "B" | "R" | "G" | "land">("all");
  const [printed, setPrinted] = useState(true); // S13 (Chris): printed by default
  const [inspect, setInspect] = useState<string | null>(null);
  const inDeck = new Map(activeDeck(w).map((e) => [e.cardId, e.count]));
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
        <span style={{ fontSize: 11 }}>{Object.values(w.player.collection).reduce((n, v) => n + v, 0)} cards · active deck {deckSize(activeDeck(w))} · {Object.keys(w.decks).length} saved deck{Object.keys(w.decks).length === 1 ? "" : "s"}</span>
        {(["all", "W", "U", "B", "R", "G", "land"] as const).map((f) => (
          <button key={f} className={filter === f ? "primary" : ""} onClick={() => setFilter(f)}>{f}</button>
        ))}
        <span style={{ flex: 1 }} />
        <button className="linkish" onClick={() => setPrinted(!printed)}>{printed ? "our frame" : "printed card"}</button>
        <button className="primary" onClick={() => c.closeCollection()}>Back</button>
      </div>
      <div className="gallery-grid">
        {entries.map(([id, n]) => (
          <div key={id} className="gallery-cell" style={{ textAlign: "center" }} onMouseEnter={() => setInspect(id)}>
            <CardFrame def={pool.get(id)!} oracle={oracle[id]} showPrinted={printed} />
            <div className="caption">
              ×{n}{inDeck.has(id) ? ` · in deck ×${inDeck.get(id)}` : ""}
            </div>
          </div>
        ))}
      </div>
      <FloatingCardInspector def={inspect ? pool.get(inspect) ?? null : null} oracle={oracle} printed={printed} onTogglePrinted={() => setPrinted(!printed)} />
    </div>
  );
}

/** S14 Part 2: the deck editor — spares | deck, click to move copies, basics row,
 * live legality (Save disabled with the reason), reading aids, name. */
function EditorScreen({ c, pool, oracle }: { c: WorldController; pool: Map<string, CardDef>; oracle: Record<string, OracleEntry> }) {
  const [filter, setFilter] = useState<"all" | "W" | "U" | "B" | "R" | "G" | "Creature" | "Instant" | "Sorcery" | "Enchantment" | "Artifact">("all");
  const [sort, setSort] = useState<"name" | "cost" | "colour">("cost");
  const [search, setSearch] = useState("");
  const [printed, setPrinted] = useState(true); // S14 round 1 (Chris): printed by default in the editor too
  const [inspect, setInspect] = useState<string | null>(null); // S14 round 2: hover → floating inspector
  // S18 rider (deck-picker polish): in-page deck ops replace the browser prompt() dialogs.
  const [op, setOp] = useState<null | { kind: "new" | "duplicate" | "delete" | "switch"; value: string }>(null);
  if (c.screen.kind !== "editor" || !c.world) return null;
  const { draft, name, notice } = c.screen;
  const w = c.world;
  const savedDeck = activeDeck(w);
  const dirty = name !== w.activeDeckName || draft.length !== savedDeck.length || draft.some((e) => savedDeck.find((x) => x.cardId === e.cardId)?.count !== e.count);
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
        <b style={{ fontFamily: "var(--serif)" }}>Deck editor</b>
        {/* S16 (v3): the deck picker — switch / new / duplicate / delete. S18: in-page ops, dirty-draft guard on switch. */}
        <select value={w.activeDeckName} title={dirty ? "your saved decks (you have unsaved changes — switching asks first)" : "your saved decks"} onChange={(e) => { const n = e.target.value; if (n === w.activeDeckName) return; if (dirty) setOp({ kind: "switch", value: n }); else c.deckSwitch(n); }}>
          {c.deckNames().map((n) => <option key={n} value={n}>{n}{n === w.activeDeckName ? " (active)" : ""}</option>)}
        </select>
        <button className="linkish" title="a new deck of 30 basics to build from" onClick={() => setOp({ kind: "new", value: `Deck ${c.deckNames().length + 1}` })}>new</button>
        <button className="linkish" title="copy the active deck" onClick={() => setOp({ kind: "duplicate", value: `${w.activeDeckName} (copy)` })}>duplicate</button>
        <button className="linkish" title="delete a non-active deck" disabled={c.deckNames().length < 2} onClick={() => setOp({ kind: "delete", value: c.deckNames().find((n) => n !== w.activeDeckName) ?? "" })}>delete</button>
        <input type="text" value={name} onChange={(e) => c.editorRename(e.target.value)} style={{ width: 140 }} title="deck name (saved with the deck)" />
        {dirty && <span className="draft-dirty" title="unsaved changes to this deck">unsaved</span>}
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
        <button onClick={() => c.editorReset()} title="discard draft changes (back to the saved deck)">Reset</button>
        <button onClick={() => c.editorClose()}>Cancel</button>
      </div>
      {op && (
        <div className="deck-op-row">
          {op.kind === "switch" ? (
            <>
              <span>Switch to <b>{op.value}</b>? Your unsaved changes to <b>{w.activeDeckName}</b> will be discarded.</span>
              <button className="primary" onClick={() => { c.deckSwitch(op.value); setOp(null); }}>Switch</button>
              <button onClick={() => setOp(null)}>Keep editing</button>
            </>
          ) : op.kind === "delete" ? (
            <>
              <span>Delete which deck?</span>
              <select value={op.value} onChange={(e) => setOp({ ...op, value: e.target.value })}>
                {c.deckNames().filter((n) => n !== w.activeDeckName).map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <button className="danger" disabled={!op.value} onClick={() => { if (c.deckDelete(op.value)) setOp(null); }}>Delete</button>
              <button onClick={() => setOp(null)}>Cancel</button>
            </>
          ) : (
            <>
              <span>{op.kind === "new" ? "Name the new deck (30 basics to build from):" : `Copy "${w.activeDeckName}" as:`}</span>
              <input type="text" autoFocus value={op.value} onChange={(e) => setOp({ ...op, value: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter" && op.value.trim()) { if ((op.kind === "new" ? c.deckNew(op.value) : c.deckDuplicate(op.value))) setOp(null); } if (e.key === "Escape") setOp(null); }} style={{ width: 180 }} />
              <button className="primary" disabled={!op.value.trim() || c.deckNames().includes(op.value.trim())} title={c.deckNames().includes(op.value.trim()) ? "a deck with that name exists" : ""} onClick={() => { if ((op.kind === "new" ? c.deckNew(op.value) : c.deckDuplicate(op.value))) setOp(null); }}>{op.kind === "new" ? "Create" : "Duplicate"}</button>
              <button onClick={() => setOp(null)}>Cancel</button>
            </>
          )}
        </div>
      )}
      <FloatingCardInspector def={inspect ? pool.get(inspect) ?? null : null} oracle={oracle} printed={printed} onTogglePrinted={() => setPrinted(!printed)} />
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
  // S18 director round (Chris, OQ-7): look around without walking — arrow keys pan the viewport
  // (3 cells), minimap clicks pan there too, Home / the ⌖ button / walking re-centres on you.
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const panRef = useRef(pan);
  panRef.current = pan;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (controller.screen.kind !== "map") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      const step = 3;
      const d: Record<string, Point> = { ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 }, ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step } };
      if (d[e.key]) { e.preventDefault(); setPan((p) => ({ x: p.x + d[e.key]!.x, y: p.y + d[e.key]!.y })); }
      else if (e.key === "Home") { e.preventDefault(); setPan({ x: 0, y: 0 }); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [controller]);
  const lastPos = useRef<string>("");
  useEffect(() => {
    const w = controller.world;
    const key = w ? `${w.player.position.x},${w.player.position.y}` : "";
    if (key !== lastPos.current) { lastPos.current = key; if (panRef.current.x || panRef.current.y) setPan({ x: 0, y: 0 }); }
  });

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
  // S18 fog: the rail only names what the player has seen (a fixed point once its cell is explored;
  // a region once any of its cells is).
  const seenCell = (p: Point) => !w.explored || isExplored(w.explored, w.map, p);
  const seenRegions = new Set<number>();
  if (w.explored) { for (let i = 0; i < w.map.region.length; i++) if (isExplored(w.explored, w.map, { x: i % w.map.width, y: Math.floor(i / w.map.width) })) seenRegions.add(w.map.region[i]!); }
  else w.map.regions.forEach((r) => seenRegions.add(r.index));
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
            clearedFixed={new Set(w.map.strongholds.map((f, i) => (w.opponents.find((o) => o.id === f.opponentId)?.gone ? i : -1)).filter((i) => i >= 0))}
            roamers={c.visibleRoamers().map((r) => ({ id: r.inst.id, at: r.inst.at!, portrait: `/portraits/${r.tmpl.portraitChip ?? r.tmpl.portrait}.png`, name: r.tmpl.name, tier: r.tmpl.tier, fleeing: r.fleeing }))}
            sightRadius={c.knobs.sightRadius}
            explored={w.explored}
            pan={pan}
            onPan={(p) => setPan(p)}
            marks={c.activeQuests().filter((x) => x.quest.bountySeenAt).map((x) => ({ at: x.quest.bountySeenAt!, label: `${x.targetName ?? "bounty"} (last seen)` }))}
            onClickCell={(p) => c.clickCell(p)}
          />
        </div>
        <div className="transport play-prompt">
          <span className="prompt-text">
            {screen.kind === "map"
              ? screen.notice ?? (screen.walking ? `Walking… step ${w.player.stepsTaken}` : screen.preview ? `Path: ${screen.preview.length} steps — click the destination again to walk.` : "Click a destination to preview the path.")
              : screen.kind === "encounter"
                ? screen.encounter.contact === "reached"
                  ? `${screen.tmpl.name} catches up with you.`
                  : screen.encounter.fleeing
                    ? `You run down ${screen.tmpl.name} — they were fleeing.`
                    : screen.encounter.contact === "lair"
                      ? `${screen.tmpl.name} guards this place.`
                      : `${screen.tmpl.name} blocks your way.`
                : screen.kind === "town"
                  ? `In ${screen.town.name}.`
                  : ""}
          </span>
          <span style={{ flex: 1 }} />
          {screen.kind === "map" && c.resumePath && c.resumePath.length > 0 && !screen.walking && (
            <button onClick={() => c.resumeWalk()}>Resume walk ({c.resumePath.length} steps)</button>
          )}
          <span className="seed">{seenRegions.size}/{w.map.regions.length} regions seen · {w.map.towns.filter((t) => seenCell(t.at)).length}/{w.map.towns.length} towns found</span>
        </div>
      </div>
      <div className="rail world-rail">
        <div className="panel">
          <h3>Journey</h3>
          <div style={{ fontSize: 12 }}>Duels: {w.duels.length} · won {w.duels.filter((d) => d.outcome === "win").length} · lost {w.duels.filter((d) => d.outcome === "loss").length}</div>
          <div style={{ fontSize: 12 }}>Opponents defeated: {w.opponents.filter((o) => o.goneReason === "defeated").length} · renown {w.player.renown} · roaming now {w.opponents.filter((o) => !o.gone && o.at).length}</div>
          <div style={{ fontSize: 12 }}>Deck: {deckSize(activeDeck(w))} cards · basic {w.player.basicLand}</div>
        </div>
        <div className="panel">
          <h3>Quests</h3>
          {c.activeQuests().map(({ quest: q, stepsLeft, destName, targetName }) => (
            <div key={q.id} style={{ fontSize: 11.5, marginBottom: 4 }}>
              <b>{{ courier: "Courier", cardCourier: "Card courier", bounty: "Bounty" }[q.kind]}</b>
              {destName ? <> → {destName}</> : null}
              {targetName ? <> — {targetName}{q.bountySeenAt ? " (marked on your map)" : " (not yet sighted)"}</> : null}
              {stepsLeft !== null && <span style={{ color: stepsLeft < 40 ? "var(--danger)" : "var(--ink-soft)" }}> · {stepsLeft} steps left</span>}
              <button className="linkish" style={{ marginLeft: 4 }} title="abandon (fails the quest; a sent card is already gone)" onClick={() => c.abandonQuest(q.id)}>abandon</button>
            </div>
          ))}
          {c.activeQuests().length === 0 && <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>none — town boards post them</div>}
          {c.world && c.world.manalinks.length > 0 && (
            <div style={{ fontSize: 11.5, marginTop: 4 }}>Manalinks: {c.world.manalinks.map((m) => m.color).join(", ")} — every duel starts with them in play.</div>
          )}
        </div>
        <div className="panel">
          <h3>Lairs &amp; strongholds</h3>
          {w.map.strongholds.map((f, i) => {
            if (!seenCell(f.at)) return null;
            const resident = w.opponents.find((o) => o.id === f.opponentId);
            const status = f.kind === "stronghold" ? "castle · sealed" : resident?.gone ? "cleared" : `${w.map.regions[f.region]?.name ?? ""} · waiting`;
            return (
              <div key={i} style={{ fontSize: 12, display: "flex", justifyContent: "space-between", cursor: screen.kind === "map" ? "pointer" : "default" }} title="click to preview the path there" onClick={() => c.clickCell(f.at)}>
                <span>{f.name ?? f.kind}</span><span style={{ color: f.kind === "stronghold" ? "var(--ink-soft)" : resident?.gone ? "var(--boost)" : "var(--danger)" }}>{status}</span>
              </div>
            );
          })}
          {w.map.strongholds.filter((f) => seenCell(f.at)).length === 0 && <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>none found yet</div>}
        </div>
        <div className="panel">
          <h3>Regions</h3>
          {[...w.map.regions].filter((r) => seenRegions.has(r.index)).sort((a, b) => (a.spoke ?? 0) - (b.spoke ?? 0) || ["civilized", "approach", "wild"].indexOf(a.tier) - ["civilized", "approach", "wild"].indexOf(b.tier)).map((r) => (
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
