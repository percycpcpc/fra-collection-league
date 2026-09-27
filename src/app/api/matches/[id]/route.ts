import { NextResponse } from "next/server";
import { error } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(_: Request, { params }: Context) {
  const { id } = await params;
  const result = await prisma.match.deleteMany({ where: { id } });
  if (!result.count) return error("Match not found.", 404);
  return NextResponse.json({ deleted: true });
}
