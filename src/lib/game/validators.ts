import { z } from "zod";

import { CARD_COLORS, CARD_KINDS, NORMAL_CARD_COLORS } from "./types";

export const cardSchema = z.object({
  id: z.string().min(1),
  color: z.enum(CARD_COLORS),
  kind: z.enum(CARD_KINDS),
  value: z.number().int().min(0).max(9).optional(),
});

export const declaredColorSchema = z.enum(NORMAL_CARD_COLORS);

export function parseDeclaredColor(value: unknown) {
  return declaredColorSchema.parse(value);
}
