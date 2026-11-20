// DG (14/11/2026): cờ THI_THU_CONG_KHAI tắt ⇒ link TRỰC TIẾP tới đề thi thử công khai của KiN không mở được (trước đây vẫn mở).
// Đề thi thử công khai = không gắn lớp + chủ không phải gia sư. Đề riêng của gia sư không gắn lớp và đề gắn lớp vẫn làm như cũ.
// Cần máy chủ với cờ MẶC ĐỊNH (tắt). Chạy: source tools/local-e2e/env.sh && TZ=Asia/Ho_Chi_Minh npx tsx tools/local-e2e/t-thi-thu-dong.ts
// CA PHÁ CỐ Ý (mỗi lần một thứ rồi hoàn lại):
//   - publicExamGate.ts isClosedPublicExam: bỏ dòng `return i.ownerAdminRole !== "teacher"` (trả true) → ca "đề riêng của gia sư" đỏ.
//   - exams/[id]/route.ts: xoá khối closedPublicExam → ca 3 đỏ.  start/route.ts: xoá khối → ca 5 đỏ.  gate/route.ts: xoá khối → ca 4 đỏ.
import { api, check, done, mkCourse, mkSuper, mkTutor, mkUser, section, wipe } from "./h";
import { prisma } from "@/lib/prisma";
import { isClosedPublicExam } from "@/lib/publicExamGate";
import { PUBLIC_EXAM_CLOSED_CODE, PUBLIC_EXAM_CLOSED_MESSAGE, featureOn } from "@/lib/features";
import { looksLikeMoney } from "@/lib/lessonReminder";

(async () => {
  section("hàm thuần");
  const off = {}, on = { THI_THU_CONG_KHAI: "1" };
  check("1a. cờ tắt + không lớp + chủ quản trị ⇒ đóng", isClosedPublicExam({ courseId: null, ownerAdminRole: "admin_super" }, off));
  check("1b. cờ tắt + không lớp + không chủ ⇒ đóng", isClosedPublicExam({ courseId: null, ownerAdminRole: null }, off));
  check("1c. cờ tắt + không lớp + chủ là gia sư ⇒ KHÔNG đóng (đề riêng của gia sư)", !isClosedPublicExam({ courseId: null, ownerAdminRole: "teacher" }, off));
  check("1d. đề gắn lớp ⇒ không bao giờ đóng", !isClosedPublicExam({ courseId: "c1", ownerAdminRole: "admin_super" }, off));
  check("1e. cờ mở ⇒ không đóng", !isClosedPublicExam({ courseId: null, ownerAdminRole: "admin_super" }, on));
  check("1f. thông điệp không số tiền, có lối đề được giao", !looksLikeMoney(PUBLIC_EXAM_CLOSED_MESSAGE) && PUBLIC_EXAM_CLOSED_MESSAGE.includes("Đề được giao"));

  if (featureOn("THI_THU_CONG_KHAI")) { console.log("BỎ QUA phần API: bài này cần máy chủ chạy với cờ THI_THU_CONG_KHAI TẮT."); await done(); return; }

  await wipe();
  const A = await mkSuper("Quản trị KiN");
  const T = await mkTutor("Cô Lan");
  const C = await mkCourse(T.id, { name: "Toán 9" });
  const S = await mkUser({ name: "Em Một" });
  const S2 = await mkUser({ name: "Em Hai" });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: C.id, status: "active" } });
  const mkExam = async (id: string, extra: Record<string, unknown>) => {
    await prisma.exam.create({ data: { id, code: id, title: "Bài " + id, category: "Toán", date: "01/01/2030", time: "08:00", duration: "15 phút", questions: 1, status: "available", createdAt: "2026-11-14", totalPoints: 10, ...extra } });
    const q = await prisma.examQuestion.create({ data: { id: id + "-mc", examId: id, order: 1, text: "2 + 2 = ?", type: "MC", points: 1 } });
    await prisma.examOption.create({ data: { id: id + "-ok", questionId: q.id, order: 0, text: "4", isCorrect: true } });
  };
  await mkExam("dong-kin", { ownerId: A.id });
  await mkExam("dong-khong-chu", {});
  await mkExam("dong-da-lam", { ownerId: A.id });
  await mkExam("mo-gia-su", { ownerId: T.id });
  await mkExam("mo-lop", { ownerId: T.id, courseId: C.id });
  await prisma.examResult.create({ data: { userId: S2.id, examId: "dong-da-lam", score: 8, totalPoints: 10 } });

  section("đề thi thử của KiN — link trực tiếp bị đóng");
  const g = await api("GET", "/api/exams/dong-kin", { as: S });
  check("3. GET đề ⇒ 404 mã public_exam_closed, không lộ tiêu đề", g.status === 404 && g.json?.code === PUBLIC_EXAM_CLOSED_CODE && !g.text.includes("Bài dong-kin"), g.json);
  const gate = await api("GET", "/api/exams/dong-kin/gate", { as: S });
  check("4. cổng vào đề ⇒ 404 cùng mã", gate.status === 404 && gate.json?.code === PUBLIC_EXAM_CLOSED_CODE, gate.json);
  const st = await api("POST", "/api/exams/dong-kin/start", { as: S, body: {} });
  check("5. mở lượt ⇒ 403, không tạo lượt", st.status === 403 && st.json?.code === PUBLIC_EXAM_CLOSED_CODE && (await prisma.examAttempt.count({ where: { examId: "dong-kin" } })) === 0, st.json);
  const g0 = await api("GET", "/api/exams/dong-khong-chu", { as: S });
  check("6. đề không còn chủ cũng đóng", g0.status === 404 && g0.json?.code === PUBLIC_EXAM_CLOSED_CODE, g0.json);
  const g2 = await api("GET", "/api/exams/dong-da-lam", { as: S2 });
  check("7. em ĐÃ có điểm đề đó vẫn mở được để xem lại", g2.status === 200, g2.json);
  const st2 = await api("POST", "/api/exams/dong-da-lam/start", { as: S2, body: {} });
  check("8. …nhưng không mở được lượt MỚI", st2.status === 403 && st2.json?.code === PUBLIC_EXAM_CLOSED_CODE, st2.json);
  const ga = await api("GET", "/api/exams/dong-kin", { as: A });
  check("9. quản trị vẫn xem được đề", ga.status === 200, ga.json);

  section("không bị ảnh hưởng");
  const gt = await api("GET", "/api/exams/mo-gia-su", { as: S2 });
  const stt = await api("POST", "/api/exams/mo-gia-su/start", { as: S2, body: {} });
  check("10. đề riêng của gia sư (không gắn lớp) vẫn mở và làm được qua link", gt.status === 200 && stt.status === 200 && !!stt.json?.attemptId, { gt: gt.status, stt: stt.json });
  const stl = await api("POST", "/api/exams/mo-lop/start", { as: S, body: {} });
  check("11. đề được giao trong lớp vẫn làm được", stl.status === 200 && !!stl.json?.attemptId, stl.json);
  await done();
})();
