import {
  CARD_KINDS,
  NORMAL_CARD_COLORS,
  type ActionCard,
  type Card,
  type CardKind,
  type CardNumber,
  type NormalCardColor,
  type NumberCard,
  type WildCard,
} from "./types";

const NUMBER_VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
const ACTION_KINDS = ["SKIP", "REVERSE", "DRAW_TWO"] as const;

export function createClassicDeck(): Card[] {
  const deck: Card[] = [];

  for (const color of NORMAL_CARD_COLORS) {
    deck.push(createNumberCard(color, 0, 0));

    for (const value of NUMBER_VALUES) {
      if (value === 0) {
        continue;
      }

      deck.push(createNumberCard(color, value, 0));
      deck.push(createNumberCard(color, value, 1));
    }

    for (const kind of ACTION_KINDS) {
      deck.push(createActionCard(color, kind, 0));
      deck.push(createActionCard(color, kind, 1));
    }
  }

  for (let index = 0; index < 4; index += 1) {
    deck.push(createWildCard("WILD", index));
    deck.push(createWildCard("WILD_DRAW_FOUR", index));
  }

  return deck;
}

export function isNumberCard(card: Card): card is NumberCard {
  return card.kind === "NUMBER";
}

export function isWildCard(card: Card): card is WildCard {
  return card.color === "WILD";
}

export function isActionCard(card: Card): card is ActionCard {
  return (
    card.kind === "SKIP" ||
    card.kind === "REVERSE" ||
    card.kind === "DRAW_TWO"
  );
}

export function assertKnownCardKind(kind: string): asserts kind is CardKind {
  if (!CARD_KINDS.includes(kind as CardKind)) {
    throw new Error(`Unknown card kind: ${kind}`);
  }
}

function createNumberCard(
  color: NormalCardColor,
  value: CardNumber,
  copy: number,
): NumberCard {
  return {
    id: `${color.toLowerCase()}-${value}-${copy}`,
    color,
    kind: "NUMBER",
    value,
  };
}

function createActionCard(
  color: NormalCardColor,
  kind: ActionCard["kind"],
  copy: number,
): ActionCard {
  return {
    id: `${color.toLowerCase()}-${kind.toLowerCase().replaceAll("_", "-")}-${copy}`,
    color,
    kind,
  };
}

function createWildCard(kind: WildCard["kind"], copy: number): WildCard {
  return {
    id: kind === "WILD" ? `wild-${copy}` : `wild-draw-four-${copy}`,
    color: "WILD",
    kind,
  };
}
