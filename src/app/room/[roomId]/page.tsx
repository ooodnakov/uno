import { notFound } from "next/navigation";

import { joinRoomAction } from "@/app/actions/rooms";
import { RoomClient } from "@/components/game/RoomClient";
import { requireCurrentUser } from "@/lib/auth/session";
import { CLASSIC_RULE_CONFIG } from "@/lib/game/types";
import type { RoomStatePayload } from "@/lib/realtime/events";
import { getRoomForUser } from "@/lib/rooms/rooms";

type RoomPageProps = {
  params: Promise<{
    roomId: string;
  }>;
};

export default async function RoomPage({ params }: RoomPageProps) {
  const user = await requireCurrentUser();
  const { roomId } = await params;
  const room = await getRoomForUser(roomId, user.id);

  if (!room) {
    notFound();
  }

  const isMember = room.players.some((player) => player.userId === user.id);
  const initialRoom: RoomStatePayload = {
    room: {
      id: room.id,
      code: room.code,
      name: room.name,
      visibility: room.visibility,
      status: room.status === "ABANDONED" ? "FINISHED" : room.status,
      hostUserId: room.hostUserId,
      maxPlayers: room.maxPlayers,
      ruleConfig: {
        ...CLASSIC_RULE_CONFIG,
        ...(typeof room.ruleConfig === "object" && room.ruleConfig !== null
          ? (room.ruleConfig as Record<string, unknown>)
          : {}),
        maxPlayers: room.maxPlayers,
      },
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

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Room</p>
          <h1>{room.name}</h1>
          <p className="muted">Invite code {room.code}</p>
        </div>
        {!isMember ? (
          <form action={joinRoomAction}>
            <input name="roomIdOrCode" type="hidden" value={room.id} />
            <button type="submit">Join room</button>
          </form>
        ) : null}
      </div>
      {isMember ? (
        <RoomClient
          currentUserId={user.id}
          initialRoom={initialRoom}
          roomId={room.id}
        />
      ) : (
        <div className="placeholder-panel">
          <p className="muted">Join this room to see seats and game state.</p>
        </div>
      )}
    </section>
  );
}
