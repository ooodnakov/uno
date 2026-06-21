import { describe, expect, it } from "vitest";

import {
  chooseBotAction,
  createClassicDeck,
  createInitialGameState,
  createVisibleGameState,
  getPlayableCards,
  isPlayableCard,
  shuffleCards,
  updatePlayerConnection,
  type Card,
  type DeclaredColor,
  type GameStateSnapshot,
} from ".";
import { applyGameAction } from "./engine";
import { CLASSIC_RULE_CONFIG, GameRuleError } from "./types";

const NOW = "2026-01-01T00:00:00.000Z";

describe("classic deck", () => {
  it("creates the documented 108-card composition", () => {
    const deck = createClassicDeck();

    expect(deck).toHaveLength(108);
    expect(new Set(deck.map((card) => card.id)).size).toBe(108);

    for (const color of ["RED", "BLUE", "GREEN", "YELLOW"] as const) {
      expect(
        deck.filter(
          (card) => card.color === color && card.kind === "NUMBER" && card.value === 0,
        ),
      ).toHaveLength(1);

      for (let value = 1; value <= 9; value += 1) {
        expect(
          deck.filter(
            (card) =>
              card.color === color &&
              card.kind === "NUMBER" &&
              card.value === value,
          ),
        ).toHaveLength(2);
      }

      for (const kind of ["SKIP", "REVERSE", "DRAW_TWO"] as const) {
        expect(
          deck.filter((card) => card.color === color && card.kind === kind),
        ).toHaveLength(2);
      }
    }

    expect(deck.filter((card) => card.kind === "WILD")).toHaveLength(4);
    expect(deck.filter((card) => card.kind === "WILD_DRAW_FOUR")).toHaveLength(4);
  });

  it("shuffles deterministically when seeded", () => {
    const deck = createClassicDeck();

    expect(shuffleCards(deck, "seed-a").map((card) => card.id)).toEqual(
      shuffleCards(deck, "seed-a").map((card) => card.id),
    );
    expect(shuffleCards(deck, "seed-a").map((card) => card.id)).not.toEqual(
      shuffleCards(deck, "seed-b").map((card) => card.id),
    );
  });
});

describe("initial and visible state", () => {
  it("deals seven cards each and starts with a number discard", () => {
    const state = makeInitialState();

    expect(state.players).toHaveLength(3);
    expect(state.players.every((player) => player.hand.length === 7)).toBe(true);
    expect(state.discardPile).toHaveLength(1);
    expect(state.discardPile[0].kind).toBe("NUMBER");
    expect(state.currentColor).toBe(state.discardPile[0].color);
    expect(state.direction).toBe(1);
  });

  it("hides opponent hands in personalized visible state", () => {
    const state = makeInitialState();
    const visible = createVisibleGameState(state, "p1");

    expect(visible.self.hand).toEqual(state.players[0].hand);
    expect(visible.players.find((player) => player.playerId === "p2")?.cardCount).toBe(7);
    expect(JSON.stringify(visible.players)).not.toContain(state.players[1].hand[0].id);
  });
});

describe("legal move detection", () => {
  it("allows number-on-number match", () => {
    expect(
      isPlayableCard(number("BLUE", 5, "b5"), number("RED", 5, "r5"), "RED"),
    ).toBe(true);
  });

  it("allows color match", () => {
    expect(
      isPlayableCard(number("RED", 8, "r8"), number("RED", 5, "r5"), "RED"),
    ).toBe(true);
  });

  it("allows action-on-action match", () => {
    expect(
      isPlayableCard(action("GREEN", "SKIP", "gs"), action("YELLOW", "SKIP", "ys"), "YELLOW"),
    ).toBe(true);
  });

  it("rejects invalid moves", () => {
    const state = makeState({
      hands: [[number("BLUE", 9, "b9")], [number("GREEN", 2, "g2")]],
      discard: number("RED", 5, "r5"),
      currentColor: "RED",
    });

    expect(() =>
      applyGameAction(state, {
        type: "PLAY_CARD",
        playerId: "p1",
        cardId: "b9",
        now: NOW,
      }),
    ).toThrow(GameRuleError);
  });
});

