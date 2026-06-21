# ONE / Один

Server-authoritative MVP for a real-time multiplayer color and number card game.

## Stack

- Next.js App Router
- React
- TypeScript
- Custom Node.js server
- Socket.IO
- PostgreSQL
- Prisma
- Docker Compose
- Vitest

## Local Development

PostgreSQL-backed mode:

```bash
pnpm install
cp .env.example .env
docker compose up -d postgres
pnpm prisma:migrate --name init
pnpm prisma:generate
pnpm dev
```

Database-free local game debugging:

```bash
pnpm install
pnpm prisma:generate
pnpm dev:memory
```

Memory mode keeps users, rooms, sessions, games, chat, and events inside the Node.js process. Restarting the server clears them. Open `http://localhost:3000`.

Default memory-mode users:

| Username | Password | Display name |
| --- | --- | --- |
| `host` | `password123` | `Host` |
| `guest` | `password123` | `Guest` |

Use two browsers or profiles so each user has a separate session cookie.

## Database

Start PostgreSQL:

```bash
docker compose up -d postgres
```

Create and apply the first migration after editing `prisma/schema.prisma`:

```bash
pnpm prisma:migrate --name init
```

Generate Prisma Client:

```bash
pnpm prisma:generate
```

## Verification

```bash
pnpm typecheck
pnpm test
pnpm build
```

The custom server health endpoint is available at:

```bash
curl http://127.0.0.1:3000/api/health
```

## Playtest

1. Start either Postgres mode or memory mode from the local development commands above.
2. In memory mode, log in as `host` in one browser/profile and `guest` in another. In Postgres mode, register two users first.
3. Host creates a room from `/lobby`.
4. Guest joins from the public lobby or by the room invite code.
5. Host starts the game.
6. Play with card clicks, Draw, Pass, ONE!, callout buttons, chat, and reactions.

The server owns deck order, legal move validation, hidden hands, timers, bot
takeover, and persisted game snapshots.

## Docker Compose

```bash
docker compose up --build
```

The app service listens on `http://localhost:3000` and uses the `postgres`
service through `DATABASE_URL`. The app container runs `pnpm prisma:deploy`
before starting the custom Node/Socket.IO server.

## Architecture Notes

- Game logic belongs under `src/lib/game` and must stay independent from React,
  Socket.IO, and Prisma.
- Realtime protocol types live under `src/lib/realtime`.
- Socket.IO setup lives under `src/server`.
- Clients send requests only; the server validates and owns game state.
- Personalized game state must be emitted per user so hidden hands are never
  broadcast to the room.
