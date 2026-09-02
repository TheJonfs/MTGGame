import { useEffect, useMemo, useRef, useState } from "react";
import { MANA_SYMBOLS } from "@shandalar/cards";
import type { CardDef, ResolvedTarget } from "@shandalar/cards";
import { STEPS, getObject, type PlayerId, type Step } from "@shandalar/engine";
import { Board } from "../components/Board";
import { Inspector, StackPanel, StatusBlock } from "../components/Rail";
import { CardFrame } from "../components/CardFrame";
import { actionLabel, cardName, eventLabel, stepLabel, targetLabel } from "../labels";
import type { OracleEntry } from "../engine-bridge";
import type { MatchController, UiPhase } from "./match-controller";
import { audio } from "../audio/audio";
import { viewAbilityAt } from "@shandalar/agents"; // S26: the S25 r4 chooser referenced it unimported — a runtime ReferenceError the typecheck never saw (tsx is outside tsc's project; the parse gate parses, it does not bind)

/**
 * The play screen (S10, ADR-058): Board + rail + prompt bar wired to the
 * MatchController. All legality flows from the controller's phases (which
 * flow from the enumerated actions); this file is presentation only.
 */

const STOPS_KEY = "shandalar-stops";
const DELAY_KEY = "shandalar-ai-delay";
const OPP_SPELL_STOP_KEY = "shandalar-stop-opp-spells"; // S11 (note 2)
const BLOCKERS_PAUSE_KEY = "shandalar-pause-blockers-untapped"; // S12 rider
const COMBAT_STOP_KEY = "shandalar-stop-combat"; // S13

export function loadStopOnCombat(): boolean {
  try {
    const raw = localStorage.getItem(COMBAT_STOP_KEY);
    return raw === null ? true : raw === "1";
  } catch {
    return true;
  }
}

export function loadPauseBlockersWithUntapped(): boolean {
  try {
    return localStorage.getItem(BLOCKERS_PAUSE_KEY) === "1";
  } catch {
    return false;
  }
}
const INSPECTOR_POS_KEY = "shandalar-inspector-pos"; // S11 (note 3)

export function loadStopOnOpponentSpells(): boolean {
  try {
    const raw = localStorage.getItem(OPP_SPELL_STOP_KEY);
    return raw === null ? true : raw === "1";
  } catch {
    return true;
  }
}

export function loadStops(): Set<Step> {
  try {
    const raw = localStorage.getItem(STOPS_KEY);
    return raw ? new Set(JSON.parse(raw) as Step[]) : new Set();
  } catch {
    return new Set();
  }
}

function PromptBar({ c, phase, confirmLabel }: { c: MatchController; phase: UiPhase; confirmLabel: string | null }) {
  const [hold, setHold] = useState(false);

  const prompt = (() => {
    switch (phase.kind) {
      case "waiting":
        return c.fastForwarding ? "Fast-forwarding to your turn…" : "Opponent is thinking…";
      case "priority":
        return "You have priority.";
      case "chooseX":
        return "Choose X.";
      case "chooseColor":
        return "Choose a colour of mana.";
      case "targeting":
        // S26 r3: "up to N" reads as optional picks; the Done button (below) commits early.
        return phase.canFinish
          ? (phase.chosen.length === 0 ? `Choose up to ${phase.targetsNeeded} target${phase.targetsNeeded === 1 ? "" : "s"} — or none.` : `${phase.chosen.length} chosen — choose another (up to ${phase.targetsNeeded}), or finish.`)
          : `Choose a target (${phase.chosen.length + 1}/${phase.targetsNeeded}).`;
      case "confirmCast":
        // S10 playtest: say WHAT is being confirmed.
        return confirmLabel ? `${confirmLabel} — confirm?` : "Confirm?";
      case "manualTap": {
        // S11 (note 5): floating pool shown inline; auto-pay covers the rest.
        const pool = c.game.state.players[c.humanSeat].manaPool;
        const floating = MANA_SYMBOLS.flatMap((s) => Array.from({ length: pool[s] }, () => s)).join(" ");
        return `Tap lands to float mana${floating ? ` (pool: ${floating})` : ""}, then cast — auto-pay covers the rest.`;
      }
      case "stackStop":
        return c.stopReason && !c.stopReason.startsWith("Opponent cast") ? "Continue when ready." : "The opponent's spell is on the stack.";
      case "attackers":
        return "Declare attackers: click creatures to stage, then confirm.";
      case "blockers":
        return phase.mustAddBlocker
          ? "A menace attacker needs a second blocker."
          : phase.options.size === 0
            ? "No legal blocks (menace or evasion) — confirm to continue."
            : phase.pendingBlocker
              ? "Now click the attacker to block."
              : "Declare blockers: click a blocker, then an attacker.";
      case "dialog":
        return "Make a choice.";
      case "gameOver":
        return "Game over.";
    }
  })();

  // S22 r4 (Chris, item 2): the bottom rail wears whose TURN it is — a strong register shift
  // (brass wash + chip when yours, cool ink when theirs) so a reflexive Pass click on the
  // opponent's turn announces itself before it happens.
  const yourTurn = c.game.state.activePlayer === c.humanSeat;
  return (
    <div className={`transport play-prompt ${yourTurn ? "your-turn" : "opp-turn"}`}>
      <span className={`turn-chip ${yourTurn ? "yours" : ""}`}>{yourTurn ? "Your turn" : "Their turn"}</span>
      <span className="prompt-text">{c.combatNotice ?? (c.stopReason ? `${c.stopReason} ${prompt}` : prompt)}</span>
      {phase.kind === "priority" && (
        <>
          <button className="primary" onClick={() => c.pass()}>Pass</button>
          <button
            title="Auto-pass every window until your next turn. Cancels if anything needs you — a block, a discard, or an opponent spell aimed at you or your permanents (ADR-059)."
            onClick={() => c.fastForwardToMyTurn()}
          >
            ⏭ my turn
          </button>
        </>
      )}
      {phase.kind === "stackStop" && (
        <button className="primary" onClick={() => c.continueFromStop()}>Continue</button>
      )}
      {phase.kind === "manualTap" && (
        <>
          <button className="primary" onClick={() => c.castNow(hold)}>Cast</button>
          <button onClick={() => c.cancel()}>Cancel</button>
          <label className="hold-toggle" title="Retain priority to respond to your own spell (ADR-058)">
            <input type="checkbox" checked={hold} onChange={(e) => setHold(e.target.checked)} /> hold priority
          </label>
        </>
      )}
      {phase.kind === "confirmCast" && (
        <>
          <button className="primary" onClick={() => c.confirmCast(hold)}>Confirm</button>
          {phase.offerManualTap && (
            <button title="You have more mana than this costs — choose which lands pay (S11)" onClick={() => c.beginManualTap()}>
              Tap manually…
            </button>
          )}
          <button onClick={() => c.cancel()}>Cancel</button>
          <label className="hold-toggle" title="Retain priority to respond to your own spell (ADR-058)">
            <input type="checkbox" checked={hold} onChange={(e) => setHold(e.target.checked)} /> hold priority
          </label>
        </>
      )}
      {phase.kind === "targeting" && phase.canFinish && (
        <button className="primary" onClick={() => c.finishTargeting()}>{phase.chosen.length === 0 ? "No targets" : `Done (${phase.chosen.length})`}</button>
      )}
      {(phase.kind === "targeting" || phase.kind === "chooseX" || phase.kind === "chooseColor") && (
        <button onClick={() => c.cancel()}>Cancel</button>
      )}
      {phase.kind === "attackers" && (
        <>
          <button className="primary" onClick={() => c.confirmAttackers()}>
            Confirm attackers ({phase.staged.size})
          </button>
          <button onClick={() => c.cancel()}>Clear</button>
        </>
      )}
      {phase.kind === "blockers" && (
        <>
          {!phase.mustAddBlocker && (
            <button className="primary" onClick={() => c.confirmBlocks()}>
              Confirm blocks ({phase.stagedPairs.length})
            </button>
          )}
          <button onClick={() => c.cancel()}>Clear</button>
        </>
      )}
      <span style={{ flex: 1 }} />
    </div>
  );
}

