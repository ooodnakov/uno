import { ALLOWED_REACTIONS } from "@/lib/realtime/events";

export function ReactionBar() {
  return (
    <div className="reaction-row" aria-label="Reactions">
      {ALLOWED_REACTIONS.map((reaction) => (
        <button key={reaction} type="button" disabled>
          {reaction}
        </button>
      ))}
    </div>
  );
}
