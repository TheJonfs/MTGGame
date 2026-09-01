import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CardDef } from "@shandalar/cards";
import { cardColors } from "@shandalar/cards";
import { activeDeck, buyOffPrice, deckSize, deckStats, dungeonAsWorldMap, isBasic, isExplored, lordPronouns, maxWorldLife, sellPrice, spares, BASIC_LANDS, type DifficultyName, type Point, type ShopItem, type StarterId } from "@shandalar/world";
import { loadOracle, loadPool, loadWorldCatalog, type OracleEntry, type SavedGame } from "../engine-bridge";
import { CardFrame } from "../components/CardFrame";
import { PlayMatch, loadStops } from "../play/PlayMatch";
import { WorldController, type NewGameChoice } from "./world-controller";
import { audio, townMusicCue, strongholdSplashCue, type MusicCue } from "../audio/audio";
import { COROLLA_DECKS } from "@shandalar/sim/corolla-decks";
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
  // S23 audio (ADR-084): the prominent front-page toggle — persisted; sound begins at the
  // first interaction per browser reality regardless of this default.
  const [sound, setSound] = useState(audio.isEnabled());
  const toggleSound = () => {
    audio.setEnabled(!sound);
    setSound(!sound);
  };
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
        {/* S23 audio: prominent, front-page, persisted (ADR-082/084). */}
        <p className="audio-toggle">
          <button className={sound ? "sound-on" : "sound-off"} onClick={toggleSound} title="Sound preference is remembered. Music begins after your first click (the browser's rule, not ours).">
            {sound ? "♪ Sound on" : "♪ Sound off"}
          </button>
        </p>
        <p style={{ fontSize: 11 }}>
          <a className="linkish" href="/">⟵ main menu</a>
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
      {/* S22 r2 (Chris): pictorial trackers — the ink-icon register replaces the plain SVGs. */}
      {/* S24 (ADR-086): life reads current / maximum — the maximum moves now (life manalinks, suspension). */}
      <span className="stat" title={`world life (maximum ${maxWorldLife(w)} = base + active life manalinks)`}><img className="stat-ink" src="/icons/stat-life.png" alt="" /> {w.player.worldLife}<span style={{ fontSize: 11, color: "var(--ink-soft)" }}>/{maxWorldLife(w)}</span></span>
      <span className="stat" title="gold"><img className="stat-ink" src="/icons/stat-gold.png" alt="" /> {w.player.gold}</span>
      <span className="stat" title="steps (the clock)"><img className="stat-ink" src="/icons/stat-steps.png" alt="" /> {w.player.stepsTaken} steps</span>
      <span style={{ flex: 1 }} />
      <button className="chrome-tab" title={c.canEdit().ok ? "edit your deck (clock-free)" : c.canEdit().reason} disabled={!c.canEdit().ok} onClick={() => c.openEditor()}>Deck</button>
      <button className="chrome-tab" onClick={() => c.openCollection()}>Collection</button>
      <button className="chrome-tab" onClick={() => c.save()}>Save</button>
      <button className="chrome-tab" onClick={onDownload}>Download</button>
      <AudioTab />
      <span className="seed">seed {w.seed} · {w.difficulty}</span>
    </div>
  );
}

/** S23 audio (Chris at kickoff): the in-game mute beside the chrome tabs — same persisted
 * preference as the front page's toggle. */
function AudioTab() {
  const [, force] = useState(0);
  useEffect(() => audio.subscribe(() => force((n) => n + 1)), []);
  const on = audio.isEnabled();
  return (
    <button className="chrome-tab" title={on ? "Mute" : "Sound on"} onClick={() => audio.setEnabled(!on)} aria-label="toggle sound">
      {on ? "♪" : "♪×"}
    </button>
  );
}

/** S25 (ADR-088): the Powers rail — five rows, form + seal state + live costs, actions for the
 * world-side three (the Quietus and Barrage act at the parley menu and say so). */
