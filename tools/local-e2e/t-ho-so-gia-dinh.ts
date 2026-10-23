// HS-12 hồ sơ gia đình dùng chung liên hệ (KHÔNG gộp phiếu học phí) + LO-14 danh sách chờ xếp lớp — API thật.
// Chạy (máy chủ dev bật): source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-ho-so-gia-dinh.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import { api, check, done, mkCourse, mkTutor, mkUser, section, wipe } from "./h";

const stamp = Date.now().toString(36);
const N = (s: string) => `Em${stamp}${s}`;
const G = (scopes: string[]) => ({ guardian: true, scopes });

(async () => {
  await wipe();
  const A = await mkTutor("Gia sư A"), B = await mkTutor("Gia sư B");
  const cA = await mkCourse(A.id, { name: "Toán 9", capacity: 2 }), cB = await mkCourse(B.id, { name: "Lý 9 của B" });
  const stu = await mkUser({ name: "Học sinh" });
  const mk = (as = A, body: Record<string, unknown> = {}) => api("POST", "/api/tutor/ho-so", { as, body: { name: N(Math.random().toString(36).slice(2, 6)), ageGroup: "u7", consent: G(["basic"]), ...body } });

  section("Gia đình: quyền và kiểm dữ liệu");
  check("chưa đăng nhập 401; học sinh 403", (await api("GET", "/api/tutor/gia-dinh")).status === 401 && (await api("POST", "/api/tutor/gia-dinh", { as: stu, body: { label: "x" } })).status === 403);
  check("thiếu nhãn → 400; SĐT sai → 400", (await api("POST", "/api/tutor/gia-dinh", { as: A, body: {} })).status === 400 && (await api("POST", "/api/tutor/gia-dinh", { as: A, body: { label: "a", guardianPhone: "09" } })).status === 400);
  const fam = await api("POST", "/api/tutor/gia-dinh", { as: A, body: { label: "Gia đình Một", guardianName: "Chị Hoa", guardianPhone: "0912 345 678" } });
  check("tạo gia đình → 201", fam.status === 201 && !!fam.json.family.id);
  const fid = fam.json.family.id as string;
  check("liên hệ chuẩn hoá lưu trong DB", (await prisma.familyGroup.findUnique({ where: { id: fid } }))?.guardianPhone === "0912345678");
  check("danh sách chỉ của mình (B thấy 0)", (await api("GET", "/api/tutor/gia-dinh", { as: A })).json.families.length === 1 && (await api("GET", "/api/tutor/gia-dinh", { as: B })).json.families.length === 0);
  check("B sửa / xoá gia đình của A → 403; id lạ → 404", (await api("PATCH", `/api/tutor/gia-dinh/${fid}`, { as: B, body: { label: "hack" } })).status === 403 && (await api("DELETE", `/api/tutor/gia-dinh/${fid}`, { as: B })).status === 403 && (await api("PATCH", "/api/tutor/gia-dinh/khong-co", { as: A, body: { label: "x" } })).status === 404);
  check("A sửa nhãn → 200", (await api("PATCH", `/api/tutor/gia-dinh/${fid}`, { as: A, body: { label: "Gia đình Một (sửa)" } })).status === 200 && (await prisma.familyGroup.findUnique({ where: { id: fid } }))?.label === "Gia đình Một (sửa)");

  section("Gắn em vào gia đình: cần phạm vi 'family'");
  const noFam = await mk(A, { familyId: fid });
  check("tạo em gắn gia đình mà đồng ý chỉ 'basic' → 422 thiếu 'family', chưa lưu", noFam.status === 422 && noFam.json.scopesMissing.join() === "family" && (await prisma.studentProfile.count()) === 0);
  const p1 = await mk(A, { name: N("a"), familyId: fid, consent: G(["basic", "family"]) });
  const p2 = await mk(A, { name: N("b"), familyId: fid, consent: G(["basic", "family"]) });
  check("hai em có phạm vi 'family' → 201 cả hai", p1.status === 201 && p2.status === 201);
  const famB = await api("POST", "/api/tutor/gia-dinh", { as: B, body: { label: "Gia đình của B" } });
  check("gia sư B gắn em vào gia đình của A → 403", (await mk(B, { familyId: fid, consent: G(["basic", "family"]) })).status === 403);
  check("A gắn em vào gia đình của B → 403", (await mk(A, { familyId: famB.json.family.id, consent: G(["basic", "family"]) })).status === 403);
  const p3 = await mk(A, { name: N("c") }); // em chưa có phạm vi family
  await prisma.studentProfile.update({ where: { id: p3.json.id }, data: { familyId: fid } }); // dòng tồn dư/ghi tay: gắn gia đình mà KHÔNG có đồng ý family
  const d1 = await api("GET", `/api/tutor/ho-so/${p1.json.id}`, { as: A });
  check("chi tiết em 1: thấy liên hệ chung + em 2; em 3 (không có 'family') KHÔNG hiện tên, chỉ đếm 'đã ẩn'", d1.json.family?.guardianPhone === "0912345678" && d1.json.family.members.map((m: { name: string }) => m.name).join() === N("b") && d1.json.family.hiddenMembers === 1 && !d1.text.includes(N("c") + '"'), d1.json.family);
  const d3 = await api("GET", `/api/tutor/ho-so/${p3.json.id}`, { as: A });
  check("em 3 (thiếu 'family') mở hồ sơ mình: KHÔNG thấy liên hệ chung của gia đình", d3.json.family === null && !d3.text.includes("0912345678"));
  check("PATCH em 3 đổi sang gia đình khác cần 'family' → 422", (await api("PATCH", `/api/tutor/ho-so/${p3.json.id}`, { as: A, body: { familyId: null } })).status === 200 && (await api("PATCH", `/api/tutor/ho-so/${p3.json.id}`, { as: A, body: { familyId: fid } })).status === 422);
  check("gỡ khỏi gia đình (familyId: null) KHÔNG cần đồng ý thêm", (await api("PATCH", `/api/tutor/ho-so/${p2.json.id}`, { as: A, body: { familyId: null } })).status === 200);
  check("danh sách gia đình đếm đúng thành viên", (await api("GET", "/api/tutor/gia-dinh", { as: A })).json.families[0].members === 1);
  await api("POST", `/api/tutor/ho-so/${p1.json.id}/thu-hoi`, { as: A, body: { party: "guardian" } });
  const d1b = await api("GET", `/api/tutor/ho-so/${p1.json.id}`, { as: A });
  check("thu hồi đồng ý của em 1 → hồ sơ khoá và KHÔNG còn liên hệ chung / tên anh chị em", d1b.json.profile.consentLevel === "locked" && d1b.json.family === null && !d1b.text.includes("0912345678"));
  await api("POST", `/api/tutor/ho-so/${p1.json.id}/dong-y`, { as: A, body: G(["basic", "family"]) });
  check("giải tán gia đình → 200, hồ sơ các em VẪN CÒN, chỉ gỡ liên kết", (await api("DELETE", `/api/tutor/gia-dinh/${fid}`, { as: A })).status === 200 && (await prisma.studentProfile.count({ where: { familyId: fid } })) === 0 && (await prisma.studentProfile.count({ where: { id: { in: [p1.json.id, p2.json.id, p3.json.id] } } })) === 3);
  const lg = JSON.stringify(await prisma.auditLog.findMany({ where: { action: { startsWith: "family_group." } } }));
  check("nhật ký gia đình không chứa tên / số", !lg.includes("Hoa") && !lg.includes("0912345678") && !lg.includes("Gia đình Một"));
  const famSrc = ["src/lib/familyGroup.ts", "src/app/api/tutor/gia-dinh/route.ts", "src/app/api/tutor/gia-dinh/[id]/route.ts"].map(f => readFileSync(join(process.cwd(), f), "utf8")).join("\n");
  // `requireTutor` nằm trong invoiceServer.ts (chỉ là hàm kiểm vai gia sư, dùng chung mọi API gia sư): chỉ cho phép đúng import đó.
  const body = famSrc.split("\n").filter(l => !/^import .*requireTutor.* from "@\/lib\/invoiceServer";$/.test(l)).join("\n");
  check("KHÔNG gộp phiếu theo gia đình: mã gia đình không đụng phiếu / học phí / tiền (ngoài import hàm kiểm vai gia sư)", !/invoice|tuition|fee|payment|coin|wallet/i.test(body), body.match(/.{0,20}(invoice|tuition|fee|payment|coin|wallet).{0,20}/i)?.[0]);

  section("Danh sách chờ xếp lớp (LO-14)");
  const w1 = await mk(A, { name: N("w1"), status: "waitlist", courseId: cA.id });
  await new Promise(r => setTimeout(r, 30));
  const w2 = await mk(A, { name: N("w2"), status: "waitlist", courseId: cA.id });
  const lst = await api("GET", "/api/tutor/ho-so", { as: A });
  const wl = lst.json.profiles.filter((p: { status: string }) => p.status === "waitlist");
  check("2 em chờ, có mốc waitlistedAt; sắp theo thứ tự vào chờ (w1 trước w2)", wl.length === 2 && wl.every((p: { waitlistedAt: string | null }) => !!p.waitlistedAt) && [...wl].sort((x: { waitlistedAt: string }, y: { waitlistedAt: string }) => x.waitlistedAt.localeCompare(y.waitlistedAt))[0].id === w1.json.id);
  const c1 = lst.json.courses.find((c: { id: string }) => c.id === cA.id);
  check("API trả sức chứa + chỗ đã dùng của lớp (0/2 lúc đầu)", c1.capacity === 2 && c1.filled === 0 && !lst.json.courses.some((c: { id: string }) => c.id === cB.id));
  const st1 = await mkUser({ name: "Em có tài khoản" });
  await prisma.enrollment.create({ data: { userId: st1.id, courseId: cA.id, status: "active" } });
  check("em có tài khoản đang học tính vào chỗ đã dùng (1/2)", (await api("GET", "/api/tutor/ho-so", { as: A })).json.courses.find((c: { id: string }) => c.id === cA.id).filled === 1);
  const place = await api("PATCH", `/api/tutor/ho-so/${w1.json.id}`, { as: A, body: { status: "active", courseId: cA.id } });
  const w1row = await prisma.studentProfile.findUnique({ where: { id: w1.json.id } });
  check("xếp vào lớp: status active, mốc chờ xoá; chỗ đã dùng tăng (2/2)", place.status === 200 && w1row?.status === "active" && w1row.waitlistedAt === null && (await api("GET", "/api/tutor/ho-so", { as: A })).json.courses.find((c: { id: string }) => c.id === cA.id).filled === 2);
  check("lớp đầy vẫn xếp thêm được (chỉ cảnh báo trên giao diện, API không chặn)", (await api("PATCH", `/api/tutor/ho-so/${w2.json.id}`, { as: A, body: { status: "active", courseId: cA.id } })).status === 200);
  check("xếp vào lớp của gia sư KHÁC → 403, em vẫn ở trạng thái cũ", (await api("PATCH", `/api/tutor/ho-so/${w1.json.id}`, { as: A, body: { courseId: cB.id } })).status === 403);
  check("đưa lại vào danh sách chờ → mốc chờ mới", (await api("PATCH", `/api/tutor/ho-so/${w2.json.id}`, { as: A, body: { status: "waitlist" } })).status === 200 && !!(await prisma.studentProfile.findUnique({ where: { id: w2.json.id } }))?.waitlistedAt);
  check("tạo thẳng vào chờ mà không có đồng ý → vẫn 422 (danh sách chờ cũng là dữ liệu trẻ)", (await api("POST", "/api/tutor/ho-so", { as: A, body: { name: N("zz"), ageGroup: "u7", status: "waitlist" } })).status === 422);

  await done();
})();
