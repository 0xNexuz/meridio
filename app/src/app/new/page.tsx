"use client";

import { useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";

import { TxStatus } from "@/components/TxStatus";
import { useSend } from "@/components/useSend";
import { createCollectionIx, parseUsdc } from "@/lib/meridio";

function localInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function NewCollectionInner() {
  const router = useRouter();
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const { send, state } = useSend();

  const now = new Date();
  const [form, setForm] = useState({
    title: "",
    price: "18",
    fee: "0",
    copies: "40",
    minBuyers: "2",
    vendor: "",
    payBy: localInput(new Date(now.getTime() + 2 * 86400_000)),
    pickupBy: localInput(new Date(now.getTime() + 9 * 86400_000)),
  });
  const [station, setStation] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/station")
      .then((r) => r.json())
      .then((j) => setStation(j.station ?? null))
      .catch(() => setStation(null));
  }, []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!publicKey) return setFormError("Connect your wallet first.");
    if (!station) return setFormError("The pickup station is not set up on this server.");
    let vendor: PublicKey, unitPrice: bigint, feePerUnit: bigint;
    try {
      vendor = new PublicKey(form.vendor.trim());
    } catch {
      return setFormError("The vendor wallet address is not valid.");
    }
    try {
      unitPrice = parseUsdc(form.price);
      feePerUnit = parseUsdc(form.fee || "0");
    } catch (err) {
      return setFormError((err as Error).message);
    }
    const payBy = Math.floor(new Date(form.payBy).getTime() / 1000);
    const pickupBy = Math.floor(new Date(form.pickupBy).getTime() / 1000);

    let address: PublicKey | null = null;
    const sig = await send("Create collection", async () => {
      const { ix, collection } = await createCollectionIx(connection, {
        organizer: publicKey,
        title: form.title.trim(),
        vendor,
        station: new PublicKey(station),
        unitPrice,
        feePerUnit,
        minBuyers: Number(form.minBuyers),
        maxUnits: Number(form.copies),
        payBy,
        pickupBy,
      });
      address = collection;
      return [ix];
    });
    if (sig && address) router.push(`/c/${(address as PublicKey).toBase58()}`);
  }

  const field = "mt-1 w-full rounded-md border border-rule bg-card px-3 py-2 text-ink";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl">Start a collection</h1>
        <p className="mt-2 text-sm text-muted">
          You set it up; you never hold the money. Prices are in USDC. The fee is what you earn per
          copy collected, at most 10% of the price.
        </p>
      </div>
      <form onSubmit={submit} className="space-y-4 rounded-lg border border-rule bg-card p-5">
        <label className="block text-sm">
          What are you buying?
          <input className={field} value={form.title} onChange={set("title")} maxLength={64} required placeholder="e.g. BIO 201 textbook" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            Price per copy (USDC)
            <input className={field} inputMode="decimal" value={form.price} onChange={set("price")} required />
          </label>
          <label className="block text-sm">
            Your fee per copy (USDC, optional)
            <input className={field} inputMode="decimal" value={form.fee} onChange={set("fee")} />
          </label>
          <label className="block text-sm">
            Copies available
            <input className={field} type="number" min={1} value={form.copies} onChange={set("copies")} required />
          </label>
          <label className="block text-sm">
            Minimum students to go ahead
            <input className={field} type="number" min={1} value={form.minBuyers} onChange={set("minBuyers")} required />
          </label>
        </div>
        <label className="block text-sm">
          Vendor&apos;s wallet address
          <input className={`${field} font-mono text-xs`} value={form.vendor} onChange={set("vendor")} placeholder="The bookshop's Solana address" required />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            Pay by
            <input className={field} type="datetime-local" value={form.payBy} onChange={set("payBy")} required />
          </label>
          <label className="block text-sm">
            Collect by (refunds after this)
            <input className={field} type="datetime-local" value={form.pickupBy} onChange={set("pickupBy")} required />
          </label>
        </div>
        {formError && <p className="text-sm text-alert">{formError}</p>}
        <TxStatus state={state} />
        <button
          type="submit"
          disabled={state.kind === "pending"}
          className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper disabled:opacity-50"
        >
          Create collection
        </button>
      </form>
    </div>
  );
}

export default function NewCollection() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <NewCollectionInner />
    </Suspense>
  );
}
