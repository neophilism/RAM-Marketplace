import { can } from "@/lib/access";
import { requireSession } from "@/lib/auth/session";
import {
  evaluatePilotReadiness,
  readinessSummary
} from "@/lib/pilot-readiness";

export const dynamic = "force-dynamic";

export default async function PilotReadinessPage() {
  const session = await requireSession();
  if (!can(session.role, "audit:read")) {
    throw new Error("Forbidden: pilot readiness is restricted to RAM super admin");
  }

  const checks = evaluatePilotReadiness(process.env);
  const summary = readinessSummary(checks);

  return (
    <section className="page">
      <div className="pageHeader">
        <div>
          <div className="eyebrow">RAM administration · pilot readiness</div>
          <h1>Pilot readiness</h1>
          <p>
            Automated configuration checks are separated from deployment gates
            that require human verification. Passing CI does not automatically
            authorize real transactions.
          </p>
        </div>
      </div>

      <div className="metricGrid">
        <article>
          <strong>{summary.automaticReady ? "READY" : "BLOCKED"}</strong>
          <span>Automatic configuration</span>
        </article>
        <article>
          <strong>{summary.blockers}</strong>
          <span>Automatic blockers</span>
        </article>
        <article>
          <strong>{summary.manualGates}</strong>
          <span>Manual deployment gates</span>
        </article>
      </div>

      <div className="tableCard">
        <div className="tableRow tableHead">
          <span>Check</span>
          <span>Status</span>
          <span>Requirement</span>
          <span>Type</span>
        </div>
        {checks.map((check) => (
          <div className="tableRow" key={check.id}>
            <strong>{check.label}</strong>
            <span className="status">{check.status}</span>
            <span>{check.detail}</span>
            <span>{check.status === "MANUAL" ? "Human verification" : "Automatic"}</span>
          </div>
        ))}
      </div>

      <div className="privacyBanner">
        <strong>Launch rule.</strong>
        <span>
          Real transactions should not be admitted until automatic blockers are
          zero and every manual deployment gate has an accountable owner and
          documented verification.
        </span>
      </div>
    </section>
  );
}
