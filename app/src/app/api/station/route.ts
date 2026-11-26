import { stationKeypair } from "@/lib/server/station";

/** Public key of the pickup station this server co-signs for. */
export async function GET() {
  const kp = stationKeypair();
  return Response.json({ station: kp ? kp.publicKey.toBase58() : null });
}
