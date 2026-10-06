import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __ramPrisma: PrismaClient | undefined;
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

export function dataBackend(): "postgres" | "prototype" {
  const configured = process.env.RAM_DATA_BACKEND;
  if (configured === "postgres" || configured === "prototype") return configured;

  if (process.env.NODE_ENV === "production") return "postgres";
  return process.env.DATABASE_URL ? "postgres" : "prototype";
}

export function getPrisma() {
  if (dataBackend() !== "postgres") return null;

  if (!globalThis.__ramPrisma) {
    const client = createPrismaClient();
    if (!client) {
      throw new Error("RAM_DATA_BACKEND=postgres requires DATABASE_URL");
    }
    globalThis.__ramPrisma = client;
  }

  return globalThis.__ramPrisma;
}

export function requirePrisma() {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("PostgreSQL persistence is not enabled");
  }
  return prisma;
}
