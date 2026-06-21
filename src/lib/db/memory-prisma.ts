import { randomUUID } from "node:crypto";

import type {
  ChatMessage,
  Game,
  GameEvent,
  GamePlayer,
  GameStatus,
  Prisma,
  Room,
  RoomPlayer,
  RoomStatus,
  RoomVisibility,
  Session,
  User,
} from "@prisma/client";

import { createMemoryPrismaKnownRequestError } from "./errors";

const LOCAL_TEST_USERS: User[] = [
  {
    id: "local_user_host",
    username: "host",
    displayName: "Host",
    passwordHash:
      "$2b$10$eP8pOHVeMrUJCU57VCf0MOjqwc0EaIKv0t3auIuwUuOk1WbZJjz8W",
    createdAt: new Date(0),
    updatedAt: new Date(0),
  },
  {
    id: "local_user_guest",
    username: "guest",
    displayName: "Guest",
    passwordHash:
      "$2b$10$eP8pOHVeMrUJCU57VCf0MOjqwc0EaIKv0t3auIuwUuOk1WbZJjz8W",
    createdAt: new Date(0),
    updatedAt: new Date(0),
  },
];

type SortDirection = "asc" | "desc";
type OrderBy = Record<string, SortDirection>;
type Where = Record<string, unknown>;
type QueryArgs = {
  where?: Where;
  include?: Record<string, unknown>;
  orderBy?: OrderBy;
  take?: number;
};
type UniqueArgs = {
  where: Where;
  include?: Record<string, unknown>;
};
type CreateArgs<TData extends Record<string, unknown>> = {
  data: TData;
};
type UpdateArgs<TData extends Record<string, unknown>> = {
  where: Where;
  data: TData;
};
type DeleteArgs = {
  where: Where;
};
type CreateManyArgs<TData extends Record<string, unknown>> = {
  data: TData[];
};

type MemoryStore = {
  users: User[];
  sessions: Session[];
  rooms: Room[];
  roomPlayers: RoomPlayer[];
  games: Game[];
  gamePlayers: GamePlayer[];
  gameEvents: GameEvent[];
  chatMessages: ChatMessage[];
  counters: Record<string, number>;
};

type MemoryPrismaClient = Record<string, unknown>;

const globalForMemoryPrisma = globalThis as unknown as {
  memoryPrismaStore?: MemoryStore;
  memoryPrismaClient?: MemoryPrismaClient;
};

export function createMemoryPrismaClient() {
  if (globalForMemoryPrisma.memoryPrismaClient) {
    return globalForMemoryPrisma.memoryPrismaClient;
  }

  const store = getMemoryStore();
  const client = buildMemoryPrismaClient(store);
  globalForMemoryPrisma.memoryPrismaClient = client;
  return client;
}