function StopsFlyout({ c }: { c: MatchController }) {
  const [open, setOpen] = useState(false);
  const [confirmingConcede, setConfirmingConcede] = useState(false);
  const [, force] = useState(0);
  const toggle = (s: Step) => {
    if (c.stops.has(s)) c.stops.delete(s);
    else c.stops.add(s);
    localStorage.setItem(STOPS_KEY, JSON.stringify([...c.stops]));
    force((n) => n + 1);
  };
  return (
    <span className="stops-flyout">
      <button className="linkish" onClick={() => setOpen(!open)}>menu ▾</button>
      {open && (
        <div className="flyout">
          <div className="flyout-title">Always stop at…</div>
          {STEPS.filter((s) => !["UNTAP", "CLEANUP"].includes(s)).map((s) => (
            <label key={s}>
              <input type="checkbox" checked={c.stops.has(s)} onChange={() => toggle(s)} /> {stepLabel(s)}
            </label>
          ))}
          <label style={{ marginTop: 4 }}>
            <input
              type="checkbox"
              checked={c.stopOnOpponentSpells}
              onChange={(e) => {
                c.stopOnOpponentSpells = e.target.checked;
                localStorage.setItem(OPP_SPELL_STOP_KEY, e.target.checked ? "1" : "0");
                force((n) => n + 1);
              }}
            />{" "}
            opponent casts a spell
          </label>
          <label>
            <input
              type="checkbox"
              checked={c.stopOnCombat}
              onChange={(e) => {
                c.stopOnCombat = e.target.checked;
                localStorage.setItem(COMBAT_STOP_KEY, e.target.checked ? "1" : "0");
                force((n) => n + 1);
              }}
            />{" "}
            attacks and blocks are declared
          </label>
          <label>
            <input
              type="checkbox"
              checked={c.pauseBlockersWithUntapped}
              onChange={(e) => {
                c.pauseBlockersWithUntapped = e.target.checked;
                localStorage.setItem(BLOCKERS_PAUSE_KEY, e.target.checked ? "1" : "0");
                force((n) => n + 1);
              }}
            />{" "}
            blockers, even with no legal block
          </label>
          <div className="flyout-title" style={{ marginTop: 6 }}>AI pacing</div>
          <label>
            delay{" "}
            <select
              value={c.aiDelayMs}
              onChange={(e) => {
                c.aiDelayMs = Number(e.target.value);
                localStorage.setItem(DELAY_KEY, e.target.value);
                force((n) => n + 1); // S25 r2 note 1: without this the controlled select snapped back
              }}
            >
              {[0, 200, 400, 800].map((ms) => <option key={ms} value={ms}>{ms}ms</option>)}
            </select>
          </label>
          <div className="flyout-title" style={{ marginTop: 6 }}>Match</div>
          {import.meta.env.DEV && (
            <button title="Dev builds only (S13): end the duel as an opponent concession in your favour" onClick={() => { c.autoWin(); setOpen(false); }}>
              Auto-win (dev)
            </button>
          )}
          {confirmingConcede ? (
            <div style={{ display: "flex", gap: 4 }}>
              <button className="danger" onClick={() => { c.concede(); setConfirmingConcede(false); setOpen(false); }}>Concede</button>
              <button onClick={() => setConfirmingConcede(false)}>Keep playing</button>
            </div>
          ) : (
            <button onClick={() => setConfirmingConcede(true)}>Concede…</button>
          )}
        </div>
      )}
    </span>
  );
}