describe("action cards", () => {
  it("applies skip behavior", () => {
    const state = makeState({
      hands: [
        [action("RED", "SKIP", "rs"), number("BLUE", 8, "b8")],
        [number("BLUE", 2, "b2")],
        [number("GREEN", 3, "g3")],
      ],
      discard: number("RED", 9, "r9"),
      currentColor: "RED",
    });

    const result = applyGameAction(state, {
      type: "PLAY_CARD",
      playerId: "p1",
      cardId: "rs",
      now: NOW,
    });

    expect(result.state.currentPlayerIndex).toBe(2);
  });

  it("applies reverse behavior", () => {
    const state = makeState({
      hands: [
        [action("RED", "REVERSE", "rr"), number("BLUE", 8, "b8")],
        [number("BLUE", 2, "b2")],
        [number("GREEN", 3, "g3")],
      ],
      discard: number("RED", 9, "r9"),
      currentColor: "RED",
    });

    const result = applyGameAction(state, {
      type: "PLAY_CARD",
      playerId: "p1",
      cardId: "rr",
      now: NOW,
    });

    expect(result.state.direction).toBe(-1);
    expect(result.state.currentPlayerIndex).toBe(2);
  });

  it("treats reverse as skip in a 2-player game", () => {
    const state = makeState({
      hands: [
        [action("RED", "REVERSE", "rr"), number("BLUE", 8, "b8")],
        [number("BLUE", 2, "b2")],
      ],
      discard: number("RED", 9, "r9"),
      currentColor: "RED",
    });

    const result = applyGameAction(state, {
      type: "PLAY_CARD",
      playerId: "p1",
      cardId: "rr",
      now: NOW,
    });

    expect(result.state.direction).toBe(1);
    expect(result.state.currentPlayerIndex).toBe(0);
  });

  it("applies draw two behavior", () => {
    const state = makeState({
      hands: [
        [action("RED", "DRAW_TWO", "rd2"), number("BLUE", 8, "b8")],
        [number("BLUE", 2, "b2")],
        [number("GREEN", 3, "g3")],
      ],
      discard: number("RED", 9, "r9"),
      currentColor: "RED",
      drawPile: [number("YELLOW", 1, "y1"), number("YELLOW", 2, "y2")],
    });

    const result = applyGameAction(state, {
      type: "PLAY_CARD",
      playerId: "p1",
      cardId: "rd2",
      now: NOW,
    });

    expect(result.state.players[1].hand).toHaveLength(3);
    expect(result.state.currentPlayerIndex).toBe(2);
  });

  it("applies wild color selection", () => {
    const state = makeState({
      hands: [[wild("WILD", "w")], [number("BLUE", 2, "b2")]],
      discard: number("RED", 9, "r9"),
      currentColor: "RED",
    });

    const result = applyGameAction(state, {
      type: "PLAY_CARD",
      playerId: "p1",
      cardId: "w",
      declaredColor: "GREEN",
      now: NOW,
    });

    expect(result.state.currentColor).toBe("GREEN");
  });

  it("applies wild draw four behavior", () => {
    const state = makeState({
      hands: [
        [wild("WILD_DRAW_FOUR", "wd4"), number("BLUE", 8, "b8")],
        [number("BLUE", 2, "b2")],
        [number("GREEN", 3, "g3")],
      ],
      discard: number("RED", 9, "r9"),
      currentColor: "RED",
      drawPile: [
        number("YELLOW", 1, "y1"),
        number("YELLOW", 2, "y2"),
        number("YELLOW", 3, "y3"),
        number("YELLOW", 4, "y4"),
      ],
    });

    const result = applyGameAction(state, {
      type: "PLAY_CARD",
      playerId: "p1",
      cardId: "wd4",
      declaredColor: "BLUE",
      now: NOW,
    });

    expect(result.state.currentColor).toBe("BLUE");
    expect(result.state.players[1].hand).toHaveLength(5);
    expect(result.state.currentPlayerIndex).toBe(2);
  });
});

