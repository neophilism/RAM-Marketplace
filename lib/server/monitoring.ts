import "server-only";

import type { SessionPrincipal } from "@/lib/auth/token";
import { requireCapability } from "@/lib/access";
import {
  monitoringConfig,
  requireAlertWebhookConfig,
  sha256,
  signMonitoringPayload
} from "@/lib/monitoring/config";
import { dataBackend, requirePrisma } from "@/lib/server/db";

type SignalSeverity = "INFO" | "WARNING" | "CRITICAL";

type SignalMetadataValue = string | number | boolean | null;

interface MonitoringSignal {
  fingerprint: string;
  code: string;
  severity: SignalSeverity;
  title: string;
  summary: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, SignalMetadataValue>;
  reopenWhenResolved: boolean;
}

function minutesAgo(now: Date, minutes: number) {
  return new Date(now.getTime() - minutes * 60_000);
}

function hoursAgo(now: Date, hours: number) {
  return new Date(now.getTime() - hours * 3_600_000);
}

async function evaluateSignals(now = new Date()): Promise<MonitoringSignal[]> {
  const prisma = requirePrisma();
  const config = monitoringConfig();
  const signals: MonitoringSignal[] = [];

  const [
    unknownPayments,
    staleProcessingPayments,
    failedPayments,
    transportExceptions,
    stalePickupOrders,
    staleDisputes,
    overdueOrganizations
  ] = await Promise.all([
    prisma.paymentExecution.findMany({
      where: {
        status: "SUBMISSION_UNKNOWN",
        updatedAt: {
          lte: minutesAgo(now, config.paymentUnknownMinutes)
        }
      },
      orderBy: { updatedAt: "asc" },
      take: 500
    }),
    prisma.paymentExecution.findMany({
      where: {
        status: "PROCESSING",
        updatedAt: {
          lte: minutesAgo(now, config.paymentProcessingMinutes)
        }
      },
      orderBy: { updatedAt: "asc" },
      take: 500
    }),
    prisma.paymentExecution.findMany({
      where: {
        status: "FAILED",
        updatedAt: {
          gte: new Date(now.getTime() - 30 * 24 * 3_600_000)
        }
      },
      orderBy: { updatedAt: "desc" },
      take: 500
    }),
    prisma.order.findMany({
      where: { status: "TRANSPORT_EXCEPTION" },
      select: { id: true, updatedAt: true },
      orderBy: { updatedAt: "asc" },
      take: 500
    }),
    prisma.order.findMany({
      where: {
        status: "READY_FOR_PICKUP",
        updatedAt: { lte: hoursAgo(now, config.pickupHours) }
      },
      select: { id: true, updatedAt: true },
      orderBy: { updatedAt: "asc" },
      take: 500
    }),
    prisma.orderDispute.findMany({
      where: {
        status: "OPEN",
        openedAt: { lte: hoursAgo(now, config.disputeHours) }
      },
      select: { id: true, orderId: true, openedAt: true },
      orderBy: { openedAt: "asc" },
      take: 500
    }),
    prisma.organization.findMany({
      where: {
        status: "PENDING_VERIFICATION",
        createdAt: {
          lte: hoursAgo(now, config.organizationVerificationHours)
        }
      },
      select: { id: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: 500
    })
  ]);

  for (const payment of unknownPayments) {
    signals.push({
      fingerprint: "PAYMENT_SUBMISSION_UNKNOWN:" + payment.id,
      code: "PAYMENT_SUBMISSION_UNKNOWN",
      severity: "CRITICAL",
      title: "Payment submission outcome is unknown",
      summary:
        "Payment execution " +
        payment.id +
        " remains submission-unknown beyond the configured threshold.",
      entityType: "PaymentExecution",
      entityId: payment.id,
      metadata: {
        settlementId: payment.settlementId,
        type: payment.type,
        thresholdMinutes: config.paymentUnknownMinutes
      },
      reopenWhenResolved: true
    });
  }

  for (const payment of staleProcessingPayments) {
    signals.push({
      fingerprint: "PAYMENT_PROCESSING_STALE:" + payment.id,
      code: "PAYMENT_PROCESSING_STALE",
      severity: "WARNING",
      title: "Payment processing is stale",
      summary:
        "Payment execution " +
        payment.id +
        " remains processing beyond the configured threshold.",
      entityType: "PaymentExecution",
      entityId: payment.id,
      metadata: {
        settlementId: payment.settlementId,
        type: payment.type,
        thresholdMinutes: config.paymentProcessingMinutes
      },
      reopenWhenResolved: true
    });
  }

  for (const payment of failedPayments) {
    signals.push({
      fingerprint: "PAYMENT_EXECUTION_FAILED:" + payment.id,
      code: "PAYMENT_EXECUTION_FAILED",
      severity: "CRITICAL",
      title: "Payment execution failed",
      summary:
        "Payment execution " +
        payment.id +
        " reached a terminal failed state and requires finance review.",
      entityType: "PaymentExecution",
      entityId: payment.id,
      metadata: {
        settlementId: payment.settlementId,
        type: payment.type,
        failureCode: payment.failureCode
      },
      reopenWhenResolved: false
    });
  }

  for (const order of transportExceptions) {
    signals.push({
      fingerprint: "TRANSPORT_EXCEPTION:" + order.id,
      code: "TRANSPORT_EXCEPTION",
      severity: "CRITICAL",
      title: "Transport exception is active",
      summary:
        "Order " +
        order.id +
        " is in TRANSPORT_EXCEPTION and requires operational intervention.",
      entityType: "Order",
      entityId: order.id,
      metadata: { lastUpdatedAt: order.updatedAt.toISOString() },
      reopenWhenResolved: true
    });
  }

  for (const order of stalePickupOrders) {
    signals.push({
      fingerprint: "READY_FOR_PICKUP_STALE:" + order.id,
      code: "READY_FOR_PICKUP_STALE",
      severity: "WARNING",
      title: "Cleared order is waiting too long for pickup",
      summary:
        "Order " +
        order.id +
        " remains READY_FOR_PICKUP beyond the configured threshold.",
      entityType: "Order",
      entityId: order.id,
      metadata: {
        thresholdHours: config.pickupHours,
        lastUpdatedAt: order.updatedAt.toISOString()
      },
      reopenWhenResolved: true
    });
  }

  for (const dispute of staleDisputes) {
    signals.push({
      fingerprint: "DISPUTE_STALE:" + dispute.id,
      code: "DISPUTE_STALE",
      severity: "WARNING",
      title: "Open dispute requires review",
      summary:
        "Dispute " +
        dispute.id +
        " for order " +
        dispute.orderId +
        " remains open beyond the configured threshold.",
      entityType: "OrderDispute",
      entityId: dispute.id,
      metadata: {
        orderId: dispute.orderId,
        thresholdHours: config.disputeHours
      },
      reopenWhenResolved: true
    });
  }

  for (const organization of overdueOrganizations) {
    signals.push({
      fingerprint: "ORGANIZATION_VERIFICATION_STALE:" + organization.id,
      code: "ORGANIZATION_VERIFICATION_STALE",
      severity: "WARNING",
      title: "Organization verification is overdue",
      summary:
        "Organization " +
        organization.id +
        " remains pending verification beyond the configured threshold.",
      entityType: "Organization",
      entityId: organization.id,
      metadata: {
        thresholdHours: config.organizationVerificationHours,
        createdAt: organization.createdAt.toISOString()
      },
      reopenWhenResolved: true
    });
  }

  return signals;
}

async function deliverIncidentAlert(
  incident: {
    id: string;
    code: string;
    severity: string;
    title: string;
    summary: string;
    entityType: string | null;
    entityId: string | null;
    firstDetectedAt: Date;
    lastDetectedAt: Date;
    occurrenceCount: number;
  },
  monitoringRunId: string,
  event: "OPENED" | "REOPENED" | "RETRY"
) {
  const prisma = requirePrisma();

  let config;
  try {
    config = requireAlertWebhookConfig();
  } catch (error) {
    await prisma.alertDelivery.create({
      data: {
        incidentId: incident.id,
        status: "FAILED",
        endpointHash: "UNCONFIGURED",
        payloadHash: sha256(incident.id + ":" + event),
        errorMessage:
          error instanceof Error
            ? error.message.slice(0, 2000)
            : "Monitoring alert webhook is not configured"
      }
    });
    return { attempted: true, sent: false };
  }

  const payload = {
    version: 1,
    event: "RAM_OPERATIONAL_INCIDENT_" + event,
    monitoringRunId,
    incident: {
      id: incident.id,
      code: incident.code,
      severity: incident.severity,
      title: incident.title,
      summary: incident.summary,
      entityType: incident.entityType,
      entityId: incident.entityId,
      firstDetectedAt: incident.firstDetectedAt.toISOString(),
      lastDetectedAt: incident.lastDetectedAt.toISOString(),
      occurrenceCount: incident.occurrenceCount
    }
  };
  const rawBody = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = signMonitoringPayload(
    rawBody,
    timestamp,
    config.alertSecret
  );
  const endpointHash = sha256(config.alertUrl);
  const payloadHash = sha256(rawBody);

  try {
    const response = await fetch(config.alertUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ram-monitoring-timestamp": timestamp,
        "x-ram-monitoring-signature": signature
      },
      body: rawBody,
      signal: AbortSignal.timeout(10_000)
    });

    if (!response.ok) {
      const body = await response.text();
      await prisma.alertDelivery.create({
        data: {
          incidentId: incident.id,
          status: "FAILED",
          endpointHash,
          payloadHash,
          responseCode: response.status,
          errorMessage:
            ("Alert receiver HTTP " + response.status + ": " + body).slice(
              0,
              2000
            )
        }
      });
      return { attempted: true, sent: false };
    }

    await prisma.alertDelivery.create({
      data: {
        incidentId: incident.id,
        status: "SENT",
        endpointHash,
        payloadHash,
        responseCode: response.status
      }
    });
    return { attempted: true, sent: true };
  } catch (error) {
    await prisma.alertDelivery.create({
      data: {
        incidentId: incident.id,
        status: "FAILED",
        endpointHash,
        payloadHash,
        errorMessage:
          error instanceof Error
            ? error.message.slice(0, 2000)
            : "Monitoring alert delivery failed"
      }
    });
    return { attempted: true, sent: false };
  }
}

