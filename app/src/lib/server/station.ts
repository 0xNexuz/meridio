import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";

/**
 * The vendor's pickup station key. For the hackathon demo it lives in a server
 * environment variable; in production it would stay on the vendor's own phone.
 */
export function stationKeypair(): Keypair | null {
  return readStationKey().keypair;
}

/**
 * Reads STATION_SECRET_KEY. Accepts the JSON array written by `solana-keygen`
 * (`[12,34,...]`) or a base58 secret key, and forgives what people paste by
 * accident: surrounding quotes, whitespace, or a leading `STATION_SECRET_KEY=`.
 * Never returns or logs the secret itself.
 */
export function readStationKey(): { keypair: Keypair | null; problem: string | null } {
  const raw = process.env.STATION_SECRET_KEY;
  if (!raw || !raw.trim()) return { keypair: null, problem: "STATION_SECRET_KEY is not set" };
  let t = raw.trim().replace(/^STATION_SECRET_KEY\s*=\s*/, "").replace(/^['"]|['"]$/g, "").trim();
  try {
    let bytes: Uint8Array;
    if (t.includes("[")) {
      t = t.slice(t.indexOf("["), t.lastIndexOf("]") + 1);
      bytes = Uint8Array.from(JSON.parse(t));
    } else {
      bytes = bs58.decode(t);
    }
    if (bytes.length !== 64) {
      return { keypair: null, problem: `STATION_SECRET_KEY has ${bytes.length} bytes; a Solana secret key has 64` };
    }
    return { keypair: Keypair.fromSecretKey(bytes), problem: null };
  } catch {
    return { keypair: null, problem: "STATION_SECRET_KEY could not be read; paste the whole [..] array from station.json" };
  }
}

/** True when the server has what it needs to run a pickup station. */
export function stationReady(): boolean {
  return stationProblem() === null;
}

/** Why the station cannot run, or null when it can. Safe to show: names settings, never values. */
export function stationProblem(): string | null {
  const key = readStationKey();
  if (key.problem) return key.problem;
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) return "SESSION_SECRET is not set (16+ characters)";
  return null;
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET is not set (16+ characters)");
  return s;
}

function mac(...parts: string[]): string {
  return createHmac("sha256", secret()).update(parts.join("|")).digest("base64url");
}

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export const SESSION_SECONDS = 4 * 60 * 60;
export const CODE_SECONDS = 90;
const SIGN_IN_WINDOW = 5 * 60;

/** The exact text the vendor signs to open a station. */
export function stationSignInMessage(collection: string, timestamp: number): string {
  return `Meridio: open pickup station for collection ${collection} at ${timestamp}`;
}

/** Verify the vendor's wallet signature and issue a station session token. */
export function openSession(
  collection: string,
  vendor: PublicKey,
  timestamp: number,
  signatureB58: string,
): { token: string; exp: number } | null {
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > SIGN_IN_WINDOW) return null;
  const message = new TextEncoder().encode(stationSignInMessage(collection, timestamp));
  let sig: Uint8Array;
  try {
    sig = bs58.decode(signatureB58);
  } catch {
    return null;
  }
  if (!nacl.sign.detached.verify(message, sig, vendor.toBytes())) return null;
  const exp = now + SESSION_SECONDS;
  return { token: `${exp}.${mac("session", collection, String(exp))}`, exp };
}

export function checkSession(collection: string, token: string): boolean {
  const [expS, m] = token.split(".");
  const exp = Number(expS);
  if (!exp || !m || exp < Math.floor(Date.now() / 1000)) return false;
  return same(m, mac("session", collection, expS));
}

/** A short-lived pickup code, shown only on the vendor's station screen. */
export function issuePickupCode(collection: string): { code: string; exp: number } {
  const exp = Math.floor(Date.now() / 1000) + CODE_SECONDS;
  return { code: mac("pickup", collection, String(exp)), exp };
}

export function checkPickupCode(collection: string, code: string, exp: number): boolean {
  if (!exp || exp < Math.floor(Date.now() / 1000)) return false;
  return same(code, mac("pickup", collection, String(exp)));
}
