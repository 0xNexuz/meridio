import { connection } from "next/server";

import { readStationKey, stationProblem } from "@/lib/server/station";

/**
 * Public key of the pickup station this server co-signs for.
 * Runs on every request (not prerendered at build), so it reflects the server's
 * current settings. When the station is not ready it says which setting is wrong,
 * never its value.
 */
export async function GET() {
  await connection();
  const { keypair } = readStationKey();
  return Response.json(
    { station: keypair ? keypair.publicKey.toBase58() : null, problem: stationProblem() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
