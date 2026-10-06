import "server-only";

import type { SessionPrincipal } from "@/lib/auth/token";
import { requireCapability } from "@/lib/access";
import {
  PILOT_MANUAL_GATES,
  type PilotManualGateKey
} from "@/lib/pilot-readiness";
import { pilotGateKeys } from "@/lib/pilot-gates";
import type {
  ResetPilotGateInput,
  VerifyPilotGateInput
} from "@/lib/pilot-gates";
import { dataBackend, requirePrisma } from "@/lib/server/db";

export type PilotGateEffectiveStatus =
  | "PENDING"
  | "VERIFIED"
  | "EXPIRED";

function gateKey(value: string): PilotManualGateKey {
  if (!pilotGateKeys.has(value as PilotManualGateKey)) {
    throw new Error("Unknown pilot gate");
  }
  return value as PilotManualGateKey;
}

function effectiveStatus(
  status: "PENDING" | "VERIFIED" | undefined,
  reviewDueAt: Date | null | undefined,
  now: Date
): PilotGateEffectiveStatus {
  if (status !== "VERIFIED") return "PENDING";
  if (reviewDueAt && reviewDueAt.getTime() <= now.getTime()) {
    return "EXPIRED";
  }
  return "VERIFIED";
}

export async function listPilotGateAdministration(
  principal: SessionPrincipal,
  now = new Date()
) {
  requireCapability(principal.role, "admin:manage");

  if (dataBackend() !== "postgres") {
    return {
      gates: PILOT_MANUAL_GATES.map((gate) => ({
        ...gate,
        effectiveStatus: "PENDING" as const,
        record: null
      })),
      owners: []
    };
  }

  const prisma = requirePrisma();
  const [rows, ownerMemberships] = await Promise.all([
    prisma.pilotGateVerification.findMany({
      include: {
        owner: { select: { id: true, name: true, email: true } },
        verifiedBy: { select: { id: true, name: true, email: true } }
      }
    }),
    prisma.membership.findMany({
      where: {
        status: "ACTIVE",
        organization: {
          type: "RAM",
          status: "ACTIVE"
        }
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: "asc" }
    })
  ]);

  const byKey = new Map(rows.map((row) => [row.gateKey, row]));
  const owners = Array.from(
    new Map(
      ownerMemberships.map((membership) => [
        membership.user.id,
        membership.user
      ])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  return {
    gates: PILOT_MANUAL_GATES.map((gate) => {
      const record = byKey.get(gate.key) ?? null;
      return {
        ...gate,
        effectiveStatus: effectiveStatus(
          record?.status,
          record?.reviewDueAt,
          now
        ),
        record
      };
    }),
    owners
  };
}

export async function verifyPilotGate(
  principal: SessionPrincipal,
  input: VerifyPilotGateInput
) {
  requireCapability(principal.role, "admin:manage");
  const key = gateKey(input.gateKey);

  if (dataBackend() !== "postgres") {
    throw new Error("Pilot gate verification requires PostgreSQL persistence");
  }

  const evidence = input.evidenceSummary.trim();
  const notes = input.notes?.trim() || null;
  let reviewDueAt: Date | null = null;

  if (input.reviewDueAt?.trim()) {
    reviewDueAt = new Date(input.reviewDueAt);
    if (Number.isNaN(reviewDueAt.getTime())) {
      throw new Error("Invalid pilot gate review due date");
    }
    if (reviewDueAt.getTime() <= Date.now()) {
      throw new Error("Pilot gate review due date must be in the future");
    }
  }

  const prisma = requirePrisma();

  return prisma.$transaction(async (tx) => {
    const ownerMembership = await tx.membership.findFirst({
      where: {
        userId: input.ownerUserId,
        status: "ACTIVE",
        organization: {
          type: "RAM",
          status: "ACTIVE"
        }
      },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    if (!ownerMembership) {
      throw new Error(
        "Pilot gate owner must be an active member of RAM Corporation"
      );
    }

    const previous = await tx.pilotGateVerification.findUnique({
      where: { gateKey: key }
    });

    const verifiedAt = new Date();
    const record = await tx.pilotGateVerification.upsert({
      where: { gateKey: key },
      create: {
        gateKey: key,
        status: "VERIFIED",
        ownerUserId: ownerMembership.user.id,
        evidenceSummary: evidence,
        verifiedByUserId: principal.userId,
        verifiedAt,
        reviewDueAt,
        notes
      },
      update: {
        status: "VERIFIED",
        ownerUserId: ownerMembership.user.id,
        evidenceSummary: evidence,
        verifiedByUserId: principal.userId,
        verifiedAt,
        reviewDueAt,
        notes
      }
    });

    await tx.auditEvent.create({
      data: {
        actorUserId: principal.userId,
        organizationId: principal.organizationId,
        action: "PILOT_GATE_VERIFIED",
        entityType: "PilotGateVerification",
        entityId: record.id,
        previousState: previous
          ? {
              gateKey: previous.gateKey,
              status: previous.status,
              ownerUserId: previous.ownerUserId,
              verifiedAt: previous.verifiedAt,
              reviewDueAt: previous.reviewDueAt
            }
          : undefined,
        nextState: {
          gateKey: key,
          status: "VERIFIED",
          ownerUserId: ownerMembership.user.id,
          verifiedAt,
          reviewDueAt
        },
        metadata: {
          evidenceSummary: evidence,
          notes
        }
      }
    });

    return record;
  });
}

export async function resetPilotGate(
  principal: SessionPrincipal,
  input: ResetPilotGateInput
) {
  requireCapability(principal.role, "admin:manage");
  const key = gateKey(input.gateKey);
  const reason = input.reason.trim();

  if (dataBackend() !== "postgres") {
    throw new Error("Pilot gate reset requires PostgreSQL persistence");
  }

  const prisma = requirePrisma();

  return prisma.$transaction(async (tx) => {
    const previous = await tx.pilotGateVerification.findUnique({
      where: { gateKey: key }
    });

    const record = await tx.pilotGateVerification.upsert({
      where: { gateKey: key },
      create: {
        gateKey: key,
        status: "PENDING",
        notes: reason
      },
      update: {
        status: "PENDING",
        evidenceSummary: null,
        verifiedByUserId: null,
        verifiedAt: null,
        reviewDueAt: null,
        notes: reason
      }
    });

    await tx.auditEvent.create({
      data: {
        actorUserId: principal.userId,
        organizationId: principal.organizationId,
        action: "PILOT_GATE_RESET",
        entityType: "PilotGateVerification",
        entityId: record.id,
        previousState: previous
          ? {
              gateKey: previous.gateKey,
              status: previous.status,
              verifiedAt: previous.verifiedAt
            }
          : undefined,
        nextState: {
          gateKey: key,
          status: "PENDING"
        },
        reason
      }
    });

    return record;
  });
}

export function pilotGateSummary(
  gates: Array<{ effectiveStatus: PilotGateEffectiveStatus }>
) {
  const verified = gates.filter(
    (gate) => gate.effectiveStatus === "VERIFIED"
  ).length;
  const expired = gates.filter(
    (gate) => gate.effectiveStatus === "EXPIRED"
  ).length;
  const pending = gates.length - verified - expired;

  return {
    total: gates.length,
    verified,
    expired,
    pending,
    ready: verified === gates.length
  };
}
