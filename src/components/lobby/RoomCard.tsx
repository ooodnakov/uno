type RoomCardProps = {
  room: {
    id: string;
    code: string;
    name: string;
    visibility: "PUBLIC" | "PRIVATE";
    players: number;
    maxPlayers: number;
    preset: string;
  };
};

export function RoomCard({ room }: RoomCardProps) {
  return (
    <article className="room-card">
      <h2>{room.name}</h2>
      <div className="room-meta">
        <span>{room.visibility}</span>
        <span>
          {room.players}/{room.maxPlayers}
        </span>
      </div>
      <div className="room-meta">
        <span>{room.preset}</span>
        <span>{room.code}</span>
      </div>
    </article>
  );
}
