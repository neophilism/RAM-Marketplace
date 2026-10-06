import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { listRamDisclosureQueue } from "@/lib/server/disclosures";

export const dynamic = "force-dynamic";

export default async function RamDisclosureQueuePage() {
  const session = await requireSession();
  const requests = await listRamDisclosureQueue(session);

  return (
    <section className="page">
      <div className="pageHeader">
        <div>
          <div className="eyebrow">RAM compliance · source privacy</div>
          <h1>Disclosure relevance review</h1>
          <p>
            Confirm that each request materially affects the stated research or
            purchase decision before any farm permission or NDA path is evaluated.
          </p>
        </div>
      </div>

      <div className="tableCard">
        <div className="tableRow tableHead">
          <span>Request</span><span>Animal / research need</span><span>Requested</span><span>Action</span>
        </div>
        {requests.length === 0 ? (
          <div className="emptyState">No source-information requests await RAM review.</div>
        ) : requests.map((request) => (
          <div className="tableRow" key={request.id}>
            <strong>{request.id}</strong>
            <div>
              <strong>{request.animalCaseId}</strong>
              <div className="subtle">{request.researchNeedTitle}</div>
            </div>
            <span>{request.requestedFields.join(", ").replaceAll("_", " ")}</span>
            <Link className="primaryButton" href={"/compliance/disclosures/" + request.id}>Review</Link>
          </div>
        ))}
      </div>
    </section>
  );
}
