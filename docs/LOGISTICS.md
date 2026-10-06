# RAM logistics and chain-of-custody contract

## Scope

The logistics layer begins only after an order has passed every RAM compliance gate and reached `READY_FOR_PICKUP`.

PR #9 implements:

`READY_FOR_PICKUP -> IN_TRANSIT -> DELIVERED`

with the exception branch:

`READY_FOR_PICKUP / IN_TRANSIT -> TRANSPORT_EXCEPTION -> IN_TRANSIT / DELIVERED`.

Receiving inspection and buyer acceptance are intentionally separate from carrier delivery.

## Assignment gate

Only RAM operations may assign transport. Assignment is blocked unless:

- the order is `READY_FOR_PICKUP`;
- the selected organization is an active `LOGISTICS` organization;
- if a specific transport user is named, that user has an active `TRANSPORT_PROVIDER` membership in that organization.

A transport assignment does not itself change the order status.

## Minimum-necessary carrier packet

After assignment, the authorized carrier may receive only what is operationally required:

- RAM animal ID;
- species and condition needed for transport/biosecurity;
- exact pickup address;
- pickup contact name and email;
- receiving facility name and delivery address;
- pickup/delivery windows;
- movement-document references;
- sanitation/biosecurity requirements;
- special transport instructions;
- transport event history for that assignment.

The carrier packet must not expose farm legal identity, supplier pricing/economics, buyer pricing, match score, research-need title/rationale, or local-veterinarian identity.

## Chain of custody

Pickup confirmation requires sanitation confirmation and explicit custody attestation.

Pickup advances the order to `IN_TRANSIT`.

Delivery confirmation requires a custody-transfer attestation and advances the order to `DELIVERED`. At delivery, the candidate advances from `SOLD_TO_RAM` to `TRANSFERRED`.

Every transport event is persisted and audited with previous and next order status.

## Exceptions

A carrier may report a transport exception from `READY_FOR_PICKUP` or `IN_TRANSIT`. A meaningful description is required.

The exception may later resume transit or complete delivery if the issue was resolved at the receiving point.

Dispute and receiving-rejection handling remain in later transaction layers.
