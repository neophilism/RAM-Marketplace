import { NextResponse } from "next/server";
import { dataBackend, requirePrisma } from "@/lib/server/db";

export async function GET() {
  try {
    if (
      process.env.NODE_ENV === "production" &&
      dataBackend() !== "postgres"
    ) {
      return NextResponse.json(
        { status: "not_ready" },
        { status: 503 }
      );
    }

    if (dataBackend() === "postgres") {
      const prisma = requirePrisma();
      await prisma.$queryRaw`SELECT 1`;
    }

    return NextResponse.json({ status: "ready" });
  } catch {
    return NextResponse.json(
      { status: "not_ready" },
      { status: 503 }
    );
  }
}