export async function runMonitoringCycle(trigger: string) {
  if (dataBackend() !== "postgres") {
    throw new Error("Operational monitoring requires PostgreSQL persistence");
  }

  const config = monitoringConfig();
  if (!config.enabled) {
    throw new Error("RAM monitoring is not enabled");
  }

  const prisma = requirePrisma();
  const run = await prisma.monitoringRun.create({
    data: {
      trigger: trigger.slice(0, 120),
      status: "RUNNING"
    }
  });

  try {
    const signals = await evaluateSignals();
    let opened = 0;
    let updated = 0;
    let alertAttempts = 0;

    for (const signal of signals) {
      const existing = await prisma.operationalIncident.findUnique({
        where: { fingerprint: signal.fingerprint }
      });

      let incident;
      let alertEvent: "OPENED" | "REOPENED" | null = null;

      if (!existing) {
        incident = await prisma.operationalIncident.create({
          data: {
            fingerprint: signal.fingerprint,
            code: signal.code,
            severity: signal.severity,
            status: "OPEN",
            title: signal.title,
            summary: signal.summary,
            entityType: signal.entityType,
            entityId: signal.entityId,
            metadata: signal.metadata
          }
        });
        opened += 1;
        alertEvent = "OPENED";
      } else if (
        existing.status === "RESOLVED" &&
        signal.reopenWhenResolved
      ) {
        incident = await prisma.operationalIncident.update({
          where: { id: existing.id },
          data: {
            severity: signal.severity,
            status: "OPEN",
            title: signal.title,
            summary: signal.summary,
            entityType: signal.entityType,
            entityId: signal.entityId,
            lastDetectedAt: new Date(),
            occurrenceCount: { increment: 1 },
            acknowledgedByUserId: null,
            acknowledgedAt: null,
            resolvedByUserId: null,
            resolvedAt: null,
            resolutionNotes: null,
            metadata: signal.metadata
          }
        });
        updated += 1;
        alertEvent = "REOPENED";
      } else if (existing.status !== "RESOLVED") {
        incident = await prisma.operationalIncident.update({
          where: { id: existing.id },
          data: {
            severity: signal.severity,
            title: signal.title,
            summary: signal.summary,
            entityType: signal.entityType,
            entityId: signal.entityId,
            lastDetectedAt: new Date(),
            occurrenceCount: { increment: 1 },
            metadata: signal.metadata
          }
        });
        updated += 1;
      } else {
        continue;
      }

      if (alertEvent) {
        const delivery = await deliverIncidentAlert(
          incident,
          run.id,
          alertEvent
        );
        if (delivery.attempted) alertAttempts += 1;
      }
    }

    const completed = await prisma.monitoringRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCESS",
        completedAt: new Date(),
        signalsEvaluated: signals.length,
        incidentsOpened: opened,
        incidentsUpdated: updated,
        alertAttempts
      }
    });

    return {
      runId: completed.id,
      status: completed.status,
      signalsEvaluated: completed.signalsEvaluated,
      incidentsOpened: completed.incidentsOpened,
      incidentsUpdated: completed.incidentsUpdated,
      alertAttempts: completed.alertAttempts
    };
  } catch (error) {
    await prisma.monitoringRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage:
          error instanceof Error
            ? error.message.slice(0, 2000)
            : "Monitoring cycle failed"
      }
    });
    throw error;
  }
}

