import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { listOrderDisputes } from "@/lib/server/disputes";

export const dynamic = "force-dynamic";

export default async function DisputesPage() {
  const session = await requireSession();
  const disputes = await listOrderDisputes(session);
  const open = disputes.filter((dispute) => dispute.status === "OPEN");

  return (
    <section className="page">
      <div className="pageHeader">
        <div>
          <div className="eyebrow">RAM operations · disputes</div>
          <h1>Rejected-receipt disputes</h1>
          <p>Every receiving rejection opens a formal dispute. RAM may accept the animal after review, approve an adjustment, authorize a replacement, or unwind the transaction by refund.</p>
        </div>
      </div>

      <div className="metricGrid">
        <article><strong>{open.length}</strong><span>Open disputes</span></article>
        <article><strong>{disputes.filter((dispute) => dispute.status === "RESOLVED").length}</strong><span>Resolved</span></article>
      </div>

      <div className="tableCard">
        <div className="tableRow tableHead"><span>Dispute</span><span>Animal / order</span><span>Status</span><span>Reason / resolution</span></div>
        {disputes.length === 0 ? (
          <div className="emptyState">No receiving disputes have been opened.</div>
        ) : disputes.map((dispute) => (
          <div className="tableRow" key={dispute.id}>
            <Link href={"/ops/disputes/" + dispute.id}><strong>{dispute.id}</strong></Link>
            <div>
              <strong>{dispute.animalCaseId}</strong>
              <div className="subtle">{dispute.species} · {dispute.condition} · order {dispute.orderId}</div>
            </div>
            <div>
              <span className="status">{dispute.status}</span>
              <div className="subtle">order {dispute.orderStatus.replaceAll("_", " ")}</div>
            </div>
            <div>
              <strong>{dispute.resolutionType?.replaceAll("_", " ") ?? "Awaiting RAM resolution"}</strong>
              <div className="subtle">{dispute.reason}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
