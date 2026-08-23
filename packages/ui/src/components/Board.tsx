import { getObject, type EngineCtx, type PlayerId } from "@shandalar/engine";
import { CardTile } from "./CardTile";
import { CardFrame } from "./CardFrame";
import type { OracleEntry } from "../engine-bridge";

interface BoardProps {
  ctx: EngineCtx;
  oracle: Record<string, OracleEntry>;
  revealOpponent: boolean;
  onHover: (id: string) => void;
  onClick: (id: string) => void;
  selected: string | null;
  /** Play mode: which seat sits at the bottom of the screen (default 0). */
  bottomSeat?: PlayerId;
  /** Play mode: interaction class per object id ("castable", "target", "staged", "dim"…). */
  classFor?: (id: string) => string;
  /** S11 (Chris's note 4): don't draw the opponent's face-down hand row — the
   * count lives in the player panel; the freed row goes to the combat zone. */
  hideOpponentHand?: boolean;
  /** S16 (Chris): locally STAGED declarations (clicked, not yet confirmed) move into the combat
   * lane at once — the engine only learns them on Confirm. Attackers by id; blocks as pairs. */
  stagedAttackers?: string[];
  stagedBlocks?: { blocker: string; attacker: string }[];
}

/** Engine combat + local staging, merged (attackers in declaration order, staged after). */
function combatView(props: BoardProps): { attackers: string[]; blockersOf: (attackerId: string) => string[] } {
  const state = props.ctx.state;
  const attackers = [...state.combat.attackers];
  for (const id of props.stagedAttackers ?? []) if (!attackers.includes(id) && state.objects[id]) attackers.push(id);
  const blockersOf = (attackerId: string) => {
    const ordered = state.combat.blockOrder[attackerId];
    const engine = state.combat.blocks.filter((b) => b.attacker === attackerId).map((b) => b.blocker);
    const local = (props.stagedBlocks ?? []).filter((b) => b.attacker === attackerId).map((b) => b.blocker);
    const all = ordered ? [...ordered] : engine;
    for (const b of local) if (!all.includes(b)) all.push(b);
    return all.filter((b) => state.objects[b]);
  };
  return { attackers, blockersOf };
}

/** Permanents of one controller, split lands / other, attachments grouped beside hosts. */
function PermanentsRow(props: BoardProps & { player: PlayerId; mirrored?: boolean }) {
  const { ctx, player, onHover, onClick, selected, classFor, mirrored } = props;
  const state = ctx.state;
  const cv = combatView(props);
  const inCombat = new Set([...cv.attackers, ...cv.attackers.flatMap((a) => cv.blockersOf(a))]);
  const ids = state.battlefield.filter((id) => {
    const o = getObject(state, id);
    return o.controller === player && !inCombat.has(id);
  });
  const attachments = new Map<string, string[]>();
  const standalone: string[] = [];
  for (const id of ids) {
    const o = getObject(state, id);
    if (o.attachedTo && state.objects[o.attachedTo]) {
      attachments.set(o.attachedTo, [...(attachments.get(o.attachedTo) ?? []), id]);
    } else {
      standalone.push(id);
    }
  }
  const lands = standalone.filter((id) => ctx.defs.def(getObject(state, id).cardId).types.includes("Land"));
  const rest = standalone.filter((id) => !lands.includes(id));

  const tile = (id: string, small = false) => (
    <CardTile key={id} ctx={ctx} obj={getObject(state, id)} small={small} onHover={onHover} onClick={onClick} selected={selected === id} extraClass={classFor?.(id)} />
  );

  const creaturesRow = (
    <div className="zone-row">
      {rest.map((id) =>
        attachments.has(id) ? (
          <div className="host-group" key={id}>
            {tile(id)}
            {attachments.get(id)!.map((a) => tile(a, true))}
          </div>
        ) : (
          tile(id)
        ),
      )}
    </div>
  );
  const landsRow = <div className="zone-row lands">{lands.map((id) => tile(id, true))}</div>;
  // S10 playtest: the opponent's lands sit nearest their hand (mirrored),
  // their creatures nearest the center — like sitting across a real table.
  return mirrored ? (
    <>
      {landsRow}
      {creaturesRow}
    </>
  ) : (
    <>
      {creaturesRow}
      {landsRow}
    </>
  );
}

