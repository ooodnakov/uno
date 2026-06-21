import { isWildCard } from "./cards";
import { shuffleCards } from "./deck";
import {
  addSeconds,
  cloneGameState,
} from "./state";
import {
  GameRuleError,
  type Card,
  type DeclaredColor,
  type EngineAction,
  type EngineEvent,
  type EngineResult,
  type EngineEventType,
  type GamePlayerState,
  type GameStateSnapshot,
} from "./types";
import {
  getAvailableActions,
  getCurrentPlayer,
  getPlayer,
  getTopDiscard,
  isPlayableCard,
} from "./rules";

export function applyGameAction(
  sourceState: GameStateSnapshot,
  action: EngineAction,
): EngineResult {
  const state = cloneGameState(sourceState);
  const now = action.now ?? new Date().toISOString();

  if (state.status !== "PLAYING") {
    throw new GameRuleError("Game is not active.");
  }

  switch (action.type) {
    case "PLAY_CARD":
      return playCard(state, action.playerId, action.cardId, action.declaredColor, now);
    case "DRAW_CARD":
      return drawCardAction(state, action.playerId, now);
    case "PASS":
      return passAction(state, action.playerId, now, "TURN_PASSED");
    case "DECLARE_ONE":
      return declareOne(state, action.playerId, now);
    case "CALLOUT_ONE":
      return calloutOne(state, action.playerId, action.targetPlayerId, now);
    case "TIMEOUT_AUTO_PASS":
      return timeoutAutoPass(state, now);
    default:
      assertNever(action);
  }
}

export function updatePlayerConnection(
  sourceState: GameStateSnapshot,
  playerId: string,
  isConnected: boolean,
  controlledByBot: boolean,
  now = new Date().toISOString(),
) {
  const state = cloneGameState(sourceState);
  const player = getMutablePlayer(state, playerId);

  player.isConnected = isConnected;
  player.controlledByBot = controlledByBot;
  state.updatedAt = now;

  return state;
}

function playCard(
  state: GameStateSnapshot,
  playerId: string,
  cardId: string,
  declaredColor: DeclaredColor | undefined,
  now: string,
): EngineResult {
  expireCallouts(state);
  const player = requireCurrentPlayer(state, playerId);
  const cardIndex = player.hand.findIndex((card) => card.id === cardId);

  if (cardIndex === -1) {
    throw new GameRuleError("Card does not belong to current player.");
  }

  const card = player.hand[cardIndex];
  const topDiscard = getTopDiscard(state);

  if (!isPlayableCard(card, topDiscard, state.currentColor)) {
    throw new GameRuleError("Card is not playable.");
  }

  if (isWildCard(card) && !declaredColor) {
    throw new GameRuleError("Wild cards require a declared color.");
  }

  player.hand.splice(cardIndex, 1);
  state.discardPile.push(card);
  state.currentColor = isWildCard(card) ? declaredColor! : card.color;
  state.hasDrawnThisTurn = false;

  updateOneStateAfterPlay(player);

  if (player.hand.length === 0) {
    state.status = "ROUND_FINISHED";
    state.winnerPlayerId = player.id;
    state.updatedAt = now;
    const event = createEvent(state, "ROUND_FINISHED", player, now, {
      playedCard: publicCardPayload(card),
      winnerPlayerId: player.id,
    });
    return { state, event };
  }

  applyCardEffectAndAdvance(state, card, now);
  state.updatedAt = now;

  return {
    state,
    event: createEvent(state, "CARD_PLAYED", player, now, {
      card: publicCardPayload(card),
      declaredColor: isWildCard(card) ? declaredColor : undefined,
    }),
  };
}

function drawCardAction(
  state: GameStateSnapshot,
  playerId: string,
  now: string,
): EngineResult {
  expireCallouts(state);
  const player = requireCurrentPlayer(state, playerId);

  if (state.hasDrawnThisTurn) {
    throw new GameRuleError("Player has already drawn this turn.");
  }

  const drawnCards = drawCards(state, player, 1);

  if (drawnCards.length === 0) {
    advanceTurn(state, now);
  } else {
    state.hasDrawnThisTurn = true;
    state.turnStartedAt = now;
    state.turnEndsAt = addSeconds(now, state.ruleConfig.turnSeconds);
  }

  player.hasDeclaredOne = player.hand.length === 1 && player.hasDeclaredOne;
  player.vulnerableToOneCallout = false;
  state.updatedAt = now;

  return {
    state,
    event: createEvent(state, "CARD_DRAWN", player, now, {
      count: drawnCards.length,
    }),
  };
}

function passAction(
  state: GameStateSnapshot,
  playerId: string,
  now: string,
  eventType: EngineEventType,
): EngineResult {
  expireCallouts(state);
  const player = requireCurrentPlayer(state, playerId);
  const actions = getAvailableActions(state, playerId);

  if (!actions.canPass) {
    throw new GameRuleError("Pass is not legal.");
  }

  advanceTurn(state, now);
  state.updatedAt = now;

  return {
    state,
    event: createEvent(state, eventType, player, now, {}),
  };
}

function declareOne(
  state: GameStateSnapshot,
  playerId: string,
  now: string,
): EngineResult {
  const player = getMutablePlayer(state, playerId);

  if (player.hand.length !== 2) {
    throw new GameRuleError("ONE can only be declared with two cards.");
  }

  player.hasDeclaredOne = true;
  player.vulnerableToOneCallout = false;
  state.updatedAt = now;

  return {
    state,
    event: createEvent(state, "ONE_DECLARED", player, now, {}),
  };
}

