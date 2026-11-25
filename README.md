# Meridio

**Your share stays yours until the book is in your hand.**

When a class pools money for a textbook, handout or dues, it usually goes to one
person's bank account and trust does the rest. In 2026 a UNIPORT course rep
collected about ₦10.8M for a textbook and the balance went unexplained; at IAUE a
rep was declared wanted over ₦6.4M of textbook money.

Meridio replaces "send it to the rep" with a Solana program:

- Each student pays their share into a vault that no person can empty.
- A share moves to the vendor only when **that student picks up the item**, in a
  transaction signed by both the student and the vendor's pickup station.
- Anything not collected by the pickup deadline is refunded to the student who
  paid it. Anyone can trigger the refund; the money can only go to that student.
- The organiser (course rep) earns at most a fixed fee per pickup (capped at 10%),
  and never holds the money.

Built for the Dev3pack Global Hackathon (Solana university hackathon, 27–29 Nov 2026).

## How a collection works

| Step | Instruction | Who signs | Money moves |
| --- | --- | --- | --- |
| Rep sets up the purchase | `create_collection` | organiser | — |
| Student pays | `pay_share` | student | student → vault |
| Student changes mind (before pay-by) | `cancel_share` | student | vault → that student |
| Order is confirmed | `lock` | organiser, or anyone after pay-by | — |
| Rep calls it off (before lock) | `cancel_collection` | organiser | — (all shares refundable) |
| Pickup at the stand | `confirm_pickup` | student **and** station | vault → vendor (price) + organiser (fee) |
| Deadline passed, not collected | `refund_share` | anyone | vault → that student only |
| Clean up | `close_collection` | organiser | rent back |

## Invariants (checked by tests)

1. The vault always holds exactly the sum of shares still marked Paid.
2. A share settles once: picked up or refunded, never both, never twice.
3. Money leaves the vault only to the vendor, the organiser's fee account, or the share's own buyer.
4. The organiser can never receive more than fee × pickups.
5. A pickup needs both the buyer's and the station's signature, before pickup-by.
6. Only the collection's mint is accepted; amounts are whole base units, no division.

## Tests

`anchor test` runs 15 LiteSVM tests: the full path, attacks (organiser withdrawal,
fake station, someone else's share, double pickup, late pickup, early refund,
refund to a stranger, wrong mint), creation rules, and a randomised fuzz that
checks the invariants and total token conservation after every step.

## Run it

Requires Solana CLI 3.1.x and Anchor 1.1.2.

```bash
anchor build
anchor test
```

Deploy to devnet (from your own machine):

```bash
solana config set --url devnet
anchor keys sync          # writes your program ID into the code
anchor build
anchor deploy --provider.cluster devnet
```

Devnet USDC mint: `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` (test USDC from faucet.circle.com).

## Honest limits

- Devnet only, unaudited.
- A pickup proves both phones signed at the stand; it does not prove the item was the right one.
- In the hackathon demo the station key lives on the server; in production it would live on the vendor's phone.
- Students need a wallet and USDC; there is no naira on-ramp yet.
- Wallet addresses are public on-chain; names stay off-chain.

## Status

| Part | Status |
| --- | --- |
| Solana program (8 instructions) | Built, 15 tests passing locally |
| Devnet deployment | Not yet |
| Web app, pickup QR (Solana Pay), receipt page | Not yet |
| Firecrawl price check, ElevenLabs voice updates | Not yet |
