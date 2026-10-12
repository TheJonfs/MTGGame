import { useMemo, useState } from "react";
import { devMenuEnabled } from "../dev";
import { DevSetup, type DevMatch } from "./DevSetup";
import { SetupScreen, type PlaySetup } from "./SetupScreen";
import { loadConvocationData, loadOracle, loadPool, type OracleEntry, type SavedGame } from "../engine-bridge";
import { addCopy, removeCopy, type DeckCheck, type Decklist } from "@shandalar/world";
import { boardingPool, count, firstCall, keepBoardedDeck, newMatchRun, nextMatchGame, playedGameMeta, recordMatchGame, recordPlayedGame, type MatchRun as Run } from "./match-run";
import { DeckEditor, type DeckEditorHost } from "../components/DeckEditor";
import { MatchController } from "./match-controller";
import { PlayMatch, loadStops } from "./PlayMatch";
import { cardName } from "../labels";

/**
 * Match shell (S10 Part 3, ADR-058): setup → play → end screen, with
 * watch-replay (the viewer route consumes the produced log), rematch on the
 * same seed, and download of the saved game.
 */

/** The match in progress (see match-run.ts). */
type MatchRun = Run<PlaySetup>;
const store = () => (typeof localStorage !== "undefined" ? localStorage : null);

