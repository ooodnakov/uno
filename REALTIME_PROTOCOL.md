# REALTIME_PROTOCOL.md

## Purpose

This document defines the real-time Socket.IO protocol for **ONE / Один**.

The protocol must support:

* authenticated sockets,
* public/private rooms,
* real-time game actions,
* personalized visible state,
* chat,
* reactions,
* reconnect,
* bot takeover,
* event logs.

## Architecture principle

The server is authoritative.

Clients send action requests. The server validates requests, mutates state, persists changes, and emits updated visible state.

Clients must never send complete game state.

Good:

```ts
socket.emit("game:playCard", {
  roomId,
  cardId,
  declaredColor,
});
```

Bad:

```ts
socket.emit("game:updateState", entireGameState);
```

Do not implement `game:updateState`.

## Transport

Use Socket.IO.

Recommended setup:

* authenticate socket during connection,
* put each socket into user-specific room,
* put each socket into game room when user joins,
* emit public room state to room channel,
* emit private game state directly to each player socket.

## Authentication

Socket connection must be authenticated.

Possible MVP approach:

* browser has HTTP session cookie,
* Socket.IO reads session from handshake,
* server resolves current user,
* reject unauthenticated socket.

Pseudocode:

```ts
io.use(async (socket, next) => {
  const user = await getUserFromSocketSession(socket);

  if (!user) {
    return next(new Error("UNAUTHORIZED"));
  }

  socket.data.user = user;
  socket.join(`user:${user.id}`);

  next();
});
```

## Naming conventions

Client-to-server events use this style:

```txt
resource:action
```

Examples:

```txt
room:join
game:playCard
chat:send
reaction:send
```

Server-to-client events use the same style:

```txt
room:state
game:state
game:event
game:error
```

## Shared base types

```ts
type ID = string;

type SocketErrorCode =
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

type SocketErrorPayload = {
  code: SocketErrorCode;
  message: string;
  requestId?: string;
};
```

## Client-to-server events

### `room:join`

Join a room socket channel and receive current room/game state.

Payload:

```ts
type RoomJoinPayload = {
  roomId: string;
};
```

Server behavior:

1. Authenticate user.
2. Verify room exists.
3. Verify user is a room member, or can join if room is waiting.
4. If room is waiting and user is not member, add user to room.
5. Join socket to `room:{roomId}`.
6. Emit `room:state`.
7. If game active, emit personalized `game:state`.

Possible errors:

* `UNAUTHORIZED`
* `NOT_FOUND`
* `ROOM_FULL`
* `ROOM_ALREADY_STARTED`
* `FORBIDDEN`

---

### `room:leave`

Leave a room.

Payload:

```ts
type RoomLeavePayload = {
  roomId: string;
};
```

Server behavior:

Waiting room:

* remove player from room,
* if host leaves, assign new host,
* if room empty, delete or mark abandoned.

In-game room:

* mark player disconnected,
* set `controlledByBot = true`,
* keep seat reserved.

Possible errors:

* `NOT_ROOM_MEMBER`
* `GAME_NOT_ACTIVE`

---

### `room:start`

Host starts a new round.

Payload:

```ts
type RoomStartPayload = {
  roomId: string;
};
```

Server behavior:

1. Verify user is host.
2. Verify room status is `WAITING` or previous round finished.
3. Verify enough players.
4. Create initial game state.
5. Persist game.
6. Set room status to `IN_GAME`.
7. Start turn timer.
8. Emit `room:state`.
9. Emit personalized `game:state` to each player.
10. Emit `game:event`.

Possible errors:

* `NOT_HOST`
* `NOT_ROOM_MEMBER`
* `INVALID_MOVE`
* `GAME_NOT_ACTIVE`

---

### `game:playCard`

Play a card from current player's hand.

Payload:

```ts
type GamePlayCardPayload = {
  roomId: string;
  gameId: string;
  cardId: string;
  declaredColor?: "RED" | "BLUE" | "GREEN" | "YELLOW";
};
```

Server behavior:

1. Verify active game.
2. Verify user is current player.
3. Verify card belongs to user.
4. Verify card is playable.
5. Validate `declaredColor` if card is wild.
6. Apply move through game engine.
7. Persist state.
8. Reset turn timer if game still active.
9. Emit personalized `game:state`.
10. Emit `game:event`.

Possible errors:

* `NOT_YOUR_TURN`
* `INVALID_MOVE`
* `INVALID_PAYLOAD`
* `GAME_NOT_ACTIVE`

---

### `game:draw`

Draw a card.

Payload:

```ts
type GameDrawPayload = {
  roomId: string;
  gameId: string;
};
```

Server behavior:

1. Verify active game.
2. Verify user is current player.
3. Apply draw according to rules.
4. Persist state.
5. Emit personalized `game:state`.
6. Emit `game:event`.

