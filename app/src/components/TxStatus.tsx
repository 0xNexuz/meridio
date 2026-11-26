"use client";

import { explorer } from "@/lib/meridio";
import type { SendState } from "./useSend";

export function TxStatus({ state }: { state: SendState }) {
  if (state.kind === "idle") return null;
  if (state.kind === "pending")
    return <p className="text-sm text-muted" role="status">{state.label}: waiting for your wallet and the network…</p>;
  if (state.kind === "error")
    return <p className="text-sm text-alert" role="alert">{state.label} failed: {state.message}</p>;
  return (
    <p className="text-sm text-stamp" role="status">
      {state.label} confirmed.{" "}
      <a className="underline underline-offset-4" href={explorer("tx", state.signature)} target="_blank" rel="noreferrer">
        View on explorer
      </a>
    </p>
  );
}