function buildMemoryPrismaClient(store: MemoryStore): MemoryPrismaClient {
  const client: MemoryPrismaClient = {
    $transaction: async <T>(callback: (tx: MemoryPrismaClient) => Promise<T>) => {
      const backup = cloneStore(store);

      try {
        return await callback(client);
      } catch (error) {
        restoreStore(store, backup);
        throw error;
      }
    },
    user: {
      create: async (args: CreateArgs<Record<string, unknown>>) => {
        const username = requireString(args.data.username, "username");
        if (store.users.some((user) => user.username === username)) {
          throw uniqueError("User.username");
        }

        const now = new Date();
        const user: User = {
          id: stringOrGenerated(args.data.id, store, "user"),
          username,
          displayName: requireString(args.data.displayName, "displayName"),
          passwordHash: requireString(args.data.passwordHash, "passwordHash"),
          createdAt: now,
          updatedAt: now,
        };
        store.users.push(user);
        return cloneUser(user);
      },
      findUnique: async (args: UniqueArgs) => {
        const user = findUniqueUser(store, args.where);
        return user ? cloneUser(user) : null;
      },
    },
    session: {
      create: async (args: CreateArgs<Record<string, unknown>>) => {
        const tokenHash = requireString(args.data.tokenHash, "tokenHash");
        if (store.sessions.some((session) => session.tokenHash === tokenHash)) {
          throw uniqueError("Session.tokenHash");
        }

        const session: Session = {
          id: stringOrGenerated(args.data.id, store, "session"),
          userId: requireString(args.data.userId, "userId"),
          tokenHash,
          expiresAt: requireDate(args.data.expiresAt, "expiresAt"),
          createdAt: new Date(),
        };
        store.sessions.push(session);
        return cloneSession(session);
      },
      deleteMany: async (args: { where?: Where }) => {
        const before = store.sessions.length;
        store.sessions = store.sessions.filter(
          (session) => !matchesRecord(store, session, args.where),
        );
        return { count: before - store.sessions.length };
      },
      findUnique: async (args: UniqueArgs) => {
        const session = findUniqueSession(store, args.where);
        return session ? includeSession(store, session, args.include) : null;
      },
      delete: async (args: DeleteArgs) => {
        const index = store.sessions.findIndex((session) => session.id === args.where.id);
        if (index < 0) {
          throw notFoundError("Session");
        }
        const [session] = store.sessions.splice(index, 1);
        return cloneSession(session);
      },
    },
    room: {
      findMany: async (args: QueryArgs = {}) => {
        return applyQuery(store, store.rooms, args).map((room) =>
          includeRoom(store, room, args.include),
        );
      },
      findFirst: async (args: QueryArgs = {}) => {
        const room = applyQuery(store, store.rooms, { ...args, take: 1 })[0];
        return room ? includeRoom(store, room, args.include) : null;
      },
      findUnique: async (args: UniqueArgs) => {
        const room = findUniqueRoom(store, args.where);
        return room ? includeRoom(store, room, args.include) : null;
      },
      create: async (args: CreateArgs<Record<string, unknown>>) => {
        const code = requireString(args.data.code, "code");
        if (store.rooms.some((room) => room.code === code)) {
          throw uniqueError("Room.code");
        }

        const now = new Date();
        const room: Room = {
          id: stringOrGenerated(args.data.id, store, "room"),
          code,
          name: requireString(args.data.name, "name"),
          visibility: requireRoomVisibility(args.data.visibility),
          status: optionalRoomStatus(args.data.status) ?? "WAITING",
          hostUserId: requireString(args.data.hostUserId, "hostUserId"),
          maxPlayers: requireNumber(args.data.maxPlayers, "maxPlayers"),
          ruleConfig: cloneJsonValue(args.data.ruleConfig),
          createdAt: now,
          updatedAt: now,
        };
        store.rooms.push(room);
        return cloneRoom(room);
      },
      update: async (args: UpdateArgs<Record<string, unknown>>) => {
        const room = requireRoomById(store, requireString(args.where.id, "id"));
        assignDefined(room, args.data, [
          "code",
          "name",
          "visibility",
          "status",
          "hostUserId",
          "maxPlayers",
          "ruleConfig",
        ]);
        room.updatedAt = new Date();
        return cloneRoom(room);
      },
      delete: async (args: DeleteArgs) => {
        const roomId = requireString(args.where.id, "id");
        const index = store.rooms.findIndex((room) => room.id === roomId);
        if (index < 0) {
          throw notFoundError("Room");
        }
        const [room] = store.rooms.splice(index, 1);
        cascadeRoomDelete(store, roomId);
        return cloneRoom(room);
      },
    },
    roomPlayer: {
      findMany: async (args: QueryArgs = {}) => {
        return applyQuery(store, store.roomPlayers, args).map((player) =>
          includeRoomPlayer(store, player, args.include),
        );
      },
      findUnique: async (args: UniqueArgs) => {
        const player = findUniqueRoomPlayer(store, args.where);
        return player ? includeRoomPlayer(store, player, args.include) : null;
      },
      create: async (args: CreateArgs<Record<string, unknown>>) => {
        const roomId = requireString(args.data.roomId, "roomId");
        const userId = requireString(args.data.userId, "userId");
        const seatIndex = requireNumber(args.data.seatIndex, "seatIndex");
        assertUniqueRoomPlayer(store, roomId, userId, seatIndex);

        const now = new Date();
        const player: RoomPlayer = {
          id: stringOrGenerated(args.data.id, store, "roomPlayer"),
          roomId,
          userId,
          seatIndex,
          isHost: optionalBoolean(args.data.isHost) ?? false,
          isConnected: optionalBoolean(args.data.isConnected) ?? true,
          controlledByBot: optionalBoolean(args.data.controlledByBot) ?? false,
          joinedAt: now,
          updatedAt: now,
        };
        store.roomPlayers.push(player);
        return cloneRoomPlayer(player);
      },
      update: async (args: UpdateArgs<Record<string, unknown>>) => {
        const player = requireRoomPlayerById(store, requireString(args.where.id, "id"));
        assignDefined(player, args.data, [
          "seatIndex",
          "isHost",
          "isConnected",
          "controlledByBot",
        ]);
        player.updatedAt = new Date();
        return cloneRoomPlayer(player);
      },
      delete: async (args: DeleteArgs) => {
        const id = requireString(args.where.id, "id");
        const index = store.roomPlayers.findIndex((player) => player.id === id);
        if (index < 0) {
          throw notFoundError("RoomPlayer");
        }
        const [player] = store.roomPlayers.splice(index, 1);
        return cloneRoomPlayer(player);
      },
    },
    game: {
      count: async (args: { where?: Where } = {}) => {
        return store.games.filter((game) => matchesRecord(store, game, args.where)).length;
      },
      create: async (args: CreateArgs<Record<string, unknown>>) => {
        const now = new Date();
        const game: Game = {
          id: stringOrGenerated(args.data.id, store, "game"),
          roomId: requireString(args.data.roomId, "roomId"),
          roundNumber: optionalNumber(args.data.roundNumber) ?? 1,
          status: optionalGameStatus(args.data.status) ?? "PLAYING",
          stateSnapshot: cloneJsonValue(args.data.stateSnapshot),
          winnerUserId: optionalString(args.data.winnerUserId) ?? null,
          startedAt: optionalDate(args.data.startedAt) ?? now,
          finishedAt: optionalDate(args.data.finishedAt) ?? null,
          createdAt: now,
          updatedAt: now,
        };
        store.games.push(game);
        return cloneGame(game);
      },
      findFirst: async (args: QueryArgs = {}) => {
        const game = applyQuery(store, store.games, { ...args, take: 1 })[0];
        return game ? cloneGame(game) : null;
      },
      findUnique: async (args: UniqueArgs) => {
        const game = findUniqueGame(store, args.where);
        return game ? cloneGame(game) : null;
      },
      update: async (args: UpdateArgs<Record<string, unknown>>) => {
        const game = requireGameById(store, requireString(args.where.id, "id"));
        assignDefined(game, args.data, [
          "status",
          "stateSnapshot",
          "winnerUserId",
          "finishedAt",
        ]);
        game.updatedAt = new Date();
        return cloneGame(game);
      },
    },
    gamePlayer: {
      createMany: async (args: CreateManyArgs<Record<string, unknown>>) => {
        for (const data of args.data) {
          const gameId = requireString(data.gameId, "gameId");
          const userId = requireString(data.userId, "userId");
          const seatIndex = requireNumber(data.seatIndex, "seatIndex");
          assertUniqueGamePlayer(store, gameId, userId, seatIndex);

          const now = new Date();
          const player: GamePlayer = {
            id: stringOrGenerated(data.id, store, "gamePlayer"),
            gameId,
            userId,
            seatIndex,
            finalPosition: optionalNumber(data.finalPosition) ?? null,
            controlledByBot: optionalBoolean(data.controlledByBot) ?? false,
            createdAt: now,
            updatedAt: now,
          };
          store.gamePlayers.push(player);
        }
        return { count: args.data.length };
      },
    },
    gameEvent: {
      create: async (args: CreateArgs<Record<string, unknown>>) => {
        const event: GameEvent = {
          id: stringOrGenerated(args.data.id, store, "gameEvent"),
          gameId: requireString(args.data.gameId, "gameId"),
          type: requireString(args.data.type, "type"),
          actorUserId: optionalString(args.data.actorUserId) ?? null,
          payload: cloneJsonValue(args.data.payload),
          createdAt: optionalDate(args.data.createdAt) ?? new Date(),
        };
        store.gameEvents.push(event);
        return cloneGameEvent(event);
      },
      findMany: async (args: QueryArgs = {}) => {
        return applyQuery(store, store.gameEvents, args).map(cloneGameEvent);
      },
    },
    chatMessage: {
      create: async (args: CreateArgs<Record<string, unknown>>) => {
        const message: ChatMessage = {
          id: stringOrGenerated(args.data.id, store, "chatMessage"),
          roomId: requireString(args.data.roomId, "roomId"),
          userId: requireString(args.data.userId, "userId"),
          text: requireString(args.data.text, "text"),
          createdAt: optionalDate(args.data.createdAt) ?? new Date(),
        };
        store.chatMessages.push(message);
        return cloneChatMessage(message);
      },
    },
  };

  return client;
}

