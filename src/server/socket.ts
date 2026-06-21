import type { Server as HttpServer } from "node:http";

import { Prisma, type Game, type Room, type RoomPlayer, type User } from "@prisma/client";
import { Server, type Socket } from "socket.io";
import { z } from "zod";

import {
  ALLOWED_REACTIONS,
  CLIENT_EVENTS,
  SERVER_EVENTS,
  type AuthenticatedSocketUser,
  type ClientToServerEvents,
  type GameEventPayload,
  type GameStatePayload,
  type InterServerEvents,
  type RoomStatePayload,
  type ServerToClientEvents,
  type SocketData,
  type SocketErrorCode,
} from "../lib/realtime/events";
import {
  CLASSIC_RULE_CONFIG,
  GameRuleError,
  applyGameAction,
  chooseBotAction,
  createInitialGameState,
  createVisibleGameState,
  updatePlayerConnection,
  type EngineAction,
  type EngineEvent,
  type GameStateSnapshot,
} from "../lib/game";
import { hashSessionToken, SESSION_COOKIE_NAME } from "../lib/auth/session-token";
import { prisma } from "../lib/db/prisma";

type OneServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

type OneSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

type RoomWithPlayers = Room & {
  players: Array<RoomPlayer & { user: User }>;
};

const timers = new Map<string, NodeJS.Timeout>();
const rateLimits = new Map<string, number>();
const roomJoinSchema = z.object({ roomId: z.string().min(1) });
const roomStartSchema = z.object({ roomId: z.string().min(1) });
const gameBaseSchema = z.object({
  roomId: z.string().min(1),
  gameId: z.string().min(1),
});
const playCardSchema = gameBaseSchema.extend({
  cardId: z.string().min(1),
  declaredColor: z.enum(["RED", "BLUE", "GREEN", "YELLOW"]).optional(),
});
const calloutSchema = gameBaseSchema.extend({
  targetPlayerId: z.string().min(1),
});
const chatSchema = z.object({
  roomId: z.string().min(1),
  text: z.string().trim().min(1).max(500),
});
const reactionSchema = z.object({
  roomId: z.string().min(1),
  reaction: z.enum(ALLOWED_REACTIONS),
});

export function createSocketServer(httpServer: HttpServer) {
  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: {
      origin: process.env.SOCKET_CORS_ORIGIN,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    const user = await getUserFromSocketSession(socket);

    if (!user) {
      return next(new Error("UNAUTHORIZED"));
    }

    socket.data.user = user;
    void socket.join(`user:${user.id}`);
    return next();
  });

  io.on("connection", (socket) => {
    registerHandlers(io, socket);
  });

  return io;
}

function registerHandlers(io: OneServer, socket: OneSocket) {
  socket.on(CLIENT_EVENTS.ROOM_JOIN, (payload) => {
    void handleRoomJoin(io, socket, payload);
  });

  socket.on(CLIENT_EVENTS.ROOM_LEAVE, (payload) => {
    void handleRoomLeave(io, socket, payload);
  });

  socket.on(CLIENT_EVENTS.ROOM_START, (payload) => {
    void handleRoomStart(io, socket, payload);
  });

  socket.on(CLIENT_EVENTS.GAME_PLAY_CARD, (payload) => {
    void handleGameAction(
      io,
      socket,
      payload,
      playCardSchema,
      (parsed, playerId) => ({
        type: "PLAY_CARD",
        playerId,
        cardId: parsed.cardId,
        declaredColor: parsed.declaredColor,
      }),
    );
  });

  socket.on(CLIENT_EVENTS.GAME_DRAW, (payload) => {
    void handleGameAction(
      io,
      socket,
      payload,
      gameBaseSchema,
      (_parsed, playerId) => ({
        type: "DRAW_CARD",
        playerId,
      }),
    );
  });

  socket.on(CLIENT_EVENTS.GAME_PASS, (payload) => {
    void handleGameAction(
      io,
      socket,
      payload,
      gameBaseSchema,
      (_parsed, playerId) => ({
        type: "PASS",
        playerId,
      }),
    );
  });

  socket.on(CLIENT_EVENTS.GAME_DECLARE_ONE, (payload) => {
    void handleGameAction(
      io,
      socket,
      payload,
      gameBaseSchema,
      (_parsed, playerId) => ({
        type: "DECLARE_ONE",
        playerId,
      }),
    );
  });

  socket.on(CLIENT_EVENTS.GAME_CALLOUT_ONE, (payload) => {
    void handleGameAction(
      io,
      socket,
      payload,
      calloutSchema,
      (parsed, playerId) => ({
        type: "CALLOUT_ONE",
        playerId,
        targetPlayerId: parsed.targetPlayerId,
      }),
    );
  });

  socket.on(CLIENT_EVENTS.CHAT_SEND, (payload) => {
    void handleChat(io, socket, payload);
  });

  socket.on(CLIENT_EVENTS.REACTION_SEND, (payload) => {
    void handleReaction(io, socket, payload);
  });

  socket.on("disconnect", () => {
    void handleDisconnect(io, socket);
  });

  void restoreSocketRooms(io, socket);
}

