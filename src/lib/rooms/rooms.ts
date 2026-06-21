import { Prisma, type RoomVisibility } from "@prisma/client";
import { z } from "zod";

import { isUniqueConstraintError } from "@/lib/db/errors";
import { prisma } from "@/lib/db/prisma";
import { CLASSIC_RULE_CONFIG, type RuleConfig } from "@/lib/game/types";

export const createRoomInputSchema = z.object({
  name: z.string().trim().min(1).max(48),
  visibility: z.enum(["PUBLIC", "PRIVATE"]),
  maxPlayers: z.coerce.number().int().min(2).max(6),
});

export type CreateRoomResult =
  | {
      ok: true;
      roomId: string;
    }
  | {
      ok: false;
      message: string;
    };

export type JoinRoomResult =
  | {
      ok: true;
      roomId: string;
    }
  | {
      ok: false;
      message: string;
    };

export async function listPublicWaitingRooms() {
  return prisma.room.findMany({
    where: {
      visibility: "PUBLIC",
      status: "WAITING",
    },
    include: {
      players: {
        include: {
          user: true,
        },
        orderBy: {
          seatIndex: "asc",
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function getRoomForUser(roomIdOrCode: string, userId: string) {
  const normalizedCode = roomIdOrCode.toUpperCase();
  const room = await prisma.room.findFirst({
    where: {
      OR: [{ id: roomIdOrCode }, { code: normalizedCode }],
    },
    include: {
      players: {
        include: {
          user: true,
        },
        orderBy: {
          seatIndex: "asc",
        },
      },
      games: {
        where: {
          status: "PLAYING",
        },
        orderBy: {
          startedAt: "desc",
        },
        take: 1,
      },
    },
  });

  if (!room) {
    return null;
  }

  const isMember = room.players.some((player) => player.userId === userId);
  const usedInviteCode = room.code === normalizedCode;

  if (!isMember && room.visibility === "PRIVATE" && !usedInviteCode) {
    return null;
  }

  return room;
}

export async function createRoom(
  userId: string,
  input: unknown,
): Promise<CreateRoomResult> {
  const parsed = createRoomInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: "Room name, visibility, and max players are required.",
    };
  }

  const { name, visibility, maxPlayers } = parsed.data;
  const ruleConfig: RuleConfig = {
    ...CLASSIC_RULE_CONFIG,
    maxPlayers,
  };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const room = await prisma.$transaction(async (tx) => {
        const createdRoom = await tx.room.create({
          data: {
            code: createInviteCode(),
            name,
            visibility: visibility as RoomVisibility,
            hostUserId: userId,
            maxPlayers,
            ruleConfig: ruleConfig as unknown as Prisma.InputJsonValue,
          },
        });

        await tx.roomPlayer.create({
          data: {
            roomId: createdRoom.id,
            userId,
            seatIndex: 0,
            isHost: true,
          },
        });

        return createdRoom;
      });

      return {
        ok: true,
        roomId: room.id,
      };
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        continue;
      }

      throw error;
    }
  }

  return {
    ok: false,
    message: "Could not allocate a room code. Try again.",
  };
}

export async function joinRoom(
  userId: string,
  roomIdOrCode: string,
): Promise<JoinRoomResult> {
  const room = await prisma.room.findFirst({
    where: {
      OR: [{ id: roomIdOrCode }, { code: roomIdOrCode.toUpperCase() }],
    },
    include: {
      players: true,
    },
  });

  if (!room) {
    return {
      ok: false,
      message: "Room not found.",
    };
  }

  if (room.status !== "WAITING") {
    return {
      ok: false,
      message: "This room has already started.",
    };
  }

  if (room.players.some((player) => player.userId === userId)) {
    return {
      ok: false,
      message: "You are already in this room.",
    };
  }

  if (room.players.length >= room.maxPlayers) {
    return {
      ok: false,
      message: "This room is full.",
    };
  }

  const usedSeats = new Set(room.players.map((player) => player.seatIndex));
  const seatIndex = Array.from({ length: room.maxPlayers }, (_, index) => index)
    .find((index) => !usedSeats.has(index));

  if (seatIndex === undefined) {
    return {
      ok: false,
      message: "No open seat is available.",
    };
  }

  await prisma.roomPlayer.create({
    data: {
      roomId: room.id,
      userId,
      seatIndex,
    },
  });

  return {
    ok: true,
    roomId: room.id,
  };
}

function createInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let index = 0; index < 6; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return code;
}
