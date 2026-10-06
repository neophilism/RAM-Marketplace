import Link from "next/link";
import { demoAuthEnabled } from "@/lib/auth/session";

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

  return (
    <section className="page narrow">
      <div className="pageHeader">
        <div>
          <div className="eyebrow">RAM access</div>
          <h1>Sign in to your workspace</h1>
          <p>
            RAM's session boundary is active. Production identity-provider credentials are
            configured at deployment; local development can use isolated demo identities.
          </p>
        </div>
      </div>

      <div className="detailGrid">
        <article className="panel">
          <h2>New organization</h2>
          <p>Create the initial workspace for a farm, research organization, veterinary group or logistics provider.</p>
          <Link className="primaryButton" href="/onboarding">Start onboarding</Link>
        </article>

        <article className="panel">
          <h2>Existing organization</h2>
          <p>
            External identity-provider sign-in is intentionally deployment-configurable.
            Returning-user provider buttons will appear here once the deployment provider is connected.
          </p>
        </article>
      </div>

      {demoEnabled && (
        <div className="panel">
          <h2>Development demo identities</h2>
          <p>These signed sessions are available only in local development or when explicitly enabled.</p>
          <div className="demoGrid">
            {demos.map((demo) => (
              <form action="/api/session/demo" method="post" key={demo.id} className="demoCard">
                <input type="hidden" name="actor" value={demo.id} />
                <strong>{demo.label}</strong>
                <span>{demo.note}</span>
                <button className="secondaryButton" type="submit">Enter workspace</button>
              </form>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
