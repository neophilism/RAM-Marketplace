import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { listBuyerOrders } from "@/lib/server/transactions";

export const dynamic = "force-dynamic";

function money(cents: number | null) {
  return cents == null ? "—" : "$" + (cents / 100).toLocaleString();
}

export default async function OrdersPage() {
  const session = await requireSession();
  const orders = await listBuyerOrders(session);

  return (
    <section className="page">
      <div className="pageHeader">
        <div>
          <div className="eyebrow">Research procurement</div>
          <h1>Orders & reservations</h1>
          <p>Track candidate holds, quotes, institutional commitment, clearance, delivery and receiving outcome without exposing source-farm identity.</p>
        </div>
      </div>

      <div className="tableCard">
        <div className="tableRow tableHead"><span>Order</span><span>Animal / study</span><span>Status</span><span>Quote</span></div>
        {orders.length === 0 ? (
          <div className="emptyState">No reservations yet. Select an eligible match from a research need.</div>
        ) : orders.map((order) => (
          <div className="tableRow" key={order.id}>
            <div>
              <Link href={"/orders/" + order.id}><strong>{order.id}</strong></Link>
              <div className="subtle">{order.createdAt.slice(0, 10)}</div>
            </div>
            <div>
              <strong>{order.animalCaseId}</strong>
              <div className="subtle">{order.condition} · {order.researchNeedTitle}</div>
            </div>
            <span className="status">{order.status.replaceAll("_", " ")}</span>
            <strong>{money(order.buyerPriceCents)}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