function getMemoryStore() {
  if (!globalForMemoryPrisma.memoryPrismaStore) {
    globalForMemoryPrisma.memoryPrismaStore = {
      users: LOCAL_TEST_USERS.map(cloneUser),
      sessions: [],
      rooms: [],
      roomPlayers: [],
      games: [],
      gamePlayers: [],
      gameEvents: [],
      chatMessages: [],
      counters: {},
    };
  }

  return globalForMemoryPrisma.memoryPrismaStore;
}

function applyQuery<TRecord extends Record<string, unknown>>(
  store: MemoryStore,
  records: TRecord[],
  args: QueryArgs,
) {
  let result = records.filter((record) => matchesRecord(store, record, args.where));

  const orderBy = args.orderBy;
  if (orderBy) {
    result = [...result].sort((left, right) => compareRecords(left, right, orderBy));
  }

  if (args.take !== undefined) {
    result = result.slice(0, args.take);
  }

  return result;
}

function matchesRecord(
  store: MemoryStore,
  record: Record<string, unknown> | undefined,
  where?: Where,
): boolean {
  if (!where || !record) {
    return true;
  }

  for (const [field, expected] of Object.entries(where)) {
    if (field === "OR") {
      if (!Array.isArray(expected)) {
        return false;
      }
      if (!expected.some((condition) => matchesRecord(store, record, condition as Where))) {
        return false;
      }
      continue;
    }

    if (field === "room") {
      const roomId = record.roomId;
      if (typeof roomId !== "string") {
        return false;
      }
      const room = store.rooms.find((candidate) => candidate.id === roomId);
      if (!matchesRecord(store, room as unknown as Record<string, unknown>, expected as Where)) {
        return false;
      }
      continue;
    }

    const actual = record[field];
    if (isInFilter(expected)) {
      if (!expected.in.includes(actual)) {
        return false;
      }
      continue;
    }

    if (actual !== expected) {
      return false;
    }
  }

  return true;
}

