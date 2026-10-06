import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { listComplianceOrders } from "@/lib/server/transactions";

export const dynamic = "force-dynamic";

export default async function CompliancePage() {
  const session = await requireSession();
  const orders = await listComplianceOrders(session);

  return (
    <section className="page">
      <div className="pageHeader">
        <div>
          <div className="eyebrow">RAM compliance</div>
          <h1>Clearance queue</h1>
          <p>Every commercial commitment remains blocked from pickup until institutional, welfare, biosecurity, movement, transport and provenance gates are confirmed.</p>
        </div>
      </div>

      <div className="formActions">
        <Link className="secondaryButton" href="/compliance/disclosures">Source disclosure queue</Link>
      </div>

      <div className="tableCard">
        <div className="tableRow tableHead"><span>Order</span><span>Animal / study</span><span>Protocol</span><span>Action</span></div>
        {orders.length === 0 ? (
          <div className="emptyState">No orders currently require clearance.</div>
        ) : orders.map((order) => (
          <div className="tableRow" key={order.id}>
            <strong>{order.id}</strong>
            <div><strong>{order.animalCaseId}</strong><div className="subtle">{order.species} · {order.condition} · {order.researchNeedTitle}</div></div>
            <span>{order.protocolReference ?? "Not supplied"}</span>
            <Link className="primaryButton" href={"/compliance/orders/" + order.id}>Review clearance</Link>
          </div>
        ))}
      </div>
    </section>
  );
}
