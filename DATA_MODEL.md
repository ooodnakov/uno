# DATA_MODEL.md

## Purpose

This document defines the data model for **ONE / Один**.

The app uses:

* PostgreSQL for durable data,
* Prisma as ORM,
* JSON snapshots for game state in MVP,
* server-authoritative game state.

## Data model goals

The model must support:

* registered users,
* public/private rooms,
* room membership,
* host-controlled lobbies,
* active games,
* multiple rounds per lobby,
* reconnect,
* bot takeover,
* persisted game events,
* chat messages,
* future stats/profiles/ranked modes.

## Persistence strategy

MVP uses a hybrid model:

1. Relational tables for users, rooms, players, messages, and events.
2. JSON snapshot for the canonical game state.
3. Append-only event log for debugging/replay-like history.

This keeps the MVP simple while preserving future extensibility.

## Prisma schema

Put this in:

```txt
prisma/schema.prisma
```

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(cuid())
  username     String   @unique
  displayName  String
  passwordHash String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  roomsHosted  Room[]   @relation("RoomHost")
  roomPlayers  RoomPlayer[]
  gamePlayers  GamePlayer[]
  chatMessages ChatMessage[]
  sessions     Session[]
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  tokenHash String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Room {
  id          String         @id @default(cuid())
  code        String         @unique
  name        String
  visibility  RoomVisibility
  status      RoomStatus     @default(WAITING)
  hostUserId  String
  maxPlayers  Int
  ruleConfig  Json
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  host        User           @relation("RoomHost", fields: [hostUserId], references: [id])
  players     RoomPlayer[]
  games       Game[]
  messages    ChatMessage[]

  @@index([visibility, status])
  @@index([hostUserId])
}

model RoomPlayer {
  id              String   @id @default(cuid())
  roomId          String
  userId          String
  seatIndex       Int
  isHost          Boolean  @default(false)
  isConnected     Boolean  @default(true)
  controlledByBot Boolean  @default(false)
  joinedAt        DateTime @default(now())
  updatedAt       DateTime @updatedAt

  room            Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([roomId, userId])
  @@unique([roomId, seatIndex])
  @@index([userId])
}

model Game {
  id             String      @id @default(cuid())
  roomId         String
  roundNumber    Int         @default(1)
  status         GameStatus  @default(PLAYING)
  stateSnapshot  Json
  winnerUserId   String?
  startedAt      DateTime    @default(now())
  finishedAt     DateTime?
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt

  room           Room        @relation(fields: [roomId], references: [id], onDelete: Cascade)
  players        GamePlayer[]
  events         GameEvent[]

  @@index([roomId, status])
  @@index([winnerUserId])
}

model GamePlayer {
  id              String   @id @default(cuid())
  gameId          String
  userId          String
  seatIndex       Int
  finalPosition   Int?
  controlledByBot Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  game            Game     @relation(fields: [gameId], references: [id], onDelete: Cascade)
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([gameId, userId])
  @@unique([gameId, seatIndex])
  @@index([userId])
}

model GameEvent {
  id        String   @id @default(cuid())
  gameId    String
  type      String
  actorUserId String?
  payload   Json
  createdAt DateTime @default(now())

  game      Game     @relation(fields: [gameId], references: [id], onDelete: Cascade)

  @@index([gameId, createdAt])
  @@index([type])
}

model ChatMessage {
  id        String   @id @default(cuid())
  roomId    String
  userId    String
  text      String
  createdAt DateTime @default(now())

  room      Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([roomId, createdAt])
  @@index([userId])
}

enum RoomVisibility {
  PUBLIC
  PRIVATE
}

enum RoomStatus {
  WAITING
  IN_GAME
  FINISHED
  ABANDONED
}

