import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { listReceivingOrders } from "@/lib/server/receiving";

export const dynamic = "force-dynamic";

export default async function ReceivingPage() {
  const session = await requireSession();
  const orders = await listReceivingOrders(session);
  const pending = orders.filter((order) => order.status === "DELIVERED");

  return (
    <section className="page">
      <div className="pageHeader">
        <div>
          <div className="eyebrow">Research institution · receiving</div>
          <h1>Delivered animal intake</h1>
          <p>Carrier delivery establishes handoff. Institutional receiving separately verifies identity, documents, condition and welfare before the animal enters the study.</p>
        </div>
      </div>

      <div className="metricGrid">
        <article><strong>{pending.length}</strong><span>Awaiting inspection</span></article>
        <article><strong>{orders.filter((order) => order.receiptDecision === "ACCEPTED").length}</strong><span>Accepted</span></article>
        <article><strong>{orders.filter((order) => order.receiptDecision === "REJECTED").length}</strong><span>Rejected at receipt</span></article>
      </div>

      <div className="tableCard">
        <div className="tableRow tableHead"><span>Order</span><span>Animal / study</span><span>Status</span><span>Receiving</span></div>
        {orders.length === 0 ? (
          <div className="emptyState">No delivered orders are available for receiving inspection.</div>
        ) : orders.map((order) => (
          <div className="tableRow" key={order.id}>
            <div>
              <Link href={"/receiving/" + order.id}><strong>{order.id}</strong></Link>
              <div className="subtle">{order.receivingFacilityName ?? "Receiving facility"}</div>
            </div>
            <div>
              <strong>{order.animalCaseId}</strong>
              <div className="subtle">{order.species} · {order.condition} · {order.researchNeedTitle}</div>
            </div>
            <span className="status">{order.status.replaceAll("_", " ")}</span>
            <div>
              {order.status === "DELIVERED" ? (
                <Link className="primaryButton" href={"/receiving/" + order.id}>Inspect receipt</Link>
              ) : (
                <span>{order.receiptDecision ?? "Recorded"}{order.inspectedAt ? " · " + new Date(order.inspectedAt).toLocaleString() : ""}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
