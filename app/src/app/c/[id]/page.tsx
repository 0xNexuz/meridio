"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

import { TxStatus } from "@/components/TxStatus";
import { DonutLegend, ShareDonut } from "@/components/ShareDonut";
import { useCollection } from "@/components/useCollection";
import { useSend } from "@/components/useSend";
import {
  cancelCollectionIx,
  cancelShareIx,
  closeCollectionIx,
  explorer,
  lockIx,
  payShareIx,
  refundDue,
  refundIxs,
  short,
  usdc,
  type ShareStatus,
} from "@/lib/meridio";

const SHARE_LABEL: Record<ShareStatus, string> = {
  paid: "In vault",
  pickedUp: "Collected",
  refunded: "Refunded",
};
const SHARE_STYLE: Record<ShareStatus, string> = {
  paid: "bg-paper text-ink",
  pickedUp: "bg-stamp-soft text-stamp",
  refunded: "bg-paper text-muted",
};

function when(ts: number) {
  return new Date(ts * 1000).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

const CHAIN_CLOCK_MARGIN = 60;

function CollectionPageInner() {
  const { id } = useParams<{ id: string }>();
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const { collection: c, shares, vaultBalance, status, refresh } = useCollection(id);
  const { send, state } = useSend();
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 5000);
    return () => clearInterval(t);
  }, []);

  if (status === "loading") return <p className="text-sm text-muted">Loading from devnet…</p>;
  if (status === "missing" || !c) return <p className="text-sm text-alert">No collection at this address.</p>;

  const shareAmount = c.unitPrice + c.feePerUnit;
  const mine = publicKey ? shares.find((s) => s.buyer.equals(publicKey)) : undefined;
  const isOrganizer = !!publicKey && publicKey.equals(c.organizer);
  const isVendor = !!publicKey && publicKey.equals(c.vendor);
  // Solana's clock can trail the phone's by up to a minute; offer refunds only once the
  // chain will certainly accept them.
  const dueRefunds = refundDue(c, now - CHAIN_CLOCK_MARGIN) ? shares.filter((s) => s.status === "paid") : [];
  const taken = c.paidCount + c.pickedCount;

  const run = async (label: string, build: Parameters<typeof send>[1]) => {
    await send(label, build);
    await refresh();
  };

  const phase =
    c.status === "cancelled"
      ? "Cancelled by the organiser. Every share can be refunded."
      : c.status === "open"
        ? now <= c.payBy
          ? `Taking payments until ${when(c.payBy)}.`
          : c.paidCount >= c.minBuyers
            ? "Payments closed. Waiting for the order to be locked."
            : "Not enough students paid. Shares can be refunded."
        : now <= c.pickupBy
          ? `Order locked. Collect by ${when(c.pickupBy)}.`
          : "Pickup time is over. Uncollected shares go back to students.";

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <p className="text-sm text-muted">
          Organised by <a className="font-mono" href={explorer("address", c.organizer.toBase58())} target="_blank" rel="noreferrer">{short(c.organizer)}</a>
        </p>
        <h1 className="font-serif text-3xl sm:text-4xl">{c.title}</h1>
        <p>{phase}</p>
      </section>

      <section className="grid items-center gap-6 rounded-2xl border border-rule bg-card p-5 sm:grid-cols-[220px_1fr]">
        <ShareDonut
          className="mx-auto w-full max-w-[220px]"
          collected={c.pickedCount}
          held={c.paidCount}
          refunded={c.refundedCount}
          centerValue={usdc(vaultBalance)}
          centerLabel="USDC in vault"
        />
        <div className="space-y-4">
          <DonutLegend collected={c.pickedCount} held={c.paidCount} refunded={c.refundedCount} />
          <p className="text-xs text-muted">
            Each student&apos;s share is one slice of the ring. A slice moves from held to paid only when that
            student collects, or to refunded if they never do.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Share", `${usdc(shareAmount)} USDC`],
          ["In vault", `${usdc(vaultBalance)} USDC`],
          ["Collected", `${c.pickedCount} of ${taken}`],
          ["Refunded", String(c.refundedCount)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-rule bg-card p-3">
            <p className="text-xs text-muted">{k}</p>
            <p className="tabular mt-1 text-lg">{v}</p>
          </div>
        ))}
      </section>

      <section className="space-y-3 rounded-lg border border-rule bg-card p-5">
        <h2 className="font-serif text-xl">Your share</h2>
        {!publicKey && <p className="text-sm text-muted">Connect your wallet to pay or see your share.</p>}
        {publicKey && !mine && c.status === "open" && now <= c.payBy && (
          <div className="space-y-2">
            <p className="text-sm">
              Pay {usdc(shareAmount)} USDC ({usdc(c.unitPrice)} to the vendor
              {c.feePerUnit > BigInt(0) ? `, ${usdc(c.feePerUnit)} organiser fee` : ""}). It only leaves the
              vault when you collect, or comes back to you.
            </p>
            <button
              className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper disabled:opacity-50"
              disabled={state.kind === "pending" || taken >= c.maxUnits}
              onClick={() => run("Pay share", async () => [await payShareIx(connection, c, publicKey)])}
            >
              {taken >= c.maxUnits ? "All copies taken" : `Pay ${usdc(shareAmount)} USDC`}
            </button>
          </div>
        )}
        {publicKey && !mine && !(c.status === "open" && now <= c.payBy) && (
          <p className="text-sm text-muted">This wallet has no share in this collection.</p>
        )}
        {mine && (
          <div className="space-y-2 text-sm">
            <p>
              Status: <span className={`rounded px-2 py-0.5 ${SHARE_STYLE[mine.status]}`}>{SHARE_LABEL[mine.status]}</span>{" "}
              · {usdc(mine.amount)} USDC
            </p>
            {mine.status === "paid" && c.status === "locked" && now <= c.pickupBy && (
              <p className="text-muted">Go to the vendor&apos;s stand and scan the code on their screen to collect.</p>
            )}
            {mine.status === "paid" && c.status === "open" && now <= c.payBy && (
              <button
                className="rounded-md border border-rule px-3 py-1.5 disabled:opacity-50"
                disabled={state.kind === "pending"}
                onClick={() => run("Cancel share", async () => [await cancelShareIx(connection, c, publicKey!)])}
              >
                Cancel and get my money back
              </button>
            )}
          </div>
        )}
      </section>

      {(isOrganizer || isVendor || dueRefunds.length > 0 || (c.paidCount === 0 && isOrganizer)) && (
        <section className="space-y-3 rounded-lg border border-rule bg-card p-5">
          <h2 className="font-serif text-xl">Actions</h2>
          <div className="flex flex-wrap gap-2 text-sm">
            {isOrganizer && c.status === "open" && c.paidCount >= c.minBuyers && (
              <button className="rounded-full bg-ink px-3 py-1.5 text-paper disabled:opacity-50" disabled={state.kind === "pending"}
                onClick={() => run("Lock order", async () => [await lockIx(connection, c, publicKey!)])}>
                Lock the order ({c.paidCount} paid)
              </button>
            )}
            {!isOrganizer && publicKey && c.status === "open" && now > c.payBy && c.paidCount >= c.minBuyers && (
              <button className="rounded-full bg-ink px-3 py-1.5 text-paper disabled:opacity-50" disabled={state.kind === "pending"}
                onClick={() => run("Lock order", async () => [await lockIx(connection, c, publicKey)])}>
                Lock the order
              </button>
            )}
            {isOrganizer && c.status === "open" && (
              <button className="rounded-md border border-rule px-3 py-1.5 disabled:opacity-50" disabled={state.kind === "pending"}
                onClick={() => run("Cancel collection", async () => [await cancelCollectionIx(connection, c)])}>
                Cancel collection
              </button>
            )}
            {isVendor && c.status === "locked" && (
              <Link className="rounded-full bg-stamp px-3 py-1.5 text-paper" href={`/c/${id}/station`}>
                Open pickup station
              </Link>
            )}
            {publicKey && dueRefunds.length > 0 && (
              <button className="rounded-full bg-ink px-3 py-1.5 text-paper disabled:opacity-50" disabled={state.kind === "pending"}
                onClick={async () => {
                  // Three refunds per transaction keeps each one small.
                  for (let i = 0; i < dueRefunds.length; i += 3) {
                    const batch = dueRefunds.slice(i, i + 3);
                    await send(`Refund ${i + 1}–${i + batch.length} of ${dueRefunds.length}`, async () =>
                      (await Promise.all(batch.map((s) => refundIxs(connection, c, s, publicKey)))).flat());
                  }
                  await refresh();
                }}>
                Refund {dueRefunds.length} uncollected {dueRefunds.length === 1 ? "share" : "shares"}
              </button>
            )}
            {isOrganizer && c.paidCount === 0 && c.status !== "open" && vaultBalance === BigInt(0) && (
              <button className="rounded-md border border-rule px-3 py-1.5 disabled:opacity-50" disabled={state.kind === "pending"}
                onClick={() => run("Close collection", async () => [await closeCollectionIx(connection, c)])}>
                Close and reclaim rent
              </button>
            )}
          </div>
          {publicKey && dueRefunds.length > 0 && (
            <p className="text-xs text-muted">Anyone can send refunds. Each one can only go to the student who paid it.</p>
          )}
        </section>
      )}

      <TxStatus state={state} />

      <section className="space-y-3">
        <h2 className="font-serif text-xl">Public receipt</h2>
        <p className="text-sm text-muted">
          Read straight from Solana, not from our servers. Vendor{" "}
          <a className="font-mono underline underline-offset-4" href={explorer("address", c.vendor.toBase58())} target="_blank" rel="noreferrer">{short(c.vendor)}</a>
          {" "}· vault{" "}
          <a className="font-mono underline underline-offset-4" href={explorer("address", c.vault.toBase58())} target="_blank" rel="noreferrer">{short(c.vault)}</a>
          {" "}· pay by {when(c.payBy)} · collect by {when(c.pickupBy)}
        </p>
        {shares.length === 0 ? (
          <p className="text-sm text-muted">No payments yet.</p>
        ) : (
          <ul className="divide-y divide-rule rounded-lg border border-rule bg-card text-sm">
            {shares.map((s) => (
              <li key={s.address.toBase58()} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <a className="font-mono" href={explorer("address", s.address.toBase58())} target="_blank" rel="noreferrer">
                  {short(s.buyer)}
                  {publicKey && s.buyer.equals(publicKey) ? " (you)" : ""}
                </a>
                <span className="tabular text-muted">{usdc(s.amount)} USDC</span>
                <span className={`rounded px-2 py-0.5 ${SHARE_STYLE[s.status]}`}>{SHARE_LABEL[s.status]}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function CollectionPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <CollectionPageInner />
    </Suspense>
  );
}
