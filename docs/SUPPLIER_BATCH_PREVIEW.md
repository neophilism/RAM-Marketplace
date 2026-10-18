# Supplier batch preview contract

`POST /api/farm/batch/preview` is an authenticated supplier-only preview. It requires the existing `animal:create` capability and derives the organization from the verified session, never from the request body. It does not write candidates, publish listings, authorize animal movement, set price, or send anything to a buyer.

Input is JSON with a `batchKey` (8-120 letters, digits, hyphens or underscores) and 1-100 `rows`. Each row has an `externalAnimalId` and `submission` using the same animal intake schema as single-candidate submission. The request body is capped at 256 KiB while streaming. Unknown envelope/submission fields, invalid rows, missing independent-cull attestation and duplicate external IDs within a batch are reported as invalid. The whole preview is `acceptedForReview=false` when any row is invalid.

Each valid row gets a SHA-256 digest scoped to organization, batch key, external ID and normalized submission. This digest is a preview comparison value, not a persisted idempotency guarantee. The response never returns submitted private animal details. The caller must treat a successful preview as a validation result only.

Before import or API integration becomes live, add durable organization-scoped external-ID uniqueness and batch idempotency, atomic/quarantined persistence, quota and retry accounting, auditable actor attribution, per-corridor eligibility and the veterinary/RAM review gates. No batch row may become `MATCHABLE` through preview. Synthetic tests cover positive preview, duplicate and invalid rows, tenant-scoped digests and body-size limits.
