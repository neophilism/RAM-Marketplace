import { requireSession } from "@/lib/auth/session";
import { listAuditEvents } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

function stringValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function json(value: unknown) {
  return value == null ? "—" : JSON.stringify(value, null, 2);
}

export default async function AuditPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const filters = {
    action: stringValue(params.action),
    entityType: stringValue(params.entityType),
    entityId: stringValue(params.entityId),
    organizationId: stringValue(params.organizationId),
    actorUserId: stringValue(params.actorUserId),
    correlationId: stringValue(params.correlationId),
    since: stringValue(params.since),
    limit: Number(stringValue(params.limit) ?? "100")
  };
  const events = await listAuditEvents(session, filters);

  return (
    <section className="page">
      <div className="pageHeader">
        <div>
          <div className="eyebrow">RAM security · audit</div>
          <h1>Global audit explorer</h1>
          <p>Read-only operational history across transaction, disclosure, clinical, logistics, finance and exception workflows.</p>
        </div>
      </div>

      <div className="privacyBanner">
        <strong>Super-admin only.</strong>
        <span>Audit history can contain restricted operational metadata. This interface is intentionally excluded from ordinary RAM operations, finance, compliance, supplier and buyer roles.</span>
      </div>

      <article className="panel">
        <h2>Filters</h2>
        <form className="formGrid" method="get">
          <label><span>Action contains</span><input name="action" defaultValue={filters.action} /></label>
          <label><span>Entity type contains</span><input name="entityType" defaultValue={filters.entityType} /></label>
          <label><span>Entity ID contains</span><input name="entityId" defaultValue={filters.entityId} /></label>
          <label><span>Organization ID</span><input name="organizationId" defaultValue={filters.organizationId} /></label>
          <label><span>Actor user ID</span><input name="actorUserId" defaultValue={filters.actorUserId} /></label>
          <label><span>Correlation ID</span><input name="correlationId" defaultValue={filters.correlationId} /></label>
          <label><span>Since</span><input type="datetime-local" name="since" defaultValue={filters.since} /></label>
          <label><span>Limit</span><input type="number" name="limit" min="1" max="250" defaultValue={filters.limit} /></label>
          <div className="formActions span2">
            <button className="primaryButton" type="submit">Apply filters</button>
            <a className="secondaryButton" href="/ops/audit">Clear</a>
          </div>
        </form>
      </article>

      <div className="tableCard">
        <div className="tableRow tableHead"><span>When / action</span><span>Entity</span><span>Actor / organization</span><span>Details</span></div>
        {events.length === 0 ? (
          <div className="emptyState">No durable audit events match these filters.</div>
        ) : events.map((event) => (
          <div className="tableRow" key={event.id}>
            <div>
              <strong>{event.action}</strong>
              <div className="subtle">{new Date(event.createdAt).toLocaleString()}</div>
            </div>
            <div>
              <strong>{event.entityType}</strong>
              <div className="subtle">{event.entityId}</div>
              {event.correlationId ? <div className="subtle">corr: {event.correlationId}</div> : null}
            </div>
            <div>
              <strong>{event.actorName ?? event.actorUserId ?? "System"}</strong>
              <div className="subtle">{event.actorEmail ?? event.actorUserId ?? "No actor"}</div>
              <div className="subtle">{event.organizationId ?? "No organization"}</div>
            </div>
            <details>
              <summary className="secondaryButton">Inspect</summary>
              {event.reason ? <p><strong>Reason:</strong> {event.reason}</p> : null}
              <h3>Previous state</h3>
              <pre>{json(event.previousState)}</pre>
              <h3>Next state</h3>
              <pre>{json(event.nextState)}</pre>
              <h3>Metadata</h3>
              <pre>{json(event.metadata)}</pre>
              <p className="finePrint">Audit ID: {event.id}</p>
            </details>
          </div>
        ))}
      </div>
    </section>
  );
}
