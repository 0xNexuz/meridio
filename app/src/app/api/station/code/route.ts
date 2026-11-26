import type { NextRequest } from "next/server";

import { checkSession, issuePickupCode, stationReady } from "@/lib/server/station";

/** A fresh pickup code for the vendor's screen. Requires a station session. */
export async function GET(request: NextRequest) {
  if (!stationReady()) {
    return Response.json({ error: "Pickup station is not configured on this server." }, { status: 503 });
  }
  const collection = request.nextUrl.searchParams.get("collection") ?? "";
  const session = request.headers.get("x-station-session") ?? "";
  if (!collection || !checkSession(collection, session)) {
    return Response.json({ error: "Station session expired. Sign in again." }, { status: 401 });
  }
  return Response.json(issuePickupCode(collection), {
    headers: { "Cache-Control": "no-store" },
  });
}
