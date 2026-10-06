import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { dataBackend } from "@/lib/server/db";
import { listResearchNeeds } from "@/lib/server/repositories";

export const dynamic = "force-dynamic";

export default async function ResearchNeedsPage() {
  const session = await requireSession();
  const needs = await listResearchNeeds(session);
  const backend = dataBackend();

  return (
    <section className="page">
      <div className="pageHeader">
        <div>
          <div className="eyebrow">Researcher workspace</div>
          <h1>Research needs</h1>
          <p>Describe the model you actually need. RAM continuously evaluates verified animal cases against active requirements.</p>
        </div>
        <Link className="primaryButton" href="/research/new">Create research need</Link>
      </div>

      <div className="prototypeBanner">
        <strong>{backend === "postgres" ? "Durable PostgreSQL storage active." : "Prototype storage active."}</strong>{" "}
        {backend === "postgres"
          ? "Research requirements and audit history persist in the database."
          : "Set DATABASE_URL and RAM_DATA_BACKEND=postgres to enable durable persistence."}
      </div>

      <div className="tableCard">
        <div className="tableRow tableHead"><span>Need</span><span>Status</span><span>Candidates</span><span>Updated</span></div>
        {needs.length === 0 ? (
          <div className="emptyState">No research needs yet. Create the first structured model request.</div>
        ) : needs.map((need) => (
          <div className="tableRow" key={need.id}>
            <div><strong>{need.id}</strong><div className="subtle">{need.title}</div></div>
            <span className="status">{need.status}</span>
            <strong>{need.matches}</strong>
            <span>{need.updated}</span>
          </div>
        ))}
      </div>

      <div className="panel">
        <h2>How matching works</h2>
        <p>Hard scientific, welfare, regulatory and logistics constraints are applied before scoring. Remaining animals use the canonical 100-point model: phenotype fit 30, diagnostic confidence 20, etiology fit 15, comorbidity fit 10, timing/availability 10, logistics fit 10 and price fit 5.</p>
      </div>
    </section>
  );
}
