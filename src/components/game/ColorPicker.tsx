import { NORMAL_CARD_COLORS } from "@/lib/game/types";

export function ColorPicker() {
  return (
    <div className="seat-row" aria-label="Color picker">
      {NORMAL_CARD_COLORS.map((color) => (
        <button key={color} type="button" disabled>
          {color}
        </button>
      ))}
    </div>
  );
}
