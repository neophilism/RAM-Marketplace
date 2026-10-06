# RAM operational monitoring and incident response

## Purpose

RAM monitoring turns durable application state into actionable operational incidents.

The monitoring system is intentionally provider-neutral. RAM does not require a specific observability vendor or paging product. A scheduler calls a signed/bearer-protected monitoring endpoint; RAM evaluates its own PostgreSQL state, persists incidents, and sends signed alert payloads to the configured external alert receiver.

## Health endpoints

### Liveness

`GET /api/health/live`

Returns HTTP 200 when the application process is serving requests.

It does not query PostgreSQL and is suitable for container/process liveness checks.

### Readiness

`GET /api/health/ready`

In production, readiness requires PostgreSQL mode and a successful database query.

The response intentionally exposes only:

- `status=ready`; or
- `status=not_ready`.

It does not expose database connection details, table names, credentials or internal failure traces.

## Monitoring scheduler

Enable monitoring with:

- `RAM_MONITORING_ENABLED=true`
- `RAM_MONITORING_RUN_TOKEN=<strong independent secret>`

A scheduler POSTs to:

`/api/monitoring/run`

with:

`Authorization: Bearer <RAM_MONITORING_RUN_TOKEN>`

The endpoint is exempt from browser same-origin mutation checks because it is a machine-to-machine scheduler boundary. Its bearer token is mandatory.

The token must:

- be at least 32 non-placeholder characters;
- differ from `AUTH_SECRET`;
- differ from `RAM_IDENTITY_ASSERTION_SECRET`;
- differ from `RAM_PAYMENT_GATEWAY_SECRET`;
- be rotated independently.

A successful cycle creates a durable `MonitoringRun` heartbeat.

The pilot dashboard blocks launch if the latest successful monitoring cycle is older than `RAM_MONITORING_MAX_RUN_AGE_MINUTES`.

## Alert receiver

Configure:

- `RAM_MONITORING_ALERT_WEBHOOK_URL`
- `RAM_MONITORING_ALERT_WEBHOOK_SECRET`

Production requires HTTPS.

The only HTTP exception is explicit loopback-only CI with:

`RAM_MONITORING_ALLOW_INSECURE_LOCAL=true`

Pilot readiness fails while that override is enabled.

RAM signs each alert with HMAC-SHA256 over:

`timestamp + "." + rawBody`

Headers:

- `X-RAM-Monitoring-Timestamp`
- `X-RAM-Monitoring-Signature`

The alert secret must be strong and distinct from all other RAM secrets, including the scheduler token.

## Monitored signals

The initial production signal set includes:

### Payment submission unknown

A payment execution remains `SUBMISSION_UNKNOWN` longer than:

`RAM_MONITORING_PAYMENT_UNKNOWN_MINUTES`

Severity: **CRITICAL**

This indicates RAM cannot safely conclude whether a collection/payout/refund request reached the provider.

### Payment processing stale

A payment remains `PROCESSING` longer than:

`RAM_MONITORING_PAYMENT_PROCESSING_MINUTES`

Severity: **WARNING**

### Payment execution failed

A payment execution reaches terminal `FAILED`.

Severity: **CRITICAL**

Terminal failures generate one incident fingerprint and do not reopen merely because the historical failed execution remains in the ledger.

### Transport exception

An order is in `TRANSPORT_EXCEPTION`.

Severity: **CRITICAL**

### Ready-for-pickup stale

An order remains `READY_FOR_PICKUP` longer than:

`RAM_MONITORING_PICKUP_HOURS`

Severity: **WARNING**

### Open dispute stale

A dispute remains open longer than:

`RAM_MONITORING_DISPUTE_HOURS`

Severity: **WARNING**

### Organization verification overdue

An organization remains `PENDING_VERIFICATION` longer than:

`RAM_MONITORING_ORG_VERIFICATION_HOURS`

Severity: **WARNING**

## Incident deduplication

Each operational condition has a stable fingerprint, such as:

