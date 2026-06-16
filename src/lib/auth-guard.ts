import { NextResponse } from "next/server";
import { getSession, type SessionPayload } from "./session";
import { checkPermission, type Permission } from "./permissions";

export async function requirePermission(permission: Permission): Promise<SessionPayload | NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Không có quyền admin" }, { status: 403 });
  if (!checkPermission(session.adminRole, permission)) {
    return NextResponse.json({ error: "Không có quyền thực hiện thao tác này" }, { status: 403 });
  }
  return session;
}


export function isNextResponse(v: unknown): v is NextResponse {
  return v instanceof NextResponse;
}

export async function requireSession(): Promise<SessionPayload | NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Vui lòng đăng nhập" }, { status: 401 });
  return session;
}