/** S11 (note 4): a persistent red zone between the battlefields — creatures
 * move INTO it for combat and back out, so the rows never cross over into the
 * other player's permanents. Two aligned rows, column per attacker
 * (art-direction §2); the attacking side's row is nearest the attacker. */
function CombatLane(props: BoardProps) {
  const { ctx, onHover, onClick, selected, classFor, bottomSeat } = props;
  const state = ctx.state;
  const bottom = bottomSeat ?? 0;
  const attackerOnTop = state.activePlayer !== bottom; // opponent attacks from the top
  const cv = combatView(props);
  if (cv.attackers.length === 0) {
    return (
      <div className="combat-lane empty">
        <div className="lane-title">Combat zone</div>
      </div>
    );
  }
  // S10 playtest: combatants keep their attachments visible beside them —
  // a Curiosity must not vanish when its host attacks.
  const attachedTo = (hostId: string) =>
    state.battlefield.filter((id) => getObject(state, id).attachedTo === hostId);
  const withAttachments = (id: string) => (
    <div className="host-group" key={id}>
      <CardTile ctx={ctx} obj={getObject(state, id)} onHover={onHover} onClick={onClick} selected={selected === id} extraClass={classFor?.(id)} />
      {attachedTo(id).map((a) => (
        <CardTile key={a} ctx={ctx} obj={getObject(state, a)} small onHover={onHover} onClick={onClick} selected={selected === a} extraClass={classFor?.(a)} />
      ))}
    </div>
  );
  return (
    <div className="combat-lane active">
      <div className="lane-title">
        Combat — {attackerOnTop ? "attackers above, blockers below" : "attackers below, blockers above"}, paired by column
      </div>
      <div className="lane-grid">
        {cv.attackers.map((attackerId) => {
          const attacker = state.objects[attackerId];
          const blockers = cv.blockersOf(attackerId);
          const attackerSlot = <div className="attacker-slot">{attacker && withAttachments(attackerId)}</div>;
          const blockerSlot = <div className="blocker-slot">{blockers.map((b) => withAttachments(b))}</div>;
          return (
            <div className="combat-col" key={attackerId}>
              {attackerOnTop ? attackerSlot : blockerSlot}
              {attackerOnTop ? blockerSlot : attackerSlot}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HandRow({ ctx, player, faceDown, oracle, onHover, onClick, classFor }: BoardProps & { player: PlayerId; faceDown: boolean }) {
  const hand = ctx.state.players[player].hand;
  if (faceDown) {
    return (
      <div className="hand-row">
        {hand.map((id) => (
          <div key={id} className="facedown" style={{ backgroundImage: "url(/card-back.png)" }} />
        ))}
      </div>
    );
  }
  return (
    <div className="hand-row">
      {hand.map((id) => {
        const obj = getObject(ctx.state, id);
        return (
          <div key={id} className={`hand-card ${classFor?.(id) ?? ""}`} onMouseEnter={() => onHover(id)} onClick={() => onClick(id)} style={{ cursor: "pointer" }}>
            <CardFrame def={ctx.defs.def(obj.cardId)} oracle={oracle[obj.cardId]} mini hand />
          </div>
        );
      })}
    </div>
  );
}

export function Board(props: BoardProps) {
  const { ctx, revealOpponent } = props;
  // Seat convention: bottomSeat ("you") at the bottom, the other across the table.
  const bottom = props.bottomSeat ?? 0;
  const top = (bottom === 0 ? 1 : 0) as PlayerId;
  return (
    <div className="board">
      {!props.hideOpponentHand && (
        <>
          <div className="row-label">Opponent hand ({ctx.state.players[top].hand.length})</div>
          <HandRow {...props} player={top} faceDown={!revealOpponent} />
        </>
      )}
      <div className="row-label">Opponent battlefield</div>
      <PermanentsRow {...props} player={top} mirrored />
      <CombatLane {...props} />
      <div className="row-label">Your battlefield</div>
      <PermanentsRow {...props} player={bottom} />
      <div className="row-label">Your hand ({ctx.state.players[bottom].hand.length})</div>
      <HandRow {...props} player={bottom} faceDown={false} />
    </div>
  );
}