/** S11 (Chris's rider): the turn-order strip — one glyph per step, the
 * current one lit, tinted by whose turn it is. Tooltips carry the names. */
const STEP_GLYPHS: Record<Step, string> = {
  UNTAP: "⟳",
  UPKEEP: "✧",
  DRAW: "⇩",
  MAIN1: "Ⅰ",
  COMBAT_BEGIN: "⚑",
  DECLARE_ATTACKERS: "⚔",
  DECLARE_BLOCKERS: "⛨",
  FIRST_STRIKE_DAMAGE: "⚡",
  COMBAT_DAMAGE: "✸",
  COMBAT_END: "⚐",
  MAIN2: "Ⅱ",
  END: "☾",
  CLEANUP: "⋯",
};

function PhaseStrip({ step, yourTurn }: { step: Step; yourTurn: boolean }) {
  return (
    <span className={`phase-strip ${yourTurn ? "you" : "opp"}`}>
      {STEPS.map((s) => (
        <span key={s} title={stepLabel(s)} className={`phase-chip${s === step ? " current" : ""}`}>
          {STEP_GLYPHS[s]}
        </span>
      ))}
    </span>
  );
}

function Ribbon({ c }: { c: MatchController }) {
  const state = c.game.state;
  const yourTurn = state.activePlayer === c.humanSeat;
  return (
    <div className="play-ribbon">
      {state.turn === 0 ? (
        // ADR-059: pre-game state reads "Turn 0 · Cleanup" — say what it is.
        <span className="turn">Mulligans</span>
      ) : (
        <>
          <span className="turn">Turn {state.turn} · {stepLabel(state.step)}</span>
          <PhaseStrip step={state.step} yourTurn={yourTurn} />
          <span className={yourTurn ? "who you" : "who"}>{yourTurn ? "Your turn" : "Opponent's turn"}</span>
        </>
      )}
      <span style={{ flex: 1 }} />
      <StopsFlyout c={c} />
      <span className="seed">seed {c.seed}</span>
    </div>
  );
}