function compareRecords<TRecord extends Record<string, unknown>>(
  left: TRecord,
  right: TRecord,
  orderBy: OrderBy,
) {
  for (const [field, direction] of Object.entries(orderBy)) {
    const leftValue = sortableValue(left[field]);
    const rightValue = sortableValue(right[field]);

    if (leftValue < rightValue) {
      return direction === "asc" ? -1 : 1;
    }
    if (leftValue > rightValue) {
      return direction === "asc" ? 1 : -1;
    }
  }

  return 0;
}

function sortableValue(value: unknown) {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "number" || typeof value === "string") {
    return value;
  }
  return String(value ?? "");
}

function includeSession(
  store: MemoryStore,
  session: Session,
  include: Record<string, unknown> | undefined,
) {
  const result: Record<string, unknown> = cloneSession(session);
  if (include?.user) {
    const user = requireUserById(store, session.userId);
    result.user = cloneUser(user);
  }
  return result;
}

function includeRoom(
  store: MemoryStore,
  room: Room,
  include: Record<string, unknown> | undefined,
) {
  const result: Record<string, unknown> = cloneRoom(room);

  if (include?.players) {
    const playerArgs = typeof include.players === "object" ? (include.players as QueryArgs) : {};
    result.players = applyQuery(
      store,
      store.roomPlayers.filter((player) => player.roomId === room.id),
      playerArgs,
    ).map((player) => includeRoomPlayer(store, player, playerArgs.include));
  }

  if (include?.games) {
    const gameArgs = typeof include.games === "object" ? (include.games as QueryArgs) : {};
    result.games = applyQuery(
      store,
      store.games.filter((game) => game.roomId === room.id),
      gameArgs,
    ).map(cloneGame);
  }

  return result;
}

