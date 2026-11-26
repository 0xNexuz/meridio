"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";

import { useCollection } from "@/components/useCollection";
import { friendlyError } from "@/lib/errors";
import { explorer, usdc } from "@/lib/meridio";

function Collect() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const { collection: c, shares, refresh } = useCollection(id);
  const [state, setState] = useState<
    { kind: "idle" } | { kind: "pending" } | { kind: "done"; sig: string } | { kind: "error"; msg: string }
  >({ kind: "idle" });

  const mine = publicKey ? shares.find((s) => s.buyer.equals(publicKey)) : undefined;

  async function collect() {
    if (!publicKey || !signTransaction) return setState({ kind: "error", msg: "Connect your wallet first." });
    setState({ kind: "pending" });
    try {
      // Same request a Solana Pay wallet makes when it scans the station QR.
      const q = `collection=${id}&code=${encodeURIComponent(search.get("code") ?? "")}&exp=${search.get("exp") ?? ""}`;
      const r = await fetch(`/api/pickup?${q}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account: publicKey.toBase58() }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Pickup request failed");
      const tx = Transaction.from(Buffer.from(j.transaction, "base64"));
      // The station already signed and pays the fee; the wallet adds the student's signature.
      const signed = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(sig, "confirmed");
      setState({ kind: "done", sig });
      refresh();
    } catch (e) {
      setState({ kind: "error", msg: friendlyError(e) });
    }
  }

  if (!c) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/c/${id}`} className="text-sm text-muted underline underline-offset-4">Back to collection</Link>
        <h1 className="mt-2 font-serif text-3xl">Collect: {c.title}</h1>
      </div>
      <div className="space-y-3 rounded-lg border border-rule bg-card p-5">
        {!publicKey && <p className="text-sm">Connect the wallet you paid with.</p>}
        {publicKey && !mine && <p className="text-sm text-alert">This wallet has no share in this collection.</p>}
        {mine && mine.status !== "paid" && <p className="text-sm">This share is already {mine.status === "pickedUp" ? "collected" : "refunded"}.</p>}
        {mine && mine.status === "paid" && state.kind !== "done" && (
          <>
            <p className="text-sm">
              Only confirm once the item is in your hand. {usdc(c.unitPrice)} USDC of your share goes to the vendor
              {c.feePerUnit > BigInt(0) ? ` and ${usdc(c.feePerUnit)} to the organiser` : ""}.
            </p>
            <button className="rounded-full bg-stamp px-4 py-2 text-sm font-medium text-paper disabled:opacity-50"
              disabled={state.kind === "pending"} onClick={collect}>
              I have received it
            </button>
          </>
        )}
        {state.kind === "pending" && <p className="text-sm text-muted">Waiting for your wallet and the network…</p>}
        {state.kind === "error" && <p className="text-sm text-alert">{state.msg}</p>}
        {state.kind === "done" && (
          <p className="text-sm text-stamp">
            Collected. Your share was paid to the vendor.{" "}
            <a className="underline" href={explorer("tx", state.sig)} target="_blank" rel="noreferrer">View on explorer</a>
          </p>
        )}
      </div>
    </div>
  );
}

export default function CollectPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <Collect />
    </Suspense>
  );
}