function DialogModal({ c, phase, pool, oracle, onHoverOption, printed }: { c: MatchController; phase: Extract<UiPhase, { kind: "dialog" }>; pool: Map<string, CardDef>; oracle: Record<string, OracleEntry>; onHoverOption: (ids: string[] | null) => void; printed: boolean }) {
  const req = phase.request;
  const state = c.game.state;
  const titles: Record<string, string> = {
    mulligan: "Keep this hand?",
    bottomCards: "Choose a card to put on the bottom",
    discard: "Choose a card to discard",
    chooseSacrifice: "Choose a permanent to sacrifice",
    legendRule: "Legend rule: choose which to keep",
    orderTriggers: "Choose which trigger goes on the stack next",
    orderBlockerDamage: "Choose which blocker takes damage next",
    optionalTrigger: "Use this ability?",
    chooseTarget: "Choose targets",
    searchLibrary: "Search your library",
  };
  // S15 (ADR-068 Amendment 1): the search dialog — the matching cards as a
  // grid (chooser only; the request's candidates), with Decline apart.
  const isSearch = req.purpose === "searchLibrary";
  const sourceName = req.source ? cardName(pool, req.source.cardId) : null;
  // S18 Part 5 (S17 concern 5 → ADR-077 rider): dedicated dialogs on the ADR-058 local-choice + single-Confirm
  // pattern for the three S17 request purposes — modal choice (A6), discard-as-cost (ADR-076), and the A7
  // additional-cost sacrifice (the staged spell + its targets shown so the player sees what the sacrifice buys).
  const isMode = req.purpose === "chooseMode";
  const isDiscardCost = req.purpose === "discardCost";
  const lastCast = c.lastCast;
  const castSource = lastCast && lastCast.type === "castSpell" && req.source && state.objects[lastCast.objectId]?.cardId === req.source.cardId ? lastCast : null;
  const isAdditionalSac = req.purpose === "chooseSacrifice" && !!req.source && !!castSource;
  const sourceDef = req.source ? pool.get(req.source.cardId) ?? null : null;
  // S19 round 2 (Duress): a caster-chooses discard reveals THEIR hand — title it that way, and when
  // nothing matches the filter the single action is an acknowledgement, not a discard.
  const isTheirHandReveal = req.purpose === "discard" && !!req.revealed;
  // S20 (A9): the shock clause — a two-button ceremony with the stakes stated.
  const isEntersChoice = req.purpose === "entersChoice";
  const revealNothing = isTheirHandReveal && req.actions.every((a) => a.type === "declineOptional");
  const dedicatedTitle = isMode
    ? `Choose one — ${sourceName}`
    : isDiscardCost
      ? `Discard a card to pay — ${sourceName}`
      : isAdditionalSac
        ? `Additional cost — ${sourceName}`
        : isTheirHandReveal
          ? revealNothing
            ? "Their hand is revealed — nothing to take"
            : "Their hand is revealed — choose the card they discard"
          : isEntersChoice
            ? `${sourceName} — pay 2 life to enter untapped?`
            : null;
  // Render actions as cards where the choice is over cards (ADR-058).
  const cardOf = (a: (typeof req.actions)[number]): string | null => {
    if ("objectId" in a && typeof a.objectId === "string") {
      const obj = state.objects[a.objectId];
      return obj ? obj.cardId : null;
    }
    if (a.type === "orderTrigger") return a.cardId;
    return null;
  };
  const asCards = isSearch || req.actions.every((a) => cardOf(a) !== null);
  // S18 director round (Chris's note 2): colour-code whose permanent an option refers to — the
  // Man-o'-War trigger's target list was a wall of same-named tiles with no owner.
  const ctlTag = (a: (typeof req.actions)[number]): "you" | "them" | null => {
    const ids: string[] = [];
    if ("objectId" in a && typeof a.objectId === "string") ids.push(a.objectId);
    if ("targets" in a && Array.isArray(a.targets)) for (const t of a.targets as { kind: string; id?: string }[]) if (t.kind === "object" && t.id) ids.push(t.id);
    const bf = ids.map((id) => state.objects[id]).find((o) => o && o.zone === "battlefield");
    if (!bf) {
      const pt = ("targets" in a && Array.isArray(a.targets) ? (a.targets as { kind: string; player?: number }[]).find((t) => t.kind === "player") : null);
      return pt ? (pt.player === c.humanSeat ? "you" : "them") : null;
    }
    return bf.controller === c.humanSeat ? "you" : "them";
  };
  const tagEl = (a: (typeof req.actions)[number]) => { const t = ctlTag(a); return t ? <span className={`ctl-tag ${t}`}>{t === "you" ? "yours" : "theirs"}</span> : null; };
  // S10 playtest: hovering an option highlights the board permanent(s) it
  // refers to — vital when two options share a card name.
  const boardIdsOf = (a: (typeof req.actions)[number]): string[] => {
    const ids: string[] = [];
    if ("objectId" in a && typeof a.objectId === "string" && state.objects[a.objectId]?.zone === "battlefield") {
      ids.push(a.objectId);
    }
    if ("targets" in a && Array.isArray(a.targets)) {
      for (const t of a.targets as { kind: string; id?: string }[]) {
        if (t.kind === "object" && t.id && state.objects[t.id]?.zone === "battlefield") ids.push(t.id);
      }
    }
    return ids;
  };
  return (
    <div className="gallery-modal">
      <div className="gallery-modal-box play-dialog">
        <h3 style={{ marginTop: 0, fontFamily: "var(--serif)" }}>
          {dedicatedTitle ?? titles[req.purpose] ?? req.purpose}
          {!dedicatedTitle && sourceName ? <span style={{ fontWeight: 400 }}> — {sourceName}</span> : null}
        </h3>
        {(isMode || isDiscardCost || isAdditionalSac) && sourceDef && (
          <div className="dialog-source">
            <CardFrame def={sourceDef} oracle={oracle[sourceDef.id]} mini showPrinted={printed} />
            <div className="dialog-source-text">
              {isMode && <p>Its ability offers a choice of modes. Pick one; if the mode needs a target you choose it next.</p>}
              {isDiscardCost && <p>Discarding is part of the activation cost — the card goes to your graveyard whether or not the ability resolves as hoped.</p>}
              {isAdditionalSac && castSource && castSource.type === "castSpell" && (
                <>
                  <p>Casting this spell requires a sacrifice as an additional cost (paid now, after mana).</p>
                  <p className="dialog-staged">Staged: {actionLabel(state, pool, castSource)}</p>
                </>
              )}
            </div>
          </div>
        )}
        {req.revealed && !isSearch && (
          <div className="revealed-strip">
            <div className="flyout-title">Revealed:</div>
            <div className="dialog-cards">
              {req.revealed.map((r) => (
                <CardFrame key={r.objectId} def={pool.get(r.cardId)!} oracle={oracle[r.cardId]} mini showPrinted={printed} />
              ))}
            </div>
          </div>
        )}
        {isSearch && (
          <p style={{ fontSize: 11.5, color: "var(--ink-soft)", marginTop: 0 }}>
            {req.actions.length - 1} matching card{req.actions.length === 2 ? "" : "s"} — pick one, or find nothing. Your library is shuffled either way.
          </p>
        )}
        <div className={isMode ? "dialog-modes" : asCards ? "dialog-cards" : "dialog-list"}>
          {req.actions.map((a, i) => {
            const cid = cardOf(a);
            const selected = phase.selected === i;
            if (isMode && a.type === "chooseMode") {
              return (
                <div key={i} className={`dialog-option dialog-mode ${selected ? "selected" : ""}`} onClick={() => c.selectDialog(i)}>
                  <span className="mode-badge">{a.mode + 1}</span>
                  <span className="mode-label">{a.label}</span>
                </div>
              );
            }
            if (isSearch && a.type === "declineSearch") {
              return (
                <div key={i} className={`dialog-option decline-search ${selected ? "selected" : ""}`} onClick={() => c.selectDialog(i)}>
                  <span>Find nothing</span>
                </div>
              );
            }
            if (isEntersChoice) {
              const you = c.humanSeat;
              const life = state.players[you].life;
              return (
                <div key={i} className={`dialog-option ${selected ? "selected" : ""}`} onClick={() => c.selectDialog(i)}>
                  <span>{a.type === "acceptOptional" ? `Pay 2 life (${life} → ${life - 2}) — enters untapped` : "Keep your life — enters tapped"}</span>
                </div>
              );
            }
            if (revealNothing && a.type === "declineOptional") {
              return (
                <div key={i} className={`dialog-option ${selected ? "selected" : ""}`} onClick={() => c.selectDialog(i)}>
                  <span>Continue (no noncreature, nonland card to take)</span>
                </div>
              );
            }
            return (
              <div
                key={i}
                className={`dialog-option ${selected ? "selected" : ""}`}
                onClick={() => c.selectDialog(i)}
                onMouseEnter={() => onHoverOption(boardIdsOf(a))}
                onMouseLeave={() => onHoverOption(null)}
              >
                {asCards && cid ? (
                  <CardFrame def={pool.get(cid)!} oracle={oracle[cid]} mini showPrinted={printed} />
                ) : (
                  <span>{tagEl(a)}{actionLabel(state, pool, a)}</span>
                )}
                {asCards && <div className="dialog-caption">{tagEl(a)}{actionLabel(state, pool, a)}</div>}
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 8, textAlign: "right" }}>
          <button className="primary" disabled={phase.selected === null} onClick={() => c.confirmDialog()}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

/** S25 r4 (Chris: Airship Crash's cycling went nowhere on click): a hand card offering both a
 * cast and a hand-zone activation — pick which. */
function CastOrActivateModal({ c, pool }: { c: MatchController; pool: Map<string, CardDef> }) {
  if (c.phase.kind !== "castOrActivate") return null;
  const cardId = c.game.state.objects[c.phase.objectId]?.cardId;
  const name = cardId ? cardName(pool, cardId) : "the card";
  const act = c.phase.activations[0];
  const ability = act && act.type === "activateAbility" ? viewAbilityAt(c.currentView()!, pool, act.objectId, act.abilityIndex) : undefined;
  const isCycle = !!ability && ability.kind === "activated" && ability.cost.discardSelf === true;
  const actLabel = isCycle ? `Cycle${ability && ability.kind === "activated" && ability.cost.mana ? ` (${ability.cost.mana})` : ""} — discard it, draw a card` : "Use its ability from hand";
  return (
    <div className="gallery-modal">
      <div className="gallery-modal-box play-dialog">
        <h3 style={{ marginTop: 0, fontFamily: "var(--serif)" }}>{name}</h3>
        <div className="dialog-list" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="primary" onClick={() => c.chooseCastOrActivate("cast")}>{c.phase.casts[0]?.type === "playLand" ? `Play ${name}` : `Cast ${name}`}</button>
          <button onClick={() => c.chooseCastOrActivate("activate")}>{actLabel}</button>
        </div>
        <div style={{ marginTop: 8, textAlign: "right" }}>
          <button onClick={() => c.chooseCastOrActivate(null)}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/** S15 (ADR-068 Amendment 2): Lotus — five colour buttons. */
/** S20: a dual clicked during manual tapping — which color? */
function TapColorModal({ c, pool }: { c: MatchController; pool: Map<string, CardDef> }) {
  if (c.phase.kind !== "chooseTapColor") return null;
  const names: Record<string, string> = { W: "White", U: "Blue", B: "Black", R: "Red", G: "Green", C: "Colorless" };
  const cardId = c.game.state.objects[c.phase.objectId]?.cardId;
  return (
    <div className="gallery-modal">
      <div className="gallery-modal-box play-dialog">
        <h3 style={{ marginTop: 0, fontFamily: "var(--serif)" }}>Tap {cardId ? cardName(pool, cardId) : "the land"} for which colour?</h3>
        <div className="dialog-list" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {c.phase.options.map((t) => (
            <button key={t.color} className="color-pick" onClick={() => c.chooseTapColor(t.color ?? null)}>
              <i className={`colour-pip c-${t.color}`} /> {names[t.color ?? ""] ?? t.color}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 8, textAlign: "right" }}>
          <button onClick={() => c.chooseTapColor(null)}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function ColorModal({ c }: { c: MatchController }) {
  const colors = ["W", "U", "B", "R", "G"] as const;
  const names: Record<string, string> = { W: "White", U: "Blue", B: "Black", R: "Red", G: "Green" };
  return (
    <div className="gallery-modal">
      <div className="gallery-modal-box play-dialog">
        <h3 style={{ marginTop: 0, fontFamily: "var(--serif)" }}>Add three mana of which colour?</h3>
        <div className="dialog-list" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {colors.map((col) => (
            <button key={col} className="color-pick" onClick={() => c.chooseColor(col)}>
              <i className={`colour-pip c-${col}`} /> {names[col]}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 8, textAlign: "right" }}>
          <button onClick={() => c.cancel()}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function XModal({ c, phase }: { c: MatchController; phase: Extract<UiPhase, { kind: "chooseX" }> }) {
  return (
    <div className="gallery-modal">
      <div className="gallery-modal-box play-dialog">
        <h3 style={{ marginTop: 0, fontFamily: "var(--serif)" }}>Choose X</h3>
        <div className="dialog-list" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {phase.xs.map((x) => (
            <button key={x} onClick={() => c.chooseX(x)}>X = {x}</button>
          ))}
        </div>
        <div style={{ marginTop: 8, textAlign: "right" }}>
          <button onClick={() => c.cancel()}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function ZoneModal({ c, pool, oracle, zone, printed, onClose }: { c: MatchController; pool: Map<string, CardDef>; oracle: Record<string, OracleEntry>; zone: { player: PlayerId; zone: "graveyard" | "exile" }; printed: boolean; onClose: () => void }) {
  const state = c.game.state;
  const ids = state.players[zone.player][zone.zone];
  const who = zone.player === c.humanSeat ? "Your" : "Opponent's";
  return (
    <div className="gallery-modal" onClick={onClose}>
      <div className="gallery-modal-box play-dialog" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0, fontFamily: "var(--serif)" }}>
          {who} {zone.zone} ({ids.length})
          <button className="linkish" onClick={onClose}>close</button>
        </h3>
        <div className="dialog-cards">
          {ids.length === 0 && <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>empty</span>}
          {ids.map((id) => {
            const obj = getObject(state, id);
            // S22 r2 (Chris — Mother Bear): a graveyard card with a live activation glows and
            // clicks (the same beginCast path as the battlefield); close the modal so the
            // targeting/confirm dialog is visible.
            const activatable = c.phase.kind === "priority" && zone.zone === "graveyard" && zone.player === c.humanSeat && c.phase.activatable.has(id);
            // S10 playtest: zone browsers follow the inspector's printed toggle.
            return (
              <div
                key={id}
                className={`card-slot ${activatable ? "castable" : ""}`}
                style={activatable ? { cursor: "pointer", outline: "2px solid var(--brass)", borderRadius: 6 } : undefined}
                title={activatable ? "this card has an ability usable from the graveyard — click to activate" : undefined}
                onClick={activatable ? () => { c.clickGraveyardCard(id); onClose(); } : undefined}
              >
                <CardFrame def={pool.get(obj.cardId)!} oracle={oracle[obj.cardId]} mini showPrinted={printed} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** S10 playtest: live play-by-play in the rail (actions + notable events).
 * Objects get a fresh id on every zone move (CR 400.7), so historical action
 * ids are dead by read time — ZONE_CHANGE events carry oldId/newId/cardId,
 * which lets every id ever logged resolve to a card name. */
function PlayLog({ c, pool }: { c: MatchController; pool: Map<string, CardDef> }) {
  const state = c.game.state;
  const you = c.humanSeat;
  const nameOf = (objectId: string): string => {
    const live = state.objects[objectId];
    if (live) return cardName(pool, live.cardId);
    const cardId = c.idNames.get(objectId);
    return cardId ? cardName(pool, cardId) : "a card";
  };
  // S22 r3 (Chris, item 4: "which player was targeted by Mind Rot?"): cast/activate lines
  // name their targets — "Cast Mind Rot → You" reads the aim off the log.
  const targetsOf = (a: { targets?: ResolvedTarget[] }): string =>
    a.targets?.length ? ` → ${a.targets.map((t) => targetLabel(state, pool, t, you, c.idNames)).join(", ")}` : "";
  const label = (a: { type: string; objectId?: string; x?: number; blocker?: string; attacker?: string; cardId?: string; targets?: ResolvedTarget[] }, mine: boolean): string => {
    switch (a.type) {
      case "playLand": return `Play ${nameOf(a.objectId!)}`;
      case "castSpell": return `Cast ${nameOf(a.objectId!)}${a.x !== undefined ? ` (X=${a.x})` : ""}${targetsOf(a)}`;
      case "activateAbility": return `Activate ${nameOf(a.objectId!)}${targetsOf(a)}`;
      case "declareAttacker": return `Attack with ${nameOf(a.objectId!)}`;
      case "declareBlocker": return `Block ${nameOf(a.attacker!)} with ${nameOf(a.blocker!)}`;
      case "sacrifice": return `Sacrifice ${nameOf(a.objectId!)}`;
      case "discard": return `Discard ${nameOf(a.objectId!)}`;
      // S15: the pick is hidden information for the opponent (Tutor → hand); the
      // destination reveals what it reveals (Growth's land shows up on the board).
      case "searchPick": return mine ? `Search: ${nameOf(a.objectId!)}` : "Searches their library and shuffles";
      case "declineSearch": return mine ? "Search: found nothing" : "Searches their library and shuffles";
      // Bottoming is hidden information — never name the opponent's card.
      case "bottomCard": return mine ? `Bottom ${nameOf(a.objectId!)}` : "Bottom a card";
      default: return actionLabel(state, pool, a as never, c.idNames); // S22 r2: dead ids resolve through the ledger
    }
  };
  const lines: string[] = [];
  for (const e of c.log.entries) {
    if (e.t === "ACTION") {
      if (["pass", "tapForMana", "doneDeclaringAttackers", "doneDeclaringBlockers"].includes(e.action.type)) continue;
      const who = e.player === you ? "You" : "Opp";
      lines.push(`T${e.turn} ${who}: ${label(e.action as never, e.player === you)}`);
    } else if (e.t === "EVENT") {
      // CARD_DRAWN is noise; SPELL_CAST duplicates the cast ACTION line.
      if (e.name === "CARD_DRAWN" || e.name === "SPELL_CAST") continue;
      const text = eventLabel(pool, e.name, e.payload as Record<string, unknown>, you);
      if (text) lines.push(text);
    }
  }
  const recent = lines.slice(-200); // S11: the log now owns the rail's spare height
  return (
    <div className="panel play-log">
      <h3>Play-by-play</h3>
      <div
        className="play-log-lines"
        ref={(el) => {
          if (el) el.scrollTop = el.scrollHeight;
        }}
      >
        {recent.map((l, i) => (
          <div key={i} className="log-line">{l}</div>
        ))}
      </div>
    </div>
  );
}

/** S11 (Chris's note 3): the Inspector pops out as a draggable floating panel
 * so the rail's height goes to the stack and the play-by-play. Position is
 * remembered; drag by the header. */
function FloatingInspector(props: { ctx: MatchController["game"]["ctx"]; objectId: string | null; fallbackCardId: string | null; oracle: Record<string, OracleEntry>; printed: boolean; onTogglePrinted: () => void }) {
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    try {
      const raw = localStorage.getItem(INSPECTOR_POS_KEY);
      if (raw) return JSON.parse(raw) as { x: number; y: number };
    } catch { /* default below */ }
    // Default: top-right of the board (rows fill left→right, so this corner
    // stays clear longest); the rail is ≤360px wide.
    return { x: Math.max(16, window.innerWidth - 360 - 250), y: 60 };
  });
  const [collapsed, setCollapsed] = useState(false);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const x = Math.max(0, Math.min(window.innerWidth - 120, e.clientX - drag.current.dx));
    const y = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - drag.current.dy));
    setPos({ x, y });
  };
  const onPointerUp = () => {
    if (!drag.current) return;
    drag.current = null;
    localStorage.setItem(INSPECTOR_POS_KEY, JSON.stringify(pos));
  };
  return (
    <div className={`floating-inspector${collapsed ? " collapsed" : ""}`} style={{ left: pos.x, top: pos.y }}>
      <div className="drag-bar" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} title="Drag to move">
        <span title="drag">⋮⋮</span>
        <button className="linkish" onClick={() => setCollapsed(!collapsed)}>{collapsed ? "show" : "hide"}</button>
      </div>
      {!collapsed && <Inspector ctx={props.ctx} objectId={props.objectId} fallbackCardId={props.fallbackCardId} oracle={props.oracle} printed={props.printed} onTogglePrinted={props.onTogglePrinted} />}
    </div>
  );
}


/** S22 r2 (Chris — the Shandalar callback): the world's play/draw coin flip, staged as a small
 * ceremony before the first decision. Pure presentation: the flip itself was rolled by the
 * world's seeded RNG and rides the spec (replay-exact); this just shows the verdict. */
function CoinFlip({ onPlay, done }: { onPlay: boolean; done: () => void }) {
  // S23 audio: the flip's stinger (cue-first; silent when unmapped).
  useEffect(() => {
    audio.sting("sting.coin-flip");
  }, []);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setSettled(true), 1100);
    const t2 = setTimeout(done, 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [done]);
  return (
    <div className="gallery-modal coin-flip-overlay" onClick={done}>
      <div style={{ textAlign: "center" }}>
        <div className={`coin ${settled ? "settled" : "spinning"}`}>{settled ? (onPlay ? "☀" : "☾") : ""}</div>
        <div className="coin-verdict" style={{ opacity: settled ? 1 : 0 }}>
          {onPlay ? "The flip is yours — you are on the play." : "The flip goes against you — you are on the draw (and draw first)."}
        </div>
      </div>
    </div>
  );
}

export function PlayMatch({
  c,
  pool,
  oracle,
  onGameOver,
}: {
  c: MatchController;
  pool: Map<string, CardDef>;
  oracle: Record<string, OracleEntry>;
  onGameOver: () => void;
}) {
  const [, force] = useState(0);
  const [inspected, setInspected] = useState<string | null>(null);
  const [printed, setPrinted] = useState(true); // S10 playtest: default to the printed card
  const [zoneOpen, setZoneOpen] = useState<{ player: PlayerId; zone: "graveyard" | "exile" } | null>(null);
  const [dialogHover, setDialogHover] = useState<string[] | null>(null);
  const [coinShown, setCoinShown] = useState(false); // S22 r2: the flip ceremony, once per match
  const lastStackTop = useMemo(() => ({ id: null as string | null }), [c]);

  useEffect(() => c.onChange(() => force((n) => n + 1)), [c]);
  useEffect(() => {
    c.stopOnOpponentSpells = loadStopOnOpponentSpells();
    c.pauseBlockersWithUntapped = loadPauseBlockersWithUntapped();
    c.stopOnCombat = loadStopOnCombat();
  }, [c]);
  useEffect(() => {
    if (c.phase.kind === "gameOver") onGameOver();
  });

  const ctx = c.game.ctx;
  const phase = c.phase;
  const opp = (c.humanSeat === 0 ? 1 : 0) as PlayerId;

  // S10 playtest: the inspector snaps to a spell arriving on the stack —
  // driven by the controller's SPELL_CAST subscription (event-time, so it
  // works even when the spell resolves without an intermediate render), and
  // pinning the CARD since stack objects die on resolution (CR 400.7).
  const snapCard = c.snapCardId;
  useEffect(() => {
    if (snapCard && snapCard !== lastStackTop.id) {
      setInspected(null); // the snap wins until the player hovers something
      lastStackTop.id = snapCard;
    }
  });

  const confirmLabel =
    phase.kind === "confirmCast" ? actionLabel(ctx.state, pool, phase.action) : null;

  // S22 r4 (Chris, item 8): while a spell sits on the stack, everything it targets wears a
  // bright ring on the board — bigger and hotter than the pick-a-target outline, because the
  // dialog dim is often up when it matters.
  const stackTargets = useMemo(() => {
    const objs = new Set<string>();
    const players = new Set<PlayerId>();
    for (const item of ctx.state.stack) {
      for (const t of item.targets ?? []) {
        if (t.kind === "object") objs.add(t.id);
        else if (t.kind === "player") players.add(t.player as PlayerId);
      }
    }
    return { objs, players };
  }, [ctx.state.stack, phase]);

  const classFor = useMemo(() => {
    const base = (id: string): string => {
      if (dialogHover?.includes(id)) return "target";
      switch (phase.kind) {
        case "priority":
          if (phase.castable.has(id) || phase.lands.has(id)) return "castable";
          if (phase.activatable.has(id)) return "castable";
          return "";
        case "targeting":
          return phase.highlightObjects.has(id) ? "target" : "dim";
        case "manualTap":
          return phase.tappable.has(id) ? "castable" : "";
        case "attackers":
          if (phase.staged.has(id)) return "staged";
          return phase.eligible.has(id) ? "castable" : "";
        case "blockers": {
          if (phase.stagedPairs.some((p) => p.blocker === id)) return "staged";
          if (phase.pendingBlocker === id) return "pending";
          if (phase.pendingBlocker) return phase.options.get(phase.pendingBlocker)?.has(id) ? "target" : "";
          return phase.options.has(id) ? "castable" : "";
        }
        default:
          return "";
      }
    };
    return (id: string): string => {
      const cls = base(id);
      if (!stackTargets.objs.has(id) || cls === "target") return cls;
      // The ring outranks the dim (a spell's victim should never fade) and rides along with
      // anything else (a castable card can be under the gun at the same time).
      return cls && cls !== "dim" ? `${cls} spell-target` : "spell-target";
    };
  }, [phase, dialogHover, stackTargets]);

  return (
    <div className="app play-app">
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Ribbon c={c} />
        <Board
          ctx={ctx}
          oracle={oracle}
          revealOpponent={false}
          hideOpponentHand
          onHover={setInspected}
          onClick={(id) => {
            const obj = ctx.state.objects[id];
            if (obj?.zone === "hand") c.clickHand(id);
            else c.clickBattlefield(id);
          }}
          selected={inspected}
          bottomSeat={c.humanSeat}
          classFor={classFor}
          stagedAttackers={phase.kind === "attackers" ? [...phase.staged] : []}
          stagedBlocks={phase.kind === "blockers" ? phase.stagedPairs : []}
        />
        <PromptBar c={c} phase={phase} confirmLabel={confirmLabel} />
      </div>
      <div className="rail">
        <div
          onClick={() => { if (phase.kind === "targeting" && phase.highlightPlayers.has(opp)) c.clickPlayer(opp); }}
          className={phase.kind === "targeting" && phase.highlightPlayers.has(opp) ? "player-target" : stackTargets.players.has(opp) ? "player-spell-target" : ""}
        >
          <StatusBlock ctx={ctx} player={opp} youSeat={c.humanSeat} emphasizeHand name={c.names[opp]} portraitSrc={c.portraits[opp]} onZoneClick={(player, zone) => setZoneOpen({ player, zone })} />
        </div>
        <StackPanel ctx={ctx} />
        {(ctx.state.players[0].ante.length > 0 || ctx.state.players[1].ante.length > 0) && (
          <div className="panel stakes-panel">
            <h3>Stakes</h3>
            {([c.humanSeat, opp] as PlayerId[]).map((p) => (
              <div key={p} style={{ fontSize: 12.5 }}>
                {p === c.humanSeat ? "You" : c.names[opp]}:{" "}
                {ctx.state.players[p].ante.length === 0 && <b>—</b>}
                {ctx.state.players[p].ante.map((id, i) => (
                  <b key={id} className="stake-card" onMouseEnter={() => setInspected(id)} title="hover to inspect">
                    {i > 0 ? ", " : ""}{cardName(pool, ctx.state.objects[id]!.cardId)}
                  </b>
                ))}
              </div>
            ))}
          </div>
        )}
        <div
          onClick={() => { if (phase.kind === "targeting" && phase.highlightPlayers.has(c.humanSeat)) c.clickPlayer(c.humanSeat); }}
          className={phase.kind === "targeting" && phase.highlightPlayers.has(c.humanSeat) ? "player-target" : stackTargets.players.has(c.humanSeat) ? "player-spell-target" : ""}
        >
          <StatusBlock ctx={ctx} player={c.humanSeat} youSeat={c.humanSeat} emphasizeHand name={c.names[c.humanSeat]} portraitSrc={c.portraits[c.humanSeat]} onZoneClick={(player, zone) => setZoneOpen({ player, zone })} />
        </div>
        <PlayLog c={c} pool={pool} />
      </div>
      <FloatingInspector ctx={ctx} objectId={inspected} fallbackCardId={snapCard} oracle={oracle} printed={printed} onTogglePrinted={() => setPrinted(!printed)} />
      {phase.kind === "dialog" && <DialogModal c={c} phase={phase} pool={pool} oracle={oracle} onHoverOption={setDialogHover} printed={printed} />}
      {phase.kind === "chooseX" && <XModal c={c} phase={phase} />}
      {phase.kind === "chooseColor" && <ColorModal c={c} />}
      {phase.kind === "chooseTapColor" && <TapColorModal c={c} pool={pool} />}
      {phase.kind === "castOrActivate" && <CastOrActivateModal c={c} pool={pool} />}
      {zoneOpen && <ZoneModal c={c} pool={pool} oracle={oracle} zone={zoneOpen} printed={printed} onClose={() => setZoneOpen(null)} />}
      {/* S22 r2: the play/draw flip ceremony — only for duels whose spec carries the world's roll. */}
      {!coinShown && c.spec.rules.startingPlayer !== undefined && (
        <CoinFlip onPlay={c.spec.rules.startingPlayer === c.humanSeat} done={() => setCoinShown(true)} />
      )}
    </div>
  );
}
