import type { Card as GameCard } from "@/lib/game/types";

import { Card } from "./Card";

type HandProps = {
  cards: readonly GameCard[];
};

export function Hand({ cards }: HandProps) {
  return (
    <div className="hand-row" aria-label="Player hand">
      {cards.map((card) => (
        <Card key={card.id} card={card} />
      ))}
    </div>
  );
}
