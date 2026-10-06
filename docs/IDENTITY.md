# RAM production identity and access contract

## Architecture

RAM separates external identity proofing from RAM authorization.

The upstream identity provider or identity gateway is responsible for:

- authenticating the human;
- verifying the email address;
- enforcing the deployment MFA / SSO policy;
- mapping provider claims into the RAM assertion contract;
- protecting the RAM assertion-signing secret;
- sending a short-lived signed assertion to RAM.

RAM is responsible for:

- cryptographically verifying the assertion;
- enforcing the provider allowlist and MFA claim;
- preventing assertion replay;
- linking the provider subject to a RAM user;
- selecting an organization-scoped membership;
- creating the signed RAM session;
- re-checking durable membership and organization status on every protected request.

RAM never treats raw public request headers as verified identity.

## Required production environment

```text
AUTH_SECRET=<RAM session signing secret>
RAM_IDENTITY_ASSERTION_SECRET=<separate assertion signing secret>
RAM_IDENTITY_ALLOWED_PROVIDERS=enterprise-oidc
RAM_IDENTITY_LOGIN_URL=https://identity.example.com/login
RAM_IDENTITY_REQUIRE_MFA=true
RAM_DEMO_AUTH_ENABLED=false
RAM_PUBLIC_ONBOARDING_ENABLED=false
```

`AUTH_SECRET` and `RAM_IDENTITY_ASSERTION_SECRET` must be different secrets.

The provider names in `RAM_IDENTITY_ALLOWED_PROVIDERS` must exactly match the `provider` claim signed by the gateway.

## Assertion contract

The upstream gateway signs a compact payload with HMAC-SHA256.

Payload:

```json
{
  "v": 1,
  "aud": "ram-marketplace",
  "provider": "enterprise-oidc",
  "subject": "provider-stable-subject",
  "email": "verified.user@example.org",
  "name": "Verified User",
  "emailVerified": true,
  "mfa": true,
  "acr": "optional-provider-assurance-class",
  "amr": ["pwd", "mfa"],
  "jti": "unique-one-time-assertion-id",
  "iat": 1791290000,
  "exp": 1791290120
}
```

The serialized JSON is base64url encoded. The signature is:

```text
HMAC-SHA256(
  RAM_IDENTITY_ASSERTION_SECRET,
  "ram-external-identity." + encodedPayload
)
```

The transmitted assertion is:

```text
encodedPayload.signature
```

RAM requires:

- audience `ram-marketplace`;
- explicit allowed provider;
- verified email;
- MFA when `RAM_IDENTITY_REQUIRE_MFA` is enabled;
- a unique `jti`;
- expiration in the future;
- assertion lifetime no longer than five minutes;
- valid HMAC signature.

## Callback

The gateway posts:

```text
POST /api/session/external
Content-Type: application/x-www-form-urlencoded

assertion=<signed assertion>
```

An optional `organizationId` may be supplied when a user has multiple RAM memberships.

The external identity callback is the only unsafe API endpoint exempted from ordinary same-origin mutation enforcement. It does not trust an existing browser session. Authentication is the short-lived signed assertion itself, and every assertion `jti` is persisted as one-time-use before a RAM session is issued.

The request remains subject to body-size limits and rate limiting.

## Existing user sign-in

RAM maps `provider + subject` through `ExternalIdentity`.

On first verified sign-in:

1. RAM looks for an existing user with the verified email;
2. if found, RAM links the external identity to that user;
3. otherwise RAM creates the user;
4. RAM records the external identity link and authentication in the audit log;
5. RAM resolves available organization memberships.

A provider subject is the durable external identity key. If an already-linked subject later presents an email owned by a different RAM user, RAM fails closed.

## Multiple organizations

RAM sessions are organization-scoped.

When a user has exactly one usable membership, RAM selects it.

When a user has multiple memberships and there is not exactly one unambiguous operational membership, `/api/session/external` returns HTTP 409 with the available organization choices. The identity gateway or future organization-selector UI must resubmit the signed-in user with the intended `organizationId`.

A new assertion must be used for the resubmission because assertions are one-time-use.

## New-user onboarding

A verified identity with no RAM memberships receives a short-lived HTTP-only enrollment cookie and is redirected to `/onboarding`.

The enrollment cookie binds:

- RAM user ID;
- verified email;
- verified name;
- provider;
- provider subject.

Production organization onboarding uses these verified identity fields rather than trusting submitted name/email fields.

The new organization is created as:

```text
Organization = PENDING_VERIFICATION
Membership   = ACTIVE
Verification = PENDING
```

The active membership alone does **not** grant operational access while the organization is pending.

## Organization verification

RAM super admins use:

```text
/ops/access
```

Approval requires:

- a verification method;
- an evidence summary.

Approval changes:

```text
Organization: PENDING_VERIFICATION -> ACTIVE
Verification: PENDING -> APPROVED
```

Rejection changes the organization to `CLOSED`.

An active organization can be suspended. A suspended organization may only be reactivated when it has an approved verification record.

Every approval, rejection, suspension and reactivation is audit logged.

## Membership lifecycle

RAM super admins can set memberships to:

- `ACTIVE`;
- `SUSPENDED`;
- `REVOKED`.

A super admin cannot suspend or revoke the exact membership used by their current session, preventing a trivial self-lockout.

Membership lifecycle changes are audit logged.

## Durable authorization

A valid RAM cookie is necessary but not sufficient for protected access.

For PostgreSQL-backed deployments, each protected request checks the durable membership and organization records again.

Operational access requires:

```text
verified email
AND Membership.status = ACTIVE
AND Organization.status = ACTIVE
```

Pending, invited or suspended accounts may reach `/account` to see their status but cannot perform operational API actions.

Revoked memberships and closed organizations are denied even account-level session access.

This means a membership or organization suspension invalidates operational access immediately without waiting for the 12-hour RAM cookie to expire.

## Replay prevention

Every accepted assertion `jti` is stored in `IdentityAssertionUse`.

A second attempt to use the same assertion fails.

Expired replay records are housekeeping data and are deleted after they are no longer operationally useful.

## Audit records

Identity/access events include:

- `EXTERNAL_IDENTITY_LINKED`;
- `EXTERNAL_IDENTITY_AUTHENTICATED`;
- organization onboarding;
- organization verification approval/rejection;
- organization suspension/reactivation;
- membership status changes.

These events feed the existing append-only RAM audit history.

## Incident response

If an upstream identity provider or signing secret is compromised:

1. stop or disable the affected identity gateway;
2. rotate `RAM_IDENTITY_ASSERTION_SECRET`;
3. remove the affected provider from `RAM_IDENTITY_ALLOWED_PROVIDERS` if necessary;
4. suspend affected RAM memberships or organizations when warranted;
5. review identity/authentication audit events;
6. validate provider remediation before re-enabling assertions.

Rotating the assertion secret prevents new forged identity assertions. Suspending RAM membership/organization state immediately blocks existing RAM cookies from operational use.
