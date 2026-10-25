// Học sinh của gia sư: GET → { students, signals }. Chỉ gia sư; chỉ học sinh thuộc lớp của chính gia sư đó (khoá theo session, không nhận id từ client).
// `signals` (HS-01): mỗi em một dòng số đếm (phiếu chưa đóng đủ, chuỗi vắng, buổi bù còn lại, trạng thái link báo cáo riêng). Không tên phụ huynh, không số tiền.
import { NextResponse } from "next/server";
import { isNextResponse } from "@/lib/auth-guard";
import { requireTutor } from "@/lib/invoiceServer";
import { loadTutorStudentSignals, loadTutorStudents } from "@/lib/tutorStudentsServer";

export async function GET() {
  const auth = await requireTutor();
  if (isNextResponse(auth)) return auth;
  const students = await loadTutorStudents(auth.userId);
  let signals: Awaited<ReturnType<typeof loadTutorStudentSignals>> = [];
  try { signals = await loadTutorStudentSignals(auth.userId, students); }
  catch (e) { console.error("[GET /api/tutor/hoc-sinh] signals", e); } // thiếu tín hiệu thì danh sách vẫn hiện, chỉ không có cột cảnh báo
  return NextResponse.json({ students, signals }, { headers: { "Cache-Control": "no-store" } });
}