Possible errors:

* `NOT_YOUR_TURN`
* `INVALID_MOVE`
* `GAME_NOT_ACTIVE`

---

### `game:pass`

Pass turn.

Payload:

```ts
type GamePassPayload = {
  roomId: string;
  gameId: string;
};
```

Server behavior:

1. Verify active game.
2. Verify user is current player.
3. Verify pass is legal.
4. Apply pass.
5. Persist state.
6. Start next turn timer.
7. Emit personalized `game:state`.
8. Emit `game:event`.

Possible errors:

* `NOT_YOUR_TURN`
* `INVALID_MOVE`
* `GAME_NOT_ACTIVE`

---

### `game:declareOne`

Declare ONE / Один.

Payload:

```ts
type GameDeclareOnePayload = {
  roomId: string;
  gameId: string;
};
```

Server behavior:

1. Verify user is in game.
2. Verify user has 2 cards.
3. Set `hasDeclaredOne = true`.
4. Persist state.
5. Emit personalized `game:state`.
6. Emit `game:event`.

Possible errors:

* `INVALID_MOVE`
* `GAME_NOT_ACTIVE`

---

### `game:calloutOne`

Call out another player who failed to declare ONE / Один.

Payload:

```ts
type GameCalloutOnePayload = {
  roomId: string;
  gameId: string;
  targetPlayerId: string;
};
```

Server behavior:

1. Verify caller is in game.
2. Verify target exists.
3. Verify target has exactly 1 card.
4. Verify target is vulnerable to callout.
5. Apply penalty: target draws 4 cards.
6. Clear target vulnerability.
7. Persist state.
8. Emit personalized `game:state`.
9. Emit `game:event`.

Possible errors:

* `INVALID_MOVE`
* `NOT_ROOM_MEMBER`
* `GAME_NOT_ACTIVE`

---

### `chat:send`

Send text chat message in room.

Payload:

```ts
type ChatSendPayload = {
  roomId: string;
  text: string;
};
```

Validation:

* user must be room member,
* text length: 1–500 chars,
* trim whitespace,
* rate limit.

Server behavior:

1. Persist message.
2. Emit `chat:message` to room.

Possible errors:

* `NOT_ROOM_MEMBER`
* `INVALID_PAYLOAD`
* `RATE_LIMITED`

---

### `reaction:send`

Send quick reaction.

Payload:

```ts
type ReactionSendPayload = {
  roomId: string;
  reaction: string;
};
```

Validation:

* user must be room member,
* reaction must be one of allowed reactions,
* rate limit.

Suggested MVP reactions:

```ts
["🔥", "😂", "😱", "👏", "💀", "ONE"]
```

Server behavior:

1. Emit `reaction:show` to room.
2. Persistence optional for MVP.

Possible errors:

* `NOT_ROOM_MEMBER`
* `INVALID_PAYLOAD`
* `RATE_LIMITED`

---

## Server-to-client events

### `room:state`

Public room state.

Payload:

```ts
type RoomStatePayload = {
  room: {
    id: string;
    code: string;
    name: string;
    visibility: "PUBLIC" | "PRIVATE";
    status: "WAITING" | "IN_GAME" | "FINISHED";
    hostUserId: string;
    maxPlayers: number;
    ruleConfig: RuleConfig;
  };
  players: Array<{
    userId: string;
    displayName: string;
    seatIndex: number;
    isHost: boolean;
    isConnected: boolean;
    controlledByBot: boolean;
  }>;
};
```

Broadcast to:

```txt
room:{roomId}
```

---

### `game:state`

Personalized visible game state.

Important:

This must be emitted separately to each player because each player sees their own hand.

Payload:

```ts
type GameStatePayload = {
  gameId: string;
  roomId: string;
  status: "WAITING" | "PLAYING" | "ROUND_FINISHED";
  self: {
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
  players: Array<{
    playerId: string;
    userId: string;
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
    currentColor: "RED" | "BLUE" | "GREEN" | "YELLOW";
    direction: 1 | -1;
    currentPlayerId: string;
    turnStartedAt: string;
    turnEndsAt: string;
  };
  availableActions: {
    canDraw: boolean;
    canPass: boolean;
    canDeclareOne: boolean;
    canCalloutOne: boolean;
    playableCardIds: string[];
  };
  lastEvents: GameEventPayload[];
};
```

Emit to:

```txt
user:{userId}
```

or directly to socket.

Never broadcast one player's hand to the whole room.

---

### `game:event`

Append-only game event for UI log.

Payload:

```ts
type GameEventPayload = {
  id: string;
  gameId: string;
  type:
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
  actorUserId?: string;
  actorDisplayName?: string;
  payload: Record<string, unknown>;
  createdAt: string;
};
```

Public event payloads must not leak hidden cards.

For example, when a player draws a card, public event says:

```json
{
  "type": "CARD_DRAWN",
  "payload": {
    "count": 1
  }
}
```

It must not include the drawn card identity unless visible by rules.

---

### `game:error`

Payload:

```ts
type GameErrorPayload = {
  code: SocketErrorCode;
  message: string;
  requestId?: string;
};
```

Emit only to the socket/user that caused the error.

---

### `chat:message`

Payload:

```ts
type ChatMessagePayload = {
  id: string;
  roomId: string;
  userId: string;
  displayName: string;
  text: string;
  createdAt: string;
};
```

Broadcast to:

```txt
room:{roomId}
```

---

### `reaction:show`

Payload:

```ts
type ReactionShowPayload = {
  id: string;
  roomId: string;
  userId: string;
  displayName: string;
  reaction: string;
  createdAt: string;
};
```

Broadcast to:

```txt
room:{roomId}
```

---

### `presence:update`

Payload:

```ts
type PresenceUpdatePayload = {
  roomId: string;
  userId: string;
  isConnected: boolean;
  controlledByBot: boolean;
};
```

Broadcast to:

```txt
room:{roomId}
```

## Reconnect behavior

On socket disconnect:

1. Mark socket disconnected.
2. If user has no other sockets in same room, mark room player disconnected.
3. If game active, set player `controlledByBot = true`.
4. Emit `presence:update`.
5. Emit `game:event` with `PLAYER_DISCONNECTED` and `BOT_TAKEOVER`.
6. Continue game.

On socket reconnect:

1. Authenticate user.
2. Find active room/game membership.
3. Join `user:{userId}`.
4. Join `room:{roomId}`.
5. Set `isConnected = true`.
6. Set `controlledByBot = false`.
7. Emit `presence:update`.
8. Emit current `room:state`.
9. Emit personalized `game:state`.

## Timer behavior

Turn timer is server-side.

When a turn begins:

1. Set `turnStartedAt`.
2. Set `turnEndsAt`.
3. Schedule server timeout.
4. Emit personalized `game:state`.

When player acts before timeout:

1. Clear current timer.
2. Apply move.
3. If game continues, start next timer.

On timeout:

1. Apply timeout move through game engine.
2. Persist state.
3. Emit `game:event` with `TURN_TIMEOUT`.
4. Emit personalized `game:state`.
5. Start next timer if needed.

The client timer is display-only.

## Bot behavior over realtime

Bots do not use sockets.

When bot should act:

1. Server calls `chooseBotMove`.
2. Server applies move through same engine path as human moves.
3. Server emits same events as normal.

Bot actions should produce normal game events:

```txt
CARD_PLAYED
CARD_DRAWN
TURN_PASSED
```

Include bot-controlled player display name.

## Validation

All client payloads must be validated.

Recommended:

* use Zod schemas,
* reject unknown/malformed payloads,
* enforce room membership,
* enforce game membership,
* enforce turn ownership,
* enforce legal moves.

Example:

```ts
const GamePlayCardSchema = z.object({
  roomId: z.string().min(1),
  gameId: z.string().min(1),
  cardId: z.string().min(1),
  declaredColor: z.enum(["RED", "BLUE", "GREEN", "YELLOW"]).optional(),
});
```

## Rate limiting

MVP should rate limit:

* chat messages,
* reactions,
* repeated invalid game actions.

Suggested limits:

* chat: 5 messages per 10 seconds,
* reactions: 5 reactions per 10 seconds,
* invalid actions: soft warning/log.

## State emission strategy

After every successful game action:

1. Persist canonical `GameState`.
2. Create visible state for each player.
3. Emit individual `game:state` to each player.
4. Emit public `game:event` to room.

Pseudocode:

```ts
for (const player of gameState.players) {
  const visibleState = getVisibleState(gameState, player.id);
  io.to(`user:${player.userId}`).emit("game:state", visibleState);
}

io.to(`room:${roomId}`).emit("game:event", publicEvent);
```

## Security rules

* Never trust client state.
* Never emit full `GameState` to room.
* Never include opponent hand cards in public events.
* Never allow unauthenticated socket actions.
* Never allow users to act for another user.
* Validate every action against current server state.
* Use room membership checks for every room event.
* Use host checks for host-only events.

## Event implementation checklist

Client-to-server:

* [ ] `room:join`
* [ ] `room:leave`
* [ ] `room:start`
* [ ] `game:playCard`
* [ ] `game:draw`
* [ ] `game:pass`
* [ ] `game:declareOne`
* [ ] `game:calloutOne`
* [ ] `chat:send`
* [ ] `reaction:send`

Server-to-client:

* [ ] `room:state`
* [ ] `game:state`
* [ ] `game:event`
* [ ] `game:error`
* [ ] `chat:message`
* [ ] `reaction:show`
* [ ] `presence:update`
