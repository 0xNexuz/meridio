import { AnchorProvider, BN, Program } from "@anchor-lang/core";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

import idl from "./idl/meridio.json";
import type { Meridio } from "./idl/meridio";

export const PROGRAM_ID = new PublicKey(idl.address);
/** Circle's devnet USDC. */
export const USDC_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_USDC_MINT ?? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
);
export const USDC_DECIMALS = 6;
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";
export const CLUSTER = "devnet";

const enc = new TextEncoder();
const SEED_COLLECTION = enc.encode("collection");
const SEED_VAULT = enc.encode("vault");
const SEED_SHARE = enc.encode("share");

// ---------------------------------------------------------------- types

export type CollectionStatus = "open" | "locked" | "cancelled";
export type ShareStatus = "paid" | "pickedUp" | "refunded";

export interface CollectionView {
  address: PublicKey;
  organizer: PublicKey;
  vendor: PublicKey;
  station: PublicKey;
  mint: PublicKey;
  vault: PublicKey;
  collectionId: BN;
  title: string;
  unitPrice: bigint;
  feePerUnit: bigint;
  minBuyers: number;
  maxUnits: number;
  payBy: number;
  pickupBy: number;
  status: CollectionStatus;
  paidCount: number;
  pickedCount: number;
  refundedCount: number;
}

export interface ShareView {
  address: PublicKey;
  collection: PublicKey;
  buyer: PublicKey;
  amount: bigint;
  status: ShareStatus;
  paidAt: number;
  settledAt: number;
}

// ---------------------------------------------------------------- program

/** A read-only program handle; signing happens in the wallet, never here. */
export function getProgram(connection: Connection): Program<Meridio> {
  const dummy = Keypair.generate();
  const wallet = {
    publicKey: dummy.publicKey,
    signTransaction: async <T>(tx: T) => tx,
    signAllTransactions: async <T>(txs: T[]) => txs,
  };
  const provider = new AnchorProvider(connection, wallet as never, { commitment: "confirmed" });
  return new Program<Meridio>(idl as Meridio, provider);
}

export function collectionPda(organizer: PublicKey, id: BN): PublicKey {
  return PublicKey.findProgramAddressSync(
    [SEED_COLLECTION, organizer.toBytes(), id.toArrayLike(Uint8Array, "le", 8)],
    PROGRAM_ID,
  )[0];
}

export function vaultPda(collection: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([SEED_VAULT, collection.toBytes()], PROGRAM_ID)[0];
}

export function sharePda(collection: PublicKey, buyer: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [SEED_SHARE, collection.toBytes(), buyer.toBytes()],
    PROGRAM_ID,
  )[0];
}

export function ata(owner: PublicKey, mint: PublicKey = USDC_MINT): PublicKey {
  return getAssociatedTokenAddressSync(mint, owner, true);
}

// ---------------------------------------------------------------- decoding

function enumKey<T extends string>(v: object): T {
  return Object.keys(v)[0] as T;
}

