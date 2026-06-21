import type { Card as GameCard } from "@/lib/game/types";

type CardProps = {
  card: GameCard;
};

export function Card({ card }: CardProps) {
  const colorClass = card.color.toLowerCase();
  const label = card.kind === "NUMBER" ? String(card.value) : card.kind[0];

  return (
    <div className={`card-face ${colorClass}`} aria-label={card.kind}>
      {label}
    </div>
  );
}
