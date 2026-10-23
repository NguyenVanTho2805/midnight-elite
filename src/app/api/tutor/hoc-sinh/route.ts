// Học sinh của gia sư: GET → { students }. Chỉ gia sư; chỉ học sinh thuộc lớp của chính gia sư đó (khoá theo session, không nhận id từ client).
import { NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { loadTutorStudents } from "@/lib/tutorStudentsServer";

export async function GET() {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const students = await loadTutorStudents(auth.userId);
  return NextResponse.json({ students }, { headers: { "Cache-Control": "no-store" } });
}