async function restoreSocketRooms(io: OneServer, socket: OneSocket) {
  const user = requireSocketUser(socket);
  const memberships = await prisma.roomPlayer.findMany({
    where: {
      userId: user.id,
      room: {
        status: { in: ["WAITING", "IN_GAME"] },
      },
    },
    include: {
      room: true,
    },
  });

  for (const membership of memberships) {
    await socket.join(`room:${membership.roomId}`);

    if (!membership.isConnected || membership.controlledByBot) {
      await prisma.roomPlayer.update({
        where: { id: membership.id },
        data: { isConnected: true, controlledByBot: false },
      });
    }

    const activeGame = await prisma.game.findFirst({
      where: {
        roomId: membership.roomId,
        status: "PLAYING",
      },
      orderBy: { startedAt: "desc" },
    });

    if (activeGame) {
      const state = parseGameState(activeGame.stateSnapshot);
      const player = state.players.find((candidate) => candidate.userId === user.id);

      if (player) {
        const updatedState = updatePlayerConnection(
          state,
          player.id,
          true,
          false,
        );
        await prisma.game.update({
          where: { id: activeGame.id },
          data: { stateSnapshot: updatedState as unknown as Prisma.InputJsonValue },
        });
        const event = await prisma.gameEvent.create({
          data: {
            gameId: activeGame.id,
            type: "PLAYER_RECONNECTED",
            actorUserId: user.id,
            payload: {},
          },
        });
        io.to(`room:${membership.roomId}`).emit(
          SERVER_EVENTS.GAME_EVENT,
          toGameEventPayload(event),
        );
        await emitGameState(io, membership.roomId, activeGame.id, updatedState);
      }
    }

    const room = await loadRoomWithPlayers(membership.roomId);
    io.to(`room:${membership.roomId}`).emit(
      SERVER_EVENTS.ROOM_STATE,
      toRoomStatePayload(room),
    );
    io.to(`room:${membership.roomId}`).emit(SERVER_EVENTS.PRESENCE_UPDATE, {
      roomId: membership.roomId,
      userId: user.id,
      isConnected: true,
      controlledByBot: false,
    });
  }
}

async function handleRoomJoin(
  io: OneServer,
  socket: OneSocket,
  payload: unknown,
) {
  const user = requireSocketUser(socket);
  const parsed = roomJoinSchema.safeParse(payload);

  if (!parsed.success) {
    emitSocketError(socket, "INVALID_PAYLOAD", "Invalid room join payload.");
    return;
  }

  const room = await prisma.room.findFirst({
    where: {
      OR: [{ id: parsed.data.roomId }, { code: parsed.data.roomId.toUpperCase() }],
    },
    include: {
      players: {
        include: { user: true },
        orderBy: { seatIndex: "asc" },
      },
    },
  });

  if (!room) {
    emitSocketError(socket, "NOT_FOUND", "Room not found.");
    return;
  }

  const member = room.players.find((player) => player.userId === user.id);
  if (!member && room.status !== "WAITING") {
    emitSocketError(socket, "ROOM_ALREADY_STARTED", "Room has already started.");
    return;
  }

  if (!member && room.players.length >= room.maxPlayers) {
    emitSocketError(socket, "ROOM_FULL", "Room is full.");
    return;
  }

  if (!member) {
    const usedSeats = new Set(room.players.map((player) => player.seatIndex));
    const seatIndex = Array.from({ length: room.maxPlayers }, (_, index) => index)
      .find((index) => !usedSeats.has(index));

    if (seatIndex === undefined) {
      emitSocketError(socket, "ROOM_FULL", "Room is full.");
      return;
    }

    await prisma.roomPlayer.create({
      data: {
        roomId: room.id,
        userId: user.id,
        seatIndex,
      },
    });
  } else {
    await prisma.roomPlayer.update({
      where: { id: member.id },
      data: { isConnected: true, controlledByBot: false },
    });
  }

  await socket.join(`room:${room.id}`);
  const freshRoom = await loadRoomWithPlayers(room.id);
  io.to(`room:${room.id}`).emit(SERVER_EVENTS.ROOM_STATE, toRoomStatePayload(freshRoom));
  await emitActiveGameState(io, freshRoom.id);
}

