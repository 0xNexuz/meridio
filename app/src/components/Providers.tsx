"use client";

import { Buffer } from "buffer";
import { useEffect, useMemo, type ReactNode } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  createDefaultAuthorizationCache,
  createDefaultChainSelector,
  createDefaultWalletNotFoundHandler,
  registerMwa,
} from "@solana-mobile/wallet-standard-mobile";

import { RPC_URL } from "@/lib/meridio";
import "@solana/wallet-adapter-react-ui/styles.css";

// The Anchor client expects Node's Buffer in the browser.
if (typeof window !== "undefined" && !("Buffer" in window)) {
  (window as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
}

let mwaRegistered = false;

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Lets Android Chrome and the Seeker connect to on-device wallets.
    if (mwaRegistered) return;
    mwaRegistered = true;
    registerMwa({
      appIdentity: {
        name: "Meridio",
        uri: window.location.origin,
        icon: "/icon.png",
      },
      authorizationCache: createDefaultAuthorizationCache(),
      chains: ["solana:devnet"],
      chainSelector: createDefaultChainSelector(),
      onWalletNotFound: createDefaultWalletNotFoundHandler(),
    });
  }, []);

  // Standard wallets (Phantom, Solflare, Backpack, MWA) are detected automatically.
  const wallets = useMemo(() => [], []);

  return (
    <ConnectionProvider endpoint={RPC_URL} config={{ commitment: "confirmed" }}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
