import { NextResponse } from "next/server";
import { error } from "@/lib/api";
import { catalogNames } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };

function parseLine(line: string) {
  let name = line.trim();
  if (!name) return null;

  const quantity = name.match(/^(\d+)(?:x)?\s+(.+)$/i);
  const qty = quantity ? Number(quantity[1]) : 1;
  if (quantity) name = quantity[2];

  const setCode = name.match(/\s+\([A-Za-z0-9]+\)/);
  if (setCode?.index !== undefined) {
    name = name.slice(0, setCode.index);
  } else {
    // Common exports append these fields even when they omit a set code.
    name = name
      .replace(/\s+\[[^\]]*\]\s*$/, "")
      .replace(/\s+\*[^*]+\*\s*$/, "")
      .replace(/\s+\d+\s*$/, "");
  }

  name = name.trim().replace(/[\s,;:.!?-]+$/, "");
  return qty > 0 && name ? { qty, name } : null;
}

export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (typeof body.text !== "string" || !body.text.trim()) return error("Import text is required.");
  const profile = await prisma.profile.findUnique({ where: { id }, select: { id: true } });
  if (!profile) return error("Profile not found.", 404);
  const known = await catalogNames();
  const merged = new Map<string, { name: string; qty: number; known: boolean }>();
  for (const line of body.text.split(/\r?\n/)) {
    const parsed = parseLine(line);
    if (!parsed) continue;
    const canonical = known.get(parsed.name.toLocaleLowerCase());
    const name = canonical ?? parsed.name;
    const key = name.toLocaleLowerCase();
    const prior = merged.get(key);
    merged.set(key, { name, qty: (prior?.qty ?? 0) + parsed.qty, known: Boolean(canonical) });
  }
  if (!merged.size) return error("No valid card lines were found.");
  const names = [...merged.values()].map((entry) => entry.name);
  const existing = await prisma.collectionCard.findMany({ where: { profileId: id, name: { in: names } }, select: { name: true } });
  const existingNames = new Set(existing.map((card) => card.name));
  await prisma.$transaction(
    [...merged.values()].map((entry) =>
      prisma.collectionCard.upsert({
        where: { profileId_name: { profileId: id, name: entry.name } },
        create: { profileId: id, name: entry.name, qty: entry.qty },
        update: { qty: { increment: entry.qty } },
      }),
    ),
  );
  return NextResponse.json({
    added: names.filter((name) => !existingNames.has(name)).length,
    updated: names.filter((name) => existingNames.has(name)).length,
    unknown: [...merged.values()].filter((entry) => !entry.known).map((entry) => entry.name),
  });
}
