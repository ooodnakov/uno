import Link from "next/link";

import { joinRoomAction } from "@/app/actions/rooms";
import { CreateRoomDialog } from "@/components/lobby/CreateRoomDialog";
import { RoomCard } from "@/components/lobby/RoomCard";
import { requireCurrentUser } from "@/lib/auth/session";
import { listPublicWaitingRooms } from "@/lib/rooms/rooms";

type LobbyPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function LobbyPage({ searchParams }: LobbyPageProps) {
  await requireCurrentUser();
  const { error } = await searchParams;
  const rooms = await listPublicWaitingRooms();

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Open tables</p>
          <h1>Lobby</h1>
        </div>
        <CreateRoomDialog />
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <form action={joinRoomAction} className="join-panel">
        <label>
          Join private table
          <input name="roomIdOrCode" type="text" required />
        </label>
        <button type="submit">Join</button>
      </form>
      <div className="room-grid">
        {rooms.map((room) => (
          <Link key={room.id} href={`/room/${room.id}`}>
            <RoomCard
              room={{
                id: room.id,
                code: room.code,
                name: room.name,
                visibility: room.visibility,
                players: room.players.length,
                maxPlayers: room.maxPlayers,
                preset: getRulePreset(room.ruleConfig),
              }}
            />
          </Link>
        ))}
      </div>
      {rooms.length === 0 ? (
        <p className="muted">No open tables yet. Deal one and invite a second player.</p>
      ) : null}
    </section>
  );
}

function getRulePreset(ruleConfig: unknown) {
  if (
    typeof ruleConfig === "object" &&
    ruleConfig !== null &&
    "preset" in ruleConfig
  ) {
    return String(ruleConfig.preset);
  }

  return "CLASSIC";
}
