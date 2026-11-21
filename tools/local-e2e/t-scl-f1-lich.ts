// SCL F1 (P2-12) — DB thật, không cần máy chủ: đề thi thử CÔNG KHAI (không gắn lớp, chủ không phải gia sư) không lên lịch / "Việc của tôi" khi cờ
// THI_THU_CONG_KHAI tắt — bấm vào là bị chặn (publicExamGate). Đề của lớp em học, và đề công khai khi cờ mở, vẫn lên như cũ.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-scl-f1-lich.ts
// Ca phá cố ý (đã chạy rồi hoàn lại): bỏ `&& !isClosedPublicExam(...)` trong loadStudentScheduleEvents → ca "cờ tắt: đề công khai KHÔNG có" đỏ.
import { mkSuper, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { loadStudentScheduleEvents } from "@/lib/studentSchedule";
import { addDaysKey, vnDateKeyOf } from "@/lib/classSessions";

const FLAG = "NEXT_PUBLIC_KIN_MO_THI_THU_CONG_KHAI";
const ddmm = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}/${k.slice(0, 4)}`;
const mkExam = (id: string, o: Record<string, unknown>) => prisma.exam.create({ data: { id, code: id, title: id, category: "toan", time: "08:00", duration: "15 phút", questions: 1, status: "available", totalPoints: 10, active: true, isDraft: false, createdAt: "2026-11-01", ...o } as never });

(async () => {
  await wipe();
  const old = process.env[FLAG];
  const SA = await mkSuper("Quản trị Hà");
  const T = await mkTutor("Cô Lan");
  const S = await mkUser({ name: "Em An" });
  const C = await mkCourse(T.id, { name: "Toán 9" });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: C.id, status: "active" } });
  const date = ddmm(addDaysKey(vnDateKeyOf(new Date()), 3));
  await mkExam("f1-cong-khai", { date, ownerId: SA.id, courseId: null });
  await mkExam("f1-lop", { date, ownerId: T.id, courseId: C.id });
  const ids = async () => (await loadStudentScheduleEvents(S.id)).filter(e => e.type === "exam").map(e => e.id).sort().join();

  section("Lịch học sinh theo cờ THI_THU_CONG_KHAI");
  delete process.env[FLAG];
  const off = await ids();
  check("cờ tắt: đề công khai KHÔNG có; đề của lớp em học vẫn có", off === "exam-f1-lop", off);
  process.env[FLAG] = "1";
  const on = await ids();
  check("cờ mở: cả đề công khai lẫn đề lớp đều có (luật cũ không đổi)", on === "exam-f1-cong-khai,exam-f1-lop", on);
  if (old === undefined) delete process.env[FLAG]; else process.env[FLAG] = old;

  await done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