function includeRoomPlayer(
  store: MemoryStore,
  player: RoomPlayer,
  include: Record<string, unknown> | undefined,
) {
  const result: Record<string, unknown> = cloneRoomPlayer(player);

  if (include?.user) {
    result.user = cloneUser(requireUserById(store, player.userId));
  }

  if (include?.room) {
    result.room = cloneRoom(requireRoomById(store, player.roomId));
  }

  return result;
}

function findUniqueUser(store: MemoryStore, where: Where) {
  if (typeof where.id === "string") {
    return store.users.find((user) => user.id === where.id);
  }
  if (typeof where.username === "string") {
    return store.users.find((user) => user.username === where.username);
  }
  return undefined;
}

function findUniqueSession(store: MemoryStore, where: Where) {
  if (typeof where.id === "string") {
    return store.sessions.find((session) => session.id === where.id);
  }
  if (typeof where.tokenHash === "string") {
    return store.sessions.find((session) => session.tokenHash === where.tokenHash);
  }
  return undefined;
}

function findUniqueRoom(store: MemoryStore, where: Where) {
  if (typeof where.id === "string") {
    return store.rooms.find((room) => room.id === where.id);
  }
  if (typeof where.code === "string") {
    return store.rooms.find((room) => room.code === where.code);
  }
  return undefined;
}

function findUniqueRoomPlayer(store: MemoryStore, where: Where) {
  if (typeof where.id === "string") {
    return store.roomPlayers.find((player) => player.id === where.id);
  }

  const roomUserKey = where.roomId_userId;
  if (isCompoundRoomPlayerKey(roomUserKey)) {
    return store.roomPlayers.find(
      (player) =>
        player.roomId === roomUserKey.roomId &&
        player.userId === roomUserKey.userId,
    );
  }

  return undefined;
}

function findUniqueGame(store: MemoryStore, where: Where) {
  if (typeof where.id === "string") {
    return store.games.find((game) => game.id === where.id);
  }
  return undefined;
}

function requireUserById(store: MemoryStore, id: string) {
  const user = store.users.find((candidate) => candidate.id === id);
  if (!user) {
    throw notFoundError("User");
  }
  return user;
}

function requireRoomById(store: MemoryStore, id: string) {
  const room = store.rooms.find((candidate) => candidate.id === id);
  if (!room) {
    throw notFoundError("Room");
  }
  return room;
}

function requireRoomPlayerById(store: MemoryStore, id: string) {
  const player = store.roomPlayers.find((candidate) => candidate.id === id);
  if (!player) {
    throw notFoundError("RoomPlayer");
  }
  return player;
}

