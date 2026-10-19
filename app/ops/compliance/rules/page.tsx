import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { RuleDraftEditor } from "./rule-draft-editor";

export const dynamic = "force-dynamic";

export default async function ComplianceRuleDraftPage() {
  const session = await requireSession();
  if (session.role !== "RAM_COMPLIANCE" && session.role !== "RAM_SUPER_ADMIN") {
    return <section className="page"><h1>Restricted</h1><p>RAM compliance author role required.</p></section>;
  }
  return (
    <section className="page">
      <div className="pageHeader">
        <div><div className="eyebrow">RAM compliance · review artifacts</div><h1>Versioned rule drafts</h1>
          <p>Prepare and revise source-backed corridor rules for later legal and veterinary review. No draft authorizes movement.</p>
        </div>
        <Link href="/ops" className="secondaryButton">Back to operations</Link>
      </div>
      <RuleDraftEditor authorId={session.userId} />
    </section>
  );
}
