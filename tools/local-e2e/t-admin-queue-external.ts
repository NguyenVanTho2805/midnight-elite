// BU-08 mục 4.4 / 8.2 — hàng chờ loại `vao-lop` (BU-01) và `khach-hoi` (BU-05). TỰ BẬT khi model/cột có trong bản sinh Prisma; chưa có thì
// in "BỎ QUA …: chưa có <tên>" (KHÔNG tính xanh) và kiểm `counts` không có khoá, `?loai=` → 403.
// Cần Next dev cổng 3100 + Postgres thử. CHƯA CHẠY ĐƯỢC ở máy dựng — COO chạy tuần tự, và chạy lại sau khi #103/#104 gộp.
// Ca phá cố ý (bản đã gộp): bỏ lọc `status: "pending"` trong adminQueueExternalServer.ts → ca "câu hỏi đã duyệt không còn trong hàng chờ" đỏ.
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { api, mkTutor, mkUser, mkCourse, mkSuper, wipe, check, section, done } from "./h";
import { detectExternal } from "@/lib/adminQueueExternal";

(async () => {
  await wipe();
  const ext = detectExternal(Prisma.ModelName as Record<string, string>, Prisma.ThreadScalarFieldEnum as Record<string, string>);
  const SA = await mkSuper("Quản trị cấp 1");
  const CA = await mkUser({ name: "Quản trị nội dung", role: "admin", adminRole: "admin_content" });
  const T = await mkTutor("Cô Lan");
  const get = (as: any, p = "/api/admin/kiem-duyet?limit=100") => api("GET", p, { as });
  const skipped: string[] = [];

  section("vao-lop (yêu cầu vào lớp — BU-01)");
  if (!ext.joinRequests) {
    console.log("  BỎ QUA vao-lop: chưa có model ClassJoinRequest (không tính xanh)"); skipped.push("vao-lop");
    const r = await get(SA);
    check("chưa có model: counts KHÔNG có khoá vao-lop; ?loai=vao-lop → 403 (không phải 500)", r.status === 200 && !("vao-lop" in r.json.counts) && (await get(SA, "/api/admin/kiem-duyet?loai=vao-lop")).status === 403);
  } else {
    const d = (prisma as any).classJoinRequest;
    const c1 = await mkCourse(T.id, { name: "Lý 10" }), c2 = await mkCourse(T.id, { name: "Hoá 10" });
    const kids = await Promise.all([1, 2, 3].map(i => mkUser({ name: `Em Chờ Duyệt ${i}` })));
    await d.create({ data: { courseId: c1.id, userId: kids[0].id, status: "pending", createdAt: new Date(Date.now() - 4 * 86_400_000) } });
    await d.create({ data: { courseId: c1.id, userId: kids[1].id, status: "pending" } });
    await d.create({ data: { courseId: c2.id, userId: kids[2].id, status: "pending" } });
    const r = await get(SA);
    const rows = r.json.items.filter((i: any) => i.kind === "vao-lop");
    check("2 dòng vao-lop (mỗi LỚP một dòng), lớp cũ 4 ngày tone 'loi'", rows.length === 2 && rows.find((i: any) => i.who === "Lý 10")?.status.tone === "loi" && rows.find((i: any) => i.who === "Hoá 10")?.status.tone === "cho");
    check("counts['vao-lop'] = 2 và KHÔNG tính vào badge", r.json.counts["vao-lop"] === 2 && r.json.badge === Object.entries(r.json.counts).filter(([k]) => k !== "vao-lop").reduce((a, [, v]: any) => a + v, 0));
    check("không tên học sinh / userId trong JSON", !/Em Chờ Duyệt/.test(r.text) && !kids.some(k => r.text.includes(k.id)));
    check("admin_content thấy; gia sư 403", (await get(CA)).json.items.some((i: any) => i.kind === "vao-lop") && (await get(T)).status === 403);
    check("dòng không có lệnh duyệt, có liên kết 'Mở lớp' → /admin/khoa-hoc/<id>/hoc-vien", rows.every((i: any) => i.detail.actions.length === 0 && i.detail.links[0].href === `/admin/khoa-hoc/${i.id.split(":")[1]}/hoc-vien`));
    const hn = await api("GET", "/api/admin/hom-nay", { as: SA });
    check("Hôm nay có 'vao-lop-cham' = 1 lớp (lớp quá 3 ngày) trong nhóm theo-doi", hn.json.items.find((i: any) => i.key === "vao-lop-cham")?.count === 1);
  }

  section("khach-hoi (câu hỏi của khách — BU-05)");
  if (!ext.guestQuestions) {
    console.log("  BỎ QUA khach-hoi: chưa có Thread.status / Thread.guestName (không tính xanh)"); skipped.push("khach-hoi");
    const r = await get(SA);
    check("chưa có cột: counts KHÔNG có khoá khach-hoi; ?loai=khach-hoi → 403 (không phải 500)", r.status === 200 && !("khach-hoi" in r.json.counts) && (await get(SA, "/api/admin/kiem-duyet?loai=khach-hoi")).status === 403);
  } else {
    const th = (prisma as any).thread;
    const author = await mkUser({ name: "Khách hệ thống", role: "student" });
    const g1 = await th.create({ data: { content: "Làm sao giải phương trình bậc hai?", authorId: author.id, category: "hoi-dap", status: "pending", guestName: "Bé Na" } });
    const g2 = await th.create({ data: { content: "Gọi em 0901234567 nhé", authorId: author.id, category: "hoi-dap", status: "pending", guestName: "Bé Bo" } });
    await th.create({ data: { content: "Đã duyệt rồi", authorId: author.id, category: "hoi-dap", status: "published", guestName: "Bé Đã" } });
    const r = await get(SA);
    const rows = r.json.items.filter((i: any) => i.kind === "khach-hoi");
    check("2 dòng khach-hoi (chỉ trạng thái pending); câu hỏi đã duyệt không còn trong hàng chờ", rows.length === 2 && !r.text.includes("Đã duyệt rồi") && r.json.counts["khach-hoi"] === 2);
    check("cờ phoneOrLink đúng (Bé Bo có SĐT) và nút Duyệt của dòng đó đòi tick", rows.find((i: any) => i.id === `khach-hoi:${g2.id}`)?.flags.phoneOrLink === true && !!rows.find((i: any) => i.id === `khach-hoi:${g2.id}`)?.detail.actions[0].ack && rows.find((i: any) => i.id === `khach-hoi:${g1.id}`)?.flags.phoneOrLink === false);
    const it = rows.find((i: any) => i.id === `khach-hoi:${g1.id}`);
    const ap = await api("POST", it.detail.actions[0].url, { as: SA, body: it.detail.actions[0].body });
    check("duyệt qua POST /api/community/moderation/<id> → dòng biến mất + AuditLog community.guest_question.approve", ap.status === 200 && !(await get(SA)).json.items.some((i: any) => i.id === it.id) && !!(await prisma.auditLog.findFirst({ where: { action: "community.guest_question.approve", resourceId: g1.id } })));
    check("thiếu quyền (gia sư) → 403", (await api("POST", it.detail.actions[0].url, { as: T, body: it.detail.actions[0].body })).status === 403);
  }
  if (skipped.length) console.log(`\n  ⚠ CHƯA NGHIỆM THU mục B: ${skipped.join(", ")} còn BỎ QUA (chưa gộp #103/#104)`);
  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