function requireGameById(store: MemoryStore, id: string) {
  const game = store.games.find((candidate) => candidate.id === id);
  if (!game) {
    throw notFoundError("Game");
  }
  return game;
}

function assertUniqueRoomPlayer(
  store: MemoryStore,
  roomId: string,
  userId: string,
  seatIndex: number,
) {
  if (
    store.roomPlayers.some(
      (player) => player.roomId === roomId && player.userId === userId,
    )
  ) {
    throw uniqueError("RoomPlayer.roomId_userId");
  }
  if (
    store.roomPlayers.some(
      (player) => player.roomId === roomId && player.seatIndex === seatIndex,
    )
  ) {
    throw uniqueError("RoomPlayer.roomId_seatIndex");
  }
}

function assertUniqueGamePlayer(
  store: MemoryStore,
  gameId: string,
  userId: string,
  seatIndex: number,
) {
  if (
    store.gamePlayers.some(
      (player) => player.gameId === gameId && player.userId === userId,
    )
  ) {
    throw uniqueError("GamePlayer.gameId_userId");
  }
  if (
    store.gamePlayers.some(
      (player) => player.gameId === gameId && player.seatIndex === seatIndex,
    )
  ) {
    throw uniqueError("GamePlayer.gameId_seatIndex");
  }
}

function cascadeRoomDelete(store: MemoryStore, roomId: string) {
  const gameIds = store.games
    .filter((game) => game.roomId === roomId)
    .map((game) => game.id);
  store.roomPlayers = store.roomPlayers.filter((player) => player.roomId !== roomId);
  store.chatMessages = store.chatMessages.filter((message) => message.roomId !== roomId);
  store.games = store.games.filter((game) => game.roomId !== roomId);
  store.gamePlayers = store.gamePlayers.filter(
    (player) => !gameIds.includes(player.gameId),
  );
  store.gameEvents = store.gameEvents.filter((event) => !gameIds.includes(event.gameId));
}

function assignDefined(
  target: Record<string, unknown>,
  data: Record<string, unknown>,
  keys: string[],
) {
  for (const key of keys) {
    if (data[key] !== undefined) {
      target[key] = key === "ruleConfig" || key === "stateSnapshot"
        ? cloneJsonValue(data[key])
        : data[key];
    }
  }
}

function stringOrGenerated(value: unknown, store: MemoryStore, prefix: string) {
  return typeof value === "string" ? value : createId(store, prefix);
}

function createId(store: MemoryStore, prefix: string) {
  const next = (store.counters[prefix] ?? 0) + 1;
  store.counters[prefix] = next;
  return `${prefix}_${next.toString(36)}_${randomUUID().slice(0, 8)}`;
}

function requireString(value: unknown, field: string) {
  if (typeof value !== "string") {
    throw new TypeError(`Expected ${field} to be a string.`);
  }
  return value;
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function requireNumber(value: unknown, field: string) {
  if (typeof value !== "number") {
    throw new TypeError(`Expected ${field} to be a number.`);
  }
  return value;
}

function optionalNumber(value: unknown) {
  return typeof value === "number" ? value : undefined;
}

function optionalBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function requireDate(value: unknown, field: string) {
  if (!(value instanceof Date)) {
    throw new TypeError(`Expected ${field} to be a Date.`);
  }
  return value;
}

function optionalDate(value: unknown) {
  return value instanceof Date ? value : undefined;
}

function requireRoomVisibility(value: unknown): RoomVisibility {
  if (value === "PUBLIC" || value === "PRIVATE") {
    return value;
  }
  throw new TypeError("Expected visibility to be PUBLIC or PRIVATE.");
}

function optionalRoomStatus(value: unknown): RoomStatus | undefined {
  if (
    value === "WAITING" ||
    value === "IN_GAME" ||
    value === "FINISHED" ||
    value === "ABANDONED"
  ) {
    return value;
  }
  return undefined;
}

function optionalGameStatus(value: unknown): GameStatus | undefined {
  if (value === "PLAYING" || value === "ROUND_FINISHED" || value === "ABANDONED") {
    return value;
  }
  return undefined;
}

function isInFilter(value: unknown): value is { in: unknown[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    "in" in value &&
    Array.isArray((value as { in?: unknown }).in)
  );
}

function isCompoundRoomPlayerKey(
  value: unknown,
): value is { roomId: string; userId: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { roomId?: unknown }).roomId === "string" &&
    typeof (value as { userId?: unknown }).userId === "string"
  );
}

