import { Transaction, type PublicKey, type TransactionInstruction } from "@solana/web3.js";

/**
 * Before a student's wallet signs a pickup transaction that came from the server,
 * check it is exactly the transaction the app expects.
 *
 * Expected instructions are rebuilt locally from on-chain data. We compile them into
 * a message with the server's fee payer and blockhash and require the bytes to match
 * the message the wallet is about to sign, so a compromised or malicious server cannot
 * add a transfer, swap an account, change data, or change who signs or is written.
 *
 * Comparing compiled messages (not per-instruction flags) matters: once a transaction
 * is serialized, signer/writable flags are stored per message, so a decoded instruction
 * reports the fee payer as writable even when the instruction itself did not ask for it.
 *
 * Returns null when it matches, or a short reason when it does not.
 */
export function pickupTxMismatch(
  tx: Transaction,
  expected: TransactionInstruction[],
  expectedFeePayer: PublicKey,
): string | null {
  if (!tx.feePayer || !tx.feePayer.equals(expectedFeePayer)) return "unexpected fee payer";
  if (!tx.recentBlockhash) return "missing blockhash";

  // Readable reasons first (program, data, accounts), then the exact byte check.
  if (tx.instructions.length !== expected.length) return "unexpected number of instructions";
  for (let i = 0; i < expected.length; i++) {
    const got = tx.instructions[i];
    const want = expected[i];
    if (!got.programId.equals(want.programId)) return `instruction ${i}: unexpected program`;
    if (!Buffer.from(got.data).equals(Buffer.from(want.data))) return `instruction ${i}: unexpected data`;
    if (got.keys.length !== want.keys.length) return `instruction ${i}: unexpected accounts`;
    for (let k = 0; k < want.keys.length; k++) {
      if (!got.keys[k].pubkey.equals(want.keys[k].pubkey)) return `instruction ${i}: unexpected account ${k}`;
    }
  }

  const want = new Transaction({ feePayer: expectedFeePayer, recentBlockhash: tx.recentBlockhash })
    .add(...expected)
    .serializeMessage();
  const got = tx.serializeMessage();
  if (!Buffer.from(got).equals(Buffer.from(want))) return "unexpected signer or writable account";
  return null;
}
