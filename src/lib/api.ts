import { NextResponse } from "next/server";

export function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function cleanName(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function isUniqueError(value: unknown) {
  return Boolean(value && typeof value === "object" && "code" in value && value.code === "P2002");
}
