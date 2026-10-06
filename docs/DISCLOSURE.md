# RAM permissioned source disclosure contract

## Core rule

Scientists browse animals, not farms.

RAM may disclose additional source facts only through a specific, audited request tied to a legitimate research relationship. Approval never grants a researcher access to `AnimalSourceRecord`.

Instead, after every applicable gate is satisfied, RAM creates an immutable, field-scoped release snapshot. Researcher-facing code reads only that snapshot.

## Requestable fields

The v1 disclosure workflow permits requests for:

1. **General husbandry / environmental context**
2. **County / local jurisdiction**
3. **Farm legal identity**

The following are not requestable through this workflow:

- exact source address;
- owner/contact identity other than an expressly approved farm legal name;
- owner email or phone;
- local veterinarian identity/contact;
- supplier acquisition economics;
- internal source notes and documents not explicitly released.

Operational disclosure needed later for approved pickup/transport is handled by the transaction/logistics authorization path, not this researcher-information path.

## Legitimate relationship requirement

A request must identify:

- an anonymous RAM animal ID;
- a research need owned by the requesting organization;
- one or more requested fields;
- a concrete explanation of why those facts affect the scientific or purchasing decision.

The animal must either be an eligible match for the research need or already participate in a related order for the requesting organization.

## Listing disclosure tiers

The animal's RAM disclosure tier is enforced server-side:

- `PUBLIC_ANONYMIZED` — public animal profile only; no additional source request.
- `REQUESTABLE` — additional source facts may be requested before a transaction.
- `POST_RESERVATION` — request requires a reservation milestone.
- `POST_PURCHASE` — request requires buyer commercial commitment.
- `RAM_INTERNAL_ONLY` — no external source disclosure.

A request cannot be submitted early to defeat a later milestone. The current transaction state is checked again before release.

## RAM relevance review

Every request first enters `PENDING_RAM_REVIEW`.

RAM compliance reviews:

- the requested fields;
- the scientific/purchasing reason;
- listing disclosure tier;
- current transaction milestone;
- standing farm permissions;
- whether the requested facts exist.

RAM approval means only that the request is sufficiently relevant to continue. It does not release source information.

## Farm permissions

Each farm site has standing permissions:

- `shareGeneralHusbandry`
- `shareCountyAfterNda`
- `shareIdentityPrePurchase`
- `shareIdentityPostPurchase`

Standing permission reduces repeated farm approvals. If a field is not covered by standing permission, the request enters `PENDING_SUPPLIER_APPROVAL`.

The farm decision surface intentionally shows:

- RAM animal ID;
- requested fields;
- the requester's relevance explanation.

It does **not** need buyer identity.

A farm owner/admin may approve or deny the specific request.

## NDA gate

County and farm identity require confidentiality acceptance.

When NDA is required, a fully approved request enters `APPROVED`. The requester must affirm the confidentiality restriction before any data is released.

## Release snapshot

After all applicable gates pass, RAM creates:

- `releasedFields`
- `releasedData`
- `releasedAt`

and advances the request to `RELEASED`.

The snapshot is constructed from the restricted source layer at release time and contains only the approved field names.

### Husbandry sanitization

General husbandry text is sanitized before release against known source identifiers, source contacts, email, phone and coordinate-like patterns.

### County

County release contains the county/local-jurisdiction label only. Exact address is never included.

### Farm identity

Farm identity release contains the legal farm name only. Exact address and contacts remain restricted.

## Researcher query boundary

The researcher request-detail query deliberately does not join `AnimalSourceRecord`.

Before `RELEASED`, the requester sees status and approval progress only.

After `RELEASED`, the requester sees only the stored release snapshot.

This makes the privacy boundary structural rather than dependent on UI hiding.

## Audit trail

PostgreSQL records audit events for:

- request creation;
- RAM approval/denial;
- farm approval/denial;
- NDA acceptance;
- final release;
- standing farm-policy changes.

## Future extension

Later versions can add carefully defined field types such as source-health-program information, vaccination history or environmental exposure categories. New fields should be added to the explicit allowlist and release-snapshot builder rather than exposing a generic source-record API.