async function handleRoomLeave(
  io: OneServer,
  socket: OneSocket,
  payload: unknown,
) {
  const user = requireSocketUser(socket);
  const parsed = roomJoinSchema.safeParse(payload);

  if (!parsed.success) {
    emitSocketError(socket, "INVALID_PAYLOAD", "Invalid room leave payload.");
    return;
  }

  const membership = await prisma.roomPlayer.findUnique({
    where: {
      roomId_userId: {
        roomId: parsed.data.roomId,
        userId: user.id,
      },
    },
    include: { room: true },
  });

  if (!membership) {
    emitSocketError(socket, "NOT_ROOM_MEMBER", "You are not in this room.");
    return;
  }

  await socket.leave(`room:${membership.roomId}`);

  if (membership.room.status === "WAITING") {
    await prisma.roomPlayer.delete({ where: { id: membership.id } });
    await assignHostIfNeeded(membership.roomId);
  } else {
    await prisma.roomPlayer.update({
      where: { id: membership.id },
      data: { isConnected: false, controlledByBot: true },
    });
  }

  const room = await loadRoomWithPlayers(membership.roomId);
  io.to(`room:${room.id}`).emit(SERVER_EVENTS.ROOM_STATE, toRoomStatePayload(room));
}

async function handleRoomStart(
  io: OneServer,
  socket: OneSocket,
  payload: unknown,
) {
  const user = requireSocketUser(socket);
  const parsed = roomStartSchema.safeParse(payload);

  if (!parsed.success) {
    emitSocketError(socket, "INVALID_PAYLOAD", "Invalid room start payload.");
    return;
  }

  const room = await loadRoomWithPlayers(parsed.data.roomId);
  const host = room.players.find((player) => player.userId === user.id && player.isHost);

  if (!host) {
    emitSocketError(socket, "NOT_HOST", "Only the host can start the room.");
    return;
  }

  if (room.players.length < 2) {
    emitSocketError(socket, "INVALID_MOVE", "At least two players are required.");
    return;
  }

  if (room.status !== "WAITING" && room.status !== "FINISHED") {
    emitSocketError(socket, "ROOM_ALREADY_STARTED", "Room has already started.");
    return;
  }

  const now = new Date().toISOString();
  const roundNumber = await prisma.game.count({ where: { roomId: room.id } });
  const state = createInitialGameState({
    id: crypto.randomUUID(),
    roomId: room.id,
    seed: `${room.id}:${Date.now()}`,
    now,
    ruleConfig: normalizeRuleConfig(room.ruleConfig, room.maxPlayers),
    players: room.players.map((player) => ({
      id: player.id,
      userId: player.userId,
      displayName: player.user.displayName,
      seatIndex: player.seatIndex,
      isConnected: player.isConnected,
      controlledByBot: player.controlledByBot,
    })),
  });

  const game = await prisma.$transaction(async (tx) => {
    const createdGame = await tx.game.create({
      data: {
        id: state.id,
        roomId: room.id,
        roundNumber: roundNumber + 1,
        stateSnapshot: state as unknown as Prisma.InputJsonValue,
      },
    });

    await tx.gamePlayer.createMany({
      data: state.players.map((player) => ({
        gameId: createdGame.id,
        userId: player.userId,
        seatIndex: player.seatIndex,
        controlledByBot: player.controlledByBot,
      })),
    });

    await tx.room.update({
      where: { id: room.id },
      data: { status: "IN_GAME" },
    });

    await tx.gameEvent.create({
      data: {
        gameId: createdGame.id,
        type: "GAME_STARTED",
        actorUserId: user.id,
        payload: { playerCount: state.players.length },
      },
    });

    return createdGame;
  });

  const freshRoom = await loadRoomWithPlayers(room.id);
  io.to(`room:${room.id}`).emit(SERVER_EVENTS.ROOM_STATE, toRoomStatePayload(freshRoom));
  io.to(`room:${room.id}`).emit(SERVER_EVENTS.GAME_EVENT, {
    id: `${game.id}:started`,
    gameId: game.id,
    type: "GAME_STARTED",
    actorUserId: user.id,
    actorDisplayName: user.displayName,
    payload: { playerCount: state.players.length },
    createdAt: now,
  });
  await emitGameState(io, freshRoom.id, game.id, state);
  scheduleTurnTimer(io, game.id);
  void maybeRunBotTurn(io, game.id);
}

