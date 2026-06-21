"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { io, type Socket } from "socket.io-client";

import type {
  ClientToServerEvents,
  GameEventPayload,
  GameStatePayload,
  Reaction,
  RoomStatePayload,
  ServerToClientEvents,
  SocketErrorPayload,
} from "@/lib/realtime/events";
import { ALLOWED_REACTIONS } from "@/lib/realtime/events";
import type { DeclaredColor } from "@/lib/game/types";

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

type RoomClientProps = {
  roomId: string;
  initialRoom: RoomStatePayload;
  currentUserId: string;
};

export function RoomClient({
  roomId,
  initialRoom,
  currentUserId,
}: RoomClientProps) {
  const [socket, setSocket] = useState<ClientSocket | null>(null);
  const [roomState, setRoomState] = useState<RoomStatePayload>(initialRoom);
  const [gameState, setGameState] = useState<GameStatePayload | null>(null);
  const [events, setEvents] = useState<GameEventPayload[]>([]);
  const [messages, setMessages] = useState<Array<{ id: string; text: string; displayName: string }>>([]);
  const [lastReaction, setLastReaction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedWildCardId, setSelectedWildCardId] = useState<string | null>(null);

  useEffect(() => {
    const nextSocket: ClientSocket = io({
      withCredentials: true,
    });

    nextSocket.on("connect", () => {
      nextSocket.emit("room:join", { roomId });
    });
    nextSocket.on("room:state", setRoomState);
    nextSocket.on("game:state", (payload) => {
      setGameState(payload);
      setEvents(payload.lastEvents);
    });
    nextSocket.on("game:event", (payload) => {
      setEvents((current) => [...current.slice(-19), payload]);
    });
    nextSocket.on("game:error", (payload: SocketErrorPayload) => {
      setError(payload.message);
      window.setTimeout(() => setError(null), 3500);
    });
    nextSocket.on("chat:message", (payload) => {
      setMessages((current) => [
        ...current.slice(-29),
        {
          id: payload.id,
          text: payload.text,
          displayName: payload.displayName,
        },
      ]);
    });
    nextSocket.on("reaction:show", (payload) => {
      setLastReaction(`${payload.displayName}: ${payload.reaction}`);
      window.setTimeout(() => setLastReaction(null), 2500);
    });
    nextSocket.on("presence:update", (payload) => {
      setRoomState((current) => ({
        ...current,
        players: current.players.map((player) =>
          player.userId === payload.userId
            ? {
                ...player,
                isConnected: payload.isConnected,
                controlledByBot: payload.controlledByBot,
              }
            : player,
        ),
      }));
    });

    setSocket(nextSocket);

    return () => {
      nextSocket.disconnect();
    };
  }, [roomId]);

  const selfRoomPlayer = roomState.players.find(
    (player) => player.userId === currentUserId,
  );
  const isHost = selfRoomPlayer?.isHost ?? false;
  const canStart =
    isHost && roomState.room.status !== "IN_GAME" && roomState.players.length >= 2;
  const topDiscard = gameState?.table.topDiscard;
  const turnSecondsLeft = useTurnSecondsLeft(gameState?.table.turnEndsAt);

  function emitStart() {
    socket?.emit("room:start", { roomId });
  }

  function playCard(cardId: string) {
    const card = gameState?.self.hand.find((candidate) => candidate.id === cardId);

    if (!gameState || !card || !socket) {
      return;
    }

    if (!gameState.availableActions.playableCardIds.includes(cardId)) {
      return;
    }

    if (card.color === "WILD") {
      setSelectedWildCardId(cardId);
      return;
    }

    socket.emit("game:playCard", {
      roomId,
      gameId: gameState.gameId,
      cardId,
    });
  }

  function playWild(declaredColor: DeclaredColor) {
    if (!gameState || !selectedWildCardId) {
      return;
    }

    socket?.emit("game:playCard", {
      roomId,
      gameId: gameState.gameId,
      cardId: selectedWildCardId,
      declaredColor,
    });
    setSelectedWildCardId(null);
  }

  function emitGameAction(action: "draw" | "pass" | "declareOne") {
    if (!gameState || !socket) {
      return;
    }

    if (action === "draw") {
      socket.emit("game:draw", { roomId, gameId: gameState.gameId });
    } else if (action === "pass") {
      socket.emit("game:pass", { roomId, gameId: gameState.gameId });
    } else {
      socket.emit("game:declareOne", { roomId, gameId: gameState.gameId });
    }
  }

  function calloutOne(targetPlayerId: string) {
    if (!gameState || !socket) {
      return;
    }

    socket.emit("game:calloutOne", {
      roomId,
      gameId: gameState.gameId,
      targetPlayerId,
    });
  }

  function sendChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const text = String(formData.get("text") ?? "").trim();

    if (!text) {
      return;
    }

    socket?.emit("chat:send", { roomId, text });
    form.reset();
  }

  function sendReaction(reaction: Reaction) {
    socket?.emit("reaction:send", { roomId, reaction });
  }

  const vulnerableTargets = useMemo(() => {
    if (!gameState?.availableActions.canCalloutOne) {
      return [];
    }

    return gameState.players.filter(
      (player) =>
        player.playerId !== gameState.self.playerId &&
        player.cardCount === 1 &&
        !player.hasDeclaredOneVisible,
    );
  }, [gameState]);

  return (
    <div className="live-room">
      {error ? <p className="toast-message">{error}</p> : null}
      {lastReaction ? <p className="reaction-pop">{lastReaction}</p> : null}
      <div className="room-toolbar">
        <div>
          <span className="muted">Status</span>
          <strong>{roomState.room.status}</strong>
        </div>
        <div>
          <span className="muted">Players</span>
          <strong>
            {roomState.players.length}/{roomState.room.maxPlayers}
          </strong>
        </div>
        <button type="button" disabled={!canStart} onClick={emitStart}>
          Start game
        </button>
      </div>

      {!gameState ? (
        <WaitingRoom roomState={roomState} currentUserId={currentUserId} />
      ) : (
        <section className="game-board">
          <div className="opponent-strip">
            {gameState.players
              .filter((player) => player.playerId !== gameState.self.playerId)
              .map((player) => (
                <div
                  className={`opponent-seat ${player.isCurrentTurn ? "active" : ""}`}
                  key={player.playerId}
                >
                  <strong>{player.displayName}</strong>
                  <span>{player.cardCount} cards</span>
                  <div className="badge-row">
                    {!player.isConnected ? <em>Offline</em> : null}
                    {player.controlledByBot ? <em>Bot</em> : null}
                    {player.hasDeclaredOneVisible ? <em>ONE</em> : null}
                  </div>
                  {vulnerableTargets.some(
                    (target) => target.playerId === player.playerId,
                  ) ? (
                    <button
                      type="button"
                      onClick={() => calloutOne(player.playerId)}
                    >
                      Callout
                    </button>
                  ) : null}
                </div>
              ))}
          </div>

          <div className="table-center">
            <div className="pile-card draw-pile">
              <span>Draw</span>
              <strong>{gameState.table.drawCount}</strong>
            </div>
            {topDiscard ? (
              <button
                className={`game-card table-card ${cardColorClass(topDiscard.color)}`}
                type="button"
                disabled
              >
                {cardLabel(topDiscard)}
              </button>
            ) : null}
            <div className={`current-color ${gameState.table.currentColor.toLowerCase()}`}>
              {gameState.table.currentColor}
            </div>
            <div className="turn-panel">
              <span>{gameState.table.direction === 1 ? "Clockwise" : "Counter"}</span>
              <strong>{turnSecondsLeft}s</strong>
              <span>
                {gameState.self.isCurrentTurn
                  ? "Your turn"
                  : `${currentPlayerName(gameState)} turn`}
              </span>
            </div>
          </div>

          <div className="action-row">
            <button
              type="button"
              disabled={!gameState.availableActions.canDraw}
              onClick={() => emitGameAction("draw")}
            >
              Draw
            </button>
            <button
              type="button"
              disabled={!gameState.availableActions.canPass}
              onClick={() => emitGameAction("pass")}
            >
              Pass
            </button>
            <button
              type="button"
              disabled={!gameState.availableActions.canDeclareOne}
              onClick={() => emitGameAction("declareOne")}
            >
              ONE!
            </button>
          </div>

          {selectedWildCardId ? (
            <div className="wild-picker">
              {(["RED", "BLUE", "GREEN", "YELLOW"] as const).map((color) => (
                <button
                  className={color.toLowerCase()}
                  key={color}
                  type="button"
                  onClick={() => playWild(color)}
                >
                  {color}
                </button>
              ))}
            </div>
          ) : null}

          <div className="hand-zone" aria-label="Your hand">
            {gameState.self.hand.map((card) => {
              const playable =
                gameState.availableActions.playableCardIds.includes(card.id);
              return (
                <button
                  className={`game-card ${cardColorClass(card.color)} ${
                    playable ? "playable" : ""
                  }`}
                  disabled={!playable}
                  key={card.id}
                  type="button"
                  onClick={() => playCard(card.id)}
                >
                  {cardLabel(card)}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <aside className="live-side">
        <div>
          <h2>Chat</h2>
          <ul className="chat-list">
            {messages.length === 0 ? <li>No messages yet</li> : null}
            {messages.map((message) => (
              <li key={message.id}>
                <strong>{message.displayName}</strong>: {message.text}
              </li>
            ))}
          </ul>
          <form className="chat-form" onSubmit={sendChat}>
            <input name="text" maxLength={500} placeholder="Message" />
            <button type="submit">Send</button>
          </form>
        </div>
        <div>
          <h2>Reactions</h2>
          <div className="reaction-row">
            {ALLOWED_REACTIONS.map((reaction) => (
              <button
                key={reaction}
                type="button"
                onClick={() => sendReaction(reaction)}
              >
                {reaction}
              </button>
            ))}
          </div>
        </div>
        <div>
          <h2>Event log</h2>
          <ul className="chat-list">
            {events.length === 0 ? <li>Waiting for events</li> : null}
            {events.map((event) => (
              <li key={event.id}>
                {event.actorDisplayName ? `${event.actorDisplayName}: ` : ""}
                {event.type.replaceAll("_", " ")}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

function WaitingRoom({
  roomState,
  currentUserId,
}: {
  roomState: RoomStatePayload;
  currentUserId: string;
}) {
  return (
    <div className="placeholder-panel">
      <div className="table-shell">
        <h2>Seats</h2>
        <div className="seat-list">
          {Array.from({ length: roomState.room.maxPlayers }, (_, seatIndex) => {
            const player = roomState.players.find(
              (roomPlayer) => roomPlayer.seatIndex === seatIndex,
            );

            return (
              <div
                className={`seat-card ${
                  player?.userId === currentUserId ? "active" : ""
                }`}
                key={seatIndex}
              >
                <span>Seat {seatIndex + 1}</span>
                <strong>{player ? player.displayName : "Open seat"}</strong>
                <div className="badge-row">
                  {player?.isHost ? <em>Host</em> : null}
                  {player && !player.isConnected ? <em>Offline</em> : null}
                  {player?.controlledByBot ? <em>Bot</em> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function useTurnSecondsLeft(turnEndsAt: string | undefined) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  if (!turnEndsAt) {
    return 0;
  }

  return Math.max(0, Math.ceil((Date.parse(turnEndsAt) - now) / 1000));
}

function currentPlayerName(gameState: GameStatePayload) {
  return (
    gameState.players.find(
      (player) => player.playerId === gameState.table.currentPlayerId,
    )?.displayName ?? "Current player"
  );
}

function cardLabel(card: GameStatePayload["self"]["hand"][number]) {
  if (card.kind === "NUMBER") {
    return card.value;
  }

  if (card.kind === "WILD_DRAW_FOUR") {
    return "+4";
  }

  if (card.kind === "DRAW_TWO") {
    return "+2";
  }

  if (card.kind === "REVERSE") {
    return "R";
  }

  if (card.kind === "SKIP") {
    return "S";
  }

  return "W";
}

function cardColorClass(color: string) {
  return color === "WILD" ? "wild" : color.toLowerCase();
}
