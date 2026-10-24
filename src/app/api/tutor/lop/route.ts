// Bảng lớp của gia sư: GET → { rows, totalStudents }. Chỉ gia sư; khoá theo chính gia sư đó.
import { NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { loadTutorClassTable } from "@/lib/tutorClassTableServer";

export async function GET() {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  return NextResponse.json(await loadTutorClassTable(auth.userId), { headers: { "Cache-Control": "no-store" } });
}
