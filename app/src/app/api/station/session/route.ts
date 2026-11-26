import { Connection, PublicKey } from "@solana/web3.js";

import { RPC_URL, fetchCollection } from "@/lib/meridio";
import { openSession, stationReady } from "@/lib/server/station";

/** The vendor proves they own the vendor wallet by signing a message. */
export async function POST(request: Request) {
  if (!stationReady()) {
    return Response.json({ error: "Pickup station is not configured on this server." }, { status: 503 });
  }
  let body: { collection?: string; timestamp?: number; signature?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }
  const { collection, timestamp, signature } = body;
  if (!collection || !timestamp || !signature) {
    return Response.json({ error: "Missing fields" }, { status: 400 });
  }
  let address: PublicKey;
  try {
    address = new PublicKey(collection);
  } catch {
    return Response.json({ error: "Bad collection address" }, { status: 400 });
  }
  const c = await fetchCollection(new Connection(RPC_URL, "confirmed"), address);
  if (!c) return Response.json({ error: "Collection not found" }, { status: 404 });

  const session = openSession(collection, c.vendor, timestamp, signature);
  if (!session) {
    return Response.json(
      { error: "Only the vendor's wallet can open this pickup station." },
      { status: 403 },
    );
  }
  return Response.json(session);
}
