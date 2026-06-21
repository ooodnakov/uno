"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCurrentUser } from "@/lib/auth/session";
import { createRoom, joinRoom } from "@/lib/rooms/rooms";

export async function createRoomAction(formData: FormData) {
  const user = await requireCurrentUser();
  const result = await createRoom(user.id, {
    name: formData.get("name"),
    visibility: formData.get("visibility"),
    maxPlayers: formData.get("maxPlayers"),
  });

  if (!result.ok) {
    redirect(`/lobby?error=${encodeURIComponent(result.message)}`);
  }

  revalidatePath("/lobby");
  redirect(`/room/${result.roomId}`);
}

export async function joinRoomAction(formData: FormData) {
  const user = await requireCurrentUser();
  const roomIdOrCode = String(formData.get("roomIdOrCode") ?? "").trim();
  const result = await joinRoom(user.id, roomIdOrCode);

  if (!result.ok) {
    redirect(`/lobby?error=${encodeURIComponent(result.message)}`);
  }

  revalidatePath("/lobby");
  redirect(`/room/${result.roomId}`);
}
