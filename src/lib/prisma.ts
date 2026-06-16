import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma/client";

type G = typeof globalThis & { _prisma?: PrismaClient };

function getClient(): PrismaClient {
  const g = globalThis as G;
  if (!g._prisma) {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new Error("DATABASE_URL is not set");
    const u = new URL(dbUrl);
    const adapter = new PrismaNeon({
      host:     u.hostname,
      user:     decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.slice(1).split("?")[0],
      ssl:      true,
      port:     u.port ? Number(u.port) : 5432,
    });
    g._prisma = new PrismaClient({ adapter });
  }
  return g._prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_, prop: string | symbol) {
    return (getClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
