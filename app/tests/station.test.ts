// Server-side pickup station: sessions and pickup codes.
// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";

process.env.SESSION_SECRET = "test-secret-that-is-long-enough";
const station = await import("../src/lib/server/station.ts");

const vendor = Keypair.generate();
const A = Keypair.generate().publicKey.toBase58();
const B = Keypair.generate().publicKey.toBase58();
const now = () => Math.floor(Date.now() / 1000);

function sign(kp: Keypair, collection: string, ts: number) {
  const msg = new TextEncoder().encode(station.stationSignInMessage(collection, ts));
  return bs58.encode(nacl.sign.detached(msg, kp.secretKey));
}

test("vendor signature opens a session for that collection only", () => {
  const ts = now();
  const s = station.openSession(A, vendor.publicKey, ts, sign(vendor, A, ts));
  assert.ok(s);
  assert.equal(station.checkSession(A, s.token), true);
  assert.equal(station.checkSession(B, s.token), false, "token must not work for another collection");
});

test("someone else's wallet cannot open the vendor's station", () => {
  const ts = now();
  const intruder = Keypair.generate();
  assert.equal(station.openSession(A, vendor.publicKey, ts, sign(intruder, A, ts)), null);
});

test("a signature for one collection cannot open another", () => {
  const ts = now();
  assert.equal(station.openSession(B, vendor.publicKey, ts, sign(vendor, A, ts)), null);
});

test("stale or future sign-in timestamps are refused", () => {
  const old = now() - 10 * 60;
  const future = now() + 10 * 60;
  assert.equal(station.openSession(A, vendor.publicKey, old, sign(vendor, A, old)), null);
  assert.equal(station.openSession(A, vendor.publicKey, future, sign(vendor, A, future)), null);
});

test("garbage signatures and tampered tokens are refused", () => {
  const ts = now();
  assert.equal(station.openSession(A, vendor.publicKey, ts, "not-base58-!!"), null);
  const s = station.openSession(A, vendor.publicKey, ts, sign(vendor, A, ts));
  assert.ok(s);
  const [, m] = s.token.split(".");
  assert.equal(station.checkSession(A, `${s.exp + 99999}.${m}`), false, "extending expiry breaks the MAC");
  assert.equal(station.checkSession(A, "garbage"), false);
  assert.equal(station.checkSession(A, ""), false);
});

test("pickup codes are bound to the collection and expire", () => {
  const { code, exp } = station.issuePickupCode(A);
  assert.equal(station.checkPickupCode(A, code, exp), true);
  assert.equal(station.checkPickupCode(B, code, exp), false);
  assert.equal(station.checkPickupCode(A, code, exp + 600), false, "cannot stretch a code's life");
  assert.equal(station.checkPickupCode(A, code, now() - 1), false);
  assert.equal(station.checkPickupCode(A, "x" + code.slice(1), exp), false);
});

test("station is not ready without both secrets", () => {
  const saved = process.env.STATION_SECRET_KEY;
  delete process.env.STATION_SECRET_KEY;
  assert.equal(station.stationReady(), false);
  process.env.STATION_SECRET_KEY = JSON.stringify(Array.from(Keypair.generate().secretKey));
  assert.equal(station.stationReady(), true);
  process.env.SESSION_SECRET = "short";
  assert.equal(station.stationReady(), false);
  process.env.SESSION_SECRET = "test-secret-that-is-long-enough";
  if (saved === undefined) delete process.env.STATION_SECRET_KEY;
  else process.env.STATION_SECRET_KEY = saved;
});
