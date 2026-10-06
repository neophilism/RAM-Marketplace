import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { getTransportAssignment } from "@/lib/server/logistics";

export const dynamic = "force-dynamic";

function windowText(start: string | null, end: string | null) {
  if (!start || !end) return "Not specified";
  return new Date(start).toLocaleString() + " – " + new Date(end).toLocaleString();
}

export default async function TransportAssignmentPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const assignment = await getTransportAssignment(session, id);

  return (
    <section className="page narrow">
      <div className="pageHeader">
        <div>
          <div className="eyebrow">Transport assignment · {assignment.id}</div>
          <h1>{assignment.animalCaseId}</h1>
          <p>{assignment.species} · {assignment.condition} · order {assignment.orderId}</p>
        </div>
        <span className="status">{assignment.orderStatus.replaceAll("_", " ")}</span>
      </div>

      <div className="privacyBanner">
        <strong>Minimum-necessary transport packet.</strong>
        <span>This view contains operational pickup and receiving data only. It is not access to RAM&apos;s full source record or buyer commercial record.</span>
      </div>

      <div className="detailGrid">
        <article className="panel">
          <h2>Pickup</h2>
          <dl>
            <div><dt>Address</dt><dd>{assignment.pickupAddress}</dd></div>
            <div><dt>Contact</dt><dd>{assignment.pickupContactName}</dd></div>
            <div><dt>Email</dt><dd>{assignment.pickupContactEmail}</dd></div>
            <div><dt>Window</dt><dd>{windowText(assignment.pickupWindowStart, assignment.pickupWindowEnd)}</dd></div>
          </dl>
        </article>

        <article className="panel">
          <h2>Delivery</h2>
          <dl>
            <div><dt>Facility</dt><dd>{assignment.deliveryFacilityName}</dd></div>
            <div><dt>Address</dt><dd>{assignment.deliveryAddress}</dd></div>
            <div><dt>Window</dt><dd>{windowText(assignment.deliveryWindowStart, assignment.deliveryWindowEnd)}</dd></div>
          </dl>
        </article>
      </div>

      <article className="panel">
        <h2>Movement & biosecurity</h2>
        <h3>Movement documents</h3>
        {assignment.movementDocumentRefs.length ? (
          <ul>{assignment.movementDocumentRefs.map((ref) => <li key={ref}>{ref}</li>)}</ul>
        ) : <p>None specified.</p>}
        <h3>Sanitation requirements</h3>
        <p>{assignment.sanitationRequirements ?? "Follow cleared transport plan and applicable sanitation requirements."}</p>
        <h3>Special instructions</h3>
        <p>{assignment.specialInstructions ?? "None."}</p>
      </article>

      {assignment.orderStatus === "READY_FOR_PICKUP" && (
        <article className="panel">
          <h2>Confirm pickup & custody</h2>
          <form className="formStack" action={"/api/transport/" + assignment.id + "/event"} method="post">
            <input type="hidden" name="eventType" value="PICKUP_CONFIRMED" />
            <label className="checkCard">
              <input type="checkbox" name="sanitationConfirmed" required />
              <span>Vehicle/container sanitation and the cleared biosecurity plan have been confirmed.</span>
            </label>
            <label className="checkCard">
              <input type="checkbox" name="custodyAttestation" required />
              <span>I attest that custody of the identified RAM animal was accepted for this transport assignment.</span>
            </label>
            <label><span>Pickup notes</span><textarea name="notes" rows={3} /></label>
            <button className="primaryButton" type="submit">Confirm pickup & begin transit</button>
          </form>
        </article>
      )}

      {assignment.orderStatus === "IN_TRANSIT" && (
        <div className="detailGrid">
          <article className="panel">
            <h2>Confirm delivery</h2>
            <form className="formStack" action={"/api/transport/" + assignment.id + "/event"} method="post">
              <input type="hidden" name="eventType" value="DELIVERY_CONFIRMED" />
              <label className="checkCard">
                <input type="checkbox" name="custodyAttestation" required />
                <span>I attest that custody was transferred at the listed receiving facility.</span>
              </label>
              <label><span>Delivery notes</span><textarea name="notes" rows={3} /></label>
              <button className="primaryButton" type="submit">Confirm delivery</button>
            </form>
          </article>
          <article className="panel">
            <h2>Report transport exception</h2>
            <form className="formStack" action={"/api/transport/" + assignment.id + "/event"} method="post">
              <input type="hidden" name="eventType" value="EXCEPTION_REPORTED" />
              <label><span>Exception description *</span><textarea name="notes" minLength={10} rows={4} required /></label>
              <button className="secondaryButton" type="submit">Report exception</button>
            </form>
          </article>
        </div>
      )}

      {assignment.orderStatus === "TRANSPORT_EXCEPTION" && (
        <div className="detailGrid">
          <article className="panel">
            <h2>Resume transit</h2>
            <form className="formStack" action={"/api/transport/" + assignment.id + "/event"} method="post">
              <input type="hidden" name="eventType" value="RESUME_TRANSIT" />
              <label><span>Resolution notes</span><textarea name="notes" rows={4} /></label>
              <button className="primaryButton" type="submit">Resume transit</button>
            </form>
          </article>
          <article className="panel">
            <h2>Delivery after exception</h2>
            <form className="formStack" action={"/api/transport/" + assignment.id + "/event"} method="post">
              <input type="hidden" name="eventType" value="DELIVERY_CONFIRMED" />
              <label className="checkCard">
                <input type="checkbox" name="custodyAttestation" required />
                <span>I attest that custody was transferred at the listed receiving facility.</span>
              </label>
              <label><span>Delivery / resolution notes</span><textarea name="notes" rows={4} /></label>
              <button className="secondaryButton" type="submit">Confirm delivery</button>
            </form>
          </article>
        </div>
      )}

      <article className="panel">
        <h2>Chain of custody</h2>
        {assignment.events.length === 0 ? <p>No transport events have been recorded.</p> : (
          <ol>
            {assignment.events.map((event) => (
              <li key={event.id}>
                <strong>{event.type.replaceAll("_", " ")}</strong> · {new Date(event.occurredAt).toLocaleString()}
                {event.notes ? <div className="subtle">{event.notes}</div> : null}
              </li>
            ))}
          </ol>
        )}
      </article>

      <Link className="secondaryButton" href="/transport">Back to assignments</Link>
    </section>
  );
}
