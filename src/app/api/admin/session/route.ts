import { NextResponse } from "next/server";
import { adminEnabled, isAuthenticated } from "@/lib/admin-auth";

export async function GET(request: Request) {
  return NextResponse.json({
    enabled: adminEnabled(),
    authenticated: await isAuthenticated(request),
  });
}