async function handleGameAction<TPayload>(
  io: OneServer,
  socket: OneSocket,
  payload: unknown,
  schema: z.ZodType<TPayload>,
  createAction: (payload: TPayload, playerId: string) => EngineAction,
) {
  const user = requireSocketUser(socket);
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    emitSocketError(socket, "INVALID_PAYLOAD", "Invalid game payload.");
    return;
  }

  try {
    const data = parsed.data as TPayload & { roomId: string; gameId: string };
    const game = await loadActiveGame(data.roomId, data.gameId);
    const state = parseGameState(game.stateSnapshot);
    const player = state.players.find((candidate) => candidate.userId === user.id);

    if (!player) {
      emitSocketError(socket, "NOT_ROOM_MEMBER", "You are not in this game.");
      return;
    }

    const action = createAction(data, player.id);
    const result = applyGameAction(state, {
      ...action,
      now: new Date().toISOString(),
    } as EngineAction);

    await persistEngineResult(game, result.state, result.event);
    emitPublicEngineEvent(io, data.roomId, result.event);
    await emitGameState(io, data.roomId, game.id, result.state);
    scheduleTurnTimer(io, game.id);
    void maybeRunBotTurn(io, game.id);
  } catch (error) {
    handleGameError(socket, error);
  }
}

async function handleChat(io: OneServer, socket: OneSocket, payload: unknown) {
  const user = requireSocketUser(socket);
  const parsed = chatSchema.safeParse(payload);

  if (!parsed.success) {
    emitSocketError(socket, "INVALID_PAYLOAD", "Invalid chat payload.");
    return;
  }

  if (!checkRateLimit(`chat:${user.id}:${parsed.data.roomId}`, 800)) {
    emitSocketError(socket, "RATE_LIMITED", "Slow down before sending more chat.");
    return;
  }

  const membership = await prisma.roomPlayer.findUnique({
    where: {
      roomId_userId: {
        roomId: parsed.data.roomId,
        userId: user.id,
      },
    },
  });

  if (!membership) {
    emitSocketError(socket, "NOT_ROOM_MEMBER", "You are not in this room.");
    return;
  }

  const message = await prisma.chatMessage.create({
    data: {
      roomId: parsed.data.roomId,
      userId: user.id,
      text: parsed.data.text,
    },
  });

  io.to(`room:${parsed.data.roomId}`).emit(SERVER_EVENTS.CHAT_MESSAGE, {
    id: message.id,
    roomId: message.roomId,
    userId: user.id,
    displayName: user.displayName,
    text: message.text,
    createdAt: message.createdAt.toISOString(),
  });
}

