type PlayerSeatProps = {
  name: string;
};

export function PlayerSeat({ name }: PlayerSeatProps) {
  return <span className="seat-pill">{name}</span>;
}