`PAYMENT_SUBMISSION_UNKNOWN:<execution-id>`

or:

`TRANSPORT_EXCEPTION:<order-id>`

A repeated monitoring scan:

- updates the existing incident;
- increments its occurrence count;
- updates `lastDetectedAt`;
- does **not** send another alert merely because the same incident is still open.

This prevents alert storms from recurring scheduler runs.

## Reopening behavior

Persistent conditions, such as an ambiguous payment or active transport exception, reopen a previously resolved incident if the underlying condition still exists on the next scan.

A reopened incident sends a new signed alert.

Terminal historical conditions, such as a failed payment execution, do not continually reopen after an operator resolves the incident.

This makes resolution meaningful while still preventing operators from permanently hiding a still-active condition.

## Operator workflow

Super administrators use:

`/ops/monitoring`

The console shows:

- open critical incidents;
- open warnings;
- acknowledged incidents;
- failed alert deliveries;
- configured monitoring thresholds;
- recent monitoring runs;
- incident occurrence counts;
- alert delivery history.

Operators may:

1. **Acknowledge** an open incident.
2. Investigate the underlying business/system condition.
3. **Resolve** the incident with required resolution notes.
4. **Retry alert** if the external alert receiver previously failed.

Acknowledgement and resolution actions are written to the RAM audit log.

## Alert delivery evidence

Every delivery attempt creates an `AlertDelivery` record containing:

- incident ID;
- SENT/FAILED status;
- SHA-256 hash of the receiver endpoint;
- SHA-256 hash of the alert payload;
- HTTP response code when available;
- bounded error message when delivery fails;
- attempt timestamp.

RAM does not need to persist the external alert receiver URL in each delivery record.

## Monitoring-run evidence

Every scan creates a `MonitoringRun` with:

- trigger;
- start/completion time;
- SUCCESS/FAILED status;
- signals evaluated;
- incidents opened;
- incidents updated;
- alert attempts;
- bounded error message on failure.

This provides a heartbeat for the monitoring system itself.

## Pilot launch gates

The pilot dashboard at `/ops/pilot` now separates:

### Automatic gates

Environment/runtime checks, including:

- production runtime;
- PostgreSQL persistence;
- identity security;
- payment security;
- monitoring enabled;
- strong independent scheduler token;
- HTTPS signed alert receiver;
- valid monitoring thresholds;
- recent successful monitoring heartbeat.

### Persisted manual gates

Each manual gate requires:

- accountable RAM owner;
- evidence summary;
- verifying RAM administrator;
- verification timestamp;
- optional review/expiry date.

Canonical gates:

- identity provider validation;
- reviewed database migrations;
- TLS/WAF/body-limit validation;
- backup/restore exercise;
- monitoring/incident-response validation;
- payment-provider operational validation.

A gate whose review due date has passed becomes **EXPIRED** and blocks launch until re-verified.

## Scheduling recommendation

Run the monitoring cycle at a cadence materially shorter than the strictest configured detection threshold.

For the default 10-minute ambiguous-payment threshold, a 5-minute scheduler cadence is appropriate.

The application does not itself create a hidden background worker. The deployment platform should invoke `POST /api/monitoring/run` on the selected schedule.

## CI

PostgreSQL CI starts a local signed alert receiver and verifies:

1. liveness and readiness probes;
2. invalid scheduler token rejection;
3. stale operational conditions create incidents;
4. signed alerts are accepted by the receiver;
5. repeated scans do not resend the same open incident;
6. occurrence count increases on repeated detection;
7. operator acknowledgement and resolution;
8. unresolved persistent condition reopens;
9. reopen sends exactly one additional alert;
10. clearing the condition prevents another reopen;
11. accountable pilot-gate verification/reset;
12. monitoring heartbeat persistence;
13. monitoring/incident/pilot records survive dump/restore.

The CI loopback alert receiver is not a production configuration and cannot satisfy pilot readiness.
