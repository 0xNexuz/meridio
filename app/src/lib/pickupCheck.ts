import type { PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";

/**
 * Before a student's wallet signs a pickup transaction that came from the server,
 * check it is exactly the transaction the app expects: same fee payer, and the same
 * instructions (program, accounts, signer/writable flags and data) in the same order.
 *
 * Expected instructions are rebuilt locally from on-chain data, so a compromised or
 * malicious server cannot slip in an extra transfer or swap an account.
 * Returns null when it matches, or a reason when it does not.
 */
export function pickupTxMismatch(
  tx: Transaction,
  expected: TransactionInstruction[],
  expectedFeePayer: PublicKey,
): string | null {
  if (!tx.feePayer || !tx.feePayer.equals(expectedFeePayer)) return "unexpected fee payer";
  if (tx.instructions.length !== expected.length) return "unexpected number of instructions";
  for (let i = 0; i < expected.length; i++) {
    const got = tx.instructions[i];
    const want = expected[i];
    if (!got.programId.equals(want.programId)) return `instruction ${i}: unexpected program`;
    if (!Buffer.from(got.data).equals(Buffer.from(want.data))) return `instruction ${i}: unexpected data`;
    if (got.keys.length !== want.keys.length) return `instruction ${i}: unexpected accounts`;
    for (let k = 0; k < want.keys.length; k++) {
      const a = got.keys[k];
      const b = want.keys[k];
      if (!a.pubkey.equals(b.pubkey) || a.isSigner !== b.isSigner || a.isWritable !== b.isWritable) {
        return `instruction ${i}: unexpected account ${k}`;
      }
    }
  }
  return null;
}
