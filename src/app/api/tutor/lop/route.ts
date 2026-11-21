// Bảng lớp của gia sư: GET → { rows, totalStudents }. Gia sư: khoá theo chính gia sư đó. SCL-B (Q1): Chủ nhiệm (quản trị trung tâm) thấy MỌI lớp, kèm `scope: "all"`
// và gia sư phụ trách từng dòng. Không qua requireTutor (invoiceServer.ts là tệp khoá tiền) cho nhánh Chủ nhiệm.
import { NextResponse } from "next/server";
import { isNextResponse, requireSession } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { loadTutorClassTable } from "@/lib/tutorClassTableServer";
import { isCenterAdmin } from "@/lib/tutorGate";

export async function GET() {
  const s = await requireSession();
  if (isNextResponse(s)) return s;
  if (isCenterAdmin(s)) return NextResponse.json({ ...(await loadTutorClassTable(null)), scope: "all" }, { headers: { "Cache-Control": "no-store" } });
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  return NextResponse.json(await loadTutorClassTable(auth.userId), { headers: { "Cache-Control": "no-store" } });
}
