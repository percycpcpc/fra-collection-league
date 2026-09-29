import { NextResponse } from "next/server";
import { error } from "@/lib/api";
import { adminEnabled, passwordMatches, sessionCookie } from "@/lib/admin-auth";

export async function POST(request: Request) {
  if (!adminEnabled()) {
    return error("Admin panel is not configured (ADMIN_PASSWORD unset).", 503);
  }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const password = typeof body.password === "string" ? body.password : "";
  if (!passwordMatches(password)) {
    return error("Incorrect password.", 401);
  }
  const response = NextResponse.json({ ok: true });
  response.headers.set("Set-Cookie", await sessionCookie(password));
  return response;
}
