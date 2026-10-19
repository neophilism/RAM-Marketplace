# Versioned compliance rule drafts

`lib/compliance-rule-drafts.ts` produces deterministic review artifacts for a proposed origin/destination corridor, species, condition family and effective interval. It normalizes source references, validates calendar dates and computes a SHA-256 digest. A revision requires the current digest and increments the revision number. A caller that persists revisions must make that compare-and-swap atomic.

Every output status is `DRAFT`. No code path in this module activates a corridor, grants legal/veterinary approval or changes transaction clearance. A source reference is a pointer for review, not proof that the referenced rule applies. An author ID is not an approver identity.

Before an approved multi-jurisdiction feature is built, the server must add durable immutable revisions, scoped author/reviewer permissions, separately recorded legal and veterinary decisions, effective and expiry checks, explicit prohibition precedence, transaction-to-rule-version binding, and a fail-closed runtime lookup. The owner must identify real corridors and responsible reviewers. Do not map a `DRAFT` to `movementRequirementsConfirmed=true`.

`tests/compliance-rule-drafts.test.ts` covers deterministic revisions and rejection of stale/tampered versions, invalid dates, missing provenance and malformed corridor codes. These synthetic cases provide no real-world rule approval.
