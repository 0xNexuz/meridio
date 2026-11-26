// Client-side check that a server-built pickup transaction is exactly what we expect.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";

const { pickupTxMismatch } = await import("../src/lib/pickupCheck.ts");

const program = Keypair.generate().publicKey;
const station = Keypair.generate().publicKey;
const buyer = Keypair.generate().publicKey;
const vault = Keypair.generate().publicKey;
const vendorToken = Keypair.generate().publicKey;

function expected(): TransactionInstruction[] {
  return [
    new TransactionInstruction({
      programId: program,
      keys: [
        { pubkey: buyer, isSigner: true, isWritable: false },
        { pubkey: station, isSigner: true, isWritable: false },
        { pubkey: vault, isSigner: false, isWritable: true },
        { pubkey: vendorToken, isSigner: false, isWritable: true },
      ],
      data: Buffer.from([1, 2, 3, 4]),
    }),
  ];
}

function tx(ixs: TransactionInstruction[], feePayer: PublicKey = station) {
  const t = new Transaction({ feePayer, blockhash: "11111111111111111111111111111111", lastValidBlockHeight: 1 });
  return t.add(...ixs);
}

/** What the browser actually receives: serialized by the server, decoded by the client. */
function roundTrip(t: Transaction, signers: Keypair[] = []) {
  if (signers.length) t.partialSign(...signers);
  const wire = t.serialize({ requireAllSignatures: false, verifySignatures: false });
  return Transaction.from(wire);
}

test("the honest transaction passes", () => {
  assert.equal(pickupTxMismatch(tx(expected()), expected(), station), null);
});

test("the honest transaction still passes after the trip over the wire (regression)", () => {
  // Decoding marks the fee payer writable in every instruction; that must not be a mismatch.
  assert.equal(pickupTxMismatch(roundTrip(tx(expected())), expected(), station), null);
});

test("a signed-by-station honest transaction passes after the trip", () => {
  const st = Keypair.generate();
  const exp = expected().map((ix) => {
    ix.keys = ix.keys.map((k) => (k.pubkey.equals(station) ? { ...k, pubkey: st.publicKey } : k));
    return ix;
  });
  const t = new Transaction({ feePayer: st.publicKey, blockhash: "11111111111111111111111111111111", lastValidBlockHeight: 1 }).add(...exp);
  assert.equal(pickupTxMismatch(roundTrip(t, [st]), exp, st.publicKey), null);
});

test("an extra transfer out of the student's wallet is caught", () => {
  const drain = SystemProgram.transfer({ fromPubkey: buyer, toPubkey: Keypair.generate().publicKey, lamports: 1 });
  assert.match(pickupTxMismatch(tx([...expected(), drain]), expected(), station) ?? "", /number of instructions/);
});

test("a swapped destination account is caught", () => {
  const bad = expected();
  bad[0].keys[3] = { pubkey: Keypair.generate().publicKey, isSigner: false, isWritable: true };
  assert.match(pickupTxMismatch(tx(bad), expected(), station) ?? "", /account 3/);
});

test("changed instruction data is caught", () => {
  const bad = expected();
  bad[0].data = Buffer.from([9, 9, 9, 9]);
  assert.match(pickupTxMismatch(tx(bad), expected(), station) ?? "", /data/);
});

test("making the student pay the fee is caught", () => {
  assert.match(pickupTxMismatch(tx(expected(), buyer), expected(), station) ?? "", /fee payer/);
});

test("making the student's account writable is caught, even after the trip", () => {
  const bad = expected();
  bad[0].keys[0] = { pubkey: buyer, isSigner: true, isWritable: true };
  assert.match(pickupTxMismatch(roundTrip(tx(bad)), expected(), station) ?? "", /signer or writable/);
});

test("an extra transfer is caught after the trip too", () => {
  const drain = SystemProgram.transfer({ fromPubkey: buyer, toPubkey: Keypair.generate().publicKey, lamports: 1 });
  assert.match(pickupTxMismatch(roundTrip(tx([...expected(), drain])), expected(), station) ?? "", /number of instructions/);
});
