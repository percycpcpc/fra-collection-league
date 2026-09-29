import { NextResponse } from "next/server";
import { asc, sql } from "drizzle-orm";
import { error } from "@/lib/api";
import { requireAdmin } from "@/lib/admin-auth";
import { chunksOf } from "@/lib/chunks";
import { getDb } from "@/lib/db";
import { siteSettings } from "@/db/schema";

export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const db = getDb();
  const rows = await db
    .select({ key: siteSettings.key, value: siteSettings.value, updatedAt: siteSettings.updatedAt })
    .from(siteSettings)
    .orderBy(asc(siteSettings.key));
  return NextResponse.json({ settings: rows });
}

// SiteSetting has 3 columns; D1 caps a statement at 100 params → max 33 rows.
const D1_SETTINGS_BATCH = 33;

export async function PUT(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof body.settings !== "object" || body.settings === null || Array.isArray(body.settings)) {
    return error("Body must be { settings: Record<string, string> }.");
  }
  const entries = Object.entries(body.settings as Record<string, unknown>);
  for (const [key, value] of entries) {
    if (!key.trim()) return error("Setting keys cannot be empty.");
    if (typeof value !== "string") return error(`Setting "${key}" must be a string.`);
  }
  if (!entries.length) return NextResponse.json({ ok: true, count: 0 });

  const updatedAt = new Date().toISOString();
  const rows = entries.map(([key, value]) => ({ key, value: value as string, updatedAt }));

  const db = getDb();
  const statements = chunksOf(rows, D1_SETTINGS_BATCH).map((batch) =>
    db
      .insert(siteSettings)
      .values(batch)
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: {
          value: sqlExcluded("value"),
          updatedAt: sqlExcluded("updatedAt"),
        },
      }),
  );
  await db.batch(
    statements as [(typeof statements)[number], ...(typeof statements)[number][]],
  );
  return NextResponse.json({ ok: true, count: rows.length });
}

// `excluded.<col>` references the row that failed to insert, for upserts.
function sqlExcluded(column: string) {
  return sql.raw(`excluded."${column}"`);
}
