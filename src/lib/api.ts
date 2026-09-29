import { NextResponse } from "next/server";

export function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function cleanName(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function isUniqueError(value: unknown) {
  return Boolean(
    value &&
    typeof value === "object" &&
    "code" in value &&
    value.code === "P2002",
  );
}

/** Parse request JSON, returning a plain object. Never throws. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function parseBody(
  request: Request,
): Promise<Record<string, any>> {
  try {
    const val = await request.json();
    if (val && typeof val === "object" && !Array.isArray(val)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return val as Record<string, any>;
    }
  } catch {
    // fall through
  }
  return {};
}
