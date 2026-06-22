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
      <div className="room-meta">
        <span>{room.visibility === "PUBLIC" ? "Open table" : "Invite table"}</span>
        <span>{room.preset}</span>
      </div>
      <h2>{room.name}</h2>
      <div className="seat-pips" aria-label={`${room.players} of ${room.maxPlayers} seats filled`}>
        {Array.from({ length: room.maxPlayers }, (_, index) => (
          <span className={index < room.players ? "filled" : ""} key={index} />
        ))}
      </div>
      <div className="room-meta">
        <span>
          {room.players}/{room.maxPlayers} seats
        </span>
        <span className="room-code">{room.code}</span>
      </div>
    </article>
  );
}