async function handleReaction(
  io: OneServer,
  socket: OneSocket,
  payload: unknown,
) {
  const user = requireSocketUser(socket);
  const parsed = reactionSchema.safeParse(payload);

  if (!parsed.success) {
    emitSocketError(socket, "INVALID_PAYLOAD", "Invalid reaction payload.");
    return;
  }

  if (!checkRateLimit(`reaction:${user.id}:${parsed.data.roomId}`, 500)) {
    emitSocketError(socket, "RATE_LIMITED", "Slow down before sending more reactions.");
    return;
  }

  const membership = await prisma.roomPlayer.findUnique({
    where: {
      roomId_userId: {
        roomId: parsed.data.roomId,
        userId: user.id,
      },
    },
  });

  if (!membership) {
    emitSocketError(socket, "NOT_ROOM_MEMBER", "You are not in this room.");
    return;
  }

  io.to(`room:${parsed.data.roomId}`).emit(SERVER_EVENTS.REACTION_SHOW, {
    roomId: parsed.data.roomId,
    userId: user.id,
    displayName: user.displayName,
    reaction: parsed.data.reaction,
    createdAt: new Date().toISOString(),
  });
}

async function handleDisconnect(io: OneServer, socket: OneSocket) {
  const user = socket.data.user;

  if (!user) {
    return;
  }

  const memberships = await prisma.roomPlayer.findMany({
    where: {
      userId: user.id,
      room: {
        status: "IN_GAME",
      },
    },
  });

  for (const membership of memberships) {
    await prisma.roomPlayer.update({
      where: { id: membership.id },
      data: {
        isConnected: false,
        controlledByBot: true,
      },
    });

    const activeGame = await prisma.game.findFirst({
      where: {
        roomId: membership.roomId,
        status: "PLAYING",
      },
      orderBy: { startedAt: "desc" },
    });

    if (activeGame) {
      const state = parseGameState(activeGame.stateSnapshot);
      const player = state.players.find((candidate) => candidate.userId === user.id);

      if (player) {
        const updatedState = updatePlayerConnection(
          state,
          player.id,
          false,
          true,
        );
        await prisma.game.update({
          where: { id: activeGame.id },
          data: { stateSnapshot: updatedState as unknown as Prisma.InputJsonValue },
        });
        const event = await prisma.gameEvent.create({
          data: {
            gameId: activeGame.id,
            type: "PLAYER_DISCONNECTED",
            actorUserId: user.id,
            payload: {},
          },
        });
        io.to(`room:${membership.roomId}`).emit(
          SERVER_EVENTS.GAME_EVENT,
          toGameEventPayload(event),
        );
        await emitGameState(io, membership.roomId, activeGame.id, updatedState);
        void maybeRunBotTurn(io, activeGame.id);
      }
    }

    io.to(`room:${membership.roomId}`).emit(SERVER_EVENTS.PRESENCE_UPDATE, {
      roomId: membership.roomId,
      userId: user.id,
      isConnected: false,
      controlledByBot: true,
    });
  }
}

async function getUserFromSocketSession(
  socket: OneSocket,
): Promise<AuthenticatedSocketUser | null> {
  const cookieHeader = socket.handshake.headers.cookie;
  const cookies = parseCookieHeader(cookieHeader);
  const sessionToken = cookies[SESSION_COOKIE_NAME];

  if (sessionToken) {
    const session = await prisma.session.findUnique({
      where: { tokenHash: hashSessionToken(sessionToken) },
      include: { user: true },
    });

    if (session && session.expiresAt > new Date()) {
      return {
        id: session.user.id,
        displayName: session.user.displayName,
      };
    }
  }

  if (process.env.NODE_ENV !== "production" && process.env.DEV_SOCKET_USER_ID) {
    return {
      id: process.env.DEV_SOCKET_USER_ID,
      displayName: process.env.DEV_SOCKET_DISPLAY_NAME || "Developer",
    };
  }

  return null;
}

async function maybeRunBotTurn(io: OneServer, gameId: string) {
  const game = await prisma.game.findUnique({ where: { id: gameId } });

  if (!game || game.status !== "PLAYING") {
    return;
  }

  const state = parseGameState(game.stateSnapshot);
  const currentPlayer = state.players[state.currentPlayerIndex];

  if (!currentPlayer?.controlledByBot) {
    return;
  }

  setTimeout(() => {
    void (async () => {
      const freshGame = await prisma.game.findUnique({ where: { id: gameId } });
      if (!freshGame || freshGame.status !== "PLAYING") {
        return;
      }
      const freshState = parseGameState(freshGame.stateSnapshot);
      const freshPlayer = freshState.players[freshState.currentPlayerIndex];
      if (!freshPlayer?.controlledByBot) {
        return;
      }

      try {
        const action = {
          ...chooseBotAction(freshState),
          now: new Date().toISOString(),
        } as EngineAction;
        const result = applyGameAction(freshState, action);
        await persistEngineResult(freshGame, result.state, result.event);
        emitPublicEngineEvent(io, freshState.roomId, result.event);
        await emitGameState(io, freshState.roomId, gameId, result.state);
        scheduleTurnTimer(io, gameId);
        void maybeRunBotTurn(io, gameId);
      } catch {
        // Bot failures should not crash the socket server.
      }
    })();
  }, 600);
}