describe("turn actions", () => {
  it("draws a card", () => {
    const state = makeState({
      hands: [[number("BLUE", 9, "b9")], [number("GREEN", 3, "g3")]],
      discard: number("RED", 1, "r1"),
      currentColor: "RED",
      drawPile: [number("YELLOW", 1, "y1")],
    });

    const result = applyGameAction(state, {
      type: "DRAW_CARD",
      playerId: "p1",
      now: NOW,
    });

    expect(result.state.players[0].hand).toHaveLength(2);
    expect(result.state.hasDrawnThisTurn).toBe(true);
  });

  it("rejects drawing twice in one turn", () => {
    const state = makeState({
      hands: [[number("BLUE", 9, "b9")], [number("GREEN", 3, "g3")]],
      discard: number("RED", 1, "r1"),
      currentColor: "RED",
      drawPile: [number("YELLOW", 1, "y1"), number("YELLOW", 2, "y2")],
    });
    const drawn = applyGameAction(state, {
      type: "DRAW_CARD",
      playerId: "p1",
      now: NOW,
    });

    expect(() =>
      applyGameAction(drawn.state, {
        type: "DRAW_CARD",
        playerId: "p1",
        now: NOW,
      }),
    ).toThrow(GameRuleError);
  });

  it("passes when allowed", () => {
    const state = makeState({
      hands: [[number("BLUE", 9, "b9")], [number("GREEN", 3, "g3")]],
      discard: number("RED", 1, "r1"),
      currentColor: "RED",
    });

    const result = applyGameAction(state, {
      type: "PASS",
      playerId: "p1",
      now: NOW,
    });

    expect(result.state.currentPlayerIndex).toBe(1);
  });

  it("auto-passes on timeout", () => {
    const state = makeState({
      hands: [[number("BLUE", 9, "b9")], [number("GREEN", 3, "g3")]],
      discard: number("RED", 1, "r1"),
      currentColor: "RED",
    });

    const result = applyGameAction(state, {
      type: "TIMEOUT_AUTO_PASS",
      now: NOW,
    });

    expect(result.event.type).toBe("TURN_TIMEOUT");
    expect(result.state.currentPlayerIndex).toBe(1);
  });
});

describe("ONE declaration and callout", () => {
  it("allows ONE declaration with two cards", () => {
    const state = makeState({
      hands: [[number("RED", 1, "r1"), number("BLUE", 2, "b2")], [number("GREEN", 3, "g3")]],
      discard: number("RED", 9, "r9"),
      currentColor: "RED",
    });

    const result = applyGameAction(state, {
      type: "DECLARE_ONE",
      playerId: "p1",
      now: NOW,
    });

    expect(result.state.players[0].hasDeclaredOne).toBe(true);
  });

  it("records a failed ONE callout", () => {
    const state = makeState({
      hands: [[number("RED", 1, "r1")], [number("GREEN", 3, "g3")]],
      discard: number("RED", 9, "r9"),
      currentColor: "RED",
      currentPlayerIndex: 1,
    });

    const result = applyGameAction(state, {
      type: "CALLOUT_ONE",
      playerId: "p2",
      targetPlayerId: "p1",
      now: NOW,
    });

    expect(result.event.type).toBe("ONE_CALLOUT_FAILED");
  });

  it("applies a successful ONE callout penalty", () => {
    const state = makeState({
      hands: [[number("RED", 1, "r1"), number("BLUE", 2, "b2")], [number("GREEN", 3, "g3")]],
      discard: number("RED", 9, "r9"),
      currentColor: "RED",
      drawPile: [
        number("YELLOW", 1, "y1"),
        number("YELLOW", 2, "y2"),
        number("YELLOW", 3, "y3"),
        number("YELLOW", 4, "y4"),
      ],
    });

    const played = applyGameAction(state, {
      type: "PLAY_CARD",
      playerId: "p1",
      cardId: "r1",
      now: NOW,
    });
    const calledOut = applyGameAction(played.state, {
      type: "CALLOUT_ONE",
      playerId: "p2",
      targetPlayerId: "p1",
      now: NOW,
    });

    expect(calledOut.event.type).toBe("ONE_CALLOUT_SUCCESS");
    expect(calledOut.state.players[0].hand).toHaveLength(5);
    expect(calledOut.state.players[0].vulnerableToOneCallout).toBe(false);
  });
});

describe("round and deck edge cases", () => {
  it("detects a round winner", () => {
    const state = makeState({
      hands: [[number("RED", 1, "r1")], [number("GREEN", 3, "g3")]],
      discard: number("RED", 9, "r9"),
      currentColor: "RED",
    });

    const result = applyGameAction(state, {
      type: "PLAY_CARD",
      playerId: "p1",
      cardId: "r1",
      now: NOW,
    });

    expect(result.state.status).toBe("ROUND_FINISHED");
    expect(result.state.winnerPlayerId).toBe("p1");
  });

  it("reshuffles discard pile when the draw pile is exhausted", () => {
    const state = makeState({
      hands: [[number("BLUE", 9, "b9")], [number("GREEN", 3, "g3")]],
      discard: number("RED", 1, "r1"),
      currentColor: "RED",
      drawPile: [],
    });
    state.discardPile = [
      number("YELLOW", 5, "y5"),
      number("GREEN", 6, "g6"),
      number("RED", 1, "r1"),
    ];

    const result = applyGameAction(state, {
      type: "DRAW_CARD",
      playerId: "p1",
      now: NOW,
    });

    expect(result.state.players[0].hand).toHaveLength(2);
    expect(result.state.discardPile).toHaveLength(1);
    expect(result.state.reshuffleCount).toBe(1);
  });
});

