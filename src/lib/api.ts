import { NextResponse } from "next/server";

export function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function cleanName(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
