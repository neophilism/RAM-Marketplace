import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { getReceivingOrder } from "@/lib/server/receiving";

export const dynamic = "force-dynamic";

function check(value: boolean) {
  return value ? "Confirmed" : "Failed / not confirmed";
}

export default async function ReceivingOrderPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const order = await getReceivingOrder(session, id);

  return (
    <section className="page narrow">
      <div className="pageHeader">
        <div>
          <div className="eyebrow">Receiving inspection · {order.id}</div>
          <h1>{order.animalCaseId}</h1>
          <p>{order.species} · {order.condition} · {order.researchNeedTitle}</p>
        </div>
        <span className="status">{order.status.replaceAll("_", " ")}</span>
      </div>

      <div className="detailGrid">
        <article className="panel">
          <h2>Animal record</h2>
          <dl>
            <div><dt>Disease stage</dt><dd>{order.diseaseStage ?? "Not specified"}</dd></div>
            <div><dt>Diagnostic confidence</dt><dd>{order.diagnosticConfidence ?? "Not specified"}</dd></div>
            <div><dt>Protocol</dt><dd>{order.protocolReference ?? "Not specified"}</dd></div>
            <div><dt>Receiving facility</dt><dd>{order.receivingFacilityName ?? "Not specified"}</dd></div>
          </dl>
          <p>{order.publicSummary}</p>
        </article>

        <article className="panel">
          <h2>Carrier delivery</h2>
          <dl>
            <div><dt>Delivery confirmed</dt><dd>{order.deliveryConfirmedAt ? new Date(order.deliveryConfirmedAt).toLocaleString() : "Delivery event unavailable"}</dd></div>
            <div><dt>Carrier notes</dt><dd>{order.deliveryNotes ?? "None"}</dd></div>
          </dl>
          <p className="finePrint">The receiving workspace deliberately excludes farm source identity, pickup address/contact information and supplier economics.</p>
        </article>
      </div>

      {order.status === "DELIVERED" && !order.inspection && (
        <>
          <article className="panel">
            <h2>Accept institutional intake</h2>
            <p>Acceptance starts the research need&apos;s in-study phase. Every receiving check must pass.</p>
            <form className="formStack" action={"/api/receiving/" + order.id + "/inspect"} method="post">
              <input type="hidden" name="decision" value="ACCEPT" />
              <label className="checkCard"><input type="checkbox" name="animalIdentityConfirmed" required /><span>RAM animal identity matches the delivered animal and custody record.</span></label>
              <label className="checkCard"><input type="checkbox" name="movementDocumentsReceived" required /><span>Required movement / transport documents were received.</span></label>
              <label className="checkCard"><input type="checkbox" name="physicalConditionConsistent" required /><span>Physical condition is materially consistent with the shipping and clinical record.</span></label>
              <label className="checkCard"><input type="checkbox" name="welfareIntakeAcceptable" required /><span>Welfare condition is acceptable for institutional intake under the approved protocol.</span></label>
              <label><span>Receiving notes</span><textarea name="notes" rows={4} /></label>
              <label className="checkCard"><input type="checkbox" name="inspectorAttestation" required /><span>I attest that I am authorized to perform this institution&apos;s receiving inspection and that these observations are accurate.</span></label>
              <button className="primaryButton" type="submit">Accept animal into study</button>
            </form>
          </article>

          <article className="panel">
            <h2>Reject at receipt</h2>
            <p>Check each item that passed. Leave any failed item unchecked and document the discrepancy. Rejection does not start the study.</p>
            <form className="formStack" action={"/api/receiving/" + order.id + "/inspect"} method="post">
              <input type="hidden" name="decision" value="REJECT" />
              <label className="checkCard"><input type="checkbox" name="animalIdentityConfirmed" /><span>Animal identity confirmed</span></label>
              <label className="checkCard"><input type="checkbox" name="movementDocumentsReceived" /><span>Movement documents received</span></label>
              <label className="checkCard"><input type="checkbox" name="physicalConditionConsistent" /><span>Physical condition consistent with record</span></label>
              <label className="checkCard"><input type="checkbox" name="welfareIntakeAcceptable" /><span>Welfare acceptable for institutional intake</span></label>
              <label><span>Blocking discrepancies *</span><textarea name="discrepancyNotes" rows={5} minLength={20} required /></label>
              <label><span>Additional notes</span><textarea name="notes" rows={4} /></label>
              <label className="checkCard"><input type="checkbox" name="inspectorAttestation" required /><span>I attest that I am authorized to perform this institution&apos;s receiving inspection and that these observations are accurate.</span></label>
              <button className="secondaryButton" type="submit">Reject at receipt</button>
            </form>
          </article>
        </>
      )}

      {order.inspection && (
        <article className="panel">
          <h2>Recorded receiving decision</h2>
          <div className="privacyBanner">
            <strong>{order.inspection.decision}</strong>
            <span>{new Date(order.inspection.inspectedAt).toLocaleString()}</span>
          </div>
          <dl>
            <div><dt>Animal identity</dt><dd>{check(order.inspection.animalIdentityConfirmed)}</dd></div>
            <div><dt>Movement documents</dt><dd>{check(order.inspection.movementDocumentsReceived)}</dd></div>
            <div><dt>Physical condition</dt><dd>{check(order.inspection.physicalConditionConsistent)}</dd></div>
            <div><dt>Welfare intake</dt><dd>{check(order.inspection.welfareIntakeAcceptable)}</dd></div>
            <div><dt>Discrepancies</dt><dd>{order.inspection.discrepancyNotes ?? "None"}</dd></div>
            <div><dt>Notes</dt><dd>{order.inspection.notes ?? "None"}</dd></div>
          </dl>
        </article>
      )}

      <Link className="secondaryButton" href="/receiving">Back to receiving queue</Link>
    </section>
  );
}