function scheduleTurnTimer(io: OneServer, gameId: string) {
  const existing = timers.get(gameId);
  if (existing) {
    clearTimeout(existing);
  }

  const timer = setTimeout(() => {
    void (async () => {
      const game = await prisma.game.findUnique({ where: { id: gameId } });
      if (!game || game.status !== "PLAYING") {
        return;
      }

      const state = parseGameState(game.stateSnapshot);
      if (state.status !== "PLAYING" || Date.parse(state.turnEndsAt) > Date.now()) {
        scheduleTurnTimer(io, gameId);
        return;
      }

      const result = applyGameAction(state, {
        type: "TIMEOUT_AUTO_PASS",
        now: new Date().toISOString(),
      });
      await persistEngineResult(game, result.state, result.event);
      emitPublicEngineEvent(io, state.roomId, result.event);
      await emitGameState(io, state.roomId, gameId, result.state);
      scheduleTurnTimer(io, gameId);
      void maybeRunBotTurn(io, gameId);
    })();
  }, 10_000);

  timers.set(gameId, timer);
}

async function emitActiveGameState(io: OneServer, roomId: string) {
  const activeGame = await prisma.game.findFirst({
    where: {
      roomId,
      status: "PLAYING",
    },
    orderBy: { startedAt: "desc" },
  });

  if (!activeGame) {
    return;
  }

  await emitGameState(io, roomId, activeGame.id, parseGameState(activeGame.stateSnapshot));
}

async function emitGameState(
  io: OneServer,
  roomId: string,
  gameId: string,
  state: GameStateSnapshot,
) {
  const events = await prisma.gameEvent.findMany({
    where: { gameId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const lastEvents = events.reverse().map(toGameEventPayload);

  for (const player of state.players) {
    io.to(`user:${player.userId}`).emit(
      SERVER_EVENTS.GAME_STATE,
      createVisibleGameState(state, player.id, lastEvents) as GameStatePayload,
    );
  }

  const room = await loadRoomWithPlayers(roomId);
  io.to(`room:${roomId}`).emit(SERVER_EVENTS.ROOM_STATE, toRoomStatePayload(room));
}

async function persistEngineResult(
  game: Game,
  state: GameStateSnapshot,
  event: EngineEvent,
) {
  await prisma.$transaction(async (tx) => {
    await tx.game.update({
      where: { id: game.id },
      data: {
        status: state.status === "ROUND_FINISHED" ? "ROUND_FINISHED" : "PLAYING",
        stateSnapshot: state as unknown as Prisma.InputJsonValue,
        winnerUserId:
          state.status === "ROUND_FINISHED"
            ? state.players.find((player) => player.id === state.winnerPlayerId)?.userId
            : undefined,
        finishedAt: state.status === "ROUND_FINISHED" ? new Date() : undefined,
      },
    });

    if (state.status === "ROUND_FINISHED") {
      await tx.room.update({
        where: { id: game.roomId },
        data: { status: "FINISHED" },
      });
    }

    await tx.gameEvent.create({
      data: {
        gameId: game.id,
        type: event.type,
        actorUserId: event.actorUserId,
        payload: event.payload as Prisma.InputJsonValue,
        createdAt: new Date(event.createdAt),
      },
    });
  });
}

function emitPublicEngineEvent(
  io: OneServer,
  roomId: string,
  event: EngineEvent,
) {
  io.to(`room:${roomId}`).emit(SERVER_EVENTS.GAME_EVENT, event);
}

function parseGameState(value: Prisma.JsonValue): GameStateSnapshot {
  return value as unknown as GameStateSnapshot;
}

async function loadRoomWithPlayers(roomId: string): Promise<RoomWithPlayers> {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      players: {
        include: { user: true },
        orderBy: { seatIndex: "asc" },
      },
    },
  });

  if (!room) {
    throw new Error(`Room not found: ${roomId}`);
  }

  return room;
}

