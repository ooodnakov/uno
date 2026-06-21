export const NORMAL_CARD_COLORS = ["RED", "BLUE", "GREEN", "YELLOW"] as const;
export const CARD_COLORS = [...NORMAL_CARD_COLORS, "WILD"] as const;
export const CARD_KINDS = [
  "NUMBER",
  "SKIP",
  "REVERSE",
  "DRAW_TWO",
  "WILD",
  "WILD_DRAW_FOUR",
] as const;

export type NormalCardColor = (typeof NORMAL_CARD_COLORS)[number];
export type DeclaredColor = NormalCardColor;
export type CardColor = (typeof CARD_COLORS)[number];
export type CardKind = (typeof CARD_KINDS)[number];
export type CardNumber = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type Direction = 1 | -1;
export type RulePreset = "CLASSIC" | "HOUSE_PARTY" | "CUSTOM";
export type GameStateStatus = "WAITING" | "PLAYING" | "ROUND_FINISHED";
export type EngineEventType =
  | "GAME_STARTED"
  | "CARD_PLAYED"
  | "CARD_DRAWN"
  | "TURN_PASSED"
  | "TURN_TIMEOUT"
  | "ONE_DECLARED"
  | "ONE_CALLOUT_SUCCESS"
  | "ONE_CALLOUT_FAILED"
  | "PLAYER_DISCONNECTED"
  | "PLAYER_RECONNECTED"
  | "BOT_TAKEOVER"
  | "ROUND_FINISHED";

export type NumberCard = {
  id: string;
  color: NormalCardColor;
  kind: "NUMBER";
  value: CardNumber;
};

export type ActionCard = {
  id: string;
  color: NormalCardColor;
  kind: "SKIP" | "REVERSE" | "DRAW_TWO";
};

export type WildCard = {
  id: string;
  color: "WILD";
  kind: "WILD" | "WILD_DRAW_FOUR";
};

export type Card = NumberCard | ActionCard | WildCard;

export type RuleConfig = {
  preset: RulePreset;
  maxPlayers: number;
  turnSeconds: number;
  challengeWildDrawFour: boolean;
  stackDrawCards: boolean;
  stackSkips: boolean;
  jumpIn: boolean;
  sevenZero: boolean;
  forcePlay: boolean;
  drawUntilPlayable: boolean;
  allowPassWhenPlayable: boolean;
  officialDeckComposition: boolean;
};

export const CLASSIC_RULE_CONFIG: RuleConfig = {
  preset: "CLASSIC",
  maxPlayers: 6,
  turnSeconds: 10,
  challengeWildDrawFour: false,
  stackDrawCards: false,
  stackSkips: false,
  jumpIn: false,
  sevenZero: false,
  forcePlay: false,
  drawUntilPlayable: false,
  allowPassWhenPlayable: true,
  officialDeckComposition: true,
};

export type GamePlayerState = {
  id: string;
  userId: string;
  displayName: string;
  seatIndex: number;
  hand: Card[];
  isConnected: boolean;
  controlledByBot: boolean;
  hasDeclaredOne: boolean;
  vulnerableToOneCallout: boolean;
};

export type GameStateSnapshot = {
  id: string;
  roomId: string;
  seed: string;
  status: GameStateStatus;
  players: GamePlayerState[];
  drawPile: Card[];
  discardPile: Card[];
  currentColor: DeclaredColor;
  currentPlayerIndex: number;
  direction: Direction;
  ruleConfig: RuleConfig;
  pendingDrawCount: number;
  hasDrawnThisTurn: boolean;
  reshuffleCount: number;
  turnStartedAt: string;
  turnEndsAt: string;
  winnerPlayerId?: string;
  createdAt: string;
  updatedAt: string;
};

export type VisibleSelfState = {
  playerId: string;
  userId: string;
  displayName: string;
  seatIndex: number;
  hand: Card[];
  isCurrentTurn: boolean;
  isConnected: boolean;
  controlledByBot: boolean;
  hasDeclaredOne: boolean;
};

export type VisibleOpponentState = {
  playerId: string;
  userId: string;
  displayName: string;
  seatIndex: number;
  cardCount: number;
  isCurrentTurn: boolean;
  isConnected: boolean;
  controlledByBot: boolean;
  hasDeclaredOneVisible: boolean;
};

export type VisibleTableState = {
  topDiscard: Card;
  discardCount: number;
  drawCount: number;
  currentColor: DeclaredColor;
  direction: Direction;
  currentPlayerId: string;
  turnStartedAt: string;
  turnEndsAt: string;
};

export type AvailableActions = {
  canDraw: boolean;
  canPass: boolean;
  canDeclareOne: boolean;
  canCalloutOne: boolean;
  playableCardIds: string[];
};

export type VisibleGameState = {
  gameId: string;
  roomId: string;
  status: GameStateStatus;
  self: VisibleSelfState;
  players: VisibleOpponentState[];
  table: VisibleTableState;
  availableActions: AvailableActions;
};

export type InitialGamePlayer = {
  id?: string;
  userId: string;
  displayName: string;
  seatIndex: number;
  isConnected?: boolean;
  controlledByBot?: boolean;
};

export type EngineAction =
  | {
      type: "PLAY_CARD";
      playerId: string;
      cardId: string;
      declaredColor?: DeclaredColor;
      now?: string;
    }
  | {
      type: "DRAW_CARD";
      playerId: string;
      now?: string;
    }
  | {
      type: "PASS";
      playerId: string;
      now?: string;
    }
  | {
      type: "DECLARE_ONE";
      playerId: string;
      now?: string;
    }
  | {
      type: "CALLOUT_ONE";
      playerId: string;
      targetPlayerId: string;
      now?: string;
    }
  | {
      type: "TIMEOUT_AUTO_PASS";
      now?: string;
    };

export type EngineEvent = {
  id: string;
  gameId: string;
  type: EngineEventType;
  actorUserId?: string;
  actorDisplayName?: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type EngineResult = {
  state: GameStateSnapshot;
  event: EngineEvent;
};

export class GameRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GameRuleError";
  }
}
