"use client";

import { useCallback, useEffect, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";

import {
  fetchCollection,
  fetchShares,
  tokenBalance,
  type CollectionView,
  type ShareView,
} from "@/lib/meridio";

/** Live view of one collection, its shares and its vault balance, from chain. */
export function useCollection(id: string, pollMs = 8000) {
  const { connection } = useConnection();
  const [collection, setCollection] = useState<CollectionView | null>(null);
  const [shares, setShares] = useState<ShareView[]>([]);
  const [vaultBalance, setVaultBalance] = useState<bigint>(BigInt(0));
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");

  const refresh = useCallback(async () => {
    let address: PublicKey;
    try {
      address = new PublicKey(id);
    } catch {
      setStatus("missing");
      return;
    }
    try {
      const c = await fetchCollection(connection, address);
      if (!c) {
        setStatus("missing");
        return;
      }
      const [s, v] = await Promise.all([fetchShares(connection, address), tokenBalance(connection, c.vault)]);
      setCollection(c);
      setShares(s);
      setVaultBalance(v);
      setStatus("ready");
    } catch {
      setStatus((prev) => (prev === "ready" ? prev : "error"));
    }
  }, [connection, id]);

  useEffect(() => {
    // First load on the next tick, then poll. (Keeps state updates in callbacks.)
    const first = setTimeout(refresh, 0);
    const t = setInterval(refresh, pollMs);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [refresh, pollMs]);

  return { collection, shares, vaultBalance, status, refresh };
}
