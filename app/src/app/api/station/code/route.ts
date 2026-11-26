import type { NextRequest } from "next/server";

import { checkSession, issuePickupCode } from "@/lib/server/station";

/** A fresh pickup code for the vendor's screen. Requires a station session. */
export async function GET(request: NextRequest) {
  const collection = request.nextUrl.searchParams.get("collection") ?? "";
  const session = request.headers.get("x-station-session") ?? "";
  if (!collection || !checkSession(collection, session)) {
    return Response.json({ error: "Station session expired. Sign in again." }, { status: 401 });
  }
  return Response.json(issuePickupCode(collection), {
    headers: { "Cache-Control": "no-store" },
  });
}
