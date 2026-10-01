import { NextResponse } from "next/server";
import { getCatalog } from "@/lib/catalog";

export async function GET() {
  return NextResponse.json(await getCatalog(), {
    headers: {
      // Catalog content changes when an admin reseeds from data/catalog.json;
      // a long max-age leaves every returning visitor on stale data for up to
      // an hour. no-cache forces revalidation while still allowing the edge
      // to serve fresh responses efficiently.
      "Cache-Control": "no-cache",
    },
  });
}
