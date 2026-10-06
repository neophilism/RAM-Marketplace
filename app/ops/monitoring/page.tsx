import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { monitoringConfig } from "@/lib/monitoring/config";
import {
  monitoringDashboard,
  monitoringRuntimeCheck
} from "@/lib/server/monitoring";

export const dynamic = "force-dynamic";

export default async function MonitoringPage() {
  const session = await requireSession();
  const [dashboard, runtime] = await Promise.all([
    monitoringDashboard(session),
    monitoringRuntimeCheck()
  ]);
  const config = monitoringConfig();

  return (
    <section className="page">
      <div className="pageHeader">
        <div>
          <div className="eyebrow">RAM administration · monitoring</div>
          <h1>Operational monitoring & incidents</h1>
          <p>
            Persistent operational signals are deduplicated into incidents. New
            or reopened incidents generate signed alerts; operators explicitly
            acknowledge and resolve them.
          </p>
        </div>
        <div className="formActions">
          <Link className="secondaryButton" href="/ops">Back to operations</Link>
          <form action="/api/ops/monitoring/run" method="post">
            <button className="primaryButton" type="submit">
              Run monitoring now
            </button>
          </form>
        </div>
      </div>

      <div className="privacyBanner">
        <strong>
          Monitoring heartbeat: {runtime.healthy ? "HEALTHY" : "BLOCKED"}
        </strong>
        <span>{runtime.detail}</span>
      </div>

      <div className="metricGrid">
        <article>
          <strong>{dashboard.summary.openCritical}</strong>
          <span>Open critical incidents</span>
        </article>
        <article>
          <strong>{dashboard.summary.openWarning}</strong>
          <span>Open warning incidents</span>
        </article>
        <article>
          <strong>{dashboard.summary.acknowledged}</strong>
          <span>Acknowledged incidents</span>
        </article>
        <article>
          <strong>{dashboard.summary.failedAlertDeliveries}</strong>
          <span>Failed alert deliveries</span>
        </article>
      </div>

      <article className="panel">
        <h2>Configured thresholds</h2>
        <div className="detailGrid">
          <p>Payment submission unknown: {config.paymentUnknownMinutes} minutes</p>
          <p>Payment processing stale: {config.paymentProcessingMinutes} minutes</p>
          <p>Open dispute stale: {config.disputeHours} hours</p>
          <p>Ready-for-pickup stale: {config.pickupHours} hours</p>
          <p>Organization verification overdue: {config.organizationVerificationHours} hours</p>
          <p>Monitoring heartbeat maximum age: {config.maxRunAgeMinutes} minutes</p>
        </div>
      </article>

      <h2>Incidents</h2>
      <div className="tableCard">
        <div className="tableRow tableHead">
          <span>Incident</span>
          <span>Severity / status</span>
          <span>Detection</span>
          <span>Action</span>
        </div>
        {dashboard.incidents.length === 0 ? (
          <div className="emptyState">No operational incidents recorded.</div>
        ) : dashboard.incidents.map((incident) => (
          <div className="tableRow" key={incident.id}>
            <div>
              <strong>{incident.title}</strong>
              <div className="subtle">{incident.code} · {incident.id}</div>
              <p>{incident.summary}</p>
              {incident.entityType ? (
                <div className="subtle">
                  {incident.entityType} {incident.entityId ?? ""}
                </div>
              ) : null}
            </div>
            <div>
              <span className="status">{incident.severity}</span>
              <div className="subtle">{incident.status}</div>
            </div>
            <div>
              <strong>{incident.occurrenceCount} detection(s)</strong>
              <div className="subtle">
                Last {incident.lastDetectedAt.toLocaleString()}
              </div>
              {incident.acknowledgedBy ? (
                <div className="subtle">
                  Ack by {incident.acknowledgedBy.name}
                </div>
              ) : null}
              {incident.resolvedBy ? (
                <div className="subtle">
                  Resolved by {incident.resolvedBy.name}
                </div>
              ) : null}
            </div>
            <div className="formStack">
              {incident.status === "OPEN" ? (
                <form
                  action={"/api/ops/monitoring/incidents/" + incident.id + "/acknowledge"}
                  method="post"
                >
                  <button className="secondaryButton" type="submit">
                    Acknowledge
                  </button>
                </form>
              ) : null}

              {incident.status !== "RESOLVED" ? (
                <>
                  <form
                    action={"/api/ops/monitoring/incidents/" + incident.id + "/retry-alert"}
                    method="post"
                  >
                    <button className="secondaryButton" type="submit">
                      Retry alert
                    </button>
                  </form>
                  <form
                    className="formStack"
                    action={"/api/ops/monitoring/incidents/" + incident.id + "/resolve"}
                    method="post"
                  >
                    <input
                      name="resolutionNotes"
                      minLength={3}
                      maxLength={4000}
                      required
                      placeholder="Resolution and evidence"
                    />
                    <button className="primaryButton" type="submit">
                      Resolve
                    </button>
                  </form>
                </>
              ) : (
                <span className="subtle">
                  {incident.resolutionNotes ?? "Resolved"}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <h2>Recent monitoring runs</h2>
      <div className="tableCard">
        <div className="tableRow tableHead">
          <span>Started</span>
          <span>Trigger</span>
          <span>Result</span>
          <span>Counts</span>
        </div>
        {dashboard.runs.length === 0 ? (
          <div className="emptyState">No monitoring cycles recorded.</div>
        ) : dashboard.runs.map((run) => (
          <div className="tableRow" key={run.id}>
            <span>{run.startedAt.toLocaleString()}</span>
            <span>{run.trigger}</span>
            <div>
              <span className="status">{run.status}</span>
              {run.errorMessage ? <div className="subtle">{run.errorMessage}</div> : null}
            </div>
            <span>
              {run.signalsEvaluated} signals · {run.incidentsOpened} opened ·{" "}
              {run.incidentsUpdated} updated · {run.alertAttempts} alerts
            </span>
          </div>
        ))}
      </div>

      <h2>Failed alert deliveries</h2>
      <div className="tableCard">
        <div className="tableRow tableHead">
          <span>Incident</span>
          <span>Attempted</span>
          <span>Receiver</span>
          <span>Error</span>
        </div>
        {dashboard.failedDeliveries.length === 0 ? (
          <div className="emptyState">No failed alert deliveries recorded.</div>
        ) : dashboard.failedDeliveries.map((delivery) => (
          <div className="tableRow" key={delivery.id}>
            <div>
              <strong>{delivery.incident.title}</strong>
              <div className="subtle">{delivery.incident.code}</div>
            </div>
            <span>{delivery.attemptedAt.toLocaleString()}</span>
            <span className="subtle">{delivery.endpointHash}</span>
            <span>{delivery.errorMessage ?? "Receiver rejected alert"}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
