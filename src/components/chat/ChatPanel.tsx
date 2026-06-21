import { EventLog } from "@/components/game/EventLog";

export function ChatPanel() {
  return (
    <div>
      <h2>Chat</h2>
      <ul className="chat-list" aria-label="Room chat">
        <li>No messages yet</li>
      </ul>
      <EventLog />
    </div>
  );
}