enum GameStatus {
  PLAYING
  ROUND_FINISHED
  ABANDONED
}
```

## Entity descriptions

## User

Represents registered app users.

MVP fields:

* `username`: unique login name.
* `displayName`: public name shown in rooms/games.
* `passwordHash`: hashed password.
* `createdAt`, `updatedAt`.

Do not store plaintext passwords.

## Session

Represents login sessions.

MVP options:

* cookie stores session token,
* database stores token hash,
* session has expiry.

Alternative:

* use JWT, but DB sessions are simpler to revoke.

## Room

Represents a lobby/table.

A room can be:

* public,
* private,
* waiting,
* in-game,
* finished,
* abandoned.

Important fields:

* `code`: human/shareable invite code.
* `visibility`: public/private.
* `status`: current room lifecycle.
* `hostUserId`: host controls settings/start.
* `maxPlayers`: MVP 2–6.
* `ruleConfig`: JSON settings.

## RoomPlayer

Represents a user's seat in a room.

Important fields:

* `seatIndex`: position around table.
* `isHost`: whether player is host.
* `isConnected`: current presence.
* `controlledByBot`: whether bot is currently controlling this seat.

Room membership persists during disconnects so users can reconnect.

## Game

Represents one round inside a room.

A room may have multiple games/rounds.

Important fields:

* `roundNumber`: round count in same room.
* `status`: active/finished/abandoned.
* `stateSnapshot`: canonical server game state as JSON.
* `winnerUserId`: winner when round ends.

## GamePlayer

Represents a user's participation in a specific round.

This is separate from `RoomPlayer` because a room can have multiple rounds.

Important fields:

* `seatIndex`: seat during the round.
* `finalPosition`: future support for rankings.
* `controlledByBot`: whether bot controlled this player at end/through part of game.

## GameEvent

Append-only game event log.

Used for:

* visible event log,
* debugging,
* future replay support,
* anti-bug investigation.

Important:

Game events must not leak hidden information.

Bad event payload:

```json
{
  "drawnCard": {
    "color": "RED",
    "kind": "NUMBER",
    "value": 7
  }
}
```

Good public event payload:

```json
{
  "count": 1
}
```

Private drawn card information belongs only in the target player's personalized `game:state`.

## ChatMessage

Text chat message in a room.

MVP:

* no moderation,
* length limit,
* rate limit.

Future:

* reporting,
* moderation,
* deletion,
* admin tools.

## Canonical game state JSON

`Game.stateSnapshot` should store the full server-authoritative state.

Example shape:

```ts
type GameStateSnapshot = {
  id: string;
  roomId: string;
  status: "WAITING" | "PLAYING" | "ROUND_FINISHED";
  players: Array<{
    id: string;
    userId: string;
    displayName: string;
    seatIndex: number;
    hand: Card[];
    isConnected: boolean;
    controlledByBot: boolean;
    hasDeclaredOne: boolean;
    vulnerableToOneCallout: boolean;
  }>;
  drawPile: Card[];
  discardPile: Card[];
  currentColor: "RED" | "BLUE" | "GREEN" | "YELLOW";
  currentPlayerIndex: number;
  direction: 1 | -1;
  ruleConfig: RuleConfig;
  pendingDrawCount: number;
  turnStartedAt: string;
  turnEndsAt: string;
  winnerPlayerId?: string;
  createdAt: string;
  updatedAt: string;
};
```

## Card shape

```ts
type Card = {
  id: string;
  color: "RED" | "BLUE" | "GREEN" | "YELLOW" | "WILD";
  kind:
    | "NUMBER"
    | "SKIP"
    | "REVERSE"
    | "DRAW_TWO"
    | "WILD"
    | "WILD_DRAW_FOUR";
  value?: number;
};
```

Card IDs must be unique within a deck.

Example card IDs:

```txt
red-0-0
red-1-0
red-1-1
wild-0
wild-draw-four-0
```

## Rule config shape

```ts
type RuleConfig = {
  preset: "CLASSIC" | "HOUSE_PARTY" | "CUSTOM";
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
```

MVP default:

```json
{
  "preset": "CLASSIC",
  "maxPlayers": 6,
  "turnSeconds": 10,
  "challengeWildDrawFour": false,
  "stackDrawCards": false,
  "stackSkips": false,
  "jumpIn": false,
  "sevenZero": false,
  "forcePlay": false,
  "drawUntilPlayable": false,
  "allowPassWhenPlayable": true,
  "officialDeckComposition": true
}
```

## Visibility model

Never send `Game.stateSnapshot` directly to clients.

Generate personalized visible state:

```ts
type VisibleGameState = {
  gameId: string;
  roomId: string;
  status: string;
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
};
```

## Indexing strategy

Important indexes:

* `Room.visibility + Room.status` for public lobby list.
* `Room.code` for invite links.
* `RoomPlayer.roomId + userId` for reconnect/membership.
* `Game.roomId + status` for active game lookup.
* `GameEvent.gameId + createdAt` for logs.
* `ChatMessage.roomId + createdAt` for chat.

## Data lifecycle

### Room creation

1. Insert `Room`.
2. Insert host as `RoomPlayer`.
3. Emit room state.

### Game start

1. Read room and room players.
2. Create initial `GameState`.
3. Insert `Game`.
4. Insert `GamePlayer` rows.
5. Update room status to `IN_GAME`.
6. Emit game state.

### Move applied

1. Load latest active game.
2. Parse `stateSnapshot`.
3. Apply move through pure engine.
4. Update `stateSnapshot`.
5. Insert `GameEvent`.
6. Emit visible states.

### Round finished

1. Update game status to `ROUND_FINISHED`.
2. Set `winnerUserId`.
3. Set `finishedAt`.
4. Keep room available for another round or set to `WAITING`.
5. Emit result.

### Disconnect

1. Update `RoomPlayer.isConnected = false`.
2. Update `RoomPlayer.controlledByBot = true`.
3. Update active `stateSnapshot` player flags.
4. Insert `GameEvent`.
5. Continue game.

### Reconnect

1. Find room membership by `userId`.
2. Update `RoomPlayer.isConnected = true`.
3. Update `RoomPlayer.controlledByBot = false`.
4. Update active `stateSnapshot`.
5. Emit private state.

## Migration commands

After editing `prisma/schema.prisma`:

```bash
npx prisma format
npx prisma migrate dev --name init
npx prisma generate
```

For production:

```bash
npx prisma migrate deploy
```

## Environment variables

Required for PostgreSQL-backed development and production:

```env
DATABASE_URL="postgresql://one:one_password@postgres:5432/one_game?schema=public"
SESSION_SECRET="change-me"
NODE_ENV="development"
```

Database-free local gameplay debugging:

```env
ONE_LOCAL_MEMORY="1"
```

When `ONE_LOCAL_MEMORY=1`, persistence is process-local and seeds two test users: `host` / `password123` and `guest` / `password123`. Restarting the server clears rooms, sessions, games, chat, and events.

Optional later:

```env
PUBLIC_APP_URL="https://example.com"
TELEGRAM_BOT_TOKEN=""
REDIS_URL=""
```

## Future data model additions

Do not implement in MVP unless needed.

Future tables:

* `Friendship`
* `UserProfile`
* `UserStats`
* `Achievement`
* `UserAchievement`
* `Season`
* `RankedRating`
* `Report`
* `AdminAction`
* `Theme`
* `UserTheme`
* `Replay`
* `Notification`

## Data safety rules

* Never store plaintext passwords.
* Never expose `passwordHash`.
* Never expose session tokens.
* Never send full game snapshots to clients.
* Never expose hidden cards through public game events.
* Validate JSON snapshots when loading.
* Prefer transactions for move application.
* Avoid concurrent move race conditions.

## Concurrency rule

Move application must be atomic.

Recommended approach:

* load current game,
* validate move,
* apply move,
* write updated state,
* write event,
* commit transaction.

To avoid double moves:

* reject action if player is no longer current player,
* use transaction,
* optionally add optimistic version number later.

Future improvement:

```prisma
version Int @default(1)
```

Then update with version check.
