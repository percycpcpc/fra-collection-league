import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { error } from "@/lib/api";
import { getDb } from "@/lib/db";
import { matches } from "@/db/schema";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(_: Request, { params }: Context) {
  const { id } = await params;
  const db = getDb();

  const exists = await db
    .select({ id: matches.id })
    .from(matches)
    .where(eq(matches.id, id))
    .limit(1)
    .then((r) => r[0] ?? null);
  if (!exists) return error("Match not found.", 404);

  await db.delete(matches).where(eq(matches.id, id));
  return NextResponse.json({ deleted: true });
}
