import "server-only";
import type { SessionPrincipal } from "@/lib/auth/token";
import { requireCapability } from "@/lib/access";
import { dataBackend, requirePrisma } from "@/lib/server/db";

export interface AuditFilters {
  action?: string;
  entityType?: string;
  entityId?: string;
  actorUserId?: string;
  organizationId?: string;
  correlationId?: string;
  since?: string;
  limit?: number;
}

export interface AuditEventView {
  id: string;
  createdAt: string;
  action: string;
  entityType: string;
  entityId: string;
  actorUserId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  organizationId: string | null;
  correlationId: string | null;
  reason: string | null;
  previousState: unknown;
  nextState: unknown;
  metadata: unknown;
}

function clean(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function clampLimit(value: number | undefined) {
  if (!Number.isFinite(value)) return 100;
  return Math.min(Math.max(Math.floor(value ?? 100), 1), 250);
}

export async function listAuditEvents(
  principal: SessionPrincipal,
  filters: AuditFilters = {}
): Promise<AuditEventView[]> {
  requireCapability(principal.role, "audit:read");

  if (dataBackend() === "prototype") {
    // Prototype workflows intentionally do not pretend to provide durable audit history.
    return [];
  }

  const prisma = requirePrisma();
  const action = clean(filters.action);
  const entityType = clean(filters.entityType);
  const entityId = clean(filters.entityId);
  const actorUserId = clean(filters.actorUserId);
  const organizationId = clean(filters.organizationId);
  const correlationId = clean(filters.correlationId);
  const sinceRaw = clean(filters.since);
  const since = sinceRaw ? new Date(sinceRaw) : undefined;

  if (since && Number.isNaN(since.getTime())) {
    throw new Error("Invalid audit start date");
  }

  const rows = await prisma.auditEvent.findMany({
    where: {
      ...(action
        ? { action: { contains: action, mode: "insensitive" } }
        : {}),
      ...(entityType
        ? { entityType: { contains: entityType, mode: "insensitive" } }
        : {}),
      ...(entityId
        ? { entityId: { contains: entityId, mode: "insensitive" } }
        : {}),
      ...(actorUserId ? { actorUserId } : {}),
      ...(organizationId ? { organizationId } : {}),
      ...(correlationId ? { correlationId } : {}),
      ...(since ? { createdAt: { gte: since } } : {})
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: clampLimit(filters.limit),
    select: {
      id: true,
      createdAt: true,
      action: true,
      entityType: true,
      entityId: true,
      actorUserId: true,
      organizationId: true,
      correlationId: true,
      reason: true,
      previousState: true,
      nextState: true,
      metadata: true,
      actor: {
        select: {
          name: true,
          email: true
        }
      }
    }
  });

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    actorUserId: row.actorUserId,
    actorName: row.actor?.name ?? null,
    actorEmail: row.actor?.email ?? null,
    organizationId: row.organizationId,
    correlationId: row.correlationId,
    reason: row.reason,
    previousState: row.previousState,
    nextState: row.nextState,
    metadata: row.metadata
  }));
}
