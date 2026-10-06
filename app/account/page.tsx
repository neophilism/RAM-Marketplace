import { can, type Capability } from "@/lib/access";
import { requireSession } from "@/lib/auth/session";
import { getOrganizationContext } from "@/lib/server/repositories";

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

export default async function AccountPage() {
  const session = await requireSession();
  const organization = await getOrganizationContext(session);

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

      <div className="detailGrid">
        <article className="panel">
          <span className="pill">{session.role.replaceAll("_", " ")}</span>
          <h2>{organization?.name ?? "Organization unavailable"}</h2>
          <p>
            {organization
              ? organization.type.replaceAll("_", " ") + " · " + organization.status.replaceAll("_", " ")
              : "No organization record is available for this session."}
          </p>
        </article>
        <article className="panel">
          <h2>Session security</h2>
          <p>RAM sessions are signed, HTTP-only and SameSite=Strict. Production cookies are Secure and expire after 12 hours.</p>
        </article>
      </div>

      <article className="panel">
        <h2>Your permissions</h2>
        <ul className="capabilityList">
          {capabilities.map((capability) => (
            <li key={capability.id} className={can(session.role, capability.id) ? "allowed" : "denied"}>
              <span>{can(session.role, capability.id) ? "✓" : "—"}</span>
              {capability.label}
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}
