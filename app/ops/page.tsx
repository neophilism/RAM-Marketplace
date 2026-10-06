import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import {
  listOpsCandidateQueue,
  listResearchNeedsForOps
} from "@/lib/server/clinical";

export const dynamic = "force-dynamic";

export default async function OpsPage() {
  const session = await requireSession();
  const [candidates, needs] = await Promise.all([
    listOpsCandidateQueue(session),
    listResearchNeedsForOps(session)
  ]);

  return (
    <section className="page">
      <div className="pageHeader">
        <div>
          <div className="eyebrow">RAM internal</div>
          <h1>Operations command center</h1>
          <p>Clinical gates, publication, research-need activation and matching are controlled here.</p>
        </div>
      </div>

      <div className="metricGrid">
        <article><strong>{candidates.length}</strong><span>Candidate workflow items</span></article>
        <article><strong>{needs.length}</strong><span>Research needs awaiting activation</span></article>
        <article><strong>{candidates.filter((item) => item.status === "VERIFIED").length}</strong><span>Ready to publish</span></article>
        <article><strong>{candidates.filter((item) => item.status === "VET_PENDING").length}</strong><span>In veterinary review</span></article>
      </div>

      <h2>Candidate gates</h2>
      <div className="tableCard">
        <div className="tableRow tableHead"><span>Candidate</span><span>Condition</span><span>Status</span><span>Action</span></div>
        {candidates.length === 0 ? (
          <div className="emptyState">No candidate workflow items.</div>
        ) : candidates.map((candidate) => (
          <div className="tableRow" key={candidate.id}>
            <div><strong>{candidate.id}</strong><div className="subtle">{candidate.species}</div></div>
            <span>{candidate.condition}</span>
            <span className="status">{candidate.status.replaceAll("_", " ")}</span>
            <div>
              {candidate.status === "SUBMITTED" ? (
                <form action={"/api/ops/candidates/" + candidate.id + "/prescreen"} method="post">
                  <button className="secondaryButton" type="submit">Pass pre-screen</button>
                </form>
              ) : candidate.status === "VERIFIED" ? (
                <Link className="primaryButton" href={"/ops/candidates/" + candidate.id}>Review & publish</Link>
              ) : (
                <span className="subtle">{candidate.reviewOutcome ? "Vet: " + candidate.reviewOutcome.replaceAll("_", " ") : "Waiting on next gate"}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <h2>Research-need activation</h2>
      <div className="tableCard">
        <div className="tableRow tableHead"><span>Need</span><span>Condition</span><span>Species</span><span>Action</span></div>
        {needs.length === 0 ? (
          <div className="emptyState">No research needs awaiting activation.</div>
        ) : needs.map((need) => (
          <div className="tableRow" key={need.id}>
            <div><strong>{need.id}</strong><div className="subtle">{need.title}</div></div>
            <span>{need.condition}</span>
            <span>{need.species ?? "Any"}</span>
            <form action={"/api/ops/research-needs/" + need.id + "/activate"} method="post">
              <button className="secondaryButton" type="submit">Verify & activate</button>
            </form>
          </div>
        ))}
      </div>

      <div className="panel">
        <h2>Matching behavior</h2>
        <p>Publishing a candidate or activating a research need automatically recalculates deterministic matches and stores the full component score, hard-gate results, review flags and reasons.</p>
      </div>
    </section>
  );
}
