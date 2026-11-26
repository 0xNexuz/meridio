"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import QRCode from "qrcode";

import { useCollection } from "@/components/useCollection";

function signInMessage(collection: string, ts: number) {
  // Must match stationSignInMessage() on the server.
  return `Meridio: open pickup station for collection ${collection} at ${ts}`;
}

function StationPageInner() {
  const { id } = useParams<{ id: string }>();
  const { publicKey, signMessage } = useWallet();
  const { collection: c, status } = useCollection(id, 4000);
  const [session, setSession] = useState<string | null>(null);
  const [code, setCode] = useState<{ code: string; exp: number } | null>(null);
  const [qr, setQr] = useState<{ pay: string; web: string; webUrl: string } | null>(null);
  const [mode, setMode] = useState<"pay" | "web">("pay");
  const [error, setError] = useState<string | null>(null);

  const openStation = async () => {
    setError(null);
    if (!publicKey || !signMessage) return setError("Connect the vendor wallet first. It must support message signing.");
    try {
      const ts = Math.floor(Date.now() / 1000);
      const sig = await signMessage(new TextEncoder().encode(signInMessage(id, ts)));
      const r = await fetch("/api/station/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collection: id, timestamp: ts, signature: bs58.encode(sig) }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Could not open the station");
      setSession(j.token);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const refreshCode = useCallback(async () => {
    if (!session) return;
    const r = await fetch(`/api/station/code?collection=${id}`, { headers: { "x-station-session": session } });
    const j = await r.json();
    if (!r.ok) {
      setSession(null);
      setError(j.error ?? "Station session expired");
      return;
    }
    setCode(j);
  }, [id, session]);

  // Codes last 90 seconds; refresh every 60.
  useEffect(() => {
    if (!session) return;
    const first = setTimeout(refreshCode, 0);
    const t = setInterval(refreshCode, 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [session, refreshCode]);

  useEffect(() => {
    if (!code) return;
    const origin = window.location.origin;
    const q = `collection=${id}&code=${encodeURIComponent(code.code)}&exp=${code.exp}`;
    const apiUrl = `${origin}/api/pickup?${q}`;
    const webUrl = `${origin}/c/${id}/collect?code=${encodeURIComponent(code.code)}&exp=${code.exp}`;
    const opts = { margin: 1, width: 320, color: { dark: "#1d1b17", light: "#fffdf8" } };
    Promise.all([
      QRCode.toDataURL(`solana:${encodeURIComponent(apiUrl)}`, opts),
      QRCode.toDataURL(webUrl, opts),
    ]).then(([pay, web]) => setQr({ pay, web, webUrl }));
  }, [code, id]);

  if (status === "loading") return <p className="text-sm text-muted">Loading…</p>;
  if (!c) return <p className="text-sm text-alert">No collection at this address.</p>;
  const isVendor = !!publicKey && publicKey.equals(c.vendor);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/c/${id}`} className="text-sm text-muted underline underline-offset-4">Back to collection</Link>
        <h1 className="mt-2 font-serif text-3xl">Pickup station</h1>
        <p className="text-muted">{c.title}</p>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg border border-rule bg-card p-3">
          <p className="text-xs text-muted">Collected</p>
          <p className="tabular text-2xl text-stamp">{c.pickedCount}</p>
        </div>
        <div className="rounded-lg border border-rule bg-card p-3">
          <p className="text-xs text-muted">Still to collect</p>
          <p className="tabular text-2xl">{c.paidCount}</p>
        </div>
        <div className="rounded-lg border border-rule bg-card p-3">
          <p className="text-xs text-muted">Status</p>
          <p className="text-lg">{c.status === "locked" ? "Open" : c.status}</p>
        </div>
      </div>

      {c.status !== "locked" && <p className="text-sm text-alert">Pickups start once the organiser locks the order.</p>}

      {!session && (
        <div className="space-y-3 rounded-lg border border-rule bg-card p-5">
          <p className="text-sm">
            Only the vendor can open the station. Sign a message with the vendor wallet (no transaction, no
            cost) to show the pickup code.
          </p>
          {publicKey && !isVendor && <p className="text-sm text-alert">The connected wallet is not this collection&apos;s vendor.</p>}
          <button className="rounded-full bg-stamp px-4 py-2 text-sm font-medium text-paper disabled:opacity-50"
            disabled={!isVendor} onClick={openStation}>
            Open pickup station
          </button>
        </div>
      )}

      {session && qr && (
        <div className="space-y-4 rounded-lg border border-rule bg-card p-5 text-center">
          <div className="flex justify-center gap-2 text-sm">
            <button className={`rounded-md px-3 py-1 ${mode === "pay" ? "bg-ink text-paper" : "border border-rule"}`} onClick={() => setMode("pay")}>
              Wallet scan (Solana Pay)
            </button>
            <button className={`rounded-md px-3 py-1 ${mode === "web" ? "bg-ink text-paper" : "border border-rule"}`} onClick={() => setMode("web")}>
              Phone camera
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mode === "pay" ? qr.pay : qr.web} alt="Pickup code" className="mx-auto w-72 max-w-full" />
          <p className="text-sm">
            Hand over the item, then let the student scan this. Their share moves to you when they approve.
          </p>
          <p className="text-xs text-muted">The code changes every minute so it only works at your stand.</p>
          {mode === "web" && (
            <p className="break-all text-xs text-muted">
              Same device demo: <a className="underline" href={qr.webUrl}>open the collect link</a>
            </p>
          )}
        </div>
      )}
      {error && <p className="text-sm text-alert">{error}</p>}
    </div>
  );
}

export default function StationPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <StationPageInner />
    </Suspense>
  );
}
