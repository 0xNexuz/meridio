/** Plain-language versions of the program's errors, for students reading on a phone. */
const MESSAGES: Record<string, string> = {
  ZeroPrice: "The price must be more than zero.",
  FeeTooHigh: "The organiser fee can be at most 10% of the price.",
  BadBuyerLimits: "Minimum buyers must be at least 1 and no more than the number of copies.",
  BadDeadlines: "The pay-by time must be in the future, and the pickup-by time after it.",
  TitleTooLong: "Keep the title under 64 characters.",
  NotOpen: "This collection is no longer taking payments.",
  NotLocked: "Pickups start once the order is locked.",
  PayByPassed: "The pay-by time has passed.",
  PayByNotPassed: "Wait until the pay-by time has passed.",
  PickupByPassed: "The pickup-by time has passed. Uncollected shares go back to students.",
  SoldOut: "All copies are taken.",
  NotEnoughBuyers: "Not enough students have paid yet.",
  OrganizerOnly: "Only the organiser can do this right now.",
  ShareNotPaid: "This share is already settled.",
  RefundNotAllowed: "Refunds open after the pickup-by time.",
  SharesOutstanding: "Some shares are still waiting for pickup or refund.",
  VaultNotEmpty: "The vault still holds tokens.",
  ConstraintHasOne: "These accounts do not belong to this collection.",
  ConstraintSeeds: "That share belongs to someone else.",
  AccountNotSigner: "A required signature is missing.",
  "already in use": "You have already paid for this collection.",
  "insufficient funds": "Not enough USDC in your wallet.",
  "0x1": "Not enough USDC or SOL in your wallet.",
  "User rejected": "You cancelled the request in your wallet.",
};

export function friendlyError(err: unknown): string {
  const text = [
    err instanceof Error ? err.message : String(err),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(((err as any)?.logs as string[] | undefined) ?? []),
  ].join("\n");
  for (const [needle, message] of Object.entries(MESSAGES)) {
    if (text.includes(needle)) return message;
  }
  // Any other Anchor error carries a readable message in the logs.
  const anchor = text.match(/Error Message: ([^\n]+)/);
  if (anchor) return anchor[1].replace(/\.$/, "") + ".";
  return text.split("\n")[0].slice(0, 200) || "Something went wrong.";
}