export async function monitoringDashboard(principal: SessionPrincipal) {
  requireCapability(principal.role, "admin:manage");

  if (dataBackend() !== "postgres") {
    return {
      incidents: [],
      runs: [],
      failedDeliveries: [],
      summary: {
        openCritical: 0,
        openWarning: 0,
        acknowledged: 0,
        failedAlertDeliveries: 0
      }
    };
  }

  const prisma = requirePrisma();
  const [incidents, runs, failedDeliveries, counts] = await Promise.all([
    prisma.operationalIncident.findMany({
      orderBy: [
        { status: "asc" },
        { severity: "desc" },
        { lastDetectedAt: "desc" }
      ],
      take: 100,
      include: {
        acknowledgedBy: { select: { name: true, email: true } },
        resolvedBy: { select: { name: true, email: true } }
      }
    }),
    prisma.monitoringRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 20
    }),
    prisma.alertDelivery.findMany({
      where: { status: "FAILED" },
      orderBy: { attemptedAt: "desc" },
      take: 20,
      include: {
        incident: {
          select: {
            id: true,
            code: true,
            title: true
          }
        }
      }
    }),
    Promise.all([
      prisma.operationalIncident.count({
        where: { status: { not: "RESOLVED" }, severity: "CRITICAL" }
      }),
      prisma.operationalIncident.count({
        where: { status: { not: "RESOLVED" }, severity: "WARNING" }
      }),
      prisma.operationalIncident.count({
        where: { status: "ACKNOWLEDGED" }
      }),
      prisma.alertDelivery.count({ where: { status: "FAILED" } })
    ])
  ]);

  return {
    incidents,
    runs,
    failedDeliveries,
    summary: {
      openCritical: counts[0],
      openWarning: counts[1],
      acknowledged: counts[2],
      failedAlertDeliveries: counts[3]
    }
  };
}

