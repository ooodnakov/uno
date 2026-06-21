type TurnTimerProps = {
  seconds: number;
};

export function TurnTimer({ seconds }: TurnTimerProps) {
  return (
    <div className="seat-row" aria-label="Turn timer">
      <span className="seat-pill">{seconds}s</span>
    </div>
  );
}