describe("bots and reconnect state", () => {
  it("chooses the first legal non-wild bot move", () => {
    const state = makeState({
      hands: [[wild("WILD", "w"), number("RED", 5, "r5")], [number("GREEN", 3, "g3")]],
      discard: number("RED", 1, "r1"),
      currentColor: "RED",
    });

    expect(chooseBotAction(state)).toMatchObject({
      type: "PLAY_CARD",
      cardId: "r5",
    });
  });

  it("passes after drawing when no bot move is legal", () => {
    const state = makeState({
      hands: [[number("BLUE", 9, "b9")], [number("GREEN", 3, "g3")]],
      discard: number("RED", 1, "r1"),
      currentColor: "RED",
    });
    state.hasDrawnThisTurn = true;

    expect(chooseBotAction(state)).toMatchObject({
      type: "PASS",
      playerId: "p1",
    });
  });

  it("marks disconnected player as bot controlled", () => {
    const state = makeState({
      hands: [[number("RED", 1, "r1")], [number("GREEN", 3, "g3")]],
      discard: number("RED", 9, "r9"),
      currentColor: "RED",
    });

    const disconnected = updatePlayerConnection(state, "p1", false, true, NOW);

    expect(disconnected.players[0]).toMatchObject({
      isConnected: false,
      controlledByBot: true,
    });
  });

  it("reclaims a seat on reconnect", () => {
    const state = makeState({
      hands: [[number("RED", 1, "r1")], [number("GREEN", 3, "g3")]],
      discard: number("RED", 9, "r9"),
      currentColor: "RED",
    });
    const disconnected = updatePlayerConnection(state, "p1", false, true, NOW);
    const reconnected = updatePlayerConnection(disconnected, "p1", true, false, NOW);

    expect(reconnected.players[0]).toMatchObject({
      isConnected: true,
      controlledByBot: false,
    });
  });
});

function makeInitialState() {
  return createInitialGameState({
    id: "game-1",
    roomId: "room-1",
    seed: "test-seed",
    now: NOW,
    players: [
      { id: "p1", userId: "u1", displayName: "One", seatIndex: 0 },
      { id: "p2", userId: "u2", displayName: "Two", seatIndex: 1 },
      { id: "p3", userId: "u3", displayName: "Three", seatIndex: 2 },
    ],
  });
}

function makeState({
  hands,
  discard,
  currentColor,
  drawPile = [],
  currentPlayerIndex = 0,
}: {
  hands: Card[][];
  discard: Card;
  currentColor: DeclaredColor;
  drawPile?: Card[];
  currentPlayerIndex?: number;
}): GameStateSnapshot {
  return {
    id: "game-1",
    roomId: "room-1",
    seed: "seed",
    status: "PLAYING",
    players: hands.map((hand, index) => ({
      id: `p${index + 1}`,
      userId: `u${index + 1}`,
      displayName: `Player ${index + 1}`,
      seatIndex: index,
      hand,
      isConnected: true,
      controlledByBot: false,
      hasDeclaredOne: false,
      vulnerableToOneCallout: false,
    })),
    drawPile,
    discardPile: [discard],
    currentColor,
    currentPlayerIndex,
    direction: 1,
    ruleConfig: { ...CLASSIC_RULE_CONFIG, maxPlayers: hands.length },
    pendingDrawCount: 0,
    hasDrawnThisTurn: false,
    reshuffleCount: 0,
    turnStartedAt: NOW,
    turnEndsAt: "2026-01-01T00:00:10.000Z",
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function number(color: Exclude<Card["color"], "WILD">, value: number, id: string): Card {
  return {
    id,
    color,
    kind: "NUMBER",
    value: value as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9,
  } as Card;
}

function action(
  color: Exclude<Card["color"], "WILD">,
  kind: "SKIP" | "REVERSE" | "DRAW_TWO",
  id: string,
): Card {
  return {
    id,
    color,
    kind,
  };
}

function wild(kind: "WILD" | "WILD_DRAW_FOUR", id: string): Card {
  return {
    id,
    color: "WILD",
    kind,
  };
}
