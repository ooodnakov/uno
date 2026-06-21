import { Hand } from "./Hand";
import { PlayerSeat } from "./PlayerSeat";
import { TurnTimer } from "./TurnTimer";

const placeholderHand = [
  { id: "red-7-0", color: "RED", kind: "NUMBER", value: 7 },
  { id: "blue-reverse-0", color: "BLUE", kind: "REVERSE" },
  { id: "wild-0", color: "WILD", kind: "WILD" },
] as const;

type GameTableProps = {
  roomId: string;
};

export function GameTable({ roomId }: GameTableProps) {
  return (
    <div className="placeholder-panel">
      <div className="table-shell">
        <div className="seat-row">
          <PlayerSeat name="Seat 1" />
          <PlayerSeat name="Seat 2" />
          <PlayerSeat name="Seat 3" />
        </div>
        <TurnTimer seconds={10} />
        <Hand cards={placeholderHand} />
        <p className="muted">Room {roomId}</p>
      </div>
    </div>
  );
}
