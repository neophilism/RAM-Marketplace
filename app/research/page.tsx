import Link from "next/link";
import { getPrototypeResearchNeeds } from "@/lib/server/prototype-store";

export const dynamic = "force-dynamic";

const seededNeeds = [
  { id: "RN-00127", title: "Naturally occurring bilateral hearing loss in swine", status: "MATCH REVIEW", matches: 6, updated: "Today" },
  { id: "RN-00112", title: "Large-animal chronic osteoarthritis model", status: "ACTIVE", matches: 3, updated: "Yesterday" },
  { id: "RN-00098", title: "Spontaneous cardiomyopathy for device feasibility", status: "INSTITUTIONAL CLEARANCE", matches: 1, updated: "Oct 2" }
];

export default function ResearchNeedsPage() {
  const needs = [...getPrototypeResearchNeeds(), ...seededNeeds];

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

      <div className="prototypeBanner"><strong>Prototype persistence:</strong> submitted needs persist for the current server process and already pass through the production validation contract.</div>

      <div className="tableCard">
        <div className="tableRow tableHead"><span>Need</span><span>Status</span><span>Candidates</span><span>Updated</span></div>
        {needs.map((need) => (
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
        <p>Hard scientific, welfare, regulatory and logistics constraints are applied before scoring. Remaining animals are ranked by phenotype, etiology, disease stage, diagnostic confidence, comorbidities, demographics, logistics and study fit.</p>
      </div>
    </section>
  );
}
