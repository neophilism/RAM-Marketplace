import "server-only";
import type { SessionPrincipal } from "@/lib/auth/token";
import { requirePrisma } from "@/lib/server/db";
import { createRuleDraft, reviseRuleDraft, type RuleDraft, type RuleDraftInput } from "@/lib/compliance-rule-drafts";

/** RAM compliance authors only. Never releases a movement rule. */
function authorize(principal: SessionPrincipal) {
  if (principal.role !== "RAM_COMPLIANCE" && principal.role !== "RAM_SUPER_ADMIN") {
    throw new Error("Forbidden: RAM compliance author required");
  }
}

export async function saveComplianceRuleDraft(
  principal: SessionPrincipal,
  input: RuleDraftInput,
  expectedDigest?: string
): Promise<RuleDraft> {
  authorize(principal);
  if (input.authorId !== principal.userId) throw new Error("Forbidden: rule author must match session");
  const db = requirePrisma();
  return db.$transaction(async (tx) => {
    const current = await tx.complianceRuleDraftRevision.findFirst({
      where: { ruleId: input.ruleId }, orderBy: { revision: "desc" }
    });
    if (!current && expectedDigest) throw new Error("Rule does not exist for revision");
    if (current && !expectedDigest) throw new Error("Expected current digest is required");
    const result = current
      ? reviseRuleDraft(current.payload as unknown as RuleDraft, expectedDigest!, input)
      : createRuleDraft(input);
    // A concurrent writer loses at the unique(ruleId,revision) constraint.
    await tx.complianceRuleDraftRevision.create({
      data: { ruleId: result.ruleId, revision: result.revision, digest: result.digest,
        authorUserId: principal.userId, payload: JSON.parse(JSON.stringify(result)) }
    });
    return result;
  });
}

export async function listComplianceRuleDrafts(principal: SessionPrincipal, ruleId: string) {
  authorize(principal);
  if (!ruleId || ruleId.length > 160) throw new Error("Invalid rule ID");
  const db = requirePrisma();
  const versions = await db.complianceRuleDraftRevision.findMany({
    where: { ruleId }, orderBy: { revision: "desc" }, take: 100
  });
  return versions.map((entry) => entry.payload);
}