function PowersRailPanel({ c }: { c: WorldController }) {
  const rows = c.powersRail();
  if (rows.length === 0) return null;
  const learned = rows.filter((r) => r.unlocked).length;
  const crossings = c.crossingList();
  return (
    <RailPanel title="Powers" badge={learned ? `${learned}/5` : undefined} defaultOpen={learned > 0}>
      {rows.map((r) => (
        <div key={r.color} style={{ fontSize: 12, marginTop: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span><i className={`colour-pip c-${r.color}`} title={r.color} /> <b>{r.name.replace(/^the /, "The ")}</b></span>
            <span style={{ color: r.advanced ? "var(--boost)" : "var(--ink-soft)", fontSize: 10.5 }}>{r.unlocked ? (r.advanced ? "advanced · seal held" : "initial") : "unlearned"}</span>
          </div>
          {!r.unlocked && <div style={{ fontSize: 10.5, color: "var(--ink-soft)" }}>somewhere, this is taught</div>}
          {r.unlocked && r.color === "G" && (
            r.running
              ? <div style={{ fontSize: 11, color: "var(--boost)" }}>running — {r.running} steps of double pace left</div>
              : <button className="linkish" disabled={!!r.reason} title={r.reason ?? ""} style={{ fontSize: 11 }} onClick={() => c.openPower({ kind: "stride" })}>
                  activate: {r.stride!.cost} G spares → {r.stride!.durationSteps} steps at ×{r.stride!.cells}
                </button>
          )}
          {r.unlocked && r.color === "W" && (
            <button className="linkish" disabled={!!r.reason} title={r.reason ?? ""} style={{ fontSize: 11 }} onClick={() => c.openPower({ kind: "balm", lives: 1 })}>
              heal: {r.balm!.costPerLife} W spares per life
            </button>
          )}
          {r.unlocked && r.color === "U" && (
            crossings.length === 0
              ? <div style={{ fontSize: 10.5, color: "var(--ink-soft)" }}>no town calls — the Crossing answers only danger</div>
              : crossings.map((d) => (
                  <div key={d.townIndex}>
                    <button className="linkish" disabled={!!r.reason} title={r.reason ?? ""} style={{ fontSize: 11 }} onClick={() => c.openPower({ kind: "crossing", townIndex: d.townIndex })}>
                      cross to {d.name} ({r.crossing!.cost} U) — {d.status === "occupied" ? "OCCUPIED" : `falls in ${d.stepsLeft}`}
                    </button>
                  </div>
                ))
          )}
          {r.unlocked && r.color === "B" && <div style={{ fontSize: 10.5, color: "var(--ink-soft)" }}>{r.quietus!.costs[1]}/{r.quietus!.costs[2]}/{r.quietus!.costs[3]} B by tier — acts at the parley menu</div>}
          {r.unlocked && r.color === "R" && <div style={{ fontSize: 10.5, color: "var(--ink-soft)" }}>{r.barrage!.costPerDamage} R per damage, cap {r.barrage!.cap} — acts at the parley menu</div>}
        </div>
      ))}
    </RailPanel>
  );
}

/** S25: the fuel picker — auto-suggested cheapest spares, deliberate override, the
 * sole-mechanism double-confirm ("there is exactly one, and it was yours"). */
function FuelPickerModal({ c }: { c: WorldController }) {
  const p = c.fuelPicker;
  if (!p) return null;
  const chosenCount = (id: string) => p.chosen.filter((x) => x === id).length;
  const amount = p.action.kind === "balm" ? p.action.lives : p.action.kind === "barrage" ? p.action.damage : null;
  return (
    <div className="gallery-modal" style={{ zIndex: 55 }}>
      <div className="gallery-modal-box play-dialog" style={{ maxWidth: 460 }}>
        <h3 style={{ margin: "0 0 4px", fontFamily: "var(--serif)" }}>{p.title.replace(/^the /, "The ")} — choose the fuel</h3>
        {amount !== null && (
          <div style={{ fontSize: 12, marginBottom: 4 }}>
            {p.action.kind === "balm" ? "Life to restore" : "Damage dealt"}:{" "}
            <button className="linkish" onClick={() => c.pickerSetAmount(amount - 1)}>−</button> <b>{amount}</b>{" "}
            <button className="linkish" onClick={() => c.pickerSetAmount(amount + 1)}>+</button>
          </div>
        )}
        <div style={{ fontSize: 12, marginBottom: 6 }}>
          Burn <b>{p.cost}</b> {p.color} spare{p.cost === 1 ? "" : "s"} — chosen {p.chosen.length}/{p.cost}.{" "}
          <button className="linkish" onClick={() => c.pickerSuggest()}>suggest cheapest</button>
        </div>
        <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid var(--line, #ccc)", padding: 4 }}>
          {p.candidates.map((cand) => (
            <div key={cand.cardId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, padding: "2px 0", ...(cand.soleMechanism ? { color: "var(--danger)" } : {}) }}>
              <span title={cand.soleMechanism ? "sole-mechanism: there is exactly one" : `~${cand.price}g at a shop`}>
                {cand.name}{cand.soleMechanism ? " ⚠" : ""} <i style={{ color: "var(--ink-soft)" }}>×{cand.available}</i>
              </span>
              <span>
                <button className="linkish" disabled={chosenCount(cand.cardId) === 0} onClick={() => c.pickerRemove(cand.cardId)}>−</button>
                <b style={{ margin: "0 5px" }}>{chosenCount(cand.cardId)}</b>
                <button className="linkish" disabled={chosenCount(cand.cardId) >= cand.available || p.chosen.length >= p.cost} onClick={() => c.pickerAdd(cand.cardId)}>+</button>
              </span>
            </div>
          ))}
          {p.candidates.length === 0 && <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>no {p.color} spares at all</div>}
        </div>
        {p.notice && <p style={{ color: p.armed ? "var(--danger)" : "var(--ink-soft)", fontSize: 12, fontWeight: p.armed ? 700 : 400 }}>{p.notice}</p>}
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button className="primary" disabled={p.chosen.length !== p.cost} onClick={() => c.pickerConfirm()}>{p.armed ? "Burn it forever" : "Confirm the burn"}</button>
          <button onClick={() => c.pickerCancel()}>Cancel</button>
        </div>
      </div>
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
          {/* S25 (ADR-088): the menu grows by up to two — costs live, greyed with reason. */}
          {(() => {
            const q = c.quietusOption();
            if (!q) return null;
            return (
              <button disabled={!!q.reason} title={q.reason ?? ""} onClick={() => c.openPower({ kind: "quietus" })}>
                The Quietus ({q.cost} B spares)
                <small>{q.reason ?? "They die without a blow. Their stake only — no gold, and fear spreads where respect would have."}</small>
              </button>
            );
          })()}
          {(() => {
            const b = c.barrageOption();
            if (!b) return null;
            const start = Math.max(1, Math.min(b.cap, Math.floor(b.depth / b.costPerDamage)));
            return (
              <button disabled={!!b.reason} title={b.reason ?? ""} onClick={() => c.openPower({ kind: "barrage", damage: start })}>
                The Barrage ({b.costPerDamage} R per damage, cap {b.cap})
                <small>{b.reason ?? "Open the duel with damage already dealt — they floor at 1 and still fight."}</small>
              </button>
            );
          })()}
        </div>
        {notice && <p style={{ color: "var(--danger)", fontSize: 12 }}>{notice}</p>}
        {/* S22 r2: the in-situ portrait verdict affordance retired — Chris blanket-approved all pending
            portraits; a future candidate round re-adds it with its candidates. */}
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
        {record.outcome === "loss" && (
          /* S24 (Part 2, Chris-directed): the defeat itemizes its whole bill — the toll first. */
          <p className="dungeon-law" style={{ borderColor: "var(--danger)" }}>
            <b>The road exacts its toll:</b> {before.life - after.life > 0 ? <>−{before.life - after.life} world life ({after.life} remains{after.life === 0 ? " — none" : ""})</> : "your life holds"}{record.anteLost.length > 0 ? <> · your stake of {record.anteLost.length} card{record.anteLost.length === 1 ? "" : "s"} is taken</> : " · no stake was lost"}.
          </p>
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
            o.reward.manalink ? ((o.reward.manalinkKind ?? "basic") === "life" ? `+ a Life Manalink (+1 max life, town-tied)` : `+ a Manalink (a ${{ W: "Plains", U: "Island", B: "Swamp", R: "Mountain", G: "Forest" }[o.reward.manalink]} in play, town-tied)`) : "", // S25 r4 note 3: the kind is named up front
          ].filter(Boolean).join(" ");
          return (
            <div className="quest-offer" key={o.id}>
              <div className="quest-text">
                <span className={`tier-badge t${o.tier}`}>{["", "I", "II", "III"][o.tier]}</span> <b>{{ courier: "Courier", cardCourier: "Card courier", bounty: "Bounty", retrieval: "Retrieval" }[o.kind]}</b> — {o.text}
              </div>
              <div className="quest-meta">
                Reward: {o.kind === "retrieval" ? `${o.retrievalItem?.cardName ?? "the item"} if you keep it — or ${o.reward.gold} gold delivered back here` : rewardBits}{o.deadlineSteps > 0 ? ` · ${o.deadlineSteps} steps` : " · no deadline"}
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

/** S19 round 2 (Chris): the completion announcement — a small ceremony, not a notice line. */
function QuestDonePopup({ c }: { c: WorldController }) {
  const items = c.questPopup!;
  return (
    <div className="gallery-modal" style={{ zIndex: 40 }}>
      <div className="gallery-modal-box play-dialog quest-done">
        {/* S22 r2: the popup is general news now (quests done, sieges landing/falling) — per-item titles. */}
        <h3 style={{ marginTop: 0, fontFamily: "var(--serif)" }}>{items.length > 1 ? "News of the road" : items[0]!.title}</h3>
        {items.map((it, i) => (
          <div key={i} className="quest-done-item">
            {items.length > 1 && <p style={{ fontFamily: "var(--serif)", fontWeight: 700, margin: "4px 0 0" }}>{it.title}</p>}
            <p className="quest-done-text">{it.quest}</p>
            <p className="quest-done-reward">{it.title.startsWith("A town") ? it.reward : <>Reward: <b>{it.reward}</b></>}</p>
          </div>
        ))}
        <p style={{ textAlign: "right", marginBottom: 0 }}>
          <button className="primary" onClick={() => c.dismissQuestPopup()}>{items.some((it) => it.title.startsWith("A town")) ? "Understood" : "Take it"}</button>
        </p>
      </div>
    </div>
  );
}

/** S24 r5 (Chris): a granted manalink's OWN ceremony — the splash that gives the Manalink
 * sting room to ring (it was drowning under Winduel inside the news modal). Renders above
 * everything; dismissing reveals whatever news waits beneath. */
function ManalinkSplash({ c }: { c: WorldController }) {
  const items = c.manalinkSplash;
  if (!items || items.length === 0) return null;
  const m = items[0]!;
  const LAND: Record<string, string> = { W: "Plains", U: "Island", B: "Swamp", R: "Mountain", G: "Forest" };
  return (
    <div className="gallery-modal" style={{ zIndex: 60 }}>
      <div className="gallery-modal-box play-dialog" style={{ maxWidth: 560, padding: 0, overflow: "hidden" }}>
        <img src="/manalink.jpg" alt="" style={{ width: "100%", display: "block", borderBottom: "2px solid var(--ink)" }} />
        <div style={{ padding: "12px 16px 14px" }}>
          <h2 style={{ fontFamily: "var(--serif)", margin: "0 0 6px" }}>A manalink is granted</h2>
          <p style={{ fontSize: 13.5, margin: "0 0 10px" }}>
            {m.kind === "life"
              ? <>The bond with <b>{m.townName}</b> steadies your very heart — <b>your maximum world life rises by 1</b> while the town stands free.</>
              : <>The bond with <b>{m.townName}</b> reaches every battlefield — <b>a {LAND[m.color]} stands with you from the first turn</b> of every duel, while the town stands free.</>}
          </p>
          <p style={{ textAlign: "right", margin: 0 }}>
            <button className="primary" onClick={() => c.dismissManalinkSplash()}>Take it up</button>
          </p>
        </div>
      </div>
    </div>
  );
}

/** S21: the siege engagement telegraph — the party, the life-carry law, the stakes (resume-aware). */
function SiegeTelegraph({ c }: { c: WorldController }) {
  if (c.screen.kind !== "siegeTelegraph" || !c.world) return null;
  const info = c.siegeInfo(c.screen.townIndex);
  if (!info) return null;
  const notice = c.screen.notice;
  const verb = info.kind === "liberation" ? "Liberate" : "Drive them off";
  return (
    <div className="gallery-modal">
      <div className="gallery-modal-box play-dialog dungeon-telegraph">
        <h2 style={{ marginTop: 0, fontFamily: "var(--serif)" }}>{info.kind === "liberation" ? `${info.town.name}, occupied` : `${info.town.name}, under siege`}</h2>
        <p className="parley-sub">
          {info.kind === "liberation"
            ? "The town is theirs. Its market, quest board, and granted gifts are dark until it is freed."
            : `The band strikes in ${info.stepsLeft ?? "?"} steps. Break them now, or the town falls.`}
        </p>
        <div style={{ display: "flex", gap: 10, margin: "10px 0", alignItems: "center" }}>
          {info.party.map((m, i) => (
            <div key={i} style={{ textAlign: "center", opacity: m.fallen ? 0.35 : 1 }}>
              <img className="parley-portrait" src={`/portraits/${m.tmpl.portraitChip ?? m.tmpl.portrait}.png`} alt="" style={{ width: 56, height: 56 }} title={m.tmpl.name} />
              <div style={{ fontSize: 10.5 }}>{m.fallen ? "fallen" : `${m.tmpl.name.length > 16 ? m.tmpl.name.slice(0, 15) + "…" : m.tmpl.name} · ${["", "I", "II", "III"][m.tmpl.tier]}`}</div>
            </div>
          ))}
        </div>
        <ul className="dungeon-stakes">
          <li><b>Consecutive fights, one life track</b> — your life carries battle to battle (starting at your world life, {c.world.player.worldLife}) and is discarded when it ends. The last of them holds the {info.kind === "liberation" ? "town's heart" : "line"}.</li>
          <li>Each fight antes as usual; <b>a single loss ends the attempt</b> — ordinary loss costs apply and their band regroups to full strength.</li>
          {/* S22 r3 (Chris, item 10): the purse is stated up front. */}
          <li>Winnings pay <b>immediately</b> (ante, gold, renown) — the band's heads are worth <b>{info.party.filter((m) => !m.fallen).reduce((n, m) => n + c.knobs.goldRewardByTier[m.tmpl.tier], 0)} gold</b> together, plus each fight's stake. A town is not a mountain.</li>
        </ul>
        {notice && <p style={{ fontSize: 12, color: "var(--ink-soft)" }}>{notice}</p>}
        <p style={{ textAlign: "right", marginBottom: 0 }}>
          <button onClick={() => c.declineSiege()}>Not yet</button>{" "}
          <button className="primary" onClick={() => c.enterSiege()}>{info.resume ? `${verb} (resume)` : verb}</button>
        </p>
      </div>
    </div>
  );
}

/** S20: the dungeon threshold — the stakes stated before the choice (dungeon-design §4). */
function DungeonTelegraph({ c }: { c: WorldController }) {
  if (c.screen.kind !== "dungeonTelegraph") return null;
  const { info } = c.screen;
  const mox = info.kind === "mox" ? c.moxDef(info.dungeonId) : undefined;
  const sh = info.kind === "stronghold" ? c.strongholdDef(info.dungeonId) : undefined;
  const pd = info.kind === "power" ? c.powerDef(info.dungeonId) : undefined; // S25: the power-dungeons
  const resident = info.residentCatalogId ? c.catalog.opponents.find((o) => o.id === info.residentCatalogId) : undefined;
  const tiers = info.kind === "stronghold" ? c.knobs.strongholdEmpowermentTiers : c.knobs.dungeonEmpowermentTiers; // S22 r1: the lord's own clock
  const status = c.world?.dungeons[info.dungeonId];
  // S20 playtest r3 (Chris): the telegraph shows the face at the deep end — the guardian's
  // portrait (dungeons.json), the lord's (S22b), or the lair resident's.
  const portrait = sh ? sh.lord.portrait : mox ? mox.guardian.portrait : pd ? pd.guardian.portrait : resident ? (resident.portraitChip ?? resident.portrait) : null;
  const holderName = sh ? sh.lord.name : mox ? mox.guardian.name : pd ? pd.guardian.name : resident?.name;
  const lordRow = sh ? c.lordStatusRows().find((r) => r.strongholdId === sh.id) : undefined;
  return (
    <div className="gallery-modal">
      <div className="gallery-modal-box play-dialog dungeon-telegraph">
        {/* S24 (mapping v3's companion): the SPLASH — a seat announces itself with its gate plate
            while its castle theme plays through this telegraph (interiors stay silent). */}
        {sh && (
          <div style={{ margin: "-14px -14px 12px", overflow: "hidden", borderBottom: "2px solid var(--ink)" }}>
            <img src={`/gate-plates/${sh.id}.jpg`} alt="" style={{ width: "100%", display: "block", maxHeight: 240, objectFit: "cover" }} />
          </div>
        )}
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          {portrait && <img className="parley-portrait" src={`/portraits/${portrait}.png`} alt="" style={{ width: 72, height: 72, flexShrink: 0 }} title={holderName} />}
          <div>
            <h2 style={{ margin: 0, fontFamily: "var(--serif)" }}>{info.name}</h2>
            <p className="parley-sub" style={{ marginBottom: 0 }}>{sh ? `${holderName} holds this seat. One-time: broken, it is broken forever.` : info.kind === "mox" || info.kind === "power" ? `${holderName} waits at the deep end. One-time: cleared, it is ground forever.` : `${resident?.name ?? "Something"} holds these halls.`}{status && status.resets > 0 ? ` · reset ${status.resets}×` : ""}</p>
          </div>
        </div>
        {mox && <p className="dungeon-law"><b>{mox.law.name}:</b> {mox.law.text}</p>}
        {pd && <p className="dungeon-law" style={{ fontStyle: "italic" }}>{pd.teaches} <b>No law binds these halls.</b></p>}
        {sh && <p className="dungeon-law"><b>{sh.law.name}:</b> {sh.law.text} <i>(the law stands in every fight inside — tear it down and it returns for the next; it is a permanent, and permanents can be answered)</i></p>}
        {lordRow && sh && (() => { const p = lordPronouns(sh.lord); /* S24 r1 (Chris): the Usher and the Sower are she */ return (
          <p style={{ fontSize: 12.5 }}><b>{lordRow.lordName}</b> fights at <b>{lordRow.life}</b> life today ({lordRow.base} base{lordRow.growth > 0 ? ` +${lordRow.growth} grown while you walked` : ""}{lordRow.reduction > 0 ? ` −${lordRow.reduction} bled by your hunting` : ""}; never below {c.knobs.lordLifeFloor}) — plus whatever your steps inside feed {p.obj}. {p.Pos} signature always looms: it starts in {p.pos} hand.</p>
        ); })()}
        <ul className="dungeon-stakes">
          <li>The world's clock <b>freezes</b> at this threshold; your steps inside feed the {info.kind === "stronghold" ? "lord" : info.kind === "mox" || info.kind === "power" ? "guardian" : "resident"} — it grows at {tiers.map((t) => t.steps).join(" / ")} interior steps (the meter shows the next threshold).</li>
          <li><b>Your life inside carries from fight to fight</b> (it starts at your world life, {c.world?.player.worldLife}); it is discarded when you leave, but an interior LOSS still costs a world life and your stake.</li>
          <li><b>Everything found inside is held in escrow</b> until the {info.kind === "stronghold" ? "lord" : info.kind === "mox" || info.kind === "power" ? "guardian" : "resident"} falls — walk out or fall, and the mountain keeps it. Minions bar the way (no parley inside).</li>
        </ul>
        <p style={{ textAlign: "right", marginBottom: 0 }}>
          <button onClick={() => c.declineDungeon()}>Not yet</button>{" "}
          <button className="primary" onClick={() => c.enterDungeon()}>{c.world?.activeDungeon?.dungeonId === info.dungeonId ? "Descend again (your run resumes)" : "Enter"}</button>
        </p>
      </div>
    </div>
  );
}

/** S20: inside — the mini-world on the same map stack, with the meter and escrow in the rail. */
function DungeonScreen({ c, pool }: { c: WorldController; pool: Map<string, CardDef> }) {
  if (c.screen.kind !== "dungeon" || !c.world) return null;
  const run = c.dungeonRun!;
  const mox = c.moxDef(run.dungeonId);
  const sh = run.kind === "stronghold" ? c.strongholdDef(run.dungeonId) : undefined;
  const name = sh?.name ?? mox?.name ?? c.catalog.opponents.find((o) => o.id === run.residentCatalogId)?.name ?? "The dark";
  const color = sh?.color ?? mox?.color ?? c.catalog.opponents.find((o) => o.id === run.residentCatalogId)?.spoke ?? "G";
  const map = dungeonAsWorldMap(run, color, name);
  const meter = c.dungeonMeter()!;
  // Fog-honest (S20 playtest r2: the dark register exposed the leak — unexplored caches and
  // minions were drawn into the darkness; stationary, so "cell explored" = "ever seen").
  const seenAt = (p: Point) => isExplored(run.explored, { width: run.grid.width }, p);
  const marks = run.treasures.filter((t) => !t.taken && seenAt(t.at)).map((t) => ({ at: t.at, label: "cache", kind: "chest" as const }));
  const minions = run.minions.filter((m) => !m.defeated && seenAt(m.at)).map((m) => {
    const tmpl = c.catalog.opponents.find((o) => o.id === m.catalogId)!;
    return { id: m.id, at: m.at, portrait: `/portraits/${tmpl.portraitChip ?? tmpl.portrait}.png`, name: tmpl.name, tier: tmpl.tier, fleeing: false };
  });
  const notice = c.screen.notice;
  return (
    <div className="app world-app">
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        <div className="chrome" style={{ display: "flex", gap: 16, alignItems: "center" }}><b style={{ fontFamily: "var(--serif)" }}>{name}</b><span className="stat">♥ interior life {meter.life}</span><span className="stat">⟳ {meter.steps} steps inside</span></div>
        <div className="world-map-wrap">
          <WorldMapView
            map={map}
            player={run.position}
            portrait="/portrait-you.png"
            preview={null}
            previewTarget={null}
            explored={run.explored}
            marks={marks}
            edgeLabel=""
            interior
            roamers={minions}
            sightRadius={c.knobs.sightRadius}
            onClickCell={(p) => c.dungeonClick(p)}
          />
        </div>
        <div className="transport play-prompt">
          <span className="prompt-text">{notice ?? "Click a cell to move. The guardian waits at the deep end."}</span>
          <span style={{ flex: 1 }} />
          <button onClick={() => c.walkOutOfDungeon()} title="forfeit the escrow; the halls reset">Walk out</button>
        </div>
      </div>
      <div className="rail world-rail">
        <div className="panel">
          <h3>The {run.kind === "stronghold" ? "lord" : run.kind === "mox" || run.kind === "power" ? "guardian" : "resident"} grows</h3>
          <div style={{ fontSize: 12 }}>Interior steps: <b>{meter.steps}</b> · tiers reached: <b>{meter.reached}</b>{meter.nextAt !== null ? <> · next at <b>{meter.nextAt}</b></> : <> · fully grown</>}</div>
          <div className="empower-meter">{(run.kind === "stronghold" ? c.knobs.strongholdEmpowermentTiers : c.knobs.dungeonEmpowermentTiers).map((t, i) => (
            <span key={i} className={`empower-tier${meter.steps >= t.steps ? " hit" : ""}`} title={`${t.steps} steps: +${t.addLife} life${t.addBasic ? ", +1 land in play" : ""}${t.addToken ? ", +1 creature in play" : ""}${t.addCard ? ", +1 card" : ""}`}>{t.steps}</span>
          ))}</div>
          {mox && <p style={{ fontSize: 11.5, color: "var(--ink-soft)" }}><b>{mox.law.name}:</b> {mox.law.text}</p>}
          {sh && <p style={{ fontSize: 11.5, color: "var(--ink-soft)" }}><b>{sh.law.name}:</b> {sh.law.text} <i>(in every fight inside; the dungeon teaches the law before the lord enforces it)</i></p>}
        </div>
        <div className="panel">
          <h3>Escrow (the mountain holds it)</h3>
          <div style={{ fontSize: 12 }}>{meter.escrowGold} gold{meter.escrowCards.length > 0 ? <> · {meter.escrowCards.map((id) => pool.get(id)?.name ?? id).join(", ")}</> : null}</div>
          <div style={{ fontSize: 10.5, color: "var(--ink-soft)" }}>Paid out when the {run.kind === "stronghold" ? "lord" : run.kind === "mox" || run.kind === "power" ? "guardian" : "resident"} falls; forfeit if you walk or fall.</div>
        </div>
        <div className="panel">
          <h3>Interior life</h3>
          <div style={{ fontSize: 12 }}>Fights start at <b>{meter.life}</b> (carried fight to fight; discarded at the door). A loss still costs a world life.</div>
        </div>
        {/* S25 r4 notes 6+9 (Chris): what's HELD for the next fight — boons (tokens and lands
            included) and the armed Barrage — plus the arming control (the interior surface the
            parley menu can't reach). */}
        {(() => {
          const boons = run.boons ?? [];
          const b = c.dungeonBarrageOption();
          if (boons.length === 0 && !b && !(run.armedBarrage ?? 0)) return null;
          return (
            <div className="panel">
              <h3>Held for the next fight</h3>
              {boons.map((id, i) => (
                <div key={i} style={{ fontSize: 12 }}>◆ {pool.get(id)?.name ?? id} <i style={{ color: "var(--ink-soft)" }}>— fights beside you, spent when it's fought</i></div>
              ))}
              {(run.armedBarrage ?? 0) > 0 && <div style={{ fontSize: 12, color: "var(--danger)" }}>◆ The Barrage — opens with <b>{run.armedBarrage}</b> damage already dealt</div>}
              {boons.length === 0 && !(run.armedBarrage ?? 0) && <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>nothing held — caches on the branches carry boons</div>}
              {b && (
                <button className="linkish" disabled={!!b.reason} title={b.reason ?? ""} style={{ fontSize: 11, marginTop: 4 }} onClick={() => c.openPower({ kind: "barrage", damage: Math.max(1, Math.min(b.cap - b.armed, Math.floor(b.depth / b.costPerDamage))) })}>
                  arm the Barrage: {b.costPerDamage} R spare per damage (cap {b.cap}{b.armed ? `, armed ${b.armed}` : ""})
                </button>
              )}
              <div style={{ fontSize: 10.5, color: "var(--ink-soft)", marginTop: 3 }}>Everything held dies with the run — walk out or fall, and it is spent for nothing.</div>
            </div>
          );
        })()}
      </div>
      {c.fuelPicker && <FuelPickerModal c={c} />} {/* S25 r4: the interior Barrage arms through the picker */}
    </div>
  );
}

/** S26 (ADR-091): the Corolla's door — the game's largest telegraph. Five seals part the petals. */
function CorollaTelegraph({ c }: { c: WorldController }) {
  if (c.screen.kind !== "corollaTelegraph" || !c.world) return null;
  const { seals, open, notice } = c.screen;
  const def = c.corollaDef;
  const fallen = c.petalRows().filter((r) => r.fallen).length;
  const inside = c.world.gauntlet.corolla;
  return (
    <div className="gallery-modal">
      <div className="gallery-modal-box play-dialog dungeon-telegraph">
        <div style={{ margin: "-14px -14px 12px", overflow: "hidden", borderBottom: "2px solid var(--ink)" }}>
          <img src="/gate-plates/corolla.jpg" alt="" style={{ width: "100%", display: "block", maxHeight: 260, objectFit: "cover" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        </div>
        <h2 style={{ margin: 0, fontFamily: "var(--serif)" }}>{def?.name ?? "The Corolla"}</h2>
        <p className="parley-sub">{open ? "The petals part." : `The petals are closed. Five seals open them; you hold ${seals}.`}</p>
        {open && (
          <ul className="dungeon-stakes">
            <li><b>The flower is a world, not a mountain.</b> Five petals around a town at the heart; each tip holds one of the five laws — <i>returned</i> — and a court that was never a lord's. What you win, you keep as you go; what falls stays fallen; you may walk out and come back.</li>
            <li><b>Time stops here.</b> No siege advances, no contract runs, no lord grows while you are among the petals. The inn at the heart asks nothing.</li>
            <li><b>Each tip is a fight at your world life</b>, ante as the world's; a loss costs a world life and your stake, and leaves you standing where you fell.</li>
            <li>At the heart: an inn, the only shelf that ever stocks the R drawer, and <b>a door that opens when five petals fall</b>{fallen ? ` — ${fallen} have` : ""}.</li>
          </ul>
        )}
        {!open && <p style={{ fontSize: 12.5 }}>Each lord's fall breaks a seal. The five seats stand on the five spokes; the Corolla waits at their convergence.</p>}
        {notice && <p style={{ fontSize: 12, color: "var(--ink-soft)" }}>{notice}</p>}
        <p style={{ textAlign: "right", marginBottom: 0 }}>
          <button onClick={() => c.declineCorolla()}>{open ? "Not yet" : "Turn away"}</button>{" "}
          {open && <button className="primary" onClick={() => c.enterCorolla()}>{inside ? "Return to the petals" : "Enter the flower"}</button>}
        </p>
      </div>
    </div>
  );
}

/** S26: the Vault's door — "the Vault shows you what you brought." */
function VaultTelegraph({ c }: { c: WorldController }) {
  if (c.screen.kind !== "vaultTelegraph" || !c.world) return null;
  const { moxen, open, notice } = c.screen;
  const w = c.world;
  return (
    <div className="gallery-modal">
      <div className="gallery-modal-box play-dialog dungeon-telegraph">
        <div style={{ margin: "-14px -14px 12px", overflow: "hidden", borderBottom: "2px solid var(--ink)" }}>
          <img src="/gate-plates/vault.jpg" alt="" style={{ width: "100%", display: "block", maxHeight: 240, objectFit: "cover" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        </div>
        <h2 style={{ margin: 0, fontFamily: "var(--serif)" }}>{c.corollaDef?.vault.name ?? "The Vault"}</h2>
        <p className="parley-sub">{open ? "The five Moxen turn in their settings. The door opens on a mirror." : `Locked. Five Moxen open it; you hold ${moxen}.`}</p>
        {open && (
          <ul className="dungeon-stakes">
            <li><b>The Vault shows you what you brought.</b> Inside is your own deck — <i>{w.activeDeckName}</i>, every card of it — played against you by the best pilot the plane has, and it fights with the prize: <b>the Black Lotus</b> is in its forty-one.</li>
            <li><b>No stakes either way.</b> A reflection has nothing to lose, and neither do you: ante is off. A loss costs a world life; the door stays.</li>
            <li>The reflection fights at your <b>full</b> life ({maxWorldLife(w)}); you fight at yours ({w.player.worldLife}). Win, and the Lotus is yours — there is exactly one — and the Vault is empty ground forever.</li>
          </ul>
        )}
        {!open && <p style={{ fontSize: 12.5 }}>The Moxen wait in the wild rings, with the court that guards them.</p>}
        {notice && <p style={{ fontSize: 12, color: "var(--ink-soft)" }}>{notice}</p>}
        <p style={{ textAlign: "right", marginBottom: 0 }}>
          <button onClick={() => c.declineVault()}>{open ? "Not yet" : "Turn away"}</button>{" "}
          {open && <button className="primary" onClick={() => c.enterVault()}>Face the reflection</button>}
        </p>
      </div>
    </div>
  );
}

/** S26: inside the flower — the petal-world on the shared map stack, in its own register. */
function CorollaScreen({ c }: { c: WorldController }) {
  if (c.screen.kind !== "corolla" || !c.world) return null;
  const map = c.corollaMap();
  const inside = c.world.gauntlet.corolla;
  if (!map || !inside) return null;
  const rows = c.petalRows();
  const fallenIdx = new Set(map.strongholds.map((f, i) => (f.opponentId === "fallen" ? i : -1)).filter((i) => i >= 0));
  const heart = c.world.gauntlet.petals ? rows.filter((r) => r.fallen).length : 0;
  const notice = c.screen.notice;
  return (
    <div className="app world-app">
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        <div className="chrome" style={{ display: "flex", gap: 16, alignItems: "center" }}><b style={{ fontFamily: "var(--serif)" }}>{c.corollaDef?.name ?? "The Corolla"}</b><span className="stat">♥ {c.world.player.worldLife} / {maxWorldLife(c.world)}</span><span className="stat">✿ {heart} of five petals fallen</span><span className="stat" title="no clock runs in the flower">⟳ the world stands still</span></div>
        <div className="world-map-wrap">
          <WorldMapView
            map={map}
            player={inside.position}
            portrait="/portrait-you.png"
            preview={null}
            previewTarget={null}
            explored={null}
            edgeLabel=""
            register="corolla"
            clearedFixed={fallenIdx}
            onClickCell={(p) => c.corollaClick(p)}
          />
        </div>
        <div className="transport play-prompt">
          <span className="prompt-text">{notice ?? "Click a petal's tip to meet its court; the town waits at the heart."}</span>
          <span style={{ flex: 1 }} />
          <button onClick={() => c.leaveCorolla()} title="the flower keeps what fell">Leave the flower</button>
        </div>
      </div>
      <div className="rail world-rail">
        <div className="panel">
          <h3>The five petals</h3>
          {rows.map((r) => (
            <div key={r.color} style={{ fontSize: 12, margin: "3px 0", opacity: r.fallen ? 0.55 : 1 }}>
              <span className={`mana-chip chip-${r.color}`} style={{ marginRight: 4 }}>{r.color}</span>
              <b>{r.lawName}</b> — {r.bossName}{" "}
              {r.fallen ? <i style={{ color: "var(--ink-soft)" }}>· fallen</i> : <button className="linkish" style={{ fontSize: 11 }} onClick={() => c.corollaClick(r.tip)} title={`${r.distance} steps from the heart`}>go to the tip</button>}
            </div>
          ))}
          <div style={{ fontSize: 10.5, color: "var(--ink-soft)", marginTop: 4 }}>Each petal wears its law's colour; its court wields the two beside it. Fallen petals stay fallen.</div>
        </div>
        <div className="panel">
          <h3>The heart</h3>
          <div style={{ fontSize: 12 }}>{c.corollaDef?.town.name ?? "The Heart"}: an inn that asks nothing, the R drawer's only shelf, and a door — <b>{heart} of five</b> petals fallen{heart >= 5 ? ". It is open." : "; it opens at five."}</div>
          <button className="linkish" style={{ fontSize: 11, marginTop: 4 }} onClick={() => c.corollaClick(c.corollaGeometry().town)}>walk to the heart</button>
        </div>
      </div>
    </div>
  );
}

/** S26: a petal's tip — the court, the returned law, the stakes. */
function PetalTelegraph({ c }: { c: WorldController }) {
  if (c.screen.kind !== "petalTelegraph" || !c.world) return null;
  const color = c.screen.color;
  const row = c.petalRows().find((r) => r.color === color)!;
  const pd = c.corollaDef!.petals.find((p) => p.color === color)!;
  const content = c.catalog.strongholdContent?.find((s) => s.color === color);
  const deck = COROLLA_DECKS[pd.boss.key];
  return (
    <div className="gallery-modal">
      <div className="gallery-modal-box play-dialog dungeon-telegraph">
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <img className="parley-portrait" src={`/portraits/${pd.boss.portrait}.png`} alt="" style={{ width: 72, height: 72, flexShrink: 0 }} title={pd.boss.name} onError={(e) => { (e.target as HTMLImageElement).style.visibility = "hidden"; }} />
          <div>
            <h2 style={{ margin: 0, fontFamily: "var(--serif)" }}>{row.lawName} — the {["W", "U", "B", "R", "G"].includes(color) ? { W: "white", U: "blue", B: "black", R: "red", G: "green" }[color] : ""} petal</h2>
            <p className="parley-sub" style={{ marginBottom: 0 }}>{pd.boss.name} holds the tip, in the pair no lord could touch ({deck?.pair ?? ""}). Fixed and certain: the fight is here whenever you are.</p>
          </div>
        </div>
        {content && <p className="dungeon-law"><b>{content.law.name}:</b> {content.law.text} <i>(the law returned — it stands on the court's side, as it stood at the seat; it is a permanent, and permanents can be answered)</i></p>}
        <ul className="dungeon-stakes">
          <li><b>{pd.boss.name}</b> fights at <b>{c.knobs.petalBossLife || c.corollaDef?.bossLife || 30}</b> life; you at your world life ({c.world.player.worldLife}). Ante as the world's ({c.knobs.anteCount}).</li>
          <li>Win: <b>{c.pool.get(pd.signature)?.name ?? pd.signature}</b> (there is exactly one, and this is the only place it drops), one <b>{c.pool.get(pd.duals[0])?.name}</b> and one <b>{c.pool.get(pd.duals[1])?.name}</b>, <b>{c.knobs.petalGoldPrize} gold</b>, and the stake. The petal falls and stays fallen.</li>
          <li>Lose: a world life and your stake; you stand where you fell. No clock runs; nothing else changes.</li>
        </ul>
        <p style={{ textAlign: "right", marginBottom: 0 }}>
          <button onClick={() => c.declinePetal()}>Step back</button>{" "}
          <button className="primary" onClick={() => c.fightPetal()}>Fight</button>
        </p>
      </div>
    </div>
  );
}

/** S26: a petal fell. */
function PetalVictory({ c, pool }: { c: WorldController; pool: Map<string, CardDef> }) {
  if (c.screen.kind !== "petalVictory") return null;
  const s = c.screen;
  return (
    <div className="loader">
      <div className="box play-setup">
        <h2 style={{ fontFamily: "var(--serif)", marginTop: 0 }}>{s.bossName} falls — the petal with them</h2>
        <p>Yours, as you go: <b>{s.paidCards.map((id) => pool.get(id)?.name ?? id).join(", ")}</b> and <b>{s.paidGold} gold</b>{s.anteWon.length ? <>, with their stake ({s.anteWon.map((id) => pool.get(id)?.name ?? id).join(", ")})</> : null}.</p>
        {s.anteWithheld.length > 0 && <p style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>◆ Their staked {s.anteWithheld.map((id) => pool.get(id)?.name ?? id).join(", ")} stays with them — there is exactly one, and it drops by defeat, not by ante.</p>}
        <p style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{s.fallen >= 5 ? "Five petals have fallen. The door at the heart is open." : `${s.fallen} of five petals fallen.`}</p>
        <p><button className="primary" onClick={() => c.continueAfterPetalVictory()}>Back among the petals</button></p>
      </div>
    </div>
  );
}

/** S26: the Lotus. */
function MirrorVictory({ c }: { c: WorldController }) {
  if (c.screen.kind !== "mirrorVictory") return null;
  return (
    <div className="loader">
      <div className="box play-setup">
        <h2 style={{ fontFamily: "var(--serif)", marginTop: 0 }}>The reflection breaks</h2>
        <p>The Vault held what you came for: <b>the Black Lotus</b>. There is exactly one, and now it is yours. The Vault is empty ground.</p>
        <p><button className="primary" onClick={() => c.continueAfterMirrorVictory()}>Take it</button></p>
      </div>
    </div>
  );
}

/** S26: the town at the heart — inn, the R-drawer shelf, the Heart's door (locked; its state readable). */
function CorollaTownScreen({ c, pool, oracle }: { c: WorldController; pool: Map<string, CardDef>; oracle: Record<string, OracleEntry> }) {
  const [printed, setPrinted] = useState(true);
  const [inspect, setInspect] = useState<string | null>(null);
  const [tab, setTab] = useState<"square" | "shelf" | "inn">("square");
  if (c.screen.kind !== "corollaTown" || !c.world) return null;
  const { stock, notice } = c.screen;
  const w = c.world;
  const maxLife = maxWorldLife(w);
  const fallen = c.petalRows().filter((r) => r.fallen).length;
  const back = tab !== "square" && <button className="linkish" onClick={() => setTab("square")}>⟵ back to the square</button>;
  return (
    <div className="gallery-modal">
      <div className="gallery-modal-box play-dialog world-town">
        <h2 style={{ fontFamily: "var(--serif)", marginTop: 0 }}>{c.corollaDef?.town.name ?? "The Heart"}{tab !== "square" && <span style={{ fontSize: 14, color: "var(--ink-soft)" }}> · {{ shelf: "the R drawer", inn: "the inn" }[tab]}</span>}</h2>
        <p style={{ fontSize: 12, marginTop: 0 }}>the town at the flower's heart — <i>no clock runs here; nothing runs anywhere while you stand among the petals</i> · you have <b>{w.player.gold}</b> gold {back}</p>
        {notice && <p style={{ fontSize: 12, color: "var(--brass)" }}>{notice}</p>}
        {tab === "square" && (
          <>
            <p className="dungeon-law" style={{ borderColor: fallen >= 5 ? "var(--brass)" : undefined }}>
              <b>The Heart's door:</b> five petals, <b>{fallen} fallen</b>. {fallen >= 5 ? "It is open — and what waits behind it has not yet been written. (The fight is not in this build.)" : "It opens when the fifth falls."}
            </p>
            <div className="town-nav">
              <button onClick={() => setTab("shelf")}>
                <img src="/town-market.png" alt="" />
                <b>The R drawer</b><span>{stock.filter((s) => s.remaining > 0).length} cards — the only shelf that ever stocks them · ×{c.knobs.corollaShopMultiplier} price</span>
              </button>
              <button onClick={() => setTab("inn")}>
                <img src="/town-inn.png" alt="" />
                <b>The inn</b><span>{w.player.worldLife < maxLife ? `rest: free — time does not pass here (${maxLife - w.player.worldLife} missing)` : "you want for nothing"}</span>
              </button>
              <div className="town-utility">
                <button onClick={() => c.openEditor()}>Edit deck</button>
                <button onClick={() => c.openCollection()}>Collection</button>
                <button onClick={() => c.save()}>Save</button>
                <button className="primary" onClick={() => c.leaveHeartTown()}>Back to the petals</button>
              </div>
            </div>
          </>
        )}
        {tab === "shelf" && (
          <>
            <div className="flyout-title">
              One copy each; what you buy stays bought, what's left stays on the shelf
              <button className="linkish" onClick={() => setPrinted(!printed)}>{printed ? "our frame" : "printed card"}</button>
            </div>
            <div className="shop-grid">
              {stock.map((item: ShopItem) => (
                <div key={item.cardId} className={`shop-item${item.remaining === 0 ? " sold-out" : ""}`} onMouseEnter={() => setInspect(item.cardId)}>
                  <div className="card-slot"><CardFrame def={pool.get(item.cardId)!} oracle={oracle[item.cardId]} showPrinted={printed} /></div>
                  <div className="shop-buttons">
                    <button className={w.player.gold >= item.price && item.remaining > 0 ? "primary" : ""} disabled={w.player.gold < item.price || item.remaining === 0} onClick={() => c.corollaBuy(item)} title="buy to collection">
                      {item.remaining === 0 ? "sold" : `${item.price} gold`}
                    </button>
                    <button disabled={w.player.gold < item.price || item.remaining === 0} onClick={() => c.corollaBuy(item, true)} title="buy and add to your deck if legal">+deck</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        {tab === "inn" && (
          <>
            <div className="flyout-title">The inn — rest is free; time does not pass in the flower</div>
            <p style={{ fontSize: 12.5 }}>You stand at <b>{w.player.worldLife} / {maxLife}</b> world life. {w.player.worldLife < maxLife ? "Nothing in the world will have moved when you wake." : "Nothing ails you; the innkeeper nods you toward the door."}</p>
            {w.player.worldLife < maxLife && <p><button className="primary" onClick={() => c.corollaRest()}>Rest (+{maxLife - w.player.worldLife} life)</button></p>}
          </>
        )}
      </div>
      <FloatingCardInspector def={inspect ? pool.get(inspect) ?? null : null} oracle={oracle} printed={printed} onTogglePrinted={() => setPrinted(!printed)} />
    </div>
  );
}

/** S20: the payout ceremony. */
function DungeonVictory({ c, pool }: { c: WorldController; pool: Map<string, CardDef> }) {
  if (c.screen.kind !== "dungeonVictory") return null;
  const { name, paidGold, paidCards, notes } = c.screen;
  return (
    <div className="loader">
      <div className="box play-setup">
        <h2 style={{ fontFamily: "var(--serif)", marginTop: 0 }}>The guardian falls — {name} is yours to leave</h2>
        <p>The mountain pays its debts: <b>{paidGold} gold</b>{paidCards.length > 0 ? <> and {paidCards.map((id) => pool.get(id)?.name ?? id).join(", ")}</> : null}.</p>
        {notes?.map((n, i) => <p key={i} style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>◆ {n}</p>)}
        <p><button className="primary" onClick={() => c.continueAfterDungeonVictory()}>Back to the light</button></p>
      </div>
    </div>
  );
}

/** S22 r1 (Chris): the map rail carries a lot now — every panel folds. Open state is per-mount
 * (position-keyed React state; a screen switch resets it, which is fine for a dev-era rail). */
function RailPanel({ title, badge, defaultOpen = true, children }: { title: string; badge?: string | number | undefined; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="panel">
      <h3 style={{ cursor: "pointer", userSelect: "none" }} onClick={() => setOpen(!open)} title={open ? "collapse" : "expand"}>
        <span style={{ display: "inline-block", width: 12, fontSize: 10 }}>{open ? "▾" : "▸"}</span>
        {title}
        {badge !== undefined && <span style={{ fontWeight: 400, fontSize: 11, color: "var(--ink-soft)" }}> · {badge}</span>}
      </h3>
      {open && children}
    </div>
  );
}

/** S22b: a LORD fell — the sole-drop + escrow are paid; the player takes any strongholdPrizePicks
 * from the colour prize list (the R + T3 shelf touching the colour, his typed duals included;
 * prizeOnly blocked), then the seal ceremony. */
function StrongholdVictory({ c, pool, oracle }: { c: WorldController; pool: Map<string, CardDef>; oracle: Record<string, OracleEntry> }) {
  if (c.screen.kind !== "strongholdVictory") return null;
  const s = c.screen;
  // S24 r1 (Chris): the Usher and the Sower are she — the ceremony speaks each lord rightly.
  const lordDef = c.strongholdDef(s.strongholdId);
  const p = lordDef ? lordPronouns(lordDef.lord) : { sub: "he", obj: "him", pos: "his", Pos: "His" };
  return (
    <div className="gallery-modal">
      <div className="gallery-modal-box play-dialog" style={{ maxWidth: 980 }}>
        <h2 style={{ fontFamily: "var(--serif)", marginTop: 0 }}>{s.lordName} falls — {s.name} is broken</h2>
        <p>
          {p.Pos} card is yours — <b>{pool.get(s.lordCardId)?.name ?? s.lordCardId}</b> ({p.pos} defeat is the only place it exists) — with the mountain's debts:{" "}
          <b>{s.paidGold} gold</b>{s.paidCards.filter((id) => id !== s.lordCardId).length > 0 ? <> and {s.paidCards.filter((id) => id !== s.lordCardId).map((id) => pool.get(id)?.name ?? id).join(", ")}</> : null}. And the <b>seal</b>.
        </p>
        <p style={{ fontSize: 13 }}>Take <b>any {s.pickCount}</b> from {p.pos} hoard ({s.picks.length}/{s.pickCount} chosen — taking fewer is your right):</p>
        {/* S22 r1 (Chris): the WHOLE colour wardrobe, shelved by tier — R first, then 3/2/1. */}
        <div style={{ maxHeight: 380, overflowY: "auto" }}>
          {(["R", 3, 2, 1] as const).map((tier) => {
            const shelf = s.prizeList.filter((id) => pool.get(id)?.shopTier === tier);
            if (shelf.length === 0) return null;
            return (
              <div key={String(tier)}>
                <div style={{ fontSize: 11.5, color: "var(--ink-soft)", margin: "6px 0 4px", fontVariant: "small-caps", letterSpacing: 0.5 }}>
                  {tier === "R" ? "the R drawer — never on a shelf" : `tier ${tier}`}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {shelf.map((id) => {
                    const def = pool.get(id);
                    if (!def) return null;
                    const picked = s.picks.includes(id);
                    return (
                      <div key={id} className="card-slot" style={{ width: 150, cursor: "pointer", outline: picked ? "3px solid var(--brass)" : "none", borderRadius: 6 }} onClick={() => c.toggleStrongholdPick(id)} title={picked ? "click to put back" : "click to take"}>
                        <CardFrame def={def} oracle={oracle[id]} showPrinted />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <p style={{ textAlign: "right", marginBottom: 0 }}>
          <button className="primary" onClick={() => c.confirmStrongholdPicks()}>{s.picks.length > 0 ? `Take ${s.picks.length} and the seal` : "Take only the seal"}</button>
        </p>
      </div>
    </div>
  );
}

/** S21 playtest r2 item 5 (Chris): the town is a SQUARE with second-layer pages — the single
 * scroll was carrying buying, selling, quests, and rumors all at once. */
function TownScreen({ c, pool, oracle }: { c: WorldController; pool: Map<string, CardDef>; oracle: Record<string, OracleEntry> }) {
  const [printed, setPrinted] = useState(true); // S13 (Chris): printed by default
  const [inspect, setInspect] = useState<string | null>(null);
  const [tab, setTab] = useState<"square" | "market" | "sell" | "board" | "tavern" | "inn">("square");
  if (c.screen.kind !== "town") return null;
  const { town, stock, notice } = c.screen;
  const w = c.world!;
  const region = w.map.regions[town.region]!;
  const maxLife = maxWorldLife(w);
  const lifeMissing = maxLife - w.player.worldLife;
  const innPrice = c.knobs.innStepsPerLife;
  const sp = spares(w.player.collection, activeDeck(w));
  const offers = c.townQuestOffers();
  const choices = c.retrievalChoices();
  const back = tab !== "square" && <button className="linkish" onClick={() => setTab("square")}>⟵ back to the square</button>;
  return (
    <div className="gallery-modal">
      <div className="gallery-modal-box play-dialog world-town">
        <h2 style={{ fontFamily: "var(--serif)", marginTop: 0 }}>{town.name}{tab !== "square" && <span style={{ fontSize: 14, color: "var(--ink-soft)" }}> · {{ market: "the market", sell: "the buyer's stall", board: "the quest board", tavern: "the tavern", inn: "the inn" }[tab]}</span>}</h2>
        <p style={{ fontSize: 12, marginTop: 0 }}>{region.name} · a safe town — <i>clock-free: deliberation costs nothing here</i> · you have <b>{w.player.gold}</b> gold {back}</p>
        {(() => {
          // S21: a threatened town wears its warning inside the walls (visible-schedules law).
          const s = c.siegeInfo(town.index);
          if (!s || s.kind !== "defense") return null;
          return (
            <p className="dungeon-law" style={{ borderColor: "var(--danger)" }}>
              <b>Under siege:</b> a band of {s.party.length} strikes in <b>{s.stepsLeft}</b> steps. Fall, and the market, board, and this town's gifts go dark.{" "}
              <button className="primary" style={{ marginLeft: 8 }} onClick={() => c.defendTown()}>Drive them off</button>
            </p>
          );
        })()}
        {notice && <p style={{ fontSize: 12, color: "var(--brass)" }}>{notice}</p>}
        {tab === "square" && (
          <>
            {/* Recovered retrieval items surface on the square — the buyer finds YOU. */}
            {choices.map((q) => (
              <div className="quest-offer" key={`ret_${q.id}`} style={{ marginTop: 8, borderColor: "var(--brass)" }}>
                <div className="quest-text"><b>The buyer waits.</b> You carried <b>{q.retrievalItem?.cardName}</b> out of the dark. {q.text}</div>
                <div className="quest-meta">
                  Keep the card, or take <b>{q.reward.gold} gold</b> for it —{" "}
                  <button onClick={() => c.chooseRetrieval(q.id, "keep")}>Keep it</button>{" "}
                  <button className="primary" onClick={() => c.chooseRetrieval(q.id, "deliver")}>Deliver ({q.reward.gold}g)</button>
                </div>
              </div>
            ))}
            <div className="town-nav">
              <button onClick={() => setTab("market")}>
                <img src="/town-market.png" alt="" />
                <b>The market</b><span>{stock.filter((s) => s.remaining > 0).length} cards on the shelf · refreshes every {c.knobs.shopRefreshSteps} steps</span>
              </button>
              <button onClick={() => setTab("sell")}>
                <img src="/town-sell.png" alt="" />
                <b>The buyer's stall</b><span>{Object.keys(sp).length ? `${Object.keys(sp).length} spare${Object.keys(sp).length === 1 ? "" : "s"} to sell (half price)` : "no spares to sell"}</span>
              </button>
              <button onClick={() => setTab("board")}>
                <img src="/town-board.png" alt="" />
                <b>The quest board</b><span>{offers.length ? `${offers.length} notice${offers.length === 1 ? "" : "s"} posted` : "nothing posted (all taken)"}</span>
              </button>
              <button onClick={() => setTab("tavern")}>
                <img src="/town-tavern.png" alt="" />
                <b>The tavern</b><span>rumors, legends, and the roads' news</span>
              </button>
              {/* S24 (ADR-086): the inn — the recovery half of the life economy. */}
              <button onClick={() => setTab("inn")}>
                <img src="/town-inn.png" alt="" />
                <b>The inn</b><span>{lifeMissing > 0 ? `rest: ${innPrice} steps per life (${lifeMissing} missing)` : "you want for nothing — rest is free to skip"}</span>
              </button>
              {/* S24 r1 (Chris, note 6): the sixth slot — the square's utility corner. */}
              <div className="town-utility">
                <button onClick={() => c.openEditor()}>Edit deck</button>
                <button onClick={() => c.openCollection()}>Collection</button>
                <button onClick={() => c.save()}>Save</button>
                <button className="primary" onClick={() => c.leaveTown()}>Leave town</button>
              </div>
            </div>
          </>
        )}
        {tab === "market" && (
          <>
            <div className="flyout-title">
              Buy only; stock refreshes every {c.knobs.shopRefreshSteps} steps
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
          </>
        )}
        {tab === "sell" && (
          <>
            <div className="flyout-title">
              Half price; basics and deck copies excluded
              <button className="linkish" onClick={() => setPrinted(!printed)}>{printed ? "our frame" : "printed card"}</button>
            </div>
            <div className="shop-grid">
              {Object.entries(sp).map(([id, n]) => {
                const def = pool.get(id);
                if (!def) return null;
                const priceless = def.shopTier === "R" && def.types.includes("Land"); // S20: duals are priceless
                return (
                  <div key={id} className="shop-item" onMouseEnter={() => setInspect(id)}>
                    <div className="card-slot"><CardFrame def={def} oracle={oracle[id]} showPrinted={printed} /></div>
                    <div className="shop-buttons">
                      <button className={priceless ? "" : "primary"} disabled={priceless} onClick={() => c.sell(id)} title={priceless ? "priceless — no shop will make an offer" : `sell one ${def.name}`}>
                        {priceless ? "priceless" : `sell · ${sellPrice(def, c.knobs)}g`}
                      </button>
                    </div>
                    <div className="shop-stock">×{n} spare{n === 1 ? "" : "s"}</div>
                  </div>
                );
              })}
              {Object.keys(sp).length === 0 && <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>no spares to sell</span>}
            </div>
          </>
        )}
        {tab === "board" && <QuestBoard c={c} pool={pool} onInspect={setInspect} />}
        {tab === "tavern" && (
          <>
            <div className="flyout-title">Heard in the tavern</div>
            {c.townRumors().map((r, i) => (
              <p key={i} style={{ fontSize: 12.5, fontStyle: "italic", margin: "5px 0", color: "var(--ink-soft)" }}>“{r}”</p>
            ))}
          </>
        )}
        {tab === "inn" && (
          <>
            <div className="flyout-title">The inn — rest trades steps for life ({innPrice} steps per point)</div>
            <p style={{ fontSize: 12.5 }}>
              You stand at <b>{w.player.worldLife} / {maxLife}</b> world life.{" "}
              {lifeMissing > 0
                ? <>The world does not wait while you sleep — <i>sieges advance, lords grow, contracts run</i>. Any news lands when you wake.</>
                : <>Nothing ails you; the innkeeper nods you toward the door.</>}
            </p>
            {lifeMissing > 0 && (
              <p>
                {([["Rest a little", Math.min(2, lifeMissing)], ["Rest well", Math.min(5, lifeMissing)], ["Recover fully", lifeMissing]] as const)
                  .filter(([, pts], i, arr) => pts > 0 && arr.findIndex(([, p]) => p === pts) === i)
                  .map(([label, pts]) => (
                    <button key={label} className={label === "Recover fully" ? "primary" : undefined} style={{ marginRight: 8 }} onClick={() => c.innRest(pts)}>
                      {label} (+{pts} life · {pts * innPrice} steps)
                    </button>
                  ))}
              </p>
            )}
          </>
        )}
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
  const [filter, setFilter] = useState<"all" | "W" | "U" | "B" | "R" | "G" | "Creature" | "Instant" | "Sorcery" | "Enchantment" | "Artifact" | "Land">("all");
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
          {["all", "W", "U", "B", "R", "G", "Creature", "Instant", "Sorcery", "Enchantment", "Artifact", "Land"].map((f) => <option key={f} value={f}>{f}</option>)}
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
  // S23 audio scaffolding (ADR-084), REWIRED by the S24 mapping-v3 landing: the SCREEN drives
  // the music context (cue-first — repeated cues no-op; unmapped cues are silence, and v3's
  // silences are deliberate: overworld, in-duel, interiors, menu-TBD).
  const lastPopup = useRef<unknown>(null);
  const lastResult = useRef<unknown>(null);
  const lastParley = useRef<string | null>(null);
  const lastTreasure = useRef(0);
  const lastManalinkSplash = useRef<unknown>(null);
  const lastScreenKind = useRef<string>("");
  useEffect(() => {
    const scr = controller.screen;
    const w2 = controller.world;
    let cue: MusicCue = "music.overworld";
    if (scr.kind === "start") cue = "music.menu";
    else if (scr.kind === "town" && w2) {
      // v3: the region is the musical identity unit — town → colour+ring → track.
      const reg = w2.map.regions[scr.town.region]!;
      cue = townMusicCue(reg.color, reg.tier);
    } else if ((scr.kind === "editor" || scr.kind === "collection") && scr.back === "town" && w2 && w2.map.towns[w2.lastTownIndex]) {
      // S24 r1 (Chris, note 5): the deck and collection screens opened FROM a town keep that
      // town's song — you never left the building.
      const t = w2.map.towns[w2.lastTownIndex]!;
      const reg = w2.map.regions[t.region]!;
      cue = townMusicCue(reg.color, reg.tier);
    } else if (scr.kind === "duel" || scr.kind === "siegeDuel" || scr.kind === "dungeonDuel" || scr.kind === "corollaDuel") cue = "music.duel";
    // S26: the Corolla's cue rows — registered, silent until mapped (the town's is Chris's LocMus0).
    else if (scr.kind === "corollaTelegraph") cue = "splash.corolla";
    else if (scr.kind === "vaultTelegraph") cue = "splash.vault";
    else if (scr.kind === "corollaTown") cue = "music.corolla.town";
    else if ((scr.kind === "editor" || scr.kind === "collection") && w2 && w2.gauntlet.corolla) cue = "music.corolla.town";
    else if (scr.kind === "corolla" || scr.kind === "petalTelegraph" || scr.kind === "petalVictory" || scr.kind === "mirrorVictory") cue = "music.corolla";
    else if (scr.kind === "dungeonTelegraph") cue = scr.info.kind === "stronghold" ? strongholdSplashCue(scr.info.dungeonId) : "music.dungeon";
    else if (scr.kind === "strongholdVictory") cue = "music.stronghold";
    else if (scr.kind === "dungeon" || scr.kind === "dungeonVictory") cue = controller.dungeonRun?.kind === "stronghold" ? "music.stronghold" : "music.dungeon";
    audio.music(cue);
    // Stingers per v3: ONE crier for all news (Newsflash), quest payoffs split by kind
    // (Manalink / Reward), the pre-battle stakes menu (Dueltune), caches (Findcard), and the
    // duel result pair (Winduel / Loseduel).
    if (controller.questPopup && controller.questPopup !== lastPopup.current) {
      lastPopup.current = controller.questPopup;
      // r5: the manalink STING moved to its own splash — popups ring reward or news only.
      audio.sting(controller.questPopup.some((p) => p.title === "Quest complete") ? "sting.reward" : "sting.news");
    }
    // r5: each manalink splash rings the Manalink sting as it shows (one-voice: it fades
    // whatever rang before it — Winduel included, which was the whole point).
    const splashHead = controller.manalinkSplash?.[0] ?? null;
    if (splashHead && splashHead !== lastManalinkSplash.current) audio.sting("sting.manalink");
    lastManalinkSplash.current = splashHead;
    // r5 (Chris): clicking early out of the win/loss screen ends its music early — leaving
    // duelResult fades whatever result sting still rings (the parley-fade pattern).
    if (lastScreenKind.current === "duelResult" && scr.kind !== "duelResult") audio.fadeSting();
    lastScreenKind.current = scr.kind;
    if (scr.kind === "encounter") {
      const key = scr.encounter.opponentId + ":" + controller.world!.player.stepsTaken;
      if (lastParley.current !== key) {
        lastParley.current = key;
        audio.sting("sting.parley");
      }
    } else if (lastParley.current !== null) {
      // S24 r1 (Chris): the stakes menu closed — a choice was made — so Dueltune fades NOW
      // rather than ringing into the duel (and stacking under Winduel on a fast auto-win).
      lastParley.current = null;
      audio.fadeSting("sting.parley");
    }
    if (controller.treasureSeq !== lastTreasure.current) {
      lastTreasure.current = controller.treasureSeq;
      if (controller.treasureSeq > 0) audio.sting("sting.treasure");
    }
    if (scr.kind === "duelResult" && scr.record !== lastResult.current) {
      lastResult.current = scr.record;
      if (scr.record.outcome === "win") audio.sting("sting.duel-win");
      else if (scr.record.outcome === "loss") audio.sting("sting.duel-loss");
    }
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
  if (c.screen.kind === "duel" || c.screen.kind === "dungeonDuel" || c.screen.kind === "siegeDuel" || c.screen.kind === "corollaDuel") {
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
  if (c.screen.kind === "dungeonTelegraph") return <DungeonTelegraph c={c} />;
  if (c.screen.kind === "siegeTelegraph") return <SiegeTelegraph c={c} />;
  if (c.screen.kind === "dungeon") return <DungeonScreen c={c} pool={pool} />;
  if (c.screen.kind === "dungeonVictory") return <DungeonVictory c={c} pool={pool} />;
  if (c.screen.kind === "corollaTelegraph") return <CorollaTelegraph c={c} />;
  if (c.screen.kind === "vaultTelegraph") return <VaultTelegraph c={c} />;
  if (c.screen.kind === "corolla") return <CorollaScreen c={c} />;
  if (c.screen.kind === "petalTelegraph") return <PetalTelegraph c={c} />;
  if (c.screen.kind === "petalVictory") return <PetalVictory c={c} pool={pool} />;
  if (c.screen.kind === "mirrorVictory") return <MirrorVictory c={c} />;
  if (c.screen.kind === "corollaTown") return <CorollaTownScreen c={c} pool={pool} oracle={oracle} />;
  if (c.screen.kind === "strongholdVictory") return <StrongholdVictory c={c} pool={pool} oracle={oracle} />;
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
            clearedFixed={new Set(w.map.strongholds.map((f, i) => {
              // S21 r2 fix (Chris): mox sites have no resident — their cleared state lives in world.dungeons.
              if (f.kind === "dungeon") return w.dungeons[`mox_${w.map.regions[f.region]?.color}`.toLowerCase()]?.cleared ? i : -1;
              // S22 r1 (Chris): a broken seat draws as RUBBLE — cleared strongholds read from world.dungeons by content id.
              if (f.kind === "stronghold") {
                const content = (c.catalog.strongholdContent ?? []).find((s) => s.color === w.map.regions[f.region]?.color);
                return content && w.dungeons[content.id]?.cleared ? i : -1;
              }
              return w.opponents.find((o) => o.id === f.opponentId)?.gone ? i : -1;
            }).filter((i) => i >= 0))}
            roamers={c.visibleRoamers().map((r) => ({ id: r.inst.id, at: r.inst.at!, portrait: `/portraits/${r.tmpl.portraitChip ?? r.tmpl.portrait}.png`, name: r.tmpl.name, tier: r.tmpl.tier, fleeing: r.fleeing }))}
            sightRadius={c.knobs.sightRadius}
            explored={w.explored}
            pan={pan}
            onPan={(p) => setPan(p)}
            marks={c.questMarks()}
            townStates={c.siegeStates()}
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
          {/* S26: standing on a centre door — knock to reopen its telegraph (arriving opens it once). */}
          {c.doorHere() && <button className="linkish" style={{ marginRight: 10 }} onClick={() => c.knock()}>{c.doorHere() === "corolla" ? "✿ the Corolla's door — knock" : "◆ the Vault's door — knock"}</button>}
          <span className="seed">{seenRegions.size}/{w.map.regions.length} regions seen · {w.map.towns.filter((t) => seenCell(t.at)).length}/{w.map.towns.length} towns found</span>
        </div>
      </div>
      <div className="rail world-rail">
        <RailPanel title="Journey">
          <div style={{ fontSize: 12 }}>Duels: {w.duels.length} · won {w.duels.filter((d) => d.outcome === "win").length} · lost {w.duels.filter((d) => d.outcome === "loss").length}</div>
          <div style={{ fontSize: 12 }}>Opponents defeated: {w.opponents.filter((o) => o.goneReason === "defeated").length} · roaming now {w.opponents.filter((o) => !o.gone && o.at).length}</div>
          <div style={{ fontSize: 12 }}>Deck: {deckSize(activeDeck(w))} cards · basic {w.player.basicLand}</div>
        </RailPanel>
        <RailPanel title="Quests" badge={c.activeQuests().length || undefined}>
          {c.activeQuests().map(({ quest: q, stepsLeft, destName, targetName, targetRegion }) => (
            <div key={q.id} style={{ fontSize: 11.5, marginBottom: 4 }}>
              <b>{{ courier: "Courier", cardCourier: "Card courier", bounty: "Bounty", retrieval: "Retrieval" }[q.kind]}</b>
              {/* S25 r4 note 2 (Chris: some quests don't say what we're pursuing): the courier's
                  cargo is named, and every row ends with its REWARD (the pursuit itself). */}
              {q.kind === "cardCourier" && q.carriedCardId ? <> — carrying {c.pool.get(q.carriedCardId)?.name ?? q.carriedCardId}</> : null}
              {q.kind === "retrieval" && <> — {q.itemRecovered
                ? `${q.retrievalItem?.cardName} recovered — the buyer waits in ${w.map.towns.find((t) => t.index === q.fromTown)?.name ?? "the offer town"} (marked)`
                : `${q.retrievalItem?.cardName} lies in ${(() => { const l = w.map.strongholds.find((f) => f.kind === "lair" && `lair_${f.opponentId}` === q.retrievalDungeonId); return l ? `${l.name ?? "a lair"} (${w.map.regions[l.region]?.name}; marked)` : "a lair"; })()}`}</>}
              {destName ? <> → {destName}</> : null}
              {/* S25 r2 note 4: the bounty names its mark's region — and the row is a map pointer
                  (click previews the path: the sighting mark when seen, else the region's heart). */}
              {targetName ? (
                <span style={{ cursor: screen.kind === "map" ? "pointer" : "default" }} title="click to preview the path there" onClick={() => {
                  // Fog honesty (S18): an unsighted mark's LIVE cell never leaks — the region's
                  // heart is the pointer until a sighting is recorded.
                  const inst = q.bountyOpponentId ? w.opponents.find((o) => o.id === q.bountyOpponentId) : undefined;
                  const dest = q.bountySeenAt ?? (inst ? w.map.regions[inst.region]?.heart : undefined);
                  if (dest) c.clickCell(dest);
                }}>
                  {" "}— {targetName}
                  {targetRegion ? <i style={{ color: "var(--ink-soft)" }}> · {targetRegion}</i> : null}
                  {q.bountySeenAt ? " (marked on your map)" : " (not yet sighted)"}
                </span>
              ) : null}
              {stepsLeft !== null && <span style={{ color: stepsLeft < 40 ? "var(--danger)" : "var(--ink-soft)" }}> · {stepsLeft} steps left</span>}
              <span style={{ color: "var(--ink-soft)" }}> · pays {q.reward.gold}g{q.reward.cardName ? ` + ${q.reward.cardName}` : ""}{q.reward.manalink ? ((q.reward.manalinkKind ?? "basic") === "life" ? " + a life manalink" : ` + a ${q.reward.manalink} manalink`) : ""}</span>
              <button className="linkish" style={{ marginLeft: 4 }} title="abandon (fails the quest; a sent card is already gone)" onClick={() => c.abandonQuest(q.id)}>abandon</button>
            </div>
          ))}
          {c.activeQuests().length === 0 && <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>none — town boards post them</div>}
        </RailPanel>
        {(() => {
          // S21 Part 4 → S22 r1: the heard-rumors journal is its own FOLDING panel now — the
          // whole journal, newest first, scrollable (it grows for the life of a run).
          const j = c.rumorJournal();
          if (j.count === 0) return null;
          return (
            <RailPanel title="Rumors" badge={j.count} defaultOpen={false}>
              <div style={{ fontSize: 11, color: "var(--ink-soft)", maxHeight: 180, overflowY: "auto" }}>
                {j.all.map((r, i) => (
                  <div key={i} style={{ fontStyle: "italic", marginTop: 3 }}>“{r}”</div>
                ))}
              </div>
            </RailPanel>
          );
        })()}
        {/* S22 r3 (Chris, item 7): NO seen-gate — a siege anywhere in the world is news; an
            unvisited town names its region so the player can find it through the fog. */}
        {c.siegeRail().length > 0 && (
          <RailPanel title="Sieges" badge={c.siegeRail().length}>
            {c.siegeRail().map((s) => (
              <div key={s.town.index} style={{ fontSize: 12, display: "flex", justifyContent: "space-between", cursor: screen.kind === "map" ? "pointer" : "default" }} title="click to preview the path there" onClick={() => c.clickCell(s.town.at)}>
                <span>{s.town.name}{!seenCell(s.town.at) && <i style={{ color: "var(--ink-soft)" }}> · {w.map.regions[s.town.region]?.name}</i>}</span>
                <span style={{ color: "var(--danger)", fontWeight: s.status === "occupied" ? 700 : 400 }}>
                  {s.status === "occupied" ? "OCCUPIED" : `falls in ${s.stepsLeft}`}
                </span>
              </div>
            ))}
          </RailPanel>
        )}
        {/* S25 r3 note 1 (Chris): manalinks get their own panel — each link names its kind, its
            granting town (the stake a siege there threatens), and its suspension state. */}
        {w.manalinks.length > 0 && (() => {
          const occupied = new Set((w.sieges as { townIndex: number; status?: string }[]).filter((s) => s.status === "occupied").map((s) => s.townIndex));
          const threatened = new Set((w.sieges as { townIndex: number; status?: string }[]).filter((s) => s.status === "threatened").map((s) => s.townIndex));
          const LAND: Record<string, string> = { W: "Plains", U: "Island", B: "Swamp", R: "Mountain", G: "Forest" };
          const darkCount = w.manalinks.filter((m) => occupied.has(m.town)).length;
          return (
            <RailPanel title="Manalinks" badge={darkCount ? `${w.manalinks.length - darkCount}/${w.manalinks.length}` : w.manalinks.length}>
              {w.manalinks.map((m, i) => {
                const town = w.map.towns[m.town];
                const dark = occupied.has(m.town);
                const hot = threatened.has(m.town);
                return (
                  <div key={i} style={{ fontSize: 12, display: "flex", justifyContent: "space-between", cursor: screen.kind === "map" && town ? "pointer" : "default" }} title="click to preview the path to its town" onClick={() => town && c.clickCell(town.at)}>
                    <span style={dark ? { textDecoration: "line-through", color: "var(--danger)" } : {}}>
                      <i className={`colour-pip c-${m.color}`} title={m.color} /> {(m.kind ?? "basic") === "life" ? "+1 max life" : `${LAND[m.color]} in play`}
                    </span>
                    <span style={{ color: dark || hot ? "var(--danger)" : "var(--ink-soft)", fontWeight: dark ? 700 : 400 }}>
                      {town?.name ?? "a town"}{dark ? " · OCCUPIED" : hot ? " · besieged!" : ""}
                    </span>
                  </div>
                );
              })}
              <div style={{ fontSize: 10.5, color: "var(--ink-soft)", marginTop: 4 }}>Town-tied: an occupied town's link goes dark until liberated. Basics start every duel in play; life links raise your maximum.</div>
            </RailPanel>
          );
        })()}
        <PowersRailPanel c={c} />
        {c.lordStatusRows().length > 0 && (
          <RailPanel title="The five lords" badge={`${c.lordStatusRows().filter((r) => r.sealed).length}/5 seals`}>
            {c.lordStatusRows().map((r) => (
              <div key={r.color} style={{ fontSize: 12, marginTop: 2 }} title={r.voice}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{r.lordName}</span>
                  <span style={{ color: r.sealed ? "var(--boost)" : "var(--danger)", fontWeight: 600 }}>{r.sealed ? "fallen" : `${r.life} life`}</span>
                </div>
                {!r.sealed && (r.growth > 0 || r.reduction > 0) && (
                  <div style={{ fontSize: 10.5, color: "var(--ink-soft)" }}>{r.base} base{r.growth > 0 ? ` +${r.growth} grown` : ""}{r.reduction > 0 ? ` −${r.reduction} hunted` : ""}</div>
                )}
              </div>
            ))}
            <div style={{ fontSize: 10.5, color: "var(--ink-soft)", marginTop: 4 }}>Hunting a spoke bleeds its lord; every step of your road feeds all five.</div>
            {/* S25 r4 note 4 (Chris): renown lives HERE now — fear is a face the lords' world reads,
                not a footnote in the Journey line. Per-colour bars (each kill of that colour is a
                notch; roamers of a colour flee when your renown there outgrows their tier). */}
            <div style={{ marginTop: 8, borderTop: "1px solid var(--line, #c9b993)" }} />
            <div style={{ fontSize: 11.5, marginTop: 6 }}><b>Your renown</b> · {w.player.renown} in all</div>
            {(["W", "U", "B", "R", "G"] as const).map((col) => (
              <div key={col} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                <i className={`colour-pip c-${col}`} title={col} />
                <div style={{ flex: 1, height: 7, background: "var(--fog, #f6efde)", border: "1px solid var(--line, #c9b993)", borderRadius: 3 }}>
                  <div style={{ width: `${Math.min(100, w.player.renownByColor[col] * 8)}%`, height: "100%", background: "var(--ink-soft)", borderRadius: 2 }} />
                </div>
                <span style={{ fontSize: 11, width: 18, textAlign: "right" }}>{w.player.renownByColor[col]}</span>
              </div>
            ))}
            <div style={{ fontSize: 10.5, color: "var(--ink-soft)", marginTop: 3 }}>Fear spreads by colour — beat a colour's creatures and its lesser kin start to flee you.</div>
          </RailPanel>
        )}
        <RailPanel title="Lairs & strongholds">
          {w.map.strongholds.map((f, i) => {
            if (!seenCell(f.at)) return null;
            const resident = w.opponents.find((o) => o.id === f.opponentId);
            // S21 r2 fix (Chris: the Emerald Root read "waiting" after its clear): a mox site's
            // cleared state lives in world.dungeons, not on a resident it never had.
            const moxCleared = f.kind === "dungeon" && w.dungeons[`${w.map.regions[f.region]?.tier === "approach" ? "power" : "mox"}_${w.map.regions[f.region]?.color}`.toLowerCase()]?.cleared; // S25: approach ring = power-dungeon
            // S22b: the seats are OPEN now — a stronghold reads by its lord's fate, not "sealed shut".
            const shRow = f.kind === "stronghold" ? c.lordStatusRows().find((r) => r.color === w.map.regions[f.region]?.color) : undefined;
            const status = f.kind === "stronghold" ? (shRow?.sealed ? "broken · seal held" : `${shRow?.lordName ?? "a lord"} · ${shRow?.life ?? "?"} life`) : moxCleared || resident?.gone ? "cleared" : `${w.map.regions[f.region]?.name ?? ""} · waiting`;
            return (
              <div key={i} style={{ fontSize: 12, display: "flex", justifyContent: "space-between", cursor: screen.kind === "map" ? "pointer" : "default" }} title="click to preview the path there" onClick={() => c.clickCell(f.at)}>
                <span>{f.name ?? f.kind}</span><span style={{ color: f.kind === "stronghold" ? "var(--ink-soft)" : moxCleared || resident?.gone ? "var(--boost)" : "var(--danger)" }}>{status}</span>
              </div>
            );
          })}
          {w.map.strongholds.filter((f) => seenCell(f.at)).length === 0 && <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>none found yet</div>}
        </RailPanel>
        <RailPanel title="Regions" badge={`${seenRegions.size}/${w.map.regions.length}`} defaultOpen={false}>
          {[...w.map.regions].filter((r) => seenRegions.has(r.index)).sort((a, b) => (a.spoke ?? 0) - (b.spoke ?? 0) || ["civilized", "approach", "wild"].indexOf(a.tier) - ["civilized", "approach", "wild"].indexOf(b.tier)).map((r) => (
            <div key={r.index} style={{ fontSize: 12, display: "flex", justifyContent: "space-between" }}>
              <span>{r.name}</span><span style={{ color: "var(--ink-soft)" }}>{r.tier}</span>
            </div>
          ))}
        </RailPanel>
        <RailPanel title="Recent duels" badge={w.duels.length || undefined} defaultOpen={false}>
          {w.duels.slice(-6).reverse().map((d) => (
            <div key={d.index} style={{ fontSize: 11.5 }}>
              #{d.index + 1} {catalog.opponents.find((o) => o.id === d.catalogId)?.name ?? d.enemyName ?? d.catalogId} — <b>{d.outcome}</b>{" "}
              <button className="linkish" onClick={() => watch(d.saved)}>replay</button>
            </div>
          ))}
          {w.duels.length === 0 && <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>none yet</div>}
        </RailPanel>
      </div>
      {screen.kind === "encounter" && <ParleyPanel c={c} />}
      {screen.kind === "town" && <TownScreen c={c} pool={pool} oracle={oracle} />}
      {c.fuelPicker && <FuelPickerModal c={c} />} {/* S25: above the parley (z 55) */}
      {c.questPopup && <QuestDonePopup c={c} />}
      <ManalinkSplash c={c} /> {/* S24 r5: above everything (z 60) — the sting's own stage */}
    </div>
  );
}
