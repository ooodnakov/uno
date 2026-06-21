import { Prisma } from "@prisma/client";

export class MemoryPrismaKnownRequestError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "MemoryPrismaKnownRequestError";
    this.code = code;
  }
}

export function createMemoryPrismaKnownRequestError(
  code: string,
  message: string,
) {
  return new MemoryPrismaKnownRequestError(code, message);
}

export function isKnownPrismaError(error: unknown, code: string) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === code;
  }

  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}

export function isUniqueConstraintError(error: unknown) {
  return isKnownPrismaError(error, "P2002");
}
