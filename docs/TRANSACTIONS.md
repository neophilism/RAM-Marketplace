# RAM commercial transaction contract

## Commercial separation

RAM treats the buyer sale and the farm-side acquisition as separate calculations and separate workflow events.

The supplier acquisition amount is calculated only from an active species pricing policy:

`supplier acquisition = min(standardized cull schedule, market ceiling)`

The supplier calculation does not accept buyer price, buyer identity, buyer budget, diagnosis, disease severity, rarity, match score, or research demand.

The acquisition-commitment interface is intentionally blind to buyer price and buyer identity.

## Buyer path

A researcher can reserve an animal only through an active structured research need and an existing eligible match.

Happy path:

`MATCHABLE animal + ACTIVE need`

-> candidate `RESERVED`

-> research need `MATCH_REVIEW -> SELECTED`

-> order `DRAFT -> CANDIDATE_HELD -> CHECKOUT_PENDING`

The reservation and quote each have explicit expiry timestamps. Current default is 24 hours.

A user with procurement / quote-approval authority records:

- receiving facility name and address;
- protocol / animal-use approval reference;
- institutional authorization attestation;
- purchasing-authority attestation.

This advances the order to `BUYER_COMMITTED` and the research need to `INSTITUTIONAL_CLEARANCE`.

Before RAM acquisition, the buyer may cancel. Cancellation releases the candidate back to `MATCHABLE` and reopens the research need.

## RAM acquisition

A RAM finance user can commit acquisition only after buyer commitment.

The system selects the current active species pricing policy and calculates the supplier amount from that policy alone. The selected policy ID, schedule amount, ceiling amount, and resulting supplier amount are snapshotted on the order for auditability.

Acquisition advances:

- order `BUYER_COMMITTED -> ACQUISITION_COMMITTED`;
- candidate `RESERVED -> SOLD_TO_RAM`.

The order then automatically enters `CLEARANCE_PENDING`.

The software deliberately distinguishes commercial commitment from physical custody. Physical transfer is a later workflow.

## Compliance clearance

RAM compliance receives restricted source information solely for transaction clearance.

The following are hard clearance gates:

1. institutional protocol / animal-use authorization;
2. receiving-facility capability;
3. animal-welfare suitability;
4. biosecurity / communicable-disease controls;
5. jurisdictional movement requirements;
6. transport plan feasibility;
7. independent cull provenance / source integrity.

Any unchecked gate or explicit blocking finding prevents `READY_FOR_PICKUP`.

Successful review:

`CLEARANCE_PENDING -> READY_FOR_PICKUP`

and

`INSTITUTIONAL_CLEARANCE -> ORDERED`

Failed review:

`CLEARANCE_PENDING -> CLEARANCE_FAILED`

Blocking findings and reviewer identity are persisted.

## Logistics and receiving

After clearance, RAM operations assigns a transport provider. Carrier custody proceeds through:

`READY_FOR_PICKUP -> IN_TRANSIT -> DELIVERED`

with `TRANSPORT_EXCEPTION` as the controlled exception state.

Carrier delivery is not buyer acceptance. A research-compliance receiving user performs a separate institutional inspection after `DELIVERED`.

Acceptance requires identity, movement-document, physical-condition and welfare checks to pass:

- order `DELIVERED -> ACCEPTED`;
- research need `ORDERED -> IN_STUDY`.

A rejected intake requires at least one failed check plus documented discrepancies:

- order `DELIVERED -> REJECTED_AT_RECEIPT`;
- research need remains `ORDERED`.

See `docs/LOGISTICS.md` and `docs/RECEIVING.md`.

## Financial ledger and settlement

RAM opens a financial settlement when supplier acquisition is committed. The opening snapshot fixes:

- buyer receivable from the committed quote;
- supplier payable from the independent acquisition calculation;
- the schedule and market ceiling used to derive that supplier payable;
- known direct costs and gross spread.

The supplier payable cannot be changed based on buyer value.

The append-only ledger then records partial or full buyer payments and supplier payouts with external references. A movement that exceeds the remaining receivable/payable is rejected.

Financial settlement may finalize only after institutional acceptance and only when both buyer and supplier outstanding balances are zero:

`ACCEPTED -> SETTLED`

A separate reconciliation attestation and external reference then closes the commercial order:

`SETTLED -> CLOSED`

Commercial close does not imply that the research study is scientifically complete. See `docs/FINANCE.md`.

## Privacy boundaries

### Buyer order projection

Buyer-facing order records may contain buyer quote and receiving-side information but must not contain:

- supplier acquisition amount;
- supplier pricing-policy inputs;
- farm identity;
- exact source location;
- source owner contacts;
- source veterinarian identity.

### Supplier acquisition decision projection

The acquisition-decision surface must not contain:

- buyer identity;
- buyer quote;
- buyer budget;
- match score.

### Compliance projection

RAM compliance is an authorized restricted-source role and may view source identity, exact location, and provenance evidence needed to clear the transaction.

## Expiration

Pre-commitment orders with expired holds are marked `EXPIRED`. If the animal remains reserved for that order, it is returned to `MATCHABLE`, the research need is reopened, and the selected match returns to candidate status.

The current implementation performs this cleanup lazily on marketplace/order access. A production deployment may additionally call the same cleanup logic from a scheduled worker.

## Next transaction layers

The remaining transaction layers are:

- rejected-receipt disputes, replacements, credits and refunds;
- provider-integrated payment initiation / webhooks around the existing ledger;
- carrier / veterinary payables where those services are separately billable;
- study completion / closure bookkeeping.
