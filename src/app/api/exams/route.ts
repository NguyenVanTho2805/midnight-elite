import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { getSession } from "@/lib/session";
import { PERMISSIONS } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const status   = searchParams.get("status");
    const activeOnly = searchParams.get("active") === "true";

    const exams = await prisma.exam.findMany({
      where: {
        ...(category   ? { category }     : {}),
        ...(status     ? { status }       : {}),
        ...(activeOnly ? { active: true } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(exams);
  } catch (e) {
    console.error("[GET /api/exams]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;

  try {
    const body = await req.json();

    // Allowlist — chỉ nhận fields đúng với Prisma schema
    const allowed = ["id", "code", "title", "category", "date", "time", "duration",
                     "questions", "status", "azotaUrl", "participants", "active", "createdAt"];
    const data: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) data[key] = body[key];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exam = await prisma.exam.create({ data: data as any });
    return NextResponse.json(exam, { status: 201 });
  } catch (e) {
    console.error("[POST /api/exams]", e);
    return NextResponse.json({ error: "Failed to create exam" }, { status: 400 });
  }
}
