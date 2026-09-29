import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

export const ADMIN_COOKIE = "fra_admin";

// Passwords that must never grant access, even if configured. The scaffolding
// default and the empty string are rejected so an unconfigured deploy stays locked.
const REJECTED_PASSWORDS = new Set(["", "change-me"]);

/**
 * The configured admin password, or null when the admin panel is effectively
 * disabled — i.e. the var is unset, empty, or still the placeholder default.
 */
function adminPassword(): string | null {
  const value = (env as { ADMIN_PASSWORD?: string }).ADMIN_PASSWORD;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (REJECTED_PASSWORDS.has(trimmed)) return null;
  return trimmed;
}

/**
 * Derive the opaque session token from the password. The raw password is never
 * placed in the cookie; the cookie holds this SHA-256 hex digest instead.
 */
export async function tokenFor(password: string): Promise<string> {
  const data = new TextEncoder().encode(`fra-admin:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time-ish string comparison to avoid trivial timing leaks. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** True when the provided password matches the configured one. */
export function passwordMatches(password: string): boolean {
  const expected = adminPassword();
  return expected !== null && safeEqual(password, expected);
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

/** True when the request carries a valid admin session cookie. */
export async function isAuthenticated(request: Request): Promise<boolean> {
  const expectedPassword = adminPassword();
  if (expectedPassword === null) return false;
  const cookie = readCookie(request, ADMIN_COOKIE);
  if (!cookie) return false;
  const expected = await tokenFor(expectedPassword);
  return safeEqual(cookie, expected);
}

/** Guard for admin API routes. Returns a 401 response when unauthenticated. */
export async function requireAdmin(
  request: Request,
): Promise<NextResponse | null> {
  if (await isAuthenticated(request)) return null;
  return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
}

/** Set-Cookie header value that establishes an admin session. */
export async function sessionCookie(password: string): Promise<string> {
  const token = await tokenFor(password);
  // 12h session, httpOnly, SameSite=Lax; Secure is added by the platform on https.
  return `${ADMIN_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200`;
}

/** Set-Cookie header value that clears the admin session. */
export function clearCookie(): string {
  return `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/** True when an admin password is configured at all. */
export function adminEnabled(): boolean {
  return adminPassword() !== null;
}
