import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import {
  evaluatePilotReadiness,
  readinessSummary,
  type ReadinessCheck
} from "@/lib/pilot-readiness";
import {
  listPilotGateAdministration,
  pilotGateSummary
} from "@/lib/server/pilot-gates";
import { monitoringRuntimeCheck } from "@/lib/server/monitoring";

export const dynamic = "force-dynamic";

export default async function PilotReadinessPage() {
  const session = await requireSession();

  const [gateAdmin, monitoringRuntime] = await Promise.all([
    listPilotGateAdministration(session),
    monitoringRuntimeCheck()
  ]);

  const automaticChecks = evaluatePilotReadiness(process.env).filter(
    (check) => check.status !== "MANUAL"
  );

  const monitoringCheck: ReadinessCheck = {
    id: "monitoring_runtime",
    label: "Monitoring heartbeat",
    status: monitoringRuntime.healthy ? "PASS" : "BLOCK",
    detail: monitoringRuntime.detail
  };
  automaticChecks.push(monitoringCheck);

  const automatic = readinessSummary(automaticChecks);
  const manual = pilotGateSummary(gateAdmin.gates);
  const launchReady = automatic.automaticReady && manual.ready;

  return (
    <section className="page">
      <div className="pageHeader">
        <div>
          <div className="eyebrow">RAM administration · pilot readiness</div>
          <h1>Pilot launch control</h1>
          <p>
            Launch readiness combines automatically verifiable configuration,
            a live monitoring heartbeat, and persisted human verification with
            accountable owners and evidence.
          </p>
        </div>
        <div className="formActions">
          <Link className="secondaryButton" href="/ops">Back to operations</Link>
          <Link className="secondaryButton" href="/ops/monitoring">
            Monitoring & incidents
          </Link>
        </div>
      </div>

      <div className="metricGrid">
        <article>
          <strong>{launchReady ? "READY" : "BLOCKED"}</strong>
          <span>Overall pilot launch</span>
        </article>
        <article>
          <strong>{automatic.blockers}</strong>
          <span>Automatic blockers</span>
        </article>
        <article>
          <strong>{manual.pending}</strong>
          <span>Manual gates pending</span>
        </article>
        <article>
          <strong>{manual.expired}</strong>
          <span>Manual gates expired</span>
        </article>
      </div>

      <h2>Automatic readiness</h2>
      <div className="tableCard">
        <div className="tableRow tableHead">
          <span>Check</span>
          <span>Status</span>
          <span>Requirement</span>
          <span>Type</span>
        </div>
        {automaticChecks.map((check) => (
          <div className="tableRow" key={check.id}>
            <strong>{check.label}</strong>
            <span className="status">{check.status}</span>
            <span>{check.detail}</span>
            <span>Automatic</span>
          </div>
        ))}
      </div>

      <h2>Accountable manual gates</h2>
      {gateAdmin.gates.map((gate) => (
        <article className="panel" key={gate.key}>
          <div className="pageHeader compact">
            <div>
              <div className="eyebrow">{gate.key.replaceAll("_", " ")}</div>
              <h2>{gate.label}</h2>
              <p>{gate.detail}</p>
            </div>
            <span className="status">{gate.effectiveStatus}</span>
          </div>

          {gate.record ? (
            <div className="detailGrid">
              <p>
                <strong>Owner:</strong>{" "}
                {gate.record.owner
                  ? gate.record.owner.name + " · " + gate.record.owner.email
                  : "Unassigned"}
              </p>
              <p>
                <strong>Verified by:</strong>{" "}
                {gate.record.verifiedBy
                  ? gate.record.verifiedBy.name
                  : "Not verified"}
              </p>
              <p>
                <strong>Verified at:</strong>{" "}
                {gate.record.verifiedAt
                  ? gate.record.verifiedAt.toLocaleString()
                  : "—"}
              </p>
              <p>
                <strong>Review due:</strong>{" "}
                {gate.record.reviewDueAt
                  ? gate.record.reviewDueAt.toLocaleString()
                  : "No expiry set"}
              </p>
            </div>
          ) : null}

          {gate.record?.evidenceSummary ? (
            <div className="privacyBanner">
              <strong>Evidence</strong>
              <span>{gate.record.evidenceSummary}</span>
            </div>
          ) : null}

          <form
            className="formStack"
            action={"/api/ops/pilot/gates/" + gate.key + "/verify"}
            method="post"
          >
            <div className="formGrid">
              <label>
                <span>Accountable owner *</span>
                <select
                  name="ownerUserId"
                  required
                  defaultValue={gate.record?.ownerUserId ?? session.userId}
                >
                  <option value="" disabled>Select RAM owner</option>
                  {gateAdmin.owners.map((owner) => (
                    <option value={owner.id} key={owner.id}>
                      {owner.name} · {owner.email}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Review due</span>
                <input name="reviewDueAt" type="datetime-local" />
              </label>
            </div>
            <label>
              <span>Verification evidence *</span>
              <textarea
                name="evidenceSummary"
                minLength={10}
                maxLength={4000}
                required
                defaultValue={gate.record?.evidenceSummary ?? ""}
                placeholder="What was tested or inspected, when, and what evidence established that this gate is satisfied?"
              />
            </label>
            <label>
              <span>Notes</span>
              <textarea
                name="notes"
                maxLength={4000}
                defaultValue={gate.record?.notes ?? ""}
              />
            </label>
            <button
              className="primaryButton"
              type="submit"
              disabled={gateAdmin.owners.length === 0}
            >
              {gate.effectiveStatus === "VERIFIED"
                ? "Re-verify gate"
                : "Verify gate"}
            </button>
          </form>

          {gate.record?.status === "VERIFIED" ? (
            <form
              className="formStack"
              action={"/api/ops/pilot/gates/" + gate.key + "/reset"}
              method="post"
            >
              <label>
                <span>Reset reason *</span>
                <input name="reason" minLength={3} maxLength={4000} required />
              </label>
              <button className="secondaryButton" type="submit">
                Reset to pending
              </button>
            </form>
          ) : null}
        </article>
      ))}

      <div className="privacyBanner">
        <strong>Launch rule.</strong>
        <span>
          Real transactions should not be admitted until automatic blockers are
          zero, the monitoring heartbeat is current, and every manual gate is
          verified and not expired.
        </span>
      </div>
    </section>
  );
}
