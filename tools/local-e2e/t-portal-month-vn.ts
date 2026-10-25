// NC2-026b F3 — "Sổ của con" quyết tháng hiển thị theo GIỜ VIỆT NAM (00:00–06:59 ngày 01 không còn hiện tháng trước).
// Phần thuần dùng đồng hồ giả (truyền Date vào hàm); phần API chỉ kiểm tháng mặc định = tháng VN của lúc gọi.
import { readFileSync } from "node:fs";
import { vnMonthKey } from "@/lib/revenue";
import { currentYearMonth } from "@/lib/tuition";
import { mkCourse, mkTutor, mkUser, wipe, check, section, done, BASE } from "./h";
import { prisma } from "@/lib/prisma";

(async () => {
  section("Đồng hồ giả: tháng theo giờ VN");
  const t1 = new Date("2026-10-31T17:30:00Z"); // = 00:30 ngày 01/11 giờ VN
  const t2 = new Date("2026-10-31T16:59:59Z"); // = 23:59:59 ngày 31/10 giờ VN
  const t3 = new Date("2026-12-31T17:00:00Z"); // = 00:00 ngày 01/01/2027 giờ VN
  check("2026-10-31T17:30Z → 2026-11", vnMonthKey(t1) === "2026-11", vnMonthKey(t1));
  check("2026-10-31T16:59:59Z → 2026-10", vnMonthKey(t2) === "2026-10", vnMonthKey(t2));
  check("giao năm: 2026-12-31T17:00Z → 2027-01", vnMonthKey(t3) === "2027-01", vnMonthKey(t3));

  section("Hàm tính tiền/lập phiếu KHÔNG đổi (currentYearMonth vẫn theo UTC)");
  check("currentYearMonth(2026-10-31T17:30Z) vẫn '2026-10' (hàm dùng chung, không đụng)", currentYearMonth(t1) === "2026-10", currentYearMonth(t1));

  section("Phía phụ huynh không còn dùng currentYearMonth; phía tiền vẫn nguyên");
  const portalFiles = ["src/app/(parent)/so-cua-con/[token]/page.tsx", "src/app/api/parent-portal/[token]/route.ts"];
  for (const f of portalFiles) check(`${f} không gọi currentYearMonth()`, !/currentYearMonth\s*\(/.test(readFileSync(f, "utf8")));
  for (const f of ["src/lib/invoiceServer.ts", "src/lib/tuitionInvoice.ts"]) {
    let src = ""; try { src = readFileSync(f, "utf8"); } catch { /* không có tệp */ }
    check(`${f} không bị đổi sang vnMonthKey bởi việc này`, !src.includes("NC2-026b"));
  }

  section("API: tháng mặc định của cổng = tháng VN lúc gọi");
  await wipe();
  const tutor = await mkTutor("Cô Lan"), stu = await mkUser({ name: "Em Tháng" }), par = await mkUser({ name: "PH Tháng" });
  const course = await mkCourse(tutor.id, { name: "Lớp tháng VN" });
  await prisma.enrollment.create({ data: { userId: stu.id, courseId: course.id, status: "active" } });
  const TOKEN = "0261b0000261b0000261b0000261b000";
  await prisma.parentLink.create({ data: { parentId: par.id, studentId: stu.id, status: "verified", verifiedAt: new Date(), portalToken: TOKEN } });
  const before = vnMonthKey(new Date());
  const j = await fetch(`${BASE}/api/parent-portal/${TOKEN}`).then(r => r.json());
  const after = vnMonthKey(new Date());
  check("yearMonth mặc định = tháng VN", j.yearMonth === before || j.yearMonth === after, j.yearMonth);
  const j2 = await fetch(`${BASE}/api/parent-portal/${TOKEN}?yearMonth=2026-09`).then(r => r.json());
  check("?yearMonth=2026-09 vẫn được tôn trọng", j2.yearMonth === "2026-09");
  const html = (await fetch(`${BASE}/so-cua-con/${TOKEN}`).then(r => r.text())).replace(/<!--.*?-->/g, "");
  const [y, m] = before.split("-");
  check("trang hiện 'Tháng mm/yyyy' theo tháng VN", html.includes(`Tháng ${m}/${y}`), html.match(/Tháng[^<]{0,12}/g));
  done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