export async function acknowledgeIncident(
  principal: SessionPrincipal,
  incidentId: string
) {
  requireCapability(principal.role, "admin:manage");
  const prisma = requirePrisma();

  return prisma.$transaction(async (tx) => {
    const incident = await tx.operationalIncident.findUnique({
      where: { id: incidentId }
    });
    if (!incident) throw new Error("Operational incident not found");
    if (incident.status === "RESOLVED") {
      throw new Error("Resolved incident cannot be acknowledged");
    }
    if (incident.status === "ACKNOWLEDGED") return incident;

    const updated = await tx.operationalIncident.update({
      where: { id: incident.id },
      data: {
        status: "ACKNOWLEDGED",
        acknowledgedByUserId: principal.userId,
        acknowledgedAt: new Date()
      }
    });

    await tx.auditEvent.create({
      data: {
        actorUserId: principal.userId,
        organizationId: principal.organizationId,
        action: "OPERATIONAL_INCIDENT_ACKNOWLEDGED",
        entityType: "OperationalIncident",
        entityId: incident.id,
        previousState: { status: incident.status },
        nextState: { status: "ACKNOWLEDGED" }
      }
    });

    return updated;
  });
}

export async function resolveIncident(
  principal: SessionPrincipal,
  incidentId: string,
  resolutionNotes: string
) {
  requireCapability(principal.role, "admin:manage");
  const notes = resolutionNotes.trim();
  if (notes.length < 3 || notes.length > 4000) {
    throw new Error("Resolution notes must be between 3 and 4000 characters");
  }

  const prisma = requirePrisma();

  return prisma.$transaction(async (tx) => {
    const incident = await tx.operationalIncident.findUnique({
      where: { id: incidentId }
    });
    if (!incident) throw new Error("Operational incident not found");
    if (incident.status === "RESOLVED") return incident;

    const updated = await tx.operationalIncident.update({
      where: { id: incident.id },
      data: {
        status: "RESOLVED",
        resolvedByUserId: principal.userId,
        resolvedAt: new Date(),
        resolutionNotes: notes
      }
    });

    await tx.auditEvent.create({
      data: {
        actorUserId: principal.userId,
        organizationId: principal.organizationId,
        action: "OPERATIONAL_INCIDENT_RESOLVED",
        entityType: "OperationalIncident",
        entityId: incident.id,
        previousState: { status: incident.status },
        nextState: { status: "RESOLVED" },
        reason: notes
      }
    });

    return updated;
  });
}

