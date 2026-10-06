import { identityBoundaryConfig } from "@/lib/auth/identity-config";
import {
  publicOnboardingEnabled,
  readEnrollmentIdentity
} from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const identity = await readEnrollmentIdentity();
  const publicEnabled = publicOnboardingEnabled();
  const identityConfig = identityBoundaryConfig();

  if (!identity && !publicEnabled) {
    return (
      <section className="page narrow">
        <div className="pageHeader">
          <div>
            <div className="eyebrow">RAM organization onboarding</div>
            <h1>Verify your identity first</h1>
            <p>
              Production onboarding begins with a verified external identity.
              RAM does not accept unverified email-only organization creation.
            </p>
          </div>
        </div>

        <article className="panel">
          <h2>Identity verification required</h2>
          <p>
            Continue through the configured identity provider. After successful
            verification, RAM returns you here with your verified name and email.
          </p>
          {identityConfig.loginUrl ? (
            <a className="primaryButton" href={identityConfig.loginUrl}>
              Continue with verified identity
            </a>
          ) : (
            <a className="secondaryButton" href="/signin">
              Back to sign in
            </a>
          )}
        </article>
      </section>
    );
  }

  return (
    <section className="page narrow">
      <div className="pageHeader">
        <div>
          <div className="eyebrow">RAM organization onboarding</div>
          <h1>Create your RAM workspace</h1>
          <p>
            Accounts belong to organizations. RAM keeps supplier identity private
            from the scientist marketplace while preserving verified source records
            internally.
          </p>
        </div>
      </div>

      {identity ? (
        <div className="privacyBanner">
          <strong>Verified identity.</strong>
          <span>
            {identity.name} · {identity.email} · provider {identity.provider}
          </span>
        </div>
      ) : null}

      <form className="formStack" action="/api/onboarding" method="post">
        <section className="panel formSection">
          <div className="sectionNumber">01</div>
          <div>
            <h2>Your identity</h2>
            <p>
              This person becomes the initial organization administrator or
              principal investigator. Verified identity fields cannot be changed
              during onboarding.
            </p>
          </div>
          <div className="formGrid">
            <label>
              <span>Name *</span>
              <input
                name="name"
                required
                autoComplete="name"
                defaultValue={identity?.name ?? ""}
                readOnly={Boolean(identity)}
              />
            </label>
            <label>
              <span>Email *</span>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                defaultValue={identity?.email ?? ""}
                readOnly={Boolean(identity)}
              />
            </label>
          </div>
        </section>

        <section className="panel formSection">
          <div className="sectionNumber">02</div>
          <div>
            <h2>Organization</h2>
            <p>
              New organizations remain pending until RAM completes organization
              verification. Pending workspaces cannot perform marketplace or
              transaction operations.
            </p>
          </div>
          <div className="formGrid">
            <label className="span2">
              <span>Organization name *</span>
              <input name="organizationName" required />
            </label>
            <label className="span2">
              <span>Organization type *</span>
              <select name="organizationType" required defaultValue="RESEARCH_INSTITUTION">
                <option value="FARM">Farm / livestock operation</option>
                <option value="RESEARCH_INSTITUTION">University / research institution</option>
                <option value="BIOTECH">Biotechnology company</option>
                <option value="PHARMA">Pharmaceutical company</option>
                <option value="CRO">Contract research organization</option>
                <option value="VETERINARY">Veterinary organization</option>
                <option value="LOGISTICS">Animal transport / logistics</option>
              </select>
            </label>
          </div>
        </section>

        <section className="panel formSection">
          <div className="sectionNumber">03</div>
          <div>
            <h2>Farm-site information</h2>
            <p>
              Required only for farm organizations. These fields are restricted
              source data and are never exposed in scientist marketplace records.
            </p>
          </div>
          <div className="formGrid">
            <label>
              <span>Farm site label</span>
              <input name="farmSiteLabel" placeholder="e.g. Main finishing site" />
            </label>
            <label>
              <span>Marketplace region</span>
              <input name="regionLabel" placeholder="e.g. Midwest U.S." />
            </label>
            <label>
              <span>County / local jurisdiction</span>
              <input name="countyLabel" placeholder="Restricted unless specifically approved" />
            </label>
            <label className="span2">
              <span>Exact address</span>
              <input name="exactAddress" autoComplete="street-address" />
            </label>
          </div>
        </section>

        <div className="formActions">
          <a className="secondaryButton" href="/signin">Back</a>
          <button className="primaryButton" type="submit">
            Create pending workspace
          </button>
        </div>
      </form>
    </section>
  );
}
