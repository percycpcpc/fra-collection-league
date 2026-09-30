import { NextResponse } from "next/server";
import { error } from "@/lib/api";
import { requireAdmin } from "@/lib/admin-auth";
import {
  CatalogConflictError,
  createCatalogCard,
  getCatalog,
  parseCatalogCard,
  replaceCatalog,
  type CatalogCard,
} from "@/lib/catalog";
import { getDb } from "@/lib/db";

export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  return NextResponse.json({ catalog: await getCatalog() });
}

/** Create a single catalog card. */
export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const raw = "card" in body ? body.card : body;

  let card: CatalogCard;
  try {
    card = parseCatalogCard(raw, "Card");
  } catch (cause) {
    return error(cause instanceof Error ? cause.message : "Invalid card data.");
  }

  try {
    const created = await createCatalogCard(card, getDb());
    return NextResponse.json({ card: created }, { status: 201 });
  } catch (cause) {
    if (cause instanceof CatalogConflictError) return error(cause.message, 409);
    return error(cause instanceof Error ? cause.message : "Failed to create card.", 400);
  }
}

/** Replace the entire catalog with the provided array. */
export async function PUT(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (!Array.isArray(body.catalog)) {
    return error("Body must be { catalog: CatalogCard[] }.");
  }

  let cards: CatalogCard[];
  try {
    cards = body.catalog.map((raw, i) => parseCatalogCard(raw, `Row ${i + 1}`));
  } catch (cause) {
    return error(cause instanceof Error ? cause.message : "Invalid catalog data.");
  }

  const seen = new Set<string>();
  for (const card of cards) {
    const key = card.name.toLocaleLowerCase();
    if (seen.has(key)) return error(`Duplicate card name: "${card.name}".`);
    seen.add(key);
  }

  try {
    const count = await replaceCatalog(cards, getDb());
    return NextResponse.json({ ok: true, count });
  } catch (cause) {
    // validateCatalog throws on malformed colorIdentity; surface the message.
    return error(cause instanceof Error ? cause.message : "Failed to save catalog.", 400);
  }
}
