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
}

/** Permanents of one controller, split lands / other, attachments grouped beside hosts. */
function PermanentsRow({ ctx, player, onHover, onClick, selected, classFor }: BoardProps & { player: PlayerId }) {
  const state = ctx.state;
  const inCombat = new Set([...state.combat.attackers, ...state.combat.blocks.map((b) => b.blocker)]);
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

  return (
    <>
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
      <div className="zone-row lands">{lands.map((id) => tile(id, true))}</div>
    </>
  );
}

/** Two aligned rows: attackers above their blockers, column per attacker (art-direction §2). */
function CombatLane({ ctx, onHover, onClick, selected, classFor }: BoardProps) {
  const state = ctx.state;
  if (state.combat.attackers.length === 0) return null;
  return (
    <div className="combat-lane">
      <div className="lane-title">Combat — attackers above, blockers below, paired by column</div>
      <div className="lane-grid">
        {state.combat.attackers.map((attackerId) => {
          const attacker = state.objects[attackerId];
          const ordered = state.combat.blockOrder[attackerId];
          const staged = state.combat.blocks.filter((b) => b.attacker === attackerId).map((b) => b.blocker);
          const blockers = (ordered ?? staged).filter((b) => state.objects[b]);
          return (
            <div className="combat-col" key={attackerId}>
              <div className="attacker-slot">
                {attacker && <CardTile ctx={ctx} obj={attacker} onHover={onHover} onClick={onClick} selected={selected === attackerId} extraClass={classFor?.(attackerId)} />}
              </div>
              <div className="blocker-slot">
                {blockers.map((b) => (
                  <CardTile key={b} ctx={ctx} obj={getObject(state, b)} onHover={onHover} onClick={onClick} selected={selected === b} extraClass={classFor?.(b)} />
                ))}
              </div>
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
      <div className="row-label">Opponent hand ({ctx.state.players[top].hand.length})</div>
      <HandRow {...props} player={top} faceDown={!revealOpponent} />
      <div className="row-label">Opponent battlefield</div>
      <PermanentsRow {...props} player={top} />
      <CombatLane {...props} />
      <div className="row-label">Your battlefield</div>
      <PermanentsRow {...props} player={bottom} />
      <div className="row-label">Your hand ({ctx.state.players[bottom].hand.length})</div>
      <HandRow {...props} player={bottom} faceDown={false} />
    </div>
  );
}
