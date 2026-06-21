import { createRoomAction } from "@/app/actions/rooms";

export function CreateRoomDialog() {
  return (
    <form action={createRoomAction} className="create-room-form">
      <label>
        Room name
        <input name="name" type="text" defaultValue="Classic table" required />
      </label>
      <label>
        Visibility
        <select name="visibility" defaultValue="PUBLIC">
          <option value="PUBLIC">Public</option>
          <option value="PRIVATE">Private</option>
        </select>
      </label>
      <label>
        Max players
        <input
          name="maxPlayers"
          type="number"
          min={2}
          max={6}
          defaultValue={6}
          required
        />
      </label>
      <button type="submit">Create room</button>
    </form>
  );
}
