# RAM application security contract

## Scope

This document describes controls enforced by the RAM application itself and the infrastructure controls required around it.

Security controls must preserve RAM's product invariants: anonymous scientist browsing, restricted farm/source data, independent supplier pricing, role separation, append-only financial history, and auditable exception handling.

## Session security

RAM sessions use:

- HMAC-SHA256 signatures;
- a production-required `AUTH_SECRET`;
- HTTP-only cookies;
- `SameSite=Strict`;
- `Secure` cookies in production;
- 12-hour expiry;
- role and organization claims validated on every token parse.

Every protected data action re-checks authentication and RBAC in the route/service layer. Page routing alone is not treated as authorization.

Production demo authentication and public self-onboarding remain disabled by default.

## Cross-site mutation protection

Every request under `/api/*` passes through the request-security gate.

Unsafe methods are rejected when:

- Fetch Metadata reports a cross-site request;
- `Origin` or `Referer` does not match the application origin;
- production receives an unsafe request without a usable same-origin source;
- declared request size exceeds `RAM_MAX_MUTATION_BYTES`.

Local development permits origin-less requests so command-line testing remains practical.

`SameSite=Strict` remains defense in depth rather than the only CSRF control.

## Request-size control

`RAM_MAX_MUTATION_BYTES` defaults to 1 MiB and must be between 16 KiB and 10 MiB.

This application check uses `Content-Length`. Production infrastructure must additionally enforce a hard body-size limit at the reverse proxy / platform edge so chunked or malformed requests cannot bypass the application-level declaration check.

## Browser response hardening

RAM emits:

- `Content-Security-Policy`;
- `X-Content-Type-Options: nosniff`;
- `X-Frame-Options: DENY`;
- `Referrer-Policy: strict-origin-when-cross-origin`;
- a restrictive `Permissions-Policy`;
- `Strict-Transport-Security` in production;
- no `X-Powered-By` header.

Authenticated pages and API responses are marked `Cache-Control: no-store`.

The CSP intentionally permits inline scripts/styles required by the current Next.js rendering model. A later nonce-based CSP may tighten this further.

## Anonymous-entry throttling

Public onboarding and demo authentication use durable fixed-window rate limits.

Rate-limit keys are HMAC-derived from address + user agent. Raw client addresses are not stored in the rate-limit table.

Current defaults:

- public onboarding: 5 requests per hour per fingerprint;
- demo authentication: 120 requests per 10 minutes per fingerprint.

Production should still add edge/WAF throttling because application-layer rate limits are not a substitute for network-level denial-of-service protection.

## Audit history

Durable PostgreSQL workflows write `AuditEvent` records for security- and transaction-relevant state changes.

The global audit explorer is restricted to `RAM_SUPER_ADMIN`.

It can filter by:

- action;
- entity type / ID;
- actor user;
- organization;
- correlation ID;
- start time.

Application tests fail if source code attempts to update or delete `AuditEvent` rows. Audit history is append-only at the application layer.

Production database credentials used by the application should also be denied direct `UPDATE` / `DELETE` privileges on audit history where operationally feasible, or equivalent database-level controls should be applied.

## Financial ledger integrity

`FinancialLedgerEntry` is also append-only at the application layer.

Corrections use additional entries such as credits and refunds rather than rewriting existing entries.

CI statically fails if application code introduces ledger update/delete calls.

## Authorization

Capabilities remain role-specific and service-side.

The global audit explorer is intentionally more restricted than ordinary operations/compliance/finance workspaces because audit metadata can cross normal functional boundaries.

Restricted farm/source records remain inaccessible to research users and transport/buyer projections.

## Required infrastructure controls

Production infrastructure must provide:

- TLS termination;
- trusted Host / forwarded-protocol handling;
- WAF or edge request throttling;
- hard request-body limits;
- restricted PostgreSQL network access;
- encryption at rest and in transit;
- encrypted backups with tested restore procedures;
- secret storage and rotation;
- centralized application/platform logs;
- alerting on repeated 401/403/429 responses and infrastructure failures;
- dependency and container/image scanning in the deployment pipeline;
- regular backup, restore and incident-response exercises.

## Data retention

Audit and financial records should not be silently purged by application workflow code.

Rate-limit buckets are ephemeral security data and may be purged after their windows expire according to deployment housekeeping policy.

Formal retention periods for business, veterinary, research, transport, source, financial and audit records should be set with counsel and compliance stakeholders before production launch.

## Remaining production work

This PR hardens the application boundary but does not replace:

- an external identity provider / email verification;
- provider-side MFA / enterprise SSO;
- payment-provider authentication and webhook verification;
- object-storage malware scanning for future uploads;
- infrastructure penetration testing;
- database privilege hardening;
- formal secrets rotation;
- production monitoring/alerting;
- production database privilege hardening and provider-level PITR configuration.