function cloneJsonValue(value: unknown): Prisma.JsonValue {
  return structuredClone(value ?? null) as Prisma.JsonValue;
}

function cloneUser(user: User): User {
  return {
    ...user,
    createdAt: new Date(user.createdAt),
    updatedAt: new Date(user.updatedAt),
  };
}

function cloneSession(session: Session): Session {
  return {
    ...session,
    expiresAt: new Date(session.expiresAt),
    createdAt: new Date(session.createdAt),
  };
}

function cloneRoom(room: Room): Room {
  return {
    ...room,
    ruleConfig: cloneJsonValue(room.ruleConfig),
    createdAt: new Date(room.createdAt),
    updatedAt: new Date(room.updatedAt),
  };
}

function cloneRoomPlayer(player: RoomPlayer): RoomPlayer {
  return {
    ...player,
    joinedAt: new Date(player.joinedAt),
    updatedAt: new Date(player.updatedAt),
  };
}

function cloneGame(game: Game): Game {
  return {
    ...game,
    stateSnapshot: cloneJsonValue(game.stateSnapshot),
    startedAt: new Date(game.startedAt),
    finishedAt: game.finishedAt ? new Date(game.finishedAt) : null,
    createdAt: new Date(game.createdAt),
    updatedAt: new Date(game.updatedAt),
  };
}

function cloneGamePlayer(player: GamePlayer): GamePlayer {
  return {
    ...player,
    createdAt: new Date(player.createdAt),
    updatedAt: new Date(player.updatedAt),
  };
}

function cloneGameEvent(event: GameEvent): GameEvent {
  return {
    ...event,
    payload: cloneJsonValue(event.payload),
    createdAt: new Date(event.createdAt),
  };
}

function cloneChatMessage(message: ChatMessage): ChatMessage {
  return {
    ...message,
    createdAt: new Date(message.createdAt),
  };
}

function cloneStore(store: MemoryStore): MemoryStore {
  return {
    users: store.users.map(cloneUser),
    sessions: store.sessions.map(cloneSession),
    rooms: store.rooms.map(cloneRoom),
    roomPlayers: store.roomPlayers.map(cloneRoomPlayer),
    games: store.games.map(cloneGame),
    gamePlayers: store.gamePlayers.map(cloneGamePlayer),
    gameEvents: store.gameEvents.map(cloneGameEvent),
    chatMessages: store.chatMessages.map(cloneChatMessage),
    counters: { ...store.counters },
  };
}

function restoreStore(target: MemoryStore, source: MemoryStore) {
  target.users = source.users;
  target.sessions = source.sessions;
  target.rooms = source.rooms;
  target.roomPlayers = source.roomPlayers;
  target.games = source.games;
  target.gamePlayers = source.gamePlayers;
  target.gameEvents = source.gameEvents;
  target.chatMessages = source.chatMessages;
  target.counters = source.counters;
}

function uniqueError(target: string) {
  return createMemoryPrismaKnownRequestError(
    "P2002",
    `Unique constraint failed on ${target}.`,
  );
}

function notFoundError(model: string) {
  return createMemoryPrismaKnownRequestError(
    "P2025",
    `${model} record was not found.`,
  );
}
