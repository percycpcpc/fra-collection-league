import { NextRequest, NextResponse } from "next/server";

// Write fence for the Cloudflare cutover (see docs/ASTRA_MIGRATION_PLAN.md).
// The league has moved to Workers + D1; this Railway deployment stays as a
// read-only fallback. Block every mutating API call so no writes are lost.
const NEW_HOME = "https://fra-collection-league.percycpcpc.workers.dev";

export function middleware(request: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    return NextResponse.next();
  }
  return NextResponse.json(
    {
      error: `This site is read-only. The league moved to ${NEW_HOME} — please update your bookmark.`,
      movedTo: NEW_HOME,
    },
    { status: 503 },
  );
}

export const config = {
  matcher: ["/api/:path*"],
};
