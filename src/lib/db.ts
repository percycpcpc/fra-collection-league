import { drizzle } from "drizzle-orm/d1";
import { env } from "cloudflare:workers";
import * as schema from "@/db/schema";

// `env` is injected by the Cloudflare Workers runtime via `cloudflare:workers`.
// This module works in route handlers, server components, and server actions
// without needing to thread `env` through function arguments.
export function getDb() {
  return drizzle((env as { DB: D1Database }).DB, { schema });
}

export type Db = ReturnType<typeof getDb>;
