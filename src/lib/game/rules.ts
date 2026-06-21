import { isActionCard, isNumberCard, isWildCard } from "./cards";
import type {
  AvailableActions,
  Card,
  DeclaredColor,
  GamePlayerState,
  GameStateSnapshot,
} from "./types";

export function getTopDiscard(state: GameStateSnapshot) {
  const topDiscard = state.discardPile.at(-1);

  if (!topDiscard) {
    throw new Error("Game state has no discard pile.");
  }

  return topDiscard;
}

export function getCurrentPlayer(state: GameStateSnapshot) {
  const player = state.players[state.currentPlayerIndex];

  if (!player) {
    throw new Error("Game state has no current player.");
  }

  return player;
}

export function getPlayer(state: GameStateSnapshot, playerId: string) {
  return state.players.find((player) => player.id === playerId);
}

export function isCurrentPlayer(
  state: GameStateSnapshot,
  playerId: string,
) {
  return getCurrentPlayer(state).id === playerId;
}

export function isPlayableCard(
  card: Card,
  topDiscard: Card,
  currentColor: DeclaredColor,
) {
  if (isWildCard(card)) {
    return true;
  }

  if (card.color === currentColor) {
    return true;
  }

  if (isNumberCard(card) && isNumberCard(topDiscard)) {
    return card.value === topDiscard.value;
  }

  if (isActionCard(card) && isActionCard(topDiscard)) {
    return card.kind === topDiscard.kind;
  }

  return false;
}

export function getPlayableCards(state: GameStateSnapshot, playerId: string) {
  const player = getPlayer(state, playerId);

  if (!player) {
    return [];
  }

  const topDiscard = getTopDiscard(state);
  return player.hand.filter((card) =>
    isPlayableCard(card, topDiscard, state.currentColor),
  );
}

export function getAvailableActions(
  state: GameStateSnapshot,
  playerId: string,
): AvailableActions {
  const player = getPlayer(state, playerId);
  const isTurn = state.status === "PLAYING" && isCurrentPlayer(state, playerId);
  const playableCards = getPlayableCards(state, playerId);
  const hasPlayableCard = playableCards.length > 0;

  return {
    canDraw: Boolean(player && isTurn),
    canPass: Boolean(
      player &&
        isTurn &&
        (state.hasDrawnThisTurn ||
          state.ruleConfig.allowPassWhenPlayable ||
          !hasPlayableCard) &&
        !(state.ruleConfig.forcePlay && hasPlayableCard),
    ),
    canDeclareOne: Boolean(player && player.hand.length === 2),
    canCalloutOne: Boolean(
      player &&
        state.players.some(
          (candidate) =>
            candidate.id !== player.id &&
            candidate.hand.length === 1 &&
            candidate.vulnerableToOneCallout,
        ),
    ),
    playableCardIds: isTurn ? playableCards.map((card) => card.id) : [],
  };
}

export function getMostCommonColor(hand: readonly Card[]): DeclaredColor {
  const counts: Record<DeclaredColor, number> = {
    RED: 0,
    BLUE: 0,
    GREEN: 0,
    YELLOW: 0,
  };

  for (const card of hand) {
    if (card.color !== "WILD") {
      counts[card.color] += 1;
    }
  }

  return (Object.entries(counts) as Array<[DeclaredColor, number]>).sort(
    (left, right) => right[1] - left[1],
  )[0][0];
}

export function playerPublicPayload(player: GamePlayerState) {
  return {
    playerId: player.id,
    userId: player.userId,
    displayName: player.displayName,
    seatIndex: player.seatIndex,
    cardCount: player.hand.length,
    isConnected: player.isConnected,
    controlledByBot: player.controlledByBot,
  };
}
