import { NextResponse } from "next/server";
import { error } from "@/lib/api";
import { requireAdmin } from "@/lib/admin-auth";
import {
  CatalogConflictError,
  CatalogNotFoundError,
  deleteCatalogCard,
  getCatalogCard,
  parseCatalogCard,
  updateCatalogCard,
  type CatalogCard,
} from "@/lib/catalog";
import { getDb } from "@/lib/db";

type Context = { params: Promise<{ name: string }> };

export async function GET(request: Request, { params }: Context) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const { name } = await params;
  const card = await getCatalogCard(decodeURIComponent(name), getDb());
  if (!card) return error("Card not found.", 404);
  return NextResponse.json({ card });
}

/** Update (and optionally rename) the card identified by the path name. */
export async function PUT(request: Request, { params }: Context) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const { name } = await params;
  const originalName = decodeURIComponent(name);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const raw = "card" in body ? body.card : body;

  let card: CatalogCard;
  try {
    // Default the name to the path name when the body omits it.
    const withName =
      typeof raw === "object" && raw !== null && !("name" in (raw as object))
        ? { ...(raw as object), name: originalName }
        : raw;
    card = parseCatalogCard(withName, "Card");
  } catch (cause) {
    return error(cause instanceof Error ? cause.message : "Invalid card data.");
  }

  try {
    const updated = await updateCatalogCard(originalName, card, getDb());
    return NextResponse.json({ card: updated });
  } catch (cause) {
    if (cause instanceof CatalogNotFoundError) return error(cause.message, 404);
    if (cause instanceof CatalogConflictError) return error(cause.message, 409);
    return error(cause instanceof Error ? cause.message : "Failed to update card.", 400);
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const { name } = await params;
  try {
    await deleteCatalogCard(decodeURIComponent(name), getDb());
    return NextResponse.json({ deleted: true });
  } catch (cause) {
    if (cause instanceof CatalogNotFoundError) return error(cause.message, 404);
    return error(cause instanceof Error ? cause.message : "Failed to delete card.", 400);
  }
}
