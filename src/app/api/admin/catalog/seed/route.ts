import { NextResponse } from "next/server";
import { error } from "@/lib/api";
import { requireAdmin } from "@/lib/admin-auth";
import { seedCatalog } from "@/lib/catalog";
import { getDb } from "@/lib/db";

/** Replace the catalog with the bundled seed dataset (data/catalog.json). */
export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const count = await seedCatalog(getDb());
    return NextResponse.json({ ok: true, count });
  } catch (cause) {
    return error(cause instanceof Error ? cause.message : "Failed to seed catalog.", 500);
  }
}
