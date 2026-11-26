"use client";

import { useCallback, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction, type TransactionInstruction } from "@solana/web3.js";

import { friendlyError } from "@/lib/errors";

export type SendState =
  | { kind: "idle" }
  | { kind: "pending"; label: string }
  | { kind: "done"; label: string; signature: string }
  | { kind: "error"; label: string; message: string };

/** Send instructions from the connected wallet and wait for confirmation. */
export function useSend() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [state, setState] = useState<SendState>({ kind: "idle" });

  const send = useCallback(
    async (label: string, ixs: TransactionInstruction[] | (() => Promise<TransactionInstruction[]>)) => {
      if (!publicKey) {
        setState({ kind: "error", label, message: "Connect a wallet first." });
        return null;
      }
      setState({ kind: "pending", label });
      try {
        const list = typeof ixs === "function" ? await ixs() : ixs;
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
        const tx = new Transaction({ feePayer: publicKey, blockhash, lastValidBlockHeight }).add(...list);
        const signature = await sendTransaction(tx, connection);
        const res = await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
        if (res.value.err) throw new Error(JSON.stringify(res.value.err));
        setState({ kind: "done", label, signature });
        return signature;
      } catch (e) {
        setState({ kind: "error", label, message: friendlyError(e) });
        return null;
      }
    },
    [connection, publicKey, sendTransaction],
  );

  return { send, state, reset: () => setState({ kind: "idle" }) };
}
