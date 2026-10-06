import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { listTransportAssignments } from "@/lib/server/logistics";

export const dynamic = "force-dynamic";

function windowText(start: string | null, end: string | null) {
  if (!start || !end) return "Not specified";
  return new Date(start).toLocaleString() + " – " + new Date(end).toLocaleString();
}

export default async function TransportPage() {
  const session = await requireSession();
  const assignments = await listTransportAssignments(session);

  return (
    <section className="page">
      <div className="pageHeader">
        <div>
          <div className="eyebrow">Transport provider</div>
          <h1>Assigned animal transfers</h1>
          <p>Operational pickup and delivery data is available only for assignments belonging to your logistics organization.</p>
        </div>
      </div>

      <div className="tableCard">
        <div className="tableRow tableHead"><span>Assignment</span><span>Animal / order</span><span>Status</span><span>Pickup window</span></div>
        {assignments.length === 0 ? (
          <div className="emptyState">No transport assignments are currently available to this account.</div>
        ) : assignments.map((assignment) => (
          <div className="tableRow" key={assignment.id}>
            <Link href={"/transport/" + assignment.id}><strong>{assignment.id}</strong></Link>
            <div><strong>{assignment.animalCaseId}</strong><div className="subtle">{assignment.species} · order {assignment.orderId}</div></div>
            <span className="status">{assignment.orderStatus.replaceAll("_", " ")}</span>
            <span>{windowText(assignment.pickupWindowStart, assignment.pickupWindowEnd)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
