# AGENTS.md

## Project

This repository implements **ONE / Один**, a public real-time multiplayer web card game inspired by classic color/number matching games.

The app must support:

* registered users only,
* public and private lobbies,
* real-time multiplayer,
* up to 6 players in MVP,
* mobile and desktop UI,
* bots,
* reconnect support,
* classic rules preset,
* future support for multiple rule variants.

## Prime directive

Build a playable, stable MVP first. Do not implement advanced platform features before the core game loop works.

Priority order:

1. Correct server-authoritative game engine.
2. Stable WebSocket multiplayer.
3. Simple responsive UI.
4. Auth and lobbies.
5. Bots/reconnect.
6. Chat/reactions.
7. Polish.

## Non-negotiable architecture rules

* The server is authoritative.
* The client must never decide deck order, legal moves, scoring, or hidden opponent cards.
* The client receives only the information it is allowed to know.
* Each move must be validated on the server.
* Game state transitions must be deterministic and testable.
* The game engine must be usable without React, sockets, or database dependencies.
* Keep game logic in `src/lib/game`.
* Keep Socket.IO event handlers thin.
* Keep UI components mostly dumb/presentational.

## Terminology

Use project-safe terminology:

* Game name: `ONE / Один`
* UNO button text: `ONE!` or `ОДИН!`
* Do not use official UNO logos, card art, or branding.
* Avoid copying official visual design.

## MVP feature set

Implement:

* user registration and login,
* public room list,
* private invite rooms,
* create room,
* join room before game starts,
* host starts game,
* up to 6 players,
* classic card deck,
* number cards,
* skip,
* reverse,
* draw two,
* wild,
* wild draw four,
* manual ONE button,
* callout penalty,
* 10-second turn timer,
* auto-pass on timeout,
* basic bot takeover on disconnect,
* reconnect to reclaim seat,
* text chat,
* reactions,
* event log,
* Docker Compose deployment.

Do not implement in MVP unless explicitly requested:

* ELO/ranked,
* seasons,
* achievements,
* skins,
* friends,
* public profiles,
* admin panel,
* Telegram Mini App auth,
* full replay viewer,
* all rule variants.

## Code quality expectations

* Use TypeScript everywhere.
* Use explicit domain types.
* Do not use `any` unless unavoidable.
* Prefer pure functions for game rules.
* Add tests for game engine.
* Use Zod or equivalent validation for socket payloads.
* Never trust client payloads.
* Keep hidden state hidden.

## Testing expectations

At minimum, test:

* deck generation,
* shuffle determinism when seeded,
* legal move validation,
* draw behavior,
* skip behavior,
* reverse behavior,
* draw two behavior,
* wild color selection,
* wild draw four behavior,
* ONE button state,
* callout penalty,
* timeout auto-pass,
* bot move selection,
* reconnect seat reclaim.

## Agent workflow

When implementing:

1. Read `DESIGN.md`.
2. Read `RULES.md`.
3. Read `REALTIME_PROTOCOL.md`.
4. Implement game engine first.
5. Add tests.
6. Add Socket.IO handlers.
7. Add UI.
8. Add Docker deployment.

For every significant change:

* update docs if behavior changes,
* keep event names consistent,
* keep database schema consistent,
* avoid breaking saved game state unless migration is provided.
