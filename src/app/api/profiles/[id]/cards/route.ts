import { NextResponse } from "next/server";
import { cleanName, error } from "@/lib/api";
import { catalogNames } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Context) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const rawName = cleanName(body.name);
  if (!rawName) return error("Card name is required.");
  if (body.qty !== undefined && (!Number.isInteger(body.qty) || body.qty < 0)) return error("Quantity must be a non-negative integer.");
  if (body.owned !== undefined && typeof body.owned !== "boolean") return error("Owned must be true or false.");
  const profile = await prisma.profile.findUnique({ where: { id }, select: { id: true } });
  if (!profile) return error("Profile not found.", 404);
  const names = await catalogNames();
  const name = names.get(rawName.toLocaleLowerCase()) ?? rawName;
  if (body.qty === 0) {
    await prisma.collectionCard.deleteMany({ where: { profileId: id, name } });
    return NextResponse.json({ deleted: true });
  }
  const card = await prisma.collectionCard.upsert({
    where: { profileId_name: { profileId: id, name } },
    create: { profileId: id, name, qty: body.qty ?? 1, owned: body.owned ?? true },
    update: {
      ...(body.qty !== undefined ? { qty: body.qty } : {}),
      ...(body.owned !== undefined ? { owned: body.owned } : {}),
    },
  });
  return NextResponse.json({ card });
}
