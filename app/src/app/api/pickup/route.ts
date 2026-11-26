import type { NextRequest } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";

import { RPC_URL, buildPickupTx, fetchCollection, getProgram, sharePda } from "@/lib/meridio";
import { checkPickupCode, stationKeypair } from "@/lib/server/station";

/**
 * Solana Pay transaction request for a pickup.
 * GET  -> label and icon for the wallet.
 * POST -> { account } in; a transaction already signed by the vendor's
 *         station comes back for the student's wallet to sign.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function fail(error: string, status = 400) {
  return Response.json({ error, message: error }, { status, headers: CORS });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function GET(request: NextRequest) {
  const icon = new URL("/icon.png", request.nextUrl.origin).toString();
  return Response.json({ label: "Meridio pickup", icon }, { headers: CORS });
}

export async function POST(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const collectionParam = q.get("collection") ?? "";
  const code = q.get("code") ?? "";
  const exp = Number(q.get("exp") ?? 0);

  if (!checkPickupCode(collectionParam, code, exp)) {
    return fail("This pickup code has expired. Scan the code on the vendor's screen again.", 403);
  }

  let account: PublicKey, collection: PublicKey;
  try {
    const body = await request.json();
    account = new PublicKey(body.account);
    collection = new PublicKey(collectionParam);
  } catch {
    return fail("Bad request");
  }

  const station = stationKeypair();
  if (!station) return fail("Pickup station is not configured on this server.", 500);

  const connection = new Connection(RPC_URL, "confirmed");
  const c = await fetchCollection(connection, collection);
  if (!c) return fail("Collection not found.", 404);
  if (!c.station.equals(station.publicKey)) return fail("This server is not this collection's station.", 403);
  if (c.status !== "locked") return fail("Pickups have not started for this collection.");
  if (Math.floor(Date.now() / 1000) > c.pickupBy) return fail("The pickup deadline has passed.");

  // Friendly checks before asking the wallet to sign. The program enforces them anyway.
  const share = await getProgram(connection).account.share.fetchNullable(sharePda(collection, account));
  if (!share) return fail("This wallet has no paid share in this collection.");
  if (!("paid" in share.status)) return fail("This share has already been collected or refunded.");

  const tx = await buildPickupTx(connection, c, account);
  tx.partialSign(station);
  const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });

  return Response.json(
    {
      transaction: serialized.toString("base64"),
      message: `Collect: ${c.title}`,
    },
    { headers: { ...CORS, "Cache-Control": "no-store" } },
  );
}
