Continue working in this repo.

First read:
- RULES.md
- REALTIME_PROTOCOL.md
- DATA_MODEL.md
- current src/lib/game code
- current src/lib/realtime code
- current src/server code

Goal: connect the pure game engine to Socket.IO and persisted Game state.

Important constraints:
- Server is authoritative.
- Never accept full game state from the client.
- Never broadcast a player's hand to all users.
- Send personalized game:state to each player.
- Validate every payload.
- Use the event names and payloads from REALTIME_PROTOCOL.md.
- Persist canonical game state in Game.stateSnapshot.
- Persist public game events in GameEvent.

Implement Socket.IO events:

Client to server:
- room:join
- room:leave
- room:start
- game:playCard
- game:draw
- game:pass
- game:declareOne
- game:calloutOne
- chat:send
- reaction:send

Server to client:
- room:state
- game:state
- game:event
- game:error
- chat:message
- reaction:show
- presence:update

Room start:
1. Only host can start.
2. Room must have enough players.
3. Create initial game state from room players.
4. Create Game row.
5. Create GamePlayer rows.
6. Set room status to IN_GAME.
7. Emit room:state.
8. Emit personalized game:state.
9. Start turn timer.

Move flow:
1. Authenticate socket user.
2. Check room membership.
3. Load active game.
4. Parse Game.stateSnapshot.
5. Validate requested move against current state.
6. Apply move through src/lib/game engine.
7. Persist updated snapshot.
8. Persist public GameEvent.
9. Emit personalized states to all players.
10. Start next server-side timer if game still active.

Timer:
- 10 seconds from ruleConfig.
- Server-owned.
- On timeout, apply engine timeout auto-pass.
- Emit TURN_TIMEOUT event.
- Continue game.

Disconnect/reconnect:
- On disconnect:
  - mark RoomPlayer disconnected if no active sockets remain for that user in the room,
  - set controlledByBot = true,
  - update active game snapshot,
  - emit presence:update,
  - emit game:event.
- On reconnect:
  - authenticate user,
  - rejoin user and room socket channels,
  - set isConnected = true,
  - set controlledByBot = false,
  - emit room:state,
  - emit personalized game:state.

Bot takeover:
- Bots do not use sockets.
- If current player is controlledByBot, server should choose/apply bot move.
- Bot action should go through same engine path as human move.
- Emit normal public game events.

Chat/reactions:
- Chat persists in ChatMessage.
- Reactions may be ephemeral.
- Validate and rate-limit lightly.

Use Zod or equivalent for payload validation.

After finishing:
- run tests,
- run typecheck,
- manually describe how to test two browser sessions.