async function loadActiveGame(roomId: string, gameId: string) {
  const game = await prisma.game.findFirst({
    where: {
      id: gameId,
      roomId,
      status: "PLAYING",
    },
  });

  if (!game) {
    throw new GameRuleError("Game is not active.");
  }

  return game;
}

function toRoomStatePayload(room: RoomWithPlayers): RoomStatePayload {
  return {
    room: {
      id: room.id,
      code: room.code,
      name: room.name,
      visibility: room.visibility,
      status: room.status === "ABANDONED" ? "FINISHED" : room.status,
      hostUserId: room.hostUserId,
      maxPlayers: room.maxPlayers,
      ruleConfig: normalizeRuleConfig(room.ruleConfig, room.maxPlayers),
    },
    players: room.players.map((player) => ({
      userId: player.userId,
      displayName: player.user.displayName,
      seatIndex: player.seatIndex,
      isHost: player.isHost,
      isConnected: player.isConnected,
      controlledByBot: player.controlledByBot,
    })),
  };
}

function toGameEventPayload(event: {
  id: string;
  gameId: string;
  type: string;
  actorUserId: string | null;
  payload: Prisma.JsonValue;
  createdAt: Date;
}): GameEventPayload {
  return {
    id: event.id,
    gameId: event.gameId,
    type: event.type as GameEventPayload["type"],
    actorUserId: event.actorUserId ?? undefined,
    payload:
      typeof event.payload === "object" && event.payload !== null
        ? (event.payload as Record<string, unknown>)
        : {},
    createdAt: event.createdAt.toISOString(),
  };
}

function checkRateLimit(key: string, windowMs: number) {
  const now = Date.now();
  const previous = rateLimits.get(key) ?? 0;

  if (now - previous < windowMs) {
    return false;
  }

  rateLimits.set(key, now);
  return true;
}

function normalizeRuleConfig(value: Prisma.JsonValue, maxPlayers: number) {
  if (typeof value === "object" && value !== null) {
    return {
      ...CLASSIC_RULE_CONFIG,
      ...(value as Record<string, unknown>),
      maxPlayers,
    };
  }

  return {
    ...CLASSIC_RULE_CONFIG,
    maxPlayers,
  };
}

async function assignHostIfNeeded(roomId: string) {
  const players = await prisma.roomPlayer.findMany({
    where: { roomId },
    orderBy: { seatIndex: "asc" },
  });

  if (players.length === 0) {
    await prisma.room.delete({ where: { id: roomId } });
    return;
  }

  if (players.some((player) => player.isHost)) {
    return;
  }

  await prisma.roomPlayer.update({
    where: { id: players[0].id },
    data: { isHost: true },
  });
  await prisma.room.update({
    where: { id: roomId },
    data: { hostUserId: players[0].userId },
  });
}

function requireSocketUser(socket: OneSocket) {
  const user = socket.data.user;
  if (!user) {
    throw new Error("Socket is not authenticated.");
  }
  return user;
}

function handleGameError(socket: OneSocket, error: unknown) {
  if (error instanceof GameRuleError) {
    emitSocketError(socket, "INVALID_MOVE", error.message);
    return;
  }

  emitSocketError(socket, "INTERNAL_ERROR", "Unexpected game error.");
}

function emitSocketError(
  socket: OneSocket,
  code: SocketErrorCode,
  message: string,
) {
  socket.emit(SERVER_EVENTS.GAME_ERROR, {
    code,
    message,
  });
}

function parseCookieHeader(cookieHeader: string | undefined) {
  const result: Record<string, string> = {};

  if (!cookieHeader) {
    return result;
  }

  for (const part of cookieHeader.split(";")) {
    const [name, ...valueParts] = part.trim().split("=");
    if (!name) {
      continue;
    }
    result[name] = decodeURIComponent(valueParts.join("="));
  }

  return result;
}
