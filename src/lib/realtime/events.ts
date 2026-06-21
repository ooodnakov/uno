import type {
  Card,
  DeclaredColor,
  Direction,
  RuleConfig,
} from "../game/types";

export type ID = string;

export const CLIENT_EVENTS = {
  ROOM_JOIN: "room:join",
  ROOM_LEAVE: "room:leave",
  ROOM_START: "room:start",
  GAME_PLAY_CARD: "game:playCard",
  GAME_DRAW: "game:draw",
  GAME_PASS: "game:pass",
  GAME_DECLARE_ONE: "game:declareOne",
  GAME_CALLOUT_ONE: "game:calloutOne",
  CHAT_SEND: "chat:send",
  REACTION_SEND: "reaction:send",
} as const;

export const SERVER_EVENTS = {
  ROOM_STATE: "room:state",
  GAME_STATE: "game:state",
  GAME_EVENT: "game:event",
  GAME_ERROR: "game:error",
  CHAT_MESSAGE: "chat:message",
  REACTION_SHOW: "reaction:show",
  PRESENCE_UPDATE: "presence:update",
} as const;

export type SocketErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "ROOM_FULL"
  | "ROOM_ALREADY_STARTED"
  | "NOT_ROOM_MEMBER"
  | "NOT_HOST"
  | "NOT_YOUR_TURN"
  | "INVALID_MOVE"
  | "INVALID_PAYLOAD"
  | "GAME_NOT_ACTIVE"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export type SocketErrorPayload = {
  code: SocketErrorCode;
  message: string;
  requestId?: string;
};

export type RoomJoinPayload = {
  roomId: ID;
};

export type RoomLeavePayload = {
  roomId: ID;
};

export type RoomStartPayload = {
  roomId: ID;
};

export type GamePlayCardPayload = {
  roomId: ID;
  gameId: ID;
  cardId: ID;
  declaredColor?: DeclaredColor;
};

export type GameDrawPayload = {
  roomId: ID;
  gameId: ID;
};

export type GamePassPayload = {
  roomId: ID;
  gameId: ID;
};

export type GameDeclareOnePayload = {
  roomId: ID;
  gameId: ID;
};

export type GameCalloutOnePayload = {
  roomId: ID;
  gameId: ID;
  targetPlayerId: ID;
};

export type ChatSendPayload = {
  roomId: ID;
  text: string;
};

export const ALLOWED_REACTIONS = ["🔥", "😂", "😱", "👏", "💀", "ONE"] as const;

export type Reaction = (typeof ALLOWED_REACTIONS)[number];

export type ReactionSendPayload = {
  roomId: ID;
  reaction: Reaction;
};

export type RoomVisibility = "PUBLIC" | "PRIVATE";
export type RoomStatus = "WAITING" | "IN_GAME" | "FINISHED";
export type PublicGameStatus = "WAITING" | "PLAYING" | "ROUND_FINISHED";

export type RoomStatePayload = {
  room: {
    id: ID;
    code: string;
    name: string;
    visibility: RoomVisibility;
    status: RoomStatus;
    hostUserId: ID;
    maxPlayers: number;
    ruleConfig: RuleConfig;
  };
  players: Array<{
    userId: ID;
    displayName: string;
    seatIndex: number;
    isHost: boolean;
    isConnected: boolean;
    controlledByBot: boolean;
  }>;
};

export type GameEventType =
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

export type GameEventPayload = {
  id: ID;
  gameId: ID;
  type: GameEventType;
  actorUserId?: ID;
  actorDisplayName?: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type GameStatePayload = {
  gameId: ID;
  roomId: ID;
  status: PublicGameStatus;
  self: {
    playerId: ID;
    userId: ID;
    displayName: string;
    seatIndex: number;
    hand: Card[];
    isCurrentTurn: boolean;
    isConnected: boolean;
    controlledByBot: boolean;
    hasDeclaredOne: boolean;
  };
  players: Array<{
    playerId: ID;
    userId: ID;
    displayName: string;
    seatIndex: number;
    cardCount: number;
    isCurrentTurn: boolean;
    isConnected: boolean;
    controlledByBot: boolean;
    hasDeclaredOneVisible: boolean;
  }>;
  table: {
    topDiscard: Card;
    discardCount: number;
    drawCount: number;
    currentColor: DeclaredColor;
    direction: Direction;
    currentPlayerId: ID;
    turnStartedAt: string;
    turnEndsAt: string;
  };
  availableActions: {
    canDraw: boolean;
    canPass: boolean;
    canDeclareOne: boolean;
    canCalloutOne: boolean;
    playableCardIds: ID[];
  };
  lastEvents: GameEventPayload[];
};

export type ChatMessagePayload = {
  id: ID;
  roomId: ID;
  userId: ID;
  displayName: string;
  text: string;
  createdAt: string;
};

export type ReactionShowPayload = {
  roomId: ID;
  userId: ID;
  displayName: string;
  reaction: Reaction;
  createdAt: string;
};

export type PresenceUpdatePayload = {
  roomId: ID;
  userId: ID;
  isConnected: boolean;
  controlledByBot: boolean;
};

export type ClientToServerEvents = {
  "room:join": (payload: RoomJoinPayload) => void;
  "room:leave": (payload: RoomLeavePayload) => void;
  "room:start": (payload: RoomStartPayload) => void;
  "game:playCard": (payload: GamePlayCardPayload) => void;
  "game:draw": (payload: GameDrawPayload) => void;
  "game:pass": (payload: GamePassPayload) => void;
  "game:declareOne": (payload: GameDeclareOnePayload) => void;
  "game:calloutOne": (payload: GameCalloutOnePayload) => void;
  "chat:send": (payload: ChatSendPayload) => void;
  "reaction:send": (payload: ReactionSendPayload) => void;
};

export type ServerToClientEvents = {
  "room:state": (payload: RoomStatePayload) => void;
  "game:state": (payload: GameStatePayload) => void;
  "game:event": (payload: GameEventPayload) => void;
  "game:error": (payload: SocketErrorPayload) => void;
  "chat:message": (payload: ChatMessagePayload) => void;
  "reaction:show": (payload: ReactionShowPayload) => void;
  "presence:update": (payload: PresenceUpdatePayload) => void;
};

export type InterServerEvents = Record<string, never>;

export type AuthenticatedSocketUser = {
  id: ID;
  displayName: string;
};

export type SocketData = {
  user?: AuthenticatedSocketUser;
};