function EndScreen({
  c,
  pool,
  onRematch,
  onNew,
  onWatch,
  run,
  onNext,
  onSideboard,
}: {
  c: MatchController;
  pool: Map<string, import("@shandalar/cards").CardDef>;
  onRematch: () => void;
  onNew: () => void;
  onWatch: () => void;
  run?: MatchRun | null;
  onNext?: (choice: "play" | "draw") => void;
  onSideboard?: () => void;
}) {
  const r = c.result!;
  const you = c.humanSeat;
  const won = r.winner === you;
  const topSpells = Object.entries(r.facts.spellsCast)
    .map(([cardId, counts]) => ({ cardId, you: counts[you], them: counts[you === 0 ? 1 : 0] }))
    .filter((s) => s.you + s.them > 0)
    .sort((a, b) => b.you + b.them - (a.you + a.them))
    .slice(0, 6);
  const download = () => {
    const blob = new Blob([c.savedGame()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `game-${c.seed}.json`;
    a.click();
  };
  return (
    <div className="loader">
      <div className="box play-setup">
        <h2 style={{ fontFamily: "var(--serif)", marginTop: 0 }}>
          {run ? `Game ${run.series.games.length}: ` : ""}{r.winner === null ? "Draw" : won ? "Victory" : "Defeat"}
        </h2>
        {run && (
          <p style={{ fontFamily: "var(--serif)", fontSize: 15, margin: "0 0 6px" }}>
            {run.series.done ? (run.series.winner === 0 ? "You win the match" : run.series.winner === 1 ? "You lose the match" : "The match is drawn") : "The match stands"} {run.series.wins[0]}–{run.series.wins[1]}{run.series.draws ? ` (${run.series.draws} drawn)` : ""} against {run.setup.enemy.name}
          </p>
        )}
        <p style={{ fontSize: 12 }}>
          {r.reason === "CONCEDE" ? "By concession" : r.reason === "LIFE" ? "By damage" : r.reason.toLowerCase()} ·{" "}
          turn {r.turns} · life {r.finalLife[you]}–{r.finalLife[you === 0 ? 1 : 0]} · seed {c.seed}
        </p>
        <table className="end-stats">
          <thead>
            <tr><th></th><th>You</th><th>Opponent</th></tr>
          </thead>
          <tbody>
            <tr><td>Damage dealt</td><td>{r.facts.damageDealt[you]}</td><td>{r.facts.damageDealt[you === 0 ? 1 : 0]}</td></tr>
            <tr><td>Cards drawn</td><td>{r.facts.cardsDrawn[you]}</td><td>{r.facts.cardsDrawn[you === 0 ? 1 : 0]}</td></tr>
            <tr><td>Creatures lost</td><td>{r.facts.creaturesLost[you]}</td><td>{r.facts.creaturesLost[you === 0 ? 1 : 0]}</td></tr>
            {topSpells.map((s) => (
              <tr key={s.cardId}><td>{cardName(pool, s.cardId)}</td><td>{s.you}</td><td>{s.them}</td></tr>
            ))}
          </tbody>
        </table>
        {run && !run.series.done && (
          <p>
            {run.series.nextChooser() === 0
              ? <><button className="primary" onClick={() => onNext?.("play")}>Next game — play first</button>{" "}<button onClick={() => onNext?.("draw")}>Next game — draw first</button></>
              : <button className="primary" onClick={() => onNext?.("play")}>Next game (they play first)</button>}{" "}
            {count(run.side) > 0 && <button onClick={onSideboard} title="change your deck from your seventy-five before the next game">Sideboard ({count(run.deck)} in the deck)</button>}
          </p>
        )}
        <p>
          <button className={run && !run.series.done ? "" : "primary"} onClick={onWatch}>Watch replay</button>{" "}
          {(!run || run.series.done) && <button onClick={onRematch}>{run ? "Play the match again" : "Rematch (same seed)"}</button>}{" "}
          <button onClick={onNew}>New match</button>{" "}
          <button className="linkish" onClick={download}>download log</button>
        </p>
      </div>
    </div>
  );
}

export function PlayApp({ onWatchReplay }: { onWatchReplay: (game: SavedGame) => void }) {
  const pool = useMemo(loadPool, []);
  const [oracle, setOracle] = useState<Record<string, OracleEntry>>({});
  const [screen, setScreen] = useState<"setup" | "match" | "end">("setup");
  const [controller, setController] = useState<MatchController | null>(null);
  const [lastSetup, setLastSetup] = useState<PlaySetup | null>(null);
  const [dev, setDev] = useState(false); // post-S58: the dev setup is a link from the setup, not the default

  useMemo(() => {
    loadOracle().then(setOracle);
  }, []);

  // S34 director round: the dev setup hands a finished custom spec (the Lab's dials) straight to the controller.
  const [lastDev, setLastDev] = useState<DevMatch | null>(null);
  const beginDev = (m: DevMatch, seedOverride?: number) => {
    const c = new MatchController(pool, {
      humanSeat: m.humanSeat,
      custom: m.custom,
      ...((seedOverride ?? m.seed) !== undefined ? { seed: (seedOverride ?? m.seed)! } : {}),
      aiDelayMs: Number(localStorage.getItem("shandalar-ai-delay") ?? 400),
    });
    c.stops = loadStops();
    setLastDev(m); setLastSetup(null); setRun(null);
    setController(c);
    setScreen("match");
    void c.start();
  };
  const [run, setRun] = useState<MatchRun | null>(null);
  const [boarding, setBoarding] = useState<null | { draft: Decklist; notice: string | null }>(null);
  const rating = useMemo(() => loadConvocationData().rating, []);
  /** The next game of the match: the series' seed and starting player; the AI's deck sideboarded from game two. */
  const nextGame = (r: MatchRun, choice: "play" | "draw") => {
    const next = nextMatchGame(r, choice, pool, rating), { human, enemy } = r.setup;
    const c = new MatchController(pool, {
      humanSeat: 0,
      custom: { human: { name: `You · ${human.name}`, decklist: next.human }, enemy: { name: enemy.name, decklist: next.enemy, difficulty: r.setup.difficulty, archetype: enemy.archetype, ...(enemy.portrait ? { portrait: enemy.portrait } : {}) }, rules: { startingLife: 20, ante: 0, startingPlayer: next.game.startingPlayer }, modifiers: [] },
      seed: next.game.seed,
      aiDelayMs: Number(localStorage.getItem("shandalar-ai-delay") ?? 400),
    });
    c.stops = loadStops();
    setRun(next.run); setBoarding(null);
    setLastSetup(r.setup); setLastDev(null);
    setController(c);
    setScreen("match");
    void c.start();
  };
  const beginMatch = (setup: PlaySetup) => nextGame(newMatchRun(setup, pool, rating), firstCall(setup));
  const begin = (setup: PlaySetup, seedOverride?: number) => {
    if (setup.match) return beginMatch(setup);
    setRun(null);
    const seed = seedOverride ?? (setup.seed.trim() !== "" ? Number(setup.seed) : undefined);
    const { human, enemy } = setup;
    const c = new MatchController(pool, {
      humanSeat: setup.humanSeat,
      // S18: always the explicit-spec path (20 life, no ante), whatever the two decks are
      custom: { human: { name: `You · ${human.name}`, decklist: human.decklist.map((e) => ({ ...e })) }, enemy: { name: enemy.name, decklist: enemy.decklist.map((e) => ({ ...e })), difficulty: setup.difficulty, archetype: enemy.archetype, ...(enemy.portrait ? { portrait: enemy.portrait } : {}) }, rules: { startingLife: 20, ante: 0 }, modifiers: [] },
      ...(seed !== undefined && Number.isFinite(seed) ? { seed } : {}),
      aiDelayMs: Number(localStorage.getItem("shandalar-ai-delay") ?? 400),
    });
    c.stops = loadStops();
    setLastSetup(setup); setLastDev(null);
    setController(c);
    setScreen("match");
    void c.start();
  };

  if (screen === "setup" || !controller) return dev && devMenuEnabled() ? <DevSetup pool={pool} onStart={beginDev} /> : <SetupScreen pool={pool} oracle={oracle} onStart={(s) => begin(s)} {...(devMenuEnabled() ? { onDev: () => setDev(true) } : {})} />;
  if (screen === "match") {
    return (
      <PlayMatch
        c={controller}
        pool={pool}
        oracle={oracle}
        onGameOver={() => {
          // the match: the game is recorded once, as it ends (the human is the series' seat 0)
          if (run?.game && !run.recorded && controller.result) {
            setRun(recordMatchGame(run, controller.result));
            recordPlayedGame(store(), controller, playedGameMeta(run.setup.enemy, run.series.seed, "match", run.game.index));
          } else if (!run && lastSetup && controller.humanSeat === 0) recordPlayedGame(store(), controller, playedGameMeta(lastSetup.enemy, controller.seed, "single", 0));
          setScreen("end");
        }}
      />
    );
  }
  if (boarding && run) {
    // between games: the deck from the registered seventy-five — as many cards as were registered, or more
    const { all, floor } = boardingPool(run), n = count(boarding.draft);
    const change = (r: ReturnType<typeof addCopy>) => setBoarding(r.ok ? { draft: r.deck, notice: null } : { ...boarding, notice: r.reason });
    const host: DeckEditorHost = {
      title: `Sideboard — your seventy-five, before game ${run.series.games.length + 1}`,
      draft: boarding.draft, name: run.setup.human.name, notice: boarding.notice,
      source: { collection: all, savedDeck: run.deck, activeDeckName: run.setup.human.name },
      legality: () => ({ ok: n >= floor, problems: n >= floor ? [] : [`the deck has ${n} cards; it needs ${floor}`] }) as DeckCheck,
      add: (id) => change(addCopy(all, boarding.draft, id, Infinity)),
      remove: (id) => change(removeCopy(boarding.draft, id)),
      reset: () => setBoarding({ draft: run.main.map((e) => ({ ...e })), notice: null }),
      save: () => { const kept = keepBoardedDeck(run, boarding.draft); if (!kept.ok) return setBoarding({ ...boarding, notice: kept.reason }); setRun(kept.run); setBoarding(null); },
      saveLabel: "Keep this deck",
      close: () => setBoarding(null), closeLabel: "Cancel",
      sparesLabel: "Sideboard",
    };
    return <div style={{ height: "100%" }}><DeckEditor host={host} pool={pool} oracle={oracle} /></div>;
  }
  return (
    <EndScreen
      c={controller}
      pool={pool}
      run={run}
      onNext={(choice) => run && nextGame(run, choice)}
      onSideboard={() => run && setBoarding({ draft: run.deck.map((e) => ({ ...e })), notice: null })}
      onRematch={() => (run ? beginMatch(run.setup) : lastDev ? beginDev(lastDev, controller.seed) : lastSetup && begin(lastSetup, controller.seed))}
      onNew={() => { setRun(null); setScreen("setup"); }}
      onWatch={() => onWatchReplay(JSON.parse(controller.savedGame()) as SavedGame)}
    />
  );
}
