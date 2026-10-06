import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { dataBackend } from "@/lib/server/db";
import { listFarmCases } from "@/lib/server/repositories";

export const dynamic = "force-dynamic";

export default async function FarmPage() {
  const session = await requireSession();
  const cases = await listFarmCases(session);
  const backend = dataBackend();

  return (
    <section className="page">
      <div className="pageHeader">
        <div>
          <div className="eyebrow">Private farm portal</div>
          <h1>Your animal cases</h1>
          <p>Your farm identity is never presented as a public seller profile.</p>
        </div>
        <Link className="primaryButton" href="/farm/new">Report an animal</Link>
      </div>

      <div className="privacyBanner">
        <strong>Source protection is on.</strong>
        <span>Scientists see RAM animal IDs and approved scientific information—not your farm name, logo, address, or seller profile.</span>
      </div>

      <div className="prototypeBanner">
        <strong>{backend === "postgres" ? "Durable PostgreSQL storage active." : "Prototype storage active."}</strong>{" "}
        {backend === "postgres"
          ? "Animal submissions, cull provenance and audit events persist in the database."
          : "Set DATABASE_URL and RAM_DATA_BACKEND=postgres to enable durable persistence."}
      </div>

      <div className="tableCard">
        <div className="tableRow tableHead"><span>Animal</span><span>Condition</span><span>Status</span><span>Next step</span></div>
        {cases.length === 0 ? (
          <div className="emptyState">No cases yet. Report the first animal selected for culling.</div>
        ) : cases.map((item) => (
          <div className="tableRow" key={item.id}>
            <strong>{item.id}</strong>
            <span>{item.condition}</span>
            <span className="status">{item.status.replaceAll("_", " ")}</span>
            <span>{item.action}</span>
          </div>
        ))}
      </div>

      <div className="detailGrid">
        <article className="panel">
          <h2>Default disclosure rules</h2>
          <label className="checkLine"><input type="checkbox" defaultChecked /> General husbandry details may be shared</label>
          <label className="checkLine"><input type="checkbox" /> County may be shared after NDA</label>
          <label className="checkLine"><input type="checkbox" /> Farm identity may be shared before purchase</label>
          <label className="checkLine"><input type="checkbox" defaultChecked /> Farm identity may be shared after purchase when operationally required</label>
        </article>
        <article className="panel">
          <h2>Pending information requests</h2>
          <p className="emptyState">No requests currently require your approval.</p>
        </article>
      </div>
    </section>
  );
}
