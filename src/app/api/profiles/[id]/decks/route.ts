import { NextResponse } from "next/server";
import { cleanName, error } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const name = cleanName(body.name);
  if (!name) return error("Deck name is required.");
  if (body.commander !== undefined && body.commander !== null && typeof body.commander !== "string") return error("Commander must be a card name or null.");
  const profile = await prisma.profile.findUnique({ where: { id }, select: { id: true } });
  if (!profile) return error("Profile not found.", 404);
  const commander = cleanName(body.commander) || null;
  const deck = await prisma.deck.create({ data: { profileId: id, name, commander } });
  return NextResponse.json({ deck }, { status: 201 });
}
