import { can, type Capability } from "@/lib/access";
import { requireAccountSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const capabilities: { id: Capability; label: string }[] = [
  { id: "animal:create", label: "Submit animal cases" },
  { id: "animal:read_marketplace", label: "Browse scientist marketplace" },
  { id: "animal:verify", label: "Perform veterinary verification" },
  { id: "source:read_restricted", label: "Read restricted farm source records" },
  { id: "source:approve_disclosure", label: "Approve source disclosure" },
  { id: "research_need:create", label: "Create research needs" },
  { id: "match:review", label: "Review scientific matches" },
  { id: "order:reserve", label: "Reserve matched animal models" },
  { id: "order:buyer_commit", label: "Commit organization to buyer quote" },
  { id: "order:acquisition_commit", label: "Commit RAM supplier acquisition" },
  { id: "order:clearance", label: "Perform RAM compliance clearance" },
  { id: "order:receive", label: "Inspect and accept or reject delivered animals" },
  { id: "pricing:manage", label: "Manage supplier pricing policy" },
  { id: "settlement:manage", label: "Manage buyer payments, supplier payouts and reconciliation" },
  { id: "dispute:manage", label: "Resolve rejected-receipt disputes" },
  { id: "audit:read", label: "Read global audit history" },
  { id: "disclosure:request", label: "Request relevant source information" },
  { id: "disclosure:ram_review", label: "Review source requests for relevance" },
  { id: "disclosure:supplier_review", label: "Approve farm source disclosures" },
  { id: "transport:assign", label: "Assign cleared orders to logistics providers" },
  { id: "transport:update", label: "Record transport custody and delivery events" },
  { id: "operations:manage", label: "Manage RAM operations" }
];

function accessMessage(reason: string) {
  switch (reason) {
    case "ORGANIZATION_PENDING":
      return "Organization verification is pending. Your identity is recognized, but operational access has not started.";
    case "ORGANIZATION_SUSPENDED":
      return "This organization is suspended. Operational requests are blocked until RAM reactivates it.";
    case "MEMBERSHIP_SUSPENDED":
      return "Your membership is suspended. The organization may remain active for other members.";
    case "MEMBERSHIP_INVITED":
      return "Your membership has not been activated yet.";
    case "EMAIL_UNVERIFIED":
      return "Your email identity is not verified. Operational requests remain blocked.";
    default:
      return "Your account is active for operational access.";
  }
}

export default async function AccountPage() {
  const { session, access } = await requireAccountSession();
  const operational = access.accessReason === "OK";

  return (
    <section className="page narrow">
      <div className="pageHeader">
        <div>
          <div className="eyebrow">Account & access</div>
          <h1>{session.name}</h1>
          <p>{session.email}</p>
        </div>
        <form action="/api/session/logout" method="post">
          <button className="secondaryButton" type="submit">Sign out</button>
        </form>
      </div>

      <div className="privacyBanner">
        <strong>{operational ? "Operational access active." : "Operational access blocked."}</strong>
        <span>{accessMessage(access.accessReason)}</span>
      </div>

      <div className="detailGrid">
        <article className="panel">
          <span className="pill">{session.role.replaceAll("_", " ")}</span>
          <h2>{access.organizationName}</h2>
          <p>
            {access.organizationType.replaceAll("_", " ")} · organization{" "}
            {access.organizationStatus.replaceAll("_", " ")}
          </p>
          <p>
            Membership: {access.membershipStatus.replaceAll("_", " ")}
          </p>
        </article>
        <article className="panel">
          <h2>Identity & session security</h2>
          <p>
            Email verification: {access.emailVerified ? "verified" : "not verified"}.
            RAM sessions are signed, HTTP-only and SameSite=Strict. Production
            cookies are Secure and expire after 12 hours.
          </p>
          <p>
            Protected requests re-check durable membership and organization state,
            so suspension or revocation takes effect without waiting for cookie
            expiry.
          </p>
        </article>
      </div>

      <article className="panel">
        <h2>Your role permissions</h2>
        {!operational ? (
          <p className="subtle">
            These are the permissions associated with your role. They remain
            unavailable until the account state above is operational.
          </p>
        ) : null}
        <ul className="capabilityList">
          {capabilities.map((capability) => {
            const roleAllows = can(session.role, capability.id);
            const allowed = roleAllows && operational;
            return (
              <li key={capability.id} className={allowed ? "allowed" : "denied"}>
                <span>{allowed ? "✓" : "—"}</span>
                {capability.label}
              </li>
            );
          })}
        </ul>
      </article>
    </section>
  );
}