export async function retryIncidentAlert(
  principal: SessionPrincipal,
  incidentId: string
) {
  requireCapability(principal.role, "admin:manage");
  const prisma = requirePrisma();

  const incident = await prisma.operationalIncident.findUnique({
    where: { id: incidentId }
  });
  if (!incident) throw new Error("Operational incident not found");
  if (incident.status === "RESOLVED") {
    throw new Error("Resolved incident does not require alert retry");
  }

  const latestRun = await prisma.monitoringRun.findFirst({
    orderBy: { startedAt: "desc" }
  });

  const delivery = await deliverIncidentAlert(
    incident,
    latestRun?.id ?? "manual-retry",
    "RETRY"
  );

  await prisma.auditEvent.create({
    data: {
      actorUserId: principal.userId,
      organizationId: principal.organizationId,
      action: "OPERATIONAL_INCIDENT_ALERT_RETRIED",
      entityType: "OperationalIncident",
      entityId: incident.id,
      metadata: {
        attempted: delivery.attempted,
        sent: delivery.sent
      }
    }
  });

  return delivery;
}

export async function monitoringRuntimeCheck(now = new Date()) {
  if (dataBackend() !== "postgres") {
    return {
      healthy: false,
      detail: "Operational monitoring requires PostgreSQL persistence."
    };
  }

  const config = monitoringConfig();
  if (!config.enabled) {
    return {
      healthy: false,
      detail: "RAM monitoring is disabled."
    };
  }

  const prisma = requirePrisma();
  const latest = await prisma.monitoringRun.findFirst({
    where: { status: "SUCCESS" },
    orderBy: { completedAt: "desc" }
  });

  if (!latest?.completedAt) {
    return {
      healthy: false,
      detail: "No successful monitoring cycle has completed."
    };
  }

  const ageMinutes =
    (now.getTime() - latest.completedAt.getTime()) / 60_000;
  if (ageMinutes > config.maxRunAgeMinutes) {
    return {
      healthy: false,
      detail:
        "Last successful monitoring cycle is " +
        Math.floor(ageMinutes) +
        " minutes old; maximum is " +
        config.maxRunAgeMinutes +
        ".",
      lastCompletedAt: latest.completedAt.toISOString()
    };
  }

  return {
    healthy: true,
    detail:
      "Monitoring heartbeat is current; last successful cycle completed " +
      Math.max(0, Math.floor(ageMinutes)) +
      " minutes ago.",
    lastCompletedAt: latest.completedAt.toISOString()
  };
}
