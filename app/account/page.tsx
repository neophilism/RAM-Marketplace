import { can, demoActors, type Capability } from "@/lib/access";

const capabilities: { id: Capability; label: string }[] = [
  { id: "animal:create", label: "Submit animal cases" },
  { id: "animal:read_marketplace", label: "Browse scientist marketplace" },
  { id: "animal:verify", label: "Perform veterinary verification" },
  { id: "source:read_restricted", label: "Read restricted farm source records" },
  { id: "source:approve_disclosure", label: "Approve source disclosure" },
  { id: "research_need:create", label: "Create research needs" },
  { id: "match:review", label: "Review scientific matches" },
  { id: "operations:manage", label: "Manage RAM operations" }
];

export default function AccountPage() {
  const actors = Object.entries(demoActors);

  return (
    <section className="page">
      <div className="pageHeader">
        <div>
          <div className="eyebrow">Identity & access prototype</div>
          <h1>Role-based workspaces</h1>
          <p>Production authentication will bind verified users to organizations and memberships. This page shows the capability model already enforced by the application layer.</p>
        </div>
      </div>

      <div className="roleGrid">
        {actors.map(([key, actor]) => (
          <article className="panel" key={key}>
            <span className="pill">{actor.role.replaceAll("_", " ")}</span>
            <h2>{actor.name}</h2>
            <p>{actor.organization}</p>
            <ul className="capabilityList">
              {capabilities.map((capability) => (
                <li key={capability.id} className={can(actor.role, capability.id) ? "allowed" : "denied"}>
                  <span>{can(actor.role, capability.id) ? "✓" : "—"}</span>{capability.label}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
