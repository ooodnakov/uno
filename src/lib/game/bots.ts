import type { DeclaredColor, EngineAction, GameStateSnapshot } from "./types";
import { getCurrentPlayer, getMostCommonColor, getPlayableCards } from "./rules";

export function chooseBotAction(
  state: GameStateSnapshot,
): EngineAction {
  const bot = getCurrentPlayer(state);
  const playableCards = getPlayableCards(state, bot.id);
  const nonWild = playableCards.find((card) => card.color !== "WILD");
  const wild = playableCards.find((card) => card.color === "WILD");
  const selectedCard = nonWild ?? wild;

  if (selectedCard) {
    const action: EngineAction = {
      type: "PLAY_CARD",
      playerId: bot.id,
      cardId: selectedCard.id,
    };

    if (selectedCard.color === "WILD") {
      action.declaredColor = chooseWildColor(bot.hand);
    }

    return action;
  }

  if (state.hasDrawnThisTurn) {
    return {
      type: "PASS",
      playerId: bot.id,
    };
  }

  return {
    type: "DRAW_CARD",
    playerId: bot.id,
  };
}

function chooseWildColor(hand: GameStateSnapshot["players"][number]["hand"]): DeclaredColor {
  return getMostCommonColor(hand);
}
