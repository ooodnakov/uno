import { z } from "zod";

import { isUniqueConstraintError } from "@/lib/db/errors";
import { prisma } from "@/lib/db/prisma";

import { hashPassword, verifyPassword } from "./password";
import { createSession, destroyCurrentSession } from "./session";

export const registerInputSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(24)
    .regex(/^[a-zA-Z0-9_]+$/),
  displayName: z.string().trim().min(1).max(32),
  password: z.string().min(8).max(128),
});

export const loginInputSchema = z.object({
  username: z.string().trim().min(1).max(24),
  password: z.string().min(1).max(128),
});

export type AuthActionResult = {
  ok: boolean;
  message?: string;
};

export async function registerUser(input: unknown): Promise<AuthActionResult> {
  const parsed = registerInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message:
        "Use a 3-24 character username, display name, and 8+ character password.",
    };
  }

  const { username, displayName, password } = parsed.data;

  try {
    const user = await prisma.user.create({
      data: {
        username: username.toLowerCase(),
        displayName,
        passwordHash: await hashPassword(password),
      },
    });

    await createSession(user.id);
    return { ok: true };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        ok: false,
        message: "That username is already taken.",
      };
    }

    throw error;
  }
}

export async function loginUser(input: unknown): Promise<AuthActionResult> {
  const parsed = loginInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: "Enter a username and password.",
    };
  }

  const user = await prisma.user.findUnique({
    where: {
      username: parsed.data.username.toLowerCase(),
    },
  });

  if (!user) {
    return {
      ok: false,
      message: "Invalid username or password.",
    };
  }

  const isValid = await verifyPassword(parsed.data.password, user.passwordHash);

  if (!isValid) {
    return {
      ok: false,
      message: "Invalid username or password.",
    };
  }

  await createSession(user.id);
  return { ok: true };
}

export async function logoutUser() {
  await destroyCurrentSession();
}
