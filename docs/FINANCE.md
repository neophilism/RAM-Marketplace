# RAM financial ledger and settlement contract

## Purpose

The finance layer records the obligations and money movements created by a RAM transaction without allowing post hoc repricing of the source animal.

A financial settlement opens when RAM commits the supplier acquisition, not when the animal is later accepted.

## Immutable acquisition-side snapshot

At acquisition commitment the ledger snapshots:

- buyer receivable from the committed buyer quote;
- supplier payable from the already-calculated independent acquisition amount;
- standardized cull schedule used for that acquisition;
- market ceiling used for that acquisition;
- direct costs known at commitment;
- resulting gross spread.

The supplier payable must equal:

`min(standardized cull schedule, market ceiling)`

The settlement service rejects a snapshot that does not satisfy that formula.

Buyer price, diagnosis, rarity, match score, research demand and buyer identity are not inputs to supplier payable.

## Ledger entries

The ledger is append-only.

Opening entries:

- `BUYER_RECEIVABLE`
- `SUPPLIER_PAYABLE`
- `DIRECT_COST` when non-zero

Money-movement entries:

- `BUYER_PAYMENT`
- `SUPPLIER_PAYOUT`

Money movements require an external accounting, bank or processor reference. Partial movements are supported. The application rejects any movement that would exceed the remaining obligation.

This version records externally executed money movements; it does not itself move funds through a bank or payment processor. A payment-provider integration can later write the same ledger events from authenticated provider callbacks.

## Supplier payout timing

The supplier payable exists immediately when RAM commits the acquisition. It may therefore be paid before buyer acceptance. Payment timing does not alter the amount due.

This is deliberate: RAM's obligation to the source side is not recalculated based on later buyer value or margin.

## Final settlement

The order may advance:

`ACCEPTED -> SETTLED`

only when:

- buyer outstanding balance is zero; and
- supplier outstanding balance is zero.

Payment can be recorded earlier, but settlement cannot finalize before buyer institutional acceptance.

## Reconciliation and close

After settlement, RAM finance records an external reconciliation reference and attests that the ledger agrees with the relevant financial records.

That advances:

`SETTLED -> CLOSED`

Financial closure does not complete the scientific study. The research need may remain `IN_STUDY` until its separate scientific lifecycle is completed.

## Privacy

The finance settlement surface uses order/animal identifiers and monetary snapshots. It does not require farm identity, farm exact location, research rationale or match score.

Source payout routing and actual bank credentials belong in a future payment-provider / secure payout integration rather than in general marketplace records.
