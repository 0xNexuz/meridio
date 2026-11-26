"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";

import { HeroArt } from "@/components/HeroArt";
import { fetchAllCollections, usdc, type CollectionView } from "@/lib/meridio";

const STATUS_LABEL = { open: "Taking payments", locked: "Pickups open", cancelled: "Cancelled" } as const;

export default function Home() {
  const { connection } = useConnection();
  const [items, setItems] = useState<CollectionView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAllCollections(connection)
      .then(setItems)
      .catch(() => setError("Could not reach Solana devnet. Refresh to try again."));
  }, [connection]);

  return (
    <div className="space-y-14">
      {/* hero */}
      <section className="bleed text-center">
        <div className="mx-auto max-w-4xl px-5 pt-8 sm:pt-12">
          <h1 className="font-display text-6xl font-bold leading-[0.95] tracking-tight sm:text-8xl">Meet Meridio,</h1>
          <p className="mx-auto mt-4 max-w-xl text-balance text-base sm:text-lg">
            your share of the class order, held in a vault until the book is in your hand.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/new" className="rounded-2xl bg-ink px-5 py-3 text-sm font-medium text-paper">
              Start a collection
            </Link>
            <Link href="/#how" className="rounded-2xl border border-ink/15 px-5 py-3 text-sm font-medium">
              How it works
            </Link>
          </div>
        </div>
        <HeroArt className="mx-auto mt-4 w-full max-w-[1200px]" />
        <p className="mt-1 px-5 text-xs text-muted">
          Illustration: a class of 7 sharing an 84 USDC order. Meridio is Greek for a share (μερίδιο).
        </p>
      </section>

      <section id="how" className="scroll-mt-24 space-y-4">
        <h2 className="font-display text-3xl font-semibold tracking-tight">Money moves only at pickup</h2>
        <p className="max-w-xl text-muted">
          Class money for textbooks, handouts and dues usually goes to one person&apos;s account. With Meridio it
          goes into a vault no one can empty. The vendor is paid one share at a time, only when a student
          collects. Anything not collected goes back to whoever paid it.
        </p>
        <ol className="grid gap-3 text-sm sm:grid-cols-3">
          {[
            ["01", "Pay your share", "Your money waits in the vault, not with the course rep.", "bg-periwinkle"],
            ["02", "Collect at the stand", "You and the vendor both sign. Only your share moves.", "bg-stamp"],
            ["03", "Not collected?", "After the deadline, your share comes back to you.", "bg-sky"],
          ].map(([n, t, d, dot]) => (
            <li key={t} className="rounded-2xl border border-rule bg-card p-4">
              <p className="flex items-center gap-2">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${dot}`} />
                <span className="font-display text-sm text-muted">{n}</span>
              </p>
              <p className="mt-2 font-medium">{t}</p>
              <p className="mt-1 text-muted">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="collections" className="scroll-mt-24 space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-3xl font-semibold tracking-tight">Collections</h2>
          <Link href="/new" className="text-sm underline underline-offset-4">
            Start one
          </Link>
        </div>
        {error && <p className="text-sm text-alert">{error}</p>}
        {!items && !error && <p className="text-sm text-muted">Loading from devnet…</p>}
        {items && items.length === 0 && (
          <p className="text-sm text-muted">No collections yet. Start the first one.</p>
        )}
        <ul className="divide-y divide-rule overflow-hidden rounded-2xl border border-rule bg-card">
          {items?.map((c) => {
            const taken = c.paidCount + c.pickedCount + c.refundedCount;
            return (
              <li key={c.address.toBase58()}>
                <Link href={`/c/${c.address.toBase58()}`} className="flex items-center justify-between gap-4 p-4 hover:bg-paper">
                  <div>
                    <p className="font-medium">{c.title}</p>
                    <p className="text-sm text-muted">
                      {usdc(c.unitPrice + c.feePerUnit)} USDC a share · {STATUS_LABEL[c.status]}
                    </p>
                  </div>
                  <p className="tabular text-right text-sm text-muted">
                    {taken}/{c.maxUnits} paid
                    <br />
                    {c.pickedCount} collected
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
