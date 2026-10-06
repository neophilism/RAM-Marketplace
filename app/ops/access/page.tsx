import { requireSession } from "@/lib/auth/session";
import { listAccessAdministration } from "@/lib/server/access-admin";

export const dynamic = "force-dynamic";

export default async function AccessAdministrationPage() {
  const session = await requireSession();
  const { organizations, memberships } =
    await listAccessAdministration(session);

  return (
    <section className="page">
      <div className="pageHeader">
        <div>
          <div className="eyebrow">RAM administration · identity & access</div>
          <h1>Organization verification & account lifecycle</h1>
          <p>
            Approve organizations only after verification. Membership and
            organization status changes take effect on the next protected
            request, even when a signed session cookie is still valid.
          </p>
        </div>
      </div>

      <div className="metricGrid">
        <article>
          <strong>
            {organizations.filter(
              (organization) =>
                organization.status === "PENDING_VERIFICATION"
            ).length}
          </strong>
          <span>Pending organizations</span>
        </article>
        <article>
          <strong>
            {organizations.filter(
              (organization) => organization.status === "SUSPENDED"
            ).length}
          </strong>
          <span>Suspended organizations</span>
        </article>
        <article>
          <strong>
            {memberships.filter(
              (membership) => membership.status === "SUSPENDED"
            ).length}
          </strong>
          <span>Suspended memberships</span>
        </article>
      </div>

      <h2>Organizations</h2>
      {organizations.length === 0 ? (
        <div className="emptyState">
          Organization verification records are available in PostgreSQL mode.
        </div>
      ) : (
        organizations.map((organization) => (
          <article className="panel" key={organization.id}>
            <div className="pageHeader compact">
              <div>
                <div className="eyebrow">
                  {organization.type.replaceAll("_", " ")}
                </div>
                <h2>{organization.name}</h2>
                <p>
                  Organization: {organization.status.replaceAll("_", " ")} ·
                  Verification:{" "}
                  {(organization.verification?.decision ?? "PENDING").replaceAll(
                    "_",
                    " "
                  )}
                </p>
              </div>
            </div>

            <div className="subtle">
              {organization.memberships.map((membership) => (
                <div key={membership.id}>
                  {membership.user.name} · {membership.user.email} ·{" "}
                  {membership.role.replaceAll("_", " ")} ·{" "}
                  {membership.status.replaceAll("_", " ")} · email{" "}
                  {membership.user.emailVerifiedAt ? "verified" : "unverified"}
                </div>
              ))}
            </div>

            {organization.status === "PENDING_VERIFICATION" ? (
              <div className="detailGrid">
                <form
                  className="formStack"
                  action={
                    "/api/ops/access/organizations/" +
                    organization.id
                  }
                  method="post"
                >
                  <input type="hidden" name="action" value="APPROVE" />
                  <label>
                    <span>Verification method *</span>
                    <input
                      name="method"
                      required
                      placeholder="e.g. institutional registry + authorized contact"
                    />
                  </label>
                  <label>
                    <span>Evidence summary *</span>
                    <textarea
                      name="evidenceSummary"
                      required
                      minLength={10}
                      placeholder="What was checked and what established the organization identity?"
                    />
                  </label>
                  <label>
                    <span>Notes</span>
                    <textarea name="notes" />
                  </label>
                  <button className="primaryButton" type="submit">
                    Approve organization
                  </button>
                </form>

                <form
                  className="formStack"
                  action={
                    "/api/ops/access/organizations/" +
                    organization.id
                  }
                  method="post"
                >
                  <input type="hidden" name="action" value="REJECT" />
                  <label>
                    <span>Rejection reason *</span>
                    <textarea name="notes" required />
                  </label>
                  <button className="secondaryButton" type="submit">
                    Reject organization
                  </button>
                </form>
              </div>
            ) : organization.status === "ACTIVE" ? (
              <form
                className="formStack"
                action={
                  "/api/ops/access/organizations/" + organization.id
                }
                method="post"
              >
                <input type="hidden" name="action" value="SUSPEND" />
                <label>
                  <span>Suspension reason *</span>
                  <input name="notes" required />
                </label>
                <button className="secondaryButton" type="submit">
                  Suspend organization
                </button>
              </form>
            ) : organization.status === "SUSPENDED" ? (
              <form
                action={
                  "/api/ops/access/organizations/" + organization.id
                }
                method="post"
              >
                <input type="hidden" name="action" value="REACTIVATE" />
                <button className="primaryButton" type="submit">
                  Reactivate verified organization
                </button>
              </form>
            ) : null}
          </article>
        ))
      )}

      <h2>Memberships</h2>
      <div className="tableCard">
        <div className="tableRow tableHead">
          <span>User</span>
          <span>Organization / role</span>
          <span>Status</span>
          <span>Lifecycle action</span>
        </div>
        {memberships.map((membership) => (
          <div className="tableRow" key={membership.id}>
            <div>
              <strong>{membership.user.name}</strong>
              <div className="subtle">{membership.user.email}</div>
            </div>
            <div>
              <strong>{membership.organization.name}</strong>
              <div className="subtle">
                {membership.role.replaceAll("_", " ")}
              </div>
            </div>
            <span className="status">
              {membership.status.replaceAll("_", " ")}
            </span>
            <div className="formStack">
              {membership.status !== "ACTIVE" &&
              membership.status !== "REVOKED" ? (
                <form
                  action={
                    "/api/ops/access/memberships/" + membership.id
                  }
                  method="post"
                >
                  <input type="hidden" name="status" value="ACTIVE" />
                  <input
                    name="reason"
                    required
                    defaultValue="RAM access administrator activated membership"
                  />
                  <button className="secondaryButton" type="submit">
                    Activate
                  </button>
                </form>
              ) : null}

              {membership.status === "ACTIVE" ? (
                <form
                  action={
                    "/api/ops/access/memberships/" + membership.id
                  }
                  method="post"
                >
                  <input type="hidden" name="status" value="SUSPENDED" />
                  <input
                    name="reason"
                    required
                    placeholder="Suspension reason"
                  />
                  <button className="secondaryButton" type="submit">
                    Suspend
                  </button>
                </form>
              ) : null}

              {membership.status !== "REVOKED" ? (
                <form
                  action={
                    "/api/ops/access/memberships/" + membership.id
                  }
                  method="post"
                >
                  <input type="hidden" name="status" value="REVOKED" />
                  <input
                    name="reason"
                    required
                    placeholder="Revocation reason"
                  />
                  <button className="secondaryButton" type="submit">
                    Revoke
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
