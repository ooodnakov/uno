# IMPLEMENTATION_PLAN.md

## Goal

Build a weekend MVP of **ONE / Один**: a real-time multiplayer web card game with accounts, lobbies, classic rules, bots, reconnect, responsive UI, and Docker deployment.

## Architecture

Use:

* Next.js App Router
* React
* TypeScript
* Node.js custom server
* Socket.IO
* PostgreSQL
* Prisma
* Docker Compose

The game engine must be independent from the UI, database, and sockets.

## Milestone 1: Project scaffold

Tasks:

* Initialize Next.js TypeScript app.
* Add custom Node.js server for Next.js + Socket.IO.
* Add Prisma.
* Add PostgreSQL Docker service.
* Add environment config.
* Add linting and formatting.
* Add basic app layout.

Deliverables:

* app starts locally,
* database connects,
* Socket.IO server starts,
* Docker Compose boots app + db.

## Milestone 2: Domain model

Create core types:

* User
* Room
* RoomPlayer
* Game
* GamePlayer
* Card
* Deck
* GameState
* VisibleGameState
* Move
* GameEvent
* RuleConfig
* BotConfig

Important rule:

`GameState` contains hidden information.
`VisibleGameState` is derived per player and hides opponent hands.

## Milestone 3: Game engine

Implement pure game logic in `src/lib/game`.

Files:

* `cards.ts`
* `deck.ts`
* `rules.ts`
* `state.ts`
* `engine.ts`
* `validators.ts`
* `bots.ts`

Required functions:

* `createDeck(config)`
* `shuffleDeck(deck, seed)`
* `createInitialGameState(players, config, seed)`
* `getVisibleState(gameState, viewerPlayerId)`
* `getPlayableCards(gameState, playerId)`
* `canPlayCard(gameState, playerId, cardId, declaredColor?)`
* `applyMove(gameState, move)`
* `advanceTurn(gameState)`
* `handleTimeout(gameState)`
* `chooseBotMove(gameState, botPlayerId)`
* `checkRoundWinner(gameState)`

Moves:

* `PLAY_CARD`
* `DRAW_CARD`
* `PASS`
* `DECLARE_ONE`
* `CALLOUT_ONE`
* `CHOOSE_COLOR`
* `BOT_TAKEOVER`
* `PLAYER_RECONNECT`

## Milestone 4: Game engine tests

Add tests for:

* deck creation,
* initial deal,
* legal number match,
* legal color match,
* illegal move rejection,
* skip,
* reverse,
* draw two,
* wild,
* wild draw four,
* turn order,
* timeout auto-pass,
* ONE declaration,
* callout penalty,
* round win,
* bot move.

Do not proceed to UI polish until engine tests pass.

## Milestone 5: Auth

Implement:

* register,
* login,
* logout,
* session cookie,
* current user endpoint/helper.

Password hashing:

* use argon2 or bcrypt,
* never store plaintext passwords.

MVP does not need email verification.

## Milestone 6: Rooms and lobbies

Implement database-backed rooms:

* create room,
* list public rooms,
* join room,
* leave room,
* private invite link,
* host starts game,
* no joining after game starts.

Room fields:

* id,
* code,
* name,
* visibility,
* hostUserId,
* maxPlayers,
* status,
* ruleConfig,
* createdAt,
* updatedAt.

Room statuses:

* `WAITING`
* `IN_GAME`
* `FINISHED`

## Milestone 7: Realtime protocol

Implement Socket.IO events.

Client to server:

* `room:join`
* `room:leave`
* `room:start`
* `game:playCard`
* `game:draw`
* `game:pass`
* `game:declareOne`
* `game:calloutOne`
* `chat:send`
* `reaction:send`

Server to client:

* `room:state`
* `game:state`
* `game:event`
* `game:error`
* `chat:message`
* `reaction:show`
* `presence:update`

Rules:

* Authenticate socket connection.
* Join socket to room channel.
* Validate every payload.
* Never broadcast private hand data to all users.
* Emit per-player visible state separately.

## Milestone 8: Timer system

Implement server-side turn timer.

Rules:

* default timer: 10 seconds,
* timer starts when turn begins,
* on timeout, apply auto-pass,
* if auto-pass is illegal, draw/pass according to current rules,
* clear timer when valid move is received,
* do not trust client timer.

## Milestone 9: Bot system

Implement basic bots.

Bot behavior MVP:

* If bot has playable card, play first playable card.
* Prefer non-wild over wild if possible.
* If playing wild, choose color most common in bot hand.
* If no playable card, draw.
* If draw cannot play, pass.
* If controlling disconnected player, act on timer or slightly before timeout.

Disconnect behavior:

* On socket disconnect, mark user disconnected.
* Immediately assign bot control to their seat.
* Keep seat reserved for original user.
* On reconnect, restore human control.

## Milestone 10: UI

Pages:

* `/`
* `/login`
* `/register`
* `/lobby`
* `/room/[roomId]`

Core components:

* `GameTable`
* `Card`
* `Hand`
* `PlayerSeat`
* `DrawPile`
* `DiscardPile`
* `TurnTimer`
* `ColorPicker`
* `OneButton`
* `CalloutButton`
* `ChatPanel`
* `EventLog`
* `CreateRoomDialog`
* `RoomCard`

UI behavior:

* Highlight playable cards.
* Allow click and drag.
* Block invalid moves silently.
* Show current color clearly.
* Show current player clearly.
* Show card counts for opponents.
* Show disconnected/bot-controlled status.
* Make mobile layout usable.

## Milestone 11: Chat and reactions

Implement:

* text chat per room,
* simple emoji/symbol reactions,
* event log separate from chat.

No moderation in MVP.

## Milestone 12: Persistence

Persist:

* users,
* rooms,
* room players,
* game snapshots,
* game events,
* chat messages,
* finished rounds.

For MVP, game state can be stored as JSON snapshots.

Use database state for reconnect and server restart recovery.

## Milestone 13: Docker deployment

Create:

* `Dockerfile`
* `docker-compose.yml`
* `.env.example`

Services:

* app,
* postgres.

Optional later:

* valkey,
* nginx,
* backup service.

Deployment checklist:

* HTTPS handled by reverse proxy,
* persistent Postgres volume,
* production env vars,
* database migration command,
* seed command optional.

## Milestone 14: Polish pass

Add:

* card animations,
* sound effects,
* mute toggle,
* better mobile spacing,
* loading states,
* empty states,
* error states,
* invite copy button.

## Weekend build order

Day 1:

1. Scaffold app.
2. Add DB.
3. Add auth.
4. Build pure game engine.
5. Add game engine tests.
6. Add room creation/joining.

Day 2:

1. Add Socket.IO.
2. Connect game engine to sockets.
3. Build game table UI.
4. Add timer.
5. Add bot takeover.
6. Add reconnect.
7. Add Docker Compose.
8. Do final playtest.

## Acceptance tests

The MVP is done when:

* user can register,
* user can log in,
* user can create public room,
* user can create private room,
* another user can join before game starts,
* host can start game,
* players receive correct private hands,
* players can play valid cards,
* invalid cards cannot be played,
* draw/pass works,
* special cards work,
* ONE declaration works,
* callout works,
* timer auto-passes,
* disconnected player is controlled by bot,
* reconnect restores player control,
* round ends when player has no cards,
* same lobby can start another round,
* app works on mobile,
* app runs through Docker Compose.
