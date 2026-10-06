import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { listRequesterDisclosureRequests } from "@/lib/server/disclosures";

export const dynamic = "force-dynamic";

const labels: Record<string, string> = {
  GENERAL_HUSBANDRY: "General husbandry",
  COUNTY: "County / local jurisdiction",
  FARM_IDENTITY: "Farm identity"
};

export default async function DisclosuresPage() {
  const session = await requireSession();
  const requests = await listRequesterDisclosureRequests(session);

  return (
    <section className="page">
      <div className="pageHeader">
        <div>
          <div className="eyebrow">Researcher workspace</div>
          <h1>Source information requests</h1>
          <p>
            Request only source facts that materially affect a scientific or purchasing
            decision. Farm identity remains private unless the applicable permission
            and transaction gates are satisfied.
          </p>
        </div>
      </div>

      <div className="tableCard">
        <div className="tableRow tableHead">
          <span>Request</span><span>Animal / study</span><span>Requested</span><span>Status</span>
        </div>
        {requests.length === 0 ? (
          <div className="emptyState">
            No source-information requests yet. Start from an anonymous animal profile or a matched candidate.
          </div>
        ) : requests.map((request) => (
          <div className="tableRow" key={request.id}>
            <div>
              <Link href={"/disclosures/" + request.id}><strong>{request.id}</strong></Link>
              <div className="subtle">{request.createdAt.slice(0, 10)}</div>
            </div>
            <div>
              <strong>{request.animalCaseId}</strong>
              <div className="subtle">{request.researchNeedTitle}</div>
            </div>
            <span>{request.requestedFields.map((field) => labels[field] ?? field).join(", ")}</span>
            <span className="status">{request.status.replaceAll("_", " ")}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
