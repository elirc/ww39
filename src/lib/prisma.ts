/**
 * What this file does: exports the singleton Prisma client used by repositories.
 * What calls it: repository implementations and seed scripts.
 * What it calls: PrismaClient from @prisma/client.
 * Junior trap: creating a new PrismaClient in every request and leaking connections.
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

