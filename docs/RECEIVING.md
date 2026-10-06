# RAM receiving inspection contract

## Separation of duties

Carrier delivery and buyer acceptance are separate events.

A transport provider may establish that custody reached the receiving facility, but the carrier cannot decide whether the buyer institution accepts the animal into its study.

Receiving inspection requires the `RECEIVING_INSPECTION` permission, assigned to the research-compliance role.

## Eligible state

A receiving inspection may be recorded only when the order is `DELIVERED`.

Each order may have only one receipt inspection decision.

## Acceptance

Acceptance requires all of the following:

- RAM animal identity confirmed;
- movement documents received;
- physical condition consistent with the shipping/clinical record;
- welfare acceptable for institutional intake;
- explicit inspector attestation.

Acceptance advances:

- order: `DELIVERED -> ACCEPTED`
- research need: `ORDERED -> IN_STUDY`

## Rejection

A rejection requires:

- at least one failed receiving check;
- a documented discrepancy description;
- inspector attestation.

Rejection records the intermediate receipt state and immediately opens a formal RAM dispute:

`DELIVERED -> REJECTED_AT_RECEIPT -> DISPUTED`

The research need remains `ORDERED` because the study has not begun with the rejected animal.

RAM operations then resolves the dispute under `docs/DISPUTES.md`.

## Privacy

The receiving workspace is buyer-side. It may show the anonymous RAM animal profile, the buyer's receiving facility/protocol data and delivery confirmation.

It must not expose source-farm identity, source address/contact information, supplier economics or RAM's confidential source-side records.
