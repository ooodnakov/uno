import { createHash } from "node:crypto";

export const SESSION_COOKIE_NAME = "one_session";

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