const big = (b: BN) => BigInt(b.toString());

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toCollection(address: PublicKey, a: any): CollectionView {
  return {
    address,
    organizer: a.organizer,
    vendor: a.vendor,
    station: a.station,
    mint: a.mint,
    vault: a.vault,
    collectionId: a.collectionId,
    title: a.title,
    unitPrice: big(a.unitPrice),
    feePerUnit: big(a.feePerUnit),
    minBuyers: a.minBuyers,
    maxUnits: a.maxUnits,
    payBy: a.payBy.toNumber(),
    pickupBy: a.pickupBy.toNumber(),
    status: enumKey<CollectionStatus>(a.status),
    paidCount: a.paidCount,
    pickedCount: a.pickedCount,
    refundedCount: a.refundedCount,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toShare(address: PublicKey, a: any): ShareView {
  return {
    address,
    collection: a.collection,
    buyer: a.buyer,
    amount: big(a.amount),
    status: enumKey<ShareStatus>(a.status),
    paidAt: a.paidAt.toNumber(),
    settledAt: a.settledAt.toNumber(),
  };
}

export async function fetchCollection(connection: Connection, address: PublicKey) {
  const program = getProgram(connection);
  const a = await program.account.collection.fetchNullable(address);
  return a ? toCollection(address, a) : null;
}

export async function fetchAllCollections(connection: Connection) {
  const program = getProgram(connection);
  const all = await program.account.collection.all();
  return all
    .map((x) => toCollection(x.publicKey, x.account))
    .sort((a, b) => b.payBy - a.payBy);
}

/** Every share of one collection, read straight from chain (not a database). */
export async function fetchShares(connection: Connection, collection: PublicKey) {
  const program = getProgram(connection);
  // Share layout: 8-byte discriminator, then the `collection` pubkey.
  const all = await program.account.share.all([
    { memcmp: { offset: 8, bytes: collection.toBase58() } },
  ]);
  return all.map((x) => toShare(x.publicKey, x.account)).sort((a, b) => a.paidAt - b.paidAt);
}

export async function tokenBalance(connection: Connection, account: PublicKey): Promise<bigint> {
  try {
    const r = await connection.getTokenAccountBalance(account);
    return BigInt(r.value.amount);
  } catch {
    return BigInt(0);
  }
}

// ---------------------------------------------------------------- rules (mirror the program)

export function refundDue(c: CollectionView, now: number): boolean {
  if (c.status === "cancelled") return true;
  if (c.status === "locked") return now > c.pickupBy;
  return now > c.pickupBy || (now > c.payBy && c.paidCount < c.minBuyers);
}

// ---------------------------------------------------------------- instructions

export interface CreateParams {
  organizer: PublicKey;
  title: string;
  vendor: PublicKey;
  station: PublicKey;
  unitPrice: bigint;
  feePerUnit: bigint;
  minBuyers: number;
  maxUnits: number;
  payBy: number;
  pickupBy: number;
}

export async function createCollectionIx(connection: Connection, p: CreateParams) {
  const program = getProgram(connection);
  const collectionId = new BN(Date.now());
  const collection = collectionPda(p.organizer, collectionId);
  const ix = await program.methods
    .createCollection({
      collectionId,
      title: p.title,
      vendor: p.vendor,
      station: p.station,
      unitPrice: new BN(p.unitPrice.toString()),
      feePerUnit: new BN(p.feePerUnit.toString()),
      minBuyers: p.minBuyers,
      maxUnits: p.maxUnits,
      payBy: new BN(p.payBy),
      pickupBy: new BN(p.pickupBy),
    })
    .accountsStrict({
      organizer: p.organizer,
      mint: USDC_MINT,
      collection,
      vault: vaultPda(collection),
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
  return { ix, collection };
}

export async function payShareIx(connection: Connection, c: CollectionView, buyer: PublicKey) {
  return getProgram(connection)
    .methods.payShare()
    .accountsStrict({
      buyer,
      collection: c.address,
      mint: c.mint,
      vault: c.vault,
      buyerToken: ata(buyer, c.mint),
      share: sharePda(c.address, buyer),
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function cancelShareIx(connection: Connection, c: CollectionView, buyer: PublicKey) {
  return getProgram(connection)
    .methods.cancelShare()
    .accountsStrict({
      buyer,
      collection: c.address,
      mint: c.mint,
      vault: c.vault,
      buyerToken: ata(buyer, c.mint),
      share: sharePda(c.address, buyer),
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
}

export async function lockIx(connection: Connection, c: CollectionView, caller: PublicKey) {
  return getProgram(connection)
    .methods.lock()
    .accountsStrict({ caller, collection: c.address })
    .instruction();
}

export async function cancelCollectionIx(connection: Connection, c: CollectionView) {
  return getProgram(connection)
    .methods.cancelCollection()
    .accountsStrict({ organizer: c.organizer, collection: c.address })
    .instruction();
}

export async function closeCollectionIx(connection: Connection, c: CollectionView) {
  return getProgram(connection)
    .methods.closeCollection()
    .accountsStrict({
      organizer: c.organizer,
      collection: c.address,
      vault: c.vault,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
}

/** Refund one share. The cranker pays the fee and, if needed, recreates the buyer's token account. */
export async function refundIxs(
  connection: Connection,
  c: CollectionView,
  share: ShareView,
  cranker: PublicKey,
): Promise<TransactionInstruction[]> {
  const buyerToken = ata(share.buyer, c.mint);
  const ix = await getProgram(connection)
    .methods.refundShare()
    .accountsStrict({
      cranker,
      collection: c.address,
      mint: c.mint,
      vault: c.vault,
      share: share.address,
      buyerToken,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
  return [
    createAssociatedTokenAccountIdempotentInstruction(cranker, buyerToken, share.buyer, c.mint, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID),
    ix,
  ];
}

/**
 * The pickup transaction. The vendor's station pays the fee and co-signs;
 * the student's wallet adds the second signature.
 */
export async function buildPickupTx(
  connection: Connection,
  c: CollectionView,
  buyer: PublicKey,
): Promise<Transaction> {
  const vendorToken = ata(c.vendor, c.mint);
  const organizerToken = ata(c.organizer, c.mint);
  const ix = await getProgram(connection)
    .methods.confirmPickup()
    .accountsStrict({
      buyer,
      station: c.station,
      collection: c.address,
      mint: c.mint,
      vault: c.vault,
      share: sharePda(c.address, buyer),
      vendorToken,
      organizerToken,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: c.station, blockhash, lastValidBlockHeight });
  tx.add(
    createAssociatedTokenAccountIdempotentInstruction(c.station, vendorToken, c.vendor, c.mint, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID),
    createAssociatedTokenAccountIdempotentInstruction(c.station, organizerToken, c.organizer, c.mint, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID),
    ix,
  );
  return tx;
}

// ---------------------------------------------------------------- formatting

export function usdc(amount: bigint): string {
  const whole = amount / BigInt(1_000_000);
  const frac = (amount % BigInt(1_000_000)).toString().padStart(6, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac.slice(0, 2).padEnd(2, "0")}` : `${whole}`;
}

export function parseUsdc(input: string): bigint {
  const t = input.trim();
  if (!/^\d+(\.\d{0,6})?$/.test(t)) throw new Error("Enter an amount like 18 or 18.50");
  const [w, f = ""] = t.split(".");
  return BigInt(w) * BigInt(1_000_000) + BigInt(f.padEnd(6, "0"));
}

export function short(k: PublicKey | string): string {
  const s = typeof k === "string" ? k : k.toBase58();
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

export function explorer(kind: "address" | "tx", value: string): string {
  return `https://explorer.solana.com/${kind}/${value}?cluster=${CLUSTER}`;
}
