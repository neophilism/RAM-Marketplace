import { requireSession } from "@/lib/auth/session";
import {
  listLogisticsOrganizations,
  listTransportReadyOrders
} from "@/lib/server/logistics";

export const dynamic = "force-dynamic";

export default async function OpsLogisticsPage() {
  const session = await requireSession();
  const [orders, logisticsOrganizations] = await Promise.all([
    listTransportReadyOrders(session),
    listLogisticsOrganizations(session)
  ]);

  return (
    <section className="page">
      <div className="pageHeader">
        <div>
          <div className="eyebrow">RAM operations · logistics</div>
          <h1>Cleared transport assignments</h1>
          <p>Assign only compliance-cleared orders. The carrier receives a minimum-necessary operational packet after assignment.</p>
        </div>
      </div>

      <div className="privacyBanner">
        <strong>Carrier privacy boundary.</strong>
        <span>Pickup address and pickup contact are released only to the assigned logistics organization. Farm legal identity, supplier economics, buyer pricing, match score and research rationale remain excluded.</span>
      </div>

      <div className="tableCard">
        <div className="tableRow tableHead"><span>Order</span><span>Animal</span><span>Status</span><span>Assignment</span></div>
        {orders.length === 0 ? (
          <div className="emptyState">No cleared orders are waiting for transport assignment.</div>
        ) : orders.map((order) => (
          <div className="tableRow" key={order.id}>
            <strong>{order.id}</strong>
            <div><strong>{order.animalCaseId}</strong><div className="subtle">{order.species} · {order.condition}</div></div>
            <span className="status">{order.status.replaceAll("_", " ")}</span>
            {order.assigned ? (
              <span className="subtle">Already assigned</span>
            ) : logisticsOrganizations.length === 0 ? (
              <span className="subtle">No active logistics organization</span>
            ) : (
              <details>
                <summary className="secondaryButton">Assign carrier</summary>
                <form className="formStack" action="/api/ops/logistics/assign" method="post">
                  <input type="hidden" name="orderId" value={order.id} />
                  <label><span>Logistics organization *</span>
                    <select name="transportOrganizationId" required>
                      {logisticsOrganizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}
                    </select>
                  </label>
                  <div className="formGrid">
                    <label><span>Pickup window start</span><input type="datetime-local" name="pickupWindowStart" /></label>
                    <label><span>Pickup window end</span><input type="datetime-local" name="pickupWindowEnd" /></label>
                    <label><span>Delivery window start</span><input type="datetime-local" name="deliveryWindowStart" /></label>
                    <label><span>Delivery window end</span><input type="datetime-local" name="deliveryWindowEnd" /></label>
                  </div>
                  <label><span>Movement document references</span><textarea name="movementDocumentRefs" rows={3} placeholder="One per line or separated by semicolons" /></label>
                  <label><span>Sanitation / biosecurity requirements</span><textarea name="sanitationRequirements" rows={3} /></label>
                  <label><span>Special transport instructions</span><textarea name="specialInstructions" rows={3} /></label>
                  <button className="primaryButton" type="submit">Create transport assignment</button>
                </form>
              </details>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
