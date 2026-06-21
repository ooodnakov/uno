import { createClassicDeck, isNumberCard } from "./cards";
import { shuffleCards } from "./deck";
import {
  CLASSIC_RULE_CONFIG,
  GameRuleError,
  type Card,
  type GamePlayerState,
  type GameStateSnapshot,
  type EngineEvent,
  type InitialGamePlayer,
  type RuleConfig,
  type VisibleGameState,
} from "./types";
import { getAvailableActions, getCurrentPlayer, getTopDiscard } from "./rules";

const CARDS_PER_PLAYER = 7;

export type CreateInitialGameStateInput = {
  id: string;
  roomId: string;
  players: InitialGamePlayer[];
  seed: string;
  ruleConfig?: RuleConfig;
  now?: string;
};

export function createInitialGameState({
  id,
  roomId,
  players,
  seed,
  ruleConfig = CLASSIC_RULE_CONFIG,
  now = new Date().toISOString(),
}: CreateInitialGameStateInput): GameStateSnapshot {
  if (players.length < 2 || players.length > ruleConfig.maxPlayers) {
    throw new GameRuleError("A game requires 2-6 players.");
  }

  const sortedPlayers = [...players].sort((left, right) => {
    return left.seatIndex - right.seatIndex;
  });
  let deck = shuffleCards(createClassicDeck(), seed);
  const gamePlayers: GamePlayerState[] = sortedPlayers.map((player, index) => {
    const hand = deck.slice(index * CARDS_PER_PLAYER, (index + 1) * CARDS_PER_PLAYER);

    return {
      id: player.id ?? `player-${player.userId}`,
      userId: player.userId,
      displayName: player.displayName,
      seatIndex: player.seatIndex,
      hand,
      isConnected: player.isConnected ?? true,
      controlledByBot: player.controlledByBot ?? false,
      hasDeclaredOne: false,
      vulnerableToOneCallout: false,
    };
  });

  deck = deck.slice(sortedPlayers.length * CARDS_PER_PLAYER);

  const skippedDiscards: Card[] = [];
  const startingDiscardIndex = deck.findIndex((card) => isNumberCard(card));

  if (startingDiscardIndex === -1) {
    throw new GameRuleError("Could not find a number card for starting discard.");
  }

  skippedDiscards.push(...deck.slice(0, startingDiscardIndex));
  const startingDiscard = deck[startingDiscardIndex];
  if (!isNumberCard(startingDiscard)) {
    throw new GameRuleError("Starting discard must be a number card.");
  }
  const rest = deck.slice(startingDiscardIndex + 1);
  const drawPile =
    skippedDiscards.length > 0
      ? shuffleCards([...skippedDiscards, ...rest], `${seed}:starting-discard`)
      : rest;
  const turnStartedAt = now;

  return {
    id,
    roomId,
    seed,
    status: "PLAYING",
    players: gamePlayers,
    drawPile,
    discardPile: [startingDiscard],
    currentColor: startingDiscard.color,
    currentPlayerIndex: 0,
    direction: 1,
    ruleConfig,
    pendingDrawCount: 0,
    hasDrawnThisTurn: false,
    reshuffleCount: 0,
    turnStartedAt,
    turnEndsAt: addSeconds(turnStartedAt, ruleConfig.turnSeconds),
    createdAt: now,
    updatedAt: now,
  };
}

export function createVisibleGameState(
  state: GameStateSnapshot,
  viewerPlayerId: string,
  lastEvents: EngineEvent[] = [],
): VisibleGameState & { lastEvents: EngineEvent[] } {
  const self = state.players.find((player) => player.id === viewerPlayerId);

  if (!self) {
    throw new GameRuleError("Viewer is not a player in this game.");
  }

  const currentPlayer = getCurrentPlayer(state);
  const topDiscard = getTopDiscard(state);

  return {
    gameId: state.id,
    roomId: state.roomId,
    status: state.status,
    self: {
      playerId: self.id,
      userId: self.userId,
      displayName: self.displayName,
      seatIndex: self.seatIndex,
      hand: self.hand,
      isCurrentTurn: currentPlayer.id === self.id,
      isConnected: self.isConnected,
      controlledByBot: self.controlledByBot,
      hasDeclaredOne: self.hasDeclaredOne,
    },
    players: state.players.map((player) => ({
      playerId: player.id,
      userId: player.userId,
      displayName: player.displayName,
      seatIndex: player.seatIndex,
      cardCount: player.hand.length,
      isCurrentTurn: currentPlayer.id === player.id,
      isConnected: player.isConnected,
      controlledByBot: player.controlledByBot,
      hasDeclaredOneVisible: player.hasDeclaredOne,
    })),
    table: {
      topDiscard,
      discardCount: state.discardPile.length,
      drawCount: state.drawPile.length,
      currentColor: state.currentColor,
      direction: state.direction,
      currentPlayerId: currentPlayer.id,
      turnStartedAt: state.turnStartedAt,
      turnEndsAt: state.turnEndsAt,
    },
    availableActions: getAvailableActions(state, self.id),
    lastEvents,
  };
}

export function cloneGameState(state: GameStateSnapshot): GameStateSnapshot {
  return {
    ...state,
    players: state.players.map((player) => ({
      ...player,
      hand: player.hand.map((card) => ({ ...card })),
    })),
    drawPile: state.drawPile.map((card) => ({ ...card })),
    discardPile: state.discardPile.map((card) => ({ ...card })),
    ruleConfig: { ...state.ruleConfig },
  };
}

export function addSeconds(isoTimestamp: string, seconds: number) {
  return new Date(new Date(isoTimestamp).getTime() + seconds * 1000).toISOString();
}
