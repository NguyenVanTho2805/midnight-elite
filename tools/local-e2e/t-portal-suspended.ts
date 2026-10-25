// NC2-026b F2 — em chỉ còn ghi danh suspended / pending_consent: câu đúng sự thật, KHÔNG lộ tên lớp/tiền, token sai vẫn 404.
import { emptyEnrollmentNotice } from "@/lib/parentPortal";
import { mkCourse, mkTutor, mkUser, wipe, check, section, done, BASE } from "./h";
import { prisma } from "@/lib/prisma";

const SUSP = "Lớp của con đang tạm dừng. Anh/chị liên hệ gia sư để biết thêm.";
const PEND = "Lớp của con đang chờ anh/chị đồng ý theo quy định. Anh/chị liên hệ gia sư để hoàn tất.";
const NONE = "Em chưa ghi danh lớp nào.";
const decode = (h: string) => h.replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

(async () => {
  section("Hàm thuần");
  check("suspended → câu tạm dừng", emptyEnrollmentNotice(["suspended"]) === SUSP);
  check("pending_consent → câu chờ đồng ý", emptyEnrollmentNotice(["pending_consent"]) === PEND);
  check("không có ghi danh → câu cũ", emptyEnrollmentNotice([]) === NONE);
  check("cả hai → ưu tiên chờ đồng ý", emptyEnrollmentNotice(["suspended", "pending_consent"]) === PEND);

  section("Trang + API");
  await wipe();
  const tutor = await mkTutor("Cô Lan"), par = await mkUser({ name: "PH Thử" });
  const course = await mkCourse(tutor.id, { name: "Lớp BÍ MẬT-XYZ" });
  // học phí tháng có thật của lớp, để chắc chắn không rò số tiền
  await prisma.monthlyCourseFee.create({ data: { courseId: course.id, yearMonth: new Date().toISOString().slice(0, 7), sessionCount: 8, freeCount: 0, updatedBy: tutor.id } });
  const mk = async (name: string, status: string | null, token: string) => {
    const s = await mkUser({ name });
    if (status) await prisma.enrollment.create({ data: { userId: s.id, courseId: course.id, status } });
    await prisma.parentLink.create({ data: { parentId: par.id, studentId: s.id, status: "verified", verifiedAt: new Date(), portalToken: token } });
    return s;
  };
  const TS = "0262b0000262b0000262b0000262b000", TP = "0263b0000263b0000263b0000263b000", TN = "0264b0000264b0000264b0000264b000";
  await mk("Em Tạm Dừng", "suspended", TS);
  await mk("Em Chờ Đồng Ý", "pending_consent", TP);
  await mk("Em Không Lớp", null, TN);

  for (const [label, tok, want, others] of [["suspended", TS, SUSP, [PEND, NONE]], ["pending_consent", TP, PEND, [SUSP, NONE]], ["không ghi danh", TN, NONE, [SUSP, PEND]]] as const) {
    const res = await fetch(`${BASE}/so-cua-con/${tok}`);
    const html = decode(await res.text());
    check(`${label}: trang 200 và hiện đúng câu`, res.status === 200 && html.includes(want), res.status);
    check(`${label}: không hiện câu của trạng thái khác`, others.every(o => !html.includes(o)));
    check(`${label}: không lộ tên lớp`, !html.includes("BÍ MẬT-XYZ"));
    check(`${label}: không hiện mục chuyên cần / học phí`, !html.includes("Chuyên cần tháng này") && !/\d[\d.]*\s?(đ|₫|VND)/.test(html.replace(/\d{2}\/\d{4}/g, "")));
    const api = await fetch(`${BASE}/api/parent-portal/${tok}`);
    const txt = await api.text();
    const j = JSON.parse(txt);
    check(`${label}: API courses rỗng, không có tên lớp`, api.status === 200 && Array.isArray(j.courses) && j.courses.length === 0 && !txt.includes("BÍ MẬT-XYZ") && j.total === undefined, txt.slice(0, 200));
  }

  section("Token sai");
  check("token đúng dạng nhưng không tồn tại → 404 (trang)", (await fetch(`${BASE}/so-cua-con/ffffffffffffffffffffffffffffffff`)).status === 404);
  check("token rác → 404 (trang)", (await fetch(`${BASE}/so-cua-con/abc`)).status === 404);
  check("token không tồn tại → 404 (API)", (await fetch(`${BASE}/api/parent-portal/ffffffffffffffffffffffffffffffff`)).status === 404);
  done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
