import { NextResponse } from "next/server";
import { getCatalog } from "@/lib/catalog";

export function GET() {
  return NextResponse.json(getCatalog(), {
    headers: {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
