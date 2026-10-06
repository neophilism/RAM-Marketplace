import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { listPaymentProfiles } from "@/lib/server/payment-profiles";
import { paymentGatewayConfig } from "@/lib/payments/gateway";

export const dynamic = "force-dynamic";

export default async function PaymentProfilesPage() {
  const session = await requireSession();
  const gateway = paymentGatewayConfig();
  const { organizations, profiles } = await listPaymentProfiles(session);

  return (
    <section className="page">
      <div className="pageHeader">
        <div>
          <div className="eyebrow">RAM finance · payment routing</div>
          <h1>Organization payment profiles</h1>
          <p>
            Store only opaque provider account references. RAM never needs raw
            bank credentials in the marketplace application.
          </p>
        </div>
        <Link className="secondaryButton" href="/finance">Back to finance</Link>
      </div>

      {!gateway ? (
        <div className="privacyBanner">
          <strong>Payment gateway not configured.</strong>
          <span>Configure the production payment gateway before creating payment profiles.</span>
        </div>
      ) : (
        <div className="privacyBanner">
          <strong>{gateway.name}</strong>
          <span>
            New or updated profiles are bound to this configured gateway and
            require explicit finance verification.
          </span>
        </div>
      )}

      <article className="panel">
        <h2>Create or replace payment profile</h2>
        <form className="formStack" action="/api/finance/payment-profiles" method="post">
          <label>
            <span>Organization *</span>
            <select name="organizationId" required defaultValue="">
              <option value="" disabled>Select organization</option>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name} · {organization.type.replaceAll("_", " ")} · {organization.status}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Opaque provider account reference *</span>
            <input
              name="externalAccountReference"
              required
              minLength={3}
              maxLength={240}
              placeholder="Provider-issued account/customer token"
              autoComplete="off"
            />
          </label>

          <div className="detailGrid">
            <label className="checkCard">
              <input type="checkbox" name="buyerCollectionEnabled" />
              <span>Enable buyer collections and refunds</span>
            </label>
            <label className="checkCard">
              <input type="checkbox" name="supplierPayoutEnabled" />
              <span>Enable supplier payouts</span>
            </label>
          </div>

          <label>
            <span>Verification notes</span>
            <textarea
              name="notes"
              rows={4}
              placeholder="Optional operational notes; do not paste bank credentials."
            />
          </label>

          <label className="checkCard">
            <input type="checkbox" name="verificationAttestation" required />
            <span>
              I attest that the external account reference was verified against
              the organization and that the selected payment capabilities are
              appropriate for this organization type.
            </span>
          </label>

          <button className="primaryButton" type="submit" disabled={!gateway}>
            Save verified payment profile
          </button>
        </form>
      </article>

      <h2>Configured profiles</h2>
      <div className="tableCard">
        <div className="tableRow tableHead">
          <span>Organization</span>
          <span>Capabilities</span>
          <span>Provider routing</span>
          <span>Status / action</span>
        </div>
        {profiles.length === 0 ? (
          <div className="emptyState">No payment profiles configured.</div>
        ) : profiles.map((profile) => (
          <div className="tableRow" key={profile.id}>
            <div>
              <strong>{profile.organization.name}</strong>
              <div className="subtle">
                {profile.organization.type.replaceAll("_", " ")} · {profile.organization.status}
              </div>
            </div>
            <div>
              <strong>
                {profile.buyerCollectionEnabled ? "Buyer collect/refund" : ""}
                {profile.buyerCollectionEnabled && profile.supplierPayoutEnabled ? " · " : ""}
                {profile.supplierPayoutEnabled ? "Supplier payout" : ""}
              </strong>
              <div className="subtle">
                Verified {new Date(profile.verifiedAt).toLocaleString()} by {profile.verifiedBy.name}
              </div>
            </div>
            <div>
              <strong>{profile.gateway}</strong>
              <div className="subtle">{profile.accountReferenceMasked}</div>
            </div>
            <div>
              <span className="status">{profile.status}</span>
              <form
                className="formStack"
                action={"/api/finance/payment-profiles/" + profile.id + "/status"}
                method="post"
              >
                <input
                  type="hidden"
                  name="status"
                  value={profile.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE"}
                />
                <input
                  name="reason"
                  required
                  placeholder={profile.status === "ACTIVE" ? "Suspension reason" : "Reactivation reason"}
                />
                <button className="secondaryButton" type="submit">
                  {profile.status === "ACTIVE" ? "Suspend" : "Reactivate"}
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
