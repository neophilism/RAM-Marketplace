# RAM rejected-receipt dispute contract

## Automatic dispute opening

A buyer receiving user may reject an animal only when at least one intake check fails and the discrepancy is documented.

The software records:

`DELIVERED -> REJECTED_AT_RECEIPT -> DISPUTED`

inside the same receiving transaction.

The rejected receipt remains immutable evidence. A separate `OrderDispute` records the exception workflow.

The associated research need remains `ORDERED` while the dispute is open.

## Resolution authority

Receipt inspection belongs to buyer-side research compliance.

Dispute resolution belongs to RAM operations.

Finance may record credits, refunds, buyer payments and supplier payouts, but finance does not choose the commercial/operational dispute outcome.

This separation prevents one role from both declaring the discrepancy and unilaterally deciding the remedy.

## Resolution types

### Accept as-is

RAM determines that the animal can be accepted despite the original receiving rejection.

- order: `DISPUTED -> ACCEPTED`
- research need: `ORDERED -> IN_STUDY`
- financial settlement remains open and follows the normal payment lifecycle

### Accept with credit

Same operational result as accept as-is, but at least one `BUYER_CREDIT` ledger entry must already exist.

- order: `DISPUTED -> ACCEPTED`
- research need: `ORDERED -> IN_STUDY`

Any refund due created by the credit must be paid before ordinary settlement can finalize.

### Replacement

Replacement fully unwinds the rejected order before rematching.

Requirements:

- buyer has been credited for the full original receivable;
- any refund due from prior buyer payment has been paid;
- supplier payable is fully satisfied.

Then:

- original order: `DISPUTED -> SETTLED`
- original financial settlement: `OPEN -> SETTLED`
- research need: `ORDERED -> ACTIVE`

The reopened research need can then run through normal matching/reservation for a replacement animal. The replacement is a new transaction rather than mutation of the rejected order.

### Refund

Refund also requires a full financial unwind:

- full buyer credit;
- any resulting buyer cash refund;
- supplier payable fully satisfied.

Then:

- order: `DISPUTED -> SETTLED`
- financial settlement: `OPEN -> SETTLED`
- research need: `ORDERED -> CLOSED`

Finance performs the existing reconciliation step to advance the settled order to `CLOSED`.

## Credits versus refunds

A buyer credit changes the amount RAM is entitled to collect. It does not delete or alter the original quote.

A buyer refund records cash returned after payment. It is permitted only when a prior credit creates a refund due.

Example full refund after full payment:

1. original receivable $100,000;
2. buyer payment $100,000;
3. buyer credit $100,000;
4. refund due becomes $100,000;
5. buyer refund $100,000;
6. net buyer balance is zero.

The ledger therefore preserves the complete history rather than rewriting the original transaction.

## Supplier protection

Receipt disputes never recalculate the supplier acquisition amount.

The supplier payable remains the acquisition-time amount derived from:

`min(standardized cull schedule, market ceiling)`

A buyer rejection, refund, replacement, research value, buyer price or RAM margin cannot reduce or increase that committed source-side amount.

## Audit

Dispute opening and resolution are audited separately from receiving and financial ledger entries.

Resolution records preserve:

- dispute reason;
- resolution type;
- resolution rationale;
- RAM operator identity;
- order and research-need state transitions;
- financial balances at resolution.
