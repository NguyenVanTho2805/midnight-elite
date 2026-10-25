// BC-02 — "Chi tiết từng buổi" trên Sổ của con (API /api/parent-portal/[token] + trang /so-cua-con/[token]) — thật.
// Kiểm: chỉ buổi của ĐÚNG em (phụ huynh khác / em khác không lẫn), chỉ lớp em đang học, không ngày tương lai, không điểm / ghi chú; token sai / đã thu hồi → 404; em nghỉ → rỗng.
// Chạy (máy chủ dev bật): source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-party-sessions.ts
import { prisma } from "@/lib/prisma";
import { api, BASE, check, done, mkCourse, mkTutor, mkUser, section, wipe } from "./h";

const day = (ago: number) => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return new Date(d.getTime() - ago * 86_400_000); };
const ip = () => ({ "x-forwarded-for": `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` });
const T1 = "0b020000b0200000b0200000b0200001", T2 = "0b020000b0200000b0200000b0200002", T3 = "0b020000b0200000b0200000b0200003";

(async () => {
  await wipe();
  const A = await mkTutor("Cô A"), B = await mkTutor("Cô B");
  const cA = await mkCourse(A.id, { name: "Toán 9 của A" }), cA2 = await mkCourse(A.id, { name: "Lý 9 của A" }), cB = await mkCourse(B.id, { name: "Văn LỚP-CỦA-B" });
  const S1 = await mkUser({ name: "Em Một" }), S2 = await mkUser({ name: "Em Hai" }), SL = await mkUser({ name: "Em Đã Nghỉ" });
  const P1 = await mkUser({ name: "PH Một" }), P2 = await mkUser({ name: "PH Hai" });
  await prisma.enrollment.create({ data: { userId: S1.id, courseId: cA.id, status: "active" } });
  await prisma.enrollment.create({ data: { userId: S1.id, courseId: cA2.id, status: "suspended" } }); // lớp đã nghỉ: không lên Sổ
  await prisma.enrollment.create({ data: { userId: S2.id, courseId: cA.id, status: "active" } });
  await prisma.enrollment.create({ data: { userId: SL.id, courseId: cA.id, status: "suspended" } });
  await prisma.enrollment.create({ data: { userId: S1.id, courseId: cB.id, status: "active" } }); // lớp của gia sư khác, em vẫn đang học: PHẢI lên Sổ (Sổ là của em)
  const mkSess = async (courseId: string, creator: string, ago: number, rec: { userId: string; status: string; note?: string }[]) => {
    const s = await prisma.attendanceSession.create({ data: { courseId, date: day(ago), createdBy: creator } });
    for (const r of rec) await prisma.attendanceRecord.create({ data: { sessionId: s.id, userId: r.userId, status: r.status, note: r.note ?? null } });
    return s;
  };
  await mkSess(cA.id, A.id, 1, [{ userId: S1.id, status: "present", note: "GHI-CHÚ-NỘI-BỘ" }, { userId: S2.id, status: "absent" }]);
  await mkSess(cA.id, A.id, 8, [{ userId: S1.id, status: "late" }]);
  await mkSess(cA.id, A.id, 15, [{ userId: S1.id, status: "absent" }]);
  await mkSess(cA.id, A.id, -3, [{ userId: S1.id, status: "excused" }]);     // tương lai
  await mkSess(cA2.id, A.id, 2, [{ userId: S1.id, status: "present" }]);       // lớp đã nghỉ
  await mkSess(cB.id, B.id, 3, [{ userId: S1.id, status: "present" }]);
  await mkSess(cA.id, A.id, 4, [{ userId: SL.id, status: "present" }]);
  const sessScore = await prisma.attendanceSession.findFirstOrThrow({ where: { courseId: cA.id, date: day(1) } });
  await prisma.sessionStudentScore.create({ data: { sessionId: sessScore.id, userId: S1.id, tutorId: A.id, score: 9.25, homeworkPct: 77 } });
  for (const [par, st, tok] of [[P1, S1, T1], [P2, S2, T2], [P1, SL, T3]] as const) {
    await prisma.parentLink.create({ data: { parentId: par.id, studentId: st.id, status: "verified", verifiedAt: new Date(), portalToken: tok } });
  }

  section("API");
  const r1 = await api("GET", `/api/parent-portal/${T1}`, { headers: ip() });
  check("200", r1.status === 200, r1.status);
  const ses = r1.json.sessions as { dateKey: string; courseName: string; status: string; label: string }[];
  check("Em Một: 4 buổi (Toán 1 ngày trước có mặt, Văn của B 3 ngày trước, Toán 8 ngày trước muộn, Toán 15 ngày trước vắng)", ses.length === 4 && ses.map(s => s.status).join() === "present,present,late,absent", ses);
  check("mới → cũ, có nhãn chữ", ses[0].label === "Có mặt" && ses[2].label === "Muộn" && ses[3].label === "Vắng");
  check("KHÔNG có buổi ngày chưa tới (báo nghỉ trước) và KHÔNG có buổi của lớp em đã nghỉ (Lý 9)", !ses.some(s => s.status === "excused") && !ses.some(s => s.courseName.startsWith("Lý")));
  check("lớp của gia sư khác mà em đang học vẫn hiện (Sổ của con là của em)", ses.some(s => s.courseName.includes("LỚP-CỦA-B")));
  check("không có ghi chú nội bộ, không có điểm trong mảng sessions", !JSON.stringify(ses).includes("GHI-CHÚ-NỘI-BỘ") && !JSON.stringify(ses).includes("9.25") && !JSON.stringify(ses).includes("77") && ses.every(s => Object.keys(s).sort().join() === "courseName,dateKey,label,status,tone"), Object.keys(ses[0]));
  check("điểm vẫn ở mục scores riêng (không đổi hành vi cũ): chỉ khi có đồng ý — ở đây không có hồ sơ nên rỗng", Array.isArray(r1.json.scores) && r1.json.scores.length === 0);
  const r2 = await api("GET", `/api/parent-portal/${T2}`, { headers: ip() });
  check("Em Hai (phụ huynh khác): chỉ 1 buổi vắng của chính em, KHÔNG lẫn buổi của Em Một", r2.status === 200 && r2.json.sessions.length === 1 && r2.json.sessions[0].status === "absent" && !JSON.stringify(r2.json).includes("LỚP-CỦA-B") && !JSON.stringify(r2.json).includes("Em Một"), r2.json.sessions);
  const r3 = await api("GET", `/api/parent-portal/${T3}`, { headers: ip() });
  check("em đã nghỉ (không lớp đang học): sessions = [] (không rò điểm danh cũ)", r3.status === 200 && Array.isArray(r3.json.sessions) && r3.json.sessions.length === 0, r3.json);

  section("Quyền: token là chìa khoá duy nhất");
  check("token sai dạng → 404", (await api("GET", "/api/parent-portal/abc", { headers: ip() })).status === 404);
  check("token đúng dạng nhưng không có → 404, không có dữ liệu", await (async () => { const r = await api("GET", `/api/parent-portal/${"f".repeat(32)}`, { headers: ip() }); return r.status === 404 && !r.text.includes("sessions"); })());
  check("gia sư B (có tài khoản) không đọc được bằng id em: không có đường nào ngoài token", (await api("GET", `/api/parent-portal/${S1.id}`, { as: B, headers: ip() })).status === 404);
  await prisma.parentLink.updateMany({ where: { portalToken: T1 }, data: { portalToken: null } });
  check("thu hồi → link cũ 404 ngay", (await api("GET", `/api/parent-portal/${T1}`, { headers: ip() })).status === 404);
  await prisma.parentLink.updateMany({ where: { studentId: S1.id }, data: { portalToken: T1, status: "pending" } });
  check("liên kết chưa xác nhận → 404 dù còn token", (await api("GET", `/api/parent-portal/${T1}`, { headers: ip() })).status === 404);
  await prisma.parentLink.updateMany({ where: { studentId: S1.id }, data: { status: "verified" } });

  section("Trang");
  const html = await (await fetch(`${BASE}/so-cua-con/${T1}`, { headers: ip() })).text();
  check("trang có mục 'Chi tiết từng buổi' với 4 dòng, kèm chữ Có mặt / Muộn / Vắng", html.includes("Chi tiết từng buổi") && html.includes("data-party-sessions") && html.includes("Có mặt") && html.includes("Muộn") && html.includes("Vắng"));
  check("trang không lộ ghi chú nội bộ, và nói rõ 'ghi trên KiN' (không 'đã xác minh')", !html.includes("GHI-CHÚ-NỘI-BỘ") && html.includes("Gia sư ghi trên KiN") && !html.includes("đã xác minh"));
  const html2 = await (await fetch(`${BASE}/so-cua-con/${T2}`, { headers: ip() })).text();
  check("trang của Em Hai không có Văn của B, không có tên Em Một", !html2.includes("LỚP-CỦA-B") && !html2.includes("Em Một"));
  const htmlNone = await (await fetch(`${BASE}/so-cua-con/${T3}`, { headers: ip() })).text();
  check("em nghỉ: không có mục chi tiết buổi", !htmlNone.includes("data-party-sessions"));
  done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
