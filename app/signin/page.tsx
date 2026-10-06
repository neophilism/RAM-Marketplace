import { demoAuthEnabled } from "@/lib/auth/session";
import { identityBoundaryConfig } from "@/lib/auth/identity-config";

export const dynamic = "force-dynamic";

const demos = [
  { id: "farmer", label: "Demo farm owner", note: "Submit and manage anonymous animal cases" },
  { id: "scientist", label: "Demo researcher", note: "Browse models, create research needs and reserve matched animals" },
  { id: "procurement", label: "Demo research procurement", note: "Approve buyer quotes and commit the research organization" },
  { id: "receiver", label: "Demo research receiving", note: "Inspect delivered animals and accept or reject institutional intake" },
  { id: "veterinarian", label: "Demo veterinarian", note: "Review and characterize candidate animals" },
  { id: "ram", label: "Demo RAM operations", note: "Operate internal queues and restricted workflows" },
  { id: "finance", label: "Demo RAM finance", note: "Set independent supplier policies and commit acquisitions" },
  { id: "compliance", label: "Demo RAM compliance", note: "Review restricted source data and clear orders for pickup" },
  { id: "transporter", label: "Demo transport provider", note: "Receive assigned transport packets and record chain-of-custody events" }
];

export default function SignInPage() {
  const demoEnabled = demoAuthEnabled();
  const identity = identityBoundaryConfig();

  return (
    <section className="page narrow">
      <div className="pageHeader">
        <div>
          <div className="eyebrow">RAM access</div>
          <h1>Sign in to your workspace</h1>
          <p>
            Production access uses a verified external identity assertion. RAM
            then revalidates membership and organization status on every protected
            request.
          </p>
        </div>
      </div>

      <div className="detailGrid">
        <article className="panel">
          <h2>Verified sign in</h2>
          <p>
            Use the configured identity provider for both existing accounts and
            new organization onboarding.
          </p>
          {identity.loginUrl ? (
            <a className="primaryButton" href={identity.loginUrl}>
              Continue with verified identity
            </a>
          ) : (
            <span className="subtle">
              No production identity login URL is configured on this deployment.
            </span>
          )}
        </article>

        <article className="panel">
          <h2>New organization</h2>
          <p>
            After identity verification, RAM collects organization details and
            creates a pending workspace. Operational access starts only after RAM
            verifies the organization.
          </p>
          {identity.loginUrl ? (
            <a className="secondaryButton" href={identity.loginUrl}>
              Verify identity & start onboarding
            </a>
          ) : (
            <a className="secondaryButton" href="/onboarding">
              View onboarding requirements
            </a>
          )}
        </article>
      </div>

      {demoEnabled && (
        <div className="panel">
          <h2>Development demo identities</h2>
          <p>
            These signed sessions are available only in local development or when
            explicitly enabled.
          </p>
          <div className="demoGrid">
            {demos.map((demo) => (
              <form action="/api/session/demo" method="post" key={demo.id} className="demoCard">
                <input type="hidden" name="actor" value={demo.id} />
                <strong>{demo.label}</strong>
                <span>{demo.note}</span>
                <button className="secondaryButton" type="submit">
                  Enter workspace
                </button>
              </form>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
