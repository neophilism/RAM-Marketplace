import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { listVeterinaryQueue } from "@/lib/server/clinical";

export const dynamic = "force-dynamic";

export default async function VetPage() {
  const session = await requireSession();
  const reviews = await listVeterinaryQueue(session);

  return (
    <section className="page">
      <div className="pageHeader">
        <div>
          <div className="eyebrow">RAM veterinary network</div>
          <h1>Verification queue</h1>
          <p>Veterinary review gates marketplace eligibility and remains independent from buyer demand.</p>
        </div>
      </div>

      <div className="tableCard">
        <div className="tableRow tableHead"><span>Animal</span><span>Condition</span><span>Status</span><span>Action</span></div>
        {reviews.length === 0 ? (
          <div className="emptyState">No candidates currently require veterinary review.</div>
        ) : reviews.map((review) => (
          <div className="tableRow" key={review.id}>
            <div><strong>{review.id}</strong><div className="subtle">{review.species} · {review.ageLabel}</div></div>
            <span>{review.condition}</span>
            <span className="status">{review.status.replaceAll("_", " ")}</span>
            <div>
              {review.status === "PRE_SCREENED" ? (
                <form action={"/api/vet/candidates/" + review.id + "/claim"} method="post">
                  <button className="secondaryButton" type="submit">Claim review</button>
                </form>
              ) : review.assignedToMe ? (
                <Link className="primaryButton" href={"/vet/" + review.id}>Continue review</Link>
              ) : (
                <span className="subtle">Assigned to another veterinarian</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="panel">
        <h2>Clinical gate</h2>
        <p>Eligible cases advance only to VERIFIED. RAM operations must separately approve pricing, disclosure and publication before a case becomes MATCHABLE.</p>
      </div>
    </section>
  );
}
