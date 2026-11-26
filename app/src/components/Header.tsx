"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

import { Logo } from "./Logo";

// The wallet button reads browser state, so render it only on the client.
const WalletMultiButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false },
);

export function Header() {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-30 flex justify-center px-3 pt-4">
      <nav className="pointer-events-auto flex max-w-full items-center gap-1 rounded-2xl border border-ink/5 bg-ink/[0.06] p-1.5 pl-3 text-sm backdrop-blur-md sm:gap-2">
        <Link href="/" className="mr-1 flex items-center gap-2" aria-label="Meridio home">
          <Logo />
          <span className="font-display hidden text-lg font-semibold tracking-tight sm:inline">Meridio</span>
        </Link>
        <Link href="/#collections" className="rounded-xl px-3 py-1.5 hover:bg-ink/5">
          Collections
        </Link>
        <Link href="/new" className="rounded-xl px-3 py-1.5 hover:bg-ink/5">
          New
        </Link>
        <Link href="/#how" className="hidden rounded-xl px-3 py-1.5 hover:bg-ink/5 sm:block">
          How it works
        </Link>
        <WalletMultiButton />
      </nav>
    </header>
  );
}