function calloutOne(
  state: GameStateSnapshot,
  playerId: string,
  targetPlayerId: string,
  now: string,
): EngineResult {
  const caller = getMutablePlayer(state, playerId);
  const target = getMutablePlayer(state, targetPlayerId);

  if (caller.id === target.id) {
    throw new GameRuleError("Players cannot call out themselves.");
  }

  if (
    target.hand.length !== 1 ||
    target.hasDeclaredOne ||
    !target.vulnerableToOneCallout
  ) {
    return {
      state,
      event: createEvent(state, "ONE_CALLOUT_FAILED", caller, now, {
        targetPlayerId,
      }),
    };
  }

  const drawnCards = drawCards(state, target, 4);
  target.hasDeclaredOne = false;
  target.vulnerableToOneCallout = false;
  state.updatedAt = now;

  return {
    state,
    event: createEvent(state, "ONE_CALLOUT_SUCCESS", caller, now, {
      targetPlayerId,
      count: drawnCards.length,
    }),
  };
}

function timeoutAutoPass(
  state: GameStateSnapshot,
  now: string,
): EngineResult {
  const currentPlayer = getCurrentPlayer(state);
  expireCallouts(state);

  if (!getAvailableActions(state, currentPlayer.id).canPass) {
    drawCards(state, currentPlayer, 1);
    state.hasDrawnThisTurn = true;
  }

  advanceTurn(state, now);
  state.updatedAt = now;

  return {
    state,
    event: createEvent(state, "TURN_TIMEOUT", currentPlayer, now, {}),
  };
}

function applyCardEffectAndAdvance(
  state: GameStateSnapshot,
  card: Card,
  now: string,
) {
  if (card.kind === "SKIP") {
    advanceTurn(state, now, 2);
    return;
  }

  if (card.kind === "REVERSE") {
    if (state.players.length === 2) {
      advanceTurn(state, now, 2);
      return;
    }

    state.direction = state.direction === 1 ? -1 : 1;
    advanceTurn(state, now);
    return;
  }

  if (card.kind === "DRAW_TWO") {
    const target = state.players[getRelativePlayerIndex(state, 1)];
    drawCards(state, target, 2);
    advanceTurn(state, now, 2);
    return;
  }

  if (card.kind === "WILD_DRAW_FOUR") {
    const target = state.players[getRelativePlayerIndex(state, 1)];
    drawCards(state, target, 4);
    advanceTurn(state, now, 2);
    return;
  }

  advanceTurn(state, now);
}

function drawCards(
  state: GameStateSnapshot,
  player: GamePlayerState,
  count: number,
) {
  const drawnCards: Card[] = [];

  for (let index = 0; index < count; index += 1) {
    refillDrawPileIfNeeded(state);
    const card = state.drawPile.shift();

    if (!card) {
      break;
    }

    player.hand.push(card);
    drawnCards.push(card);
  }

  if (drawnCards.length > 0 && player.hand.length !== 1) {
    player.hasDeclaredOne = false;
    player.vulnerableToOneCallout = false;
  }

  return drawnCards;
}

function refillDrawPileIfNeeded(state: GameStateSnapshot) {
  if (state.drawPile.length > 0 || state.discardPile.length <= 1) {
    return;
  }

  const topDiscard = state.discardPile.at(-1)!;
  const recycled = state.discardPile.slice(0, -1);
  state.reshuffleCount += 1;
  state.discardPile = [topDiscard];
  state.drawPile = shuffleCards(
    recycled,
    `${state.seed}:reshuffle:${state.reshuffleCount}`,
  );
}

function advanceTurn(
  state: GameStateSnapshot,
  now: string,
  steps = 1,
) {
  state.currentPlayerIndex = getRelativePlayerIndex(state, steps);
  state.hasDrawnThisTurn = false;
  state.turnStartedAt = now;
  state.turnEndsAt = addSeconds(now, state.ruleConfig.turnSeconds);
}

function getRelativePlayerIndex(state: GameStateSnapshot, steps: number) {
  return (
    (state.currentPlayerIndex + state.direction * steps + state.players.length) %
    state.players.length
  );
}

function requireCurrentPlayer(
  state: GameStateSnapshot,
  playerId: string,
) {
  const currentPlayer = getCurrentPlayer(state);

  if (currentPlayer.id !== playerId) {
    throw new GameRuleError("It is not this player's turn.");
  }

  return currentPlayer;
}

function getMutablePlayer(state: GameStateSnapshot, playerId: string) {
  const player = getPlayer(state, playerId);

  if (!player) {
    throw new GameRuleError("Player is not in this game.");
  }

  return player;
}

function updateOneStateAfterPlay(player: GamePlayerState) {
  if (player.hand.length === 1) {
    player.vulnerableToOneCallout = !player.hasDeclaredOne;
    return;
  }

  player.hasDeclaredOne = false;
  player.vulnerableToOneCallout = false;
}

function expireCallouts(state: GameStateSnapshot) {
  for (const player of state.players) {
    player.vulnerableToOneCallout = false;
  }
}

function createEvent(
  state: GameStateSnapshot,
  type: EngineEventType,
  actor: GamePlayerState | undefined,
  now: string,
  payload: Record<string, unknown>,
): EngineEvent {
  return {
    id: `${type.toLowerCase().replaceAll("_", "-")}-${now}-${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    gameId: state.id,
    type,
    actorUserId: actor?.userId,
    actorDisplayName: actor?.displayName,
    payload,
    createdAt: now,
  };
}

function publicCardPayload(card: Card) {
  return {
    id: card.id,
    color: card.color,
    kind: card.kind,
    value: card.kind === "NUMBER" ? card.value : undefined,
  };
}

function assertNever(value: never): never {
  throw new Error(`Unhandled action: ${JSON.stringify(value)}`);
}
