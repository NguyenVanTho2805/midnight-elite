// NC2-050 — API công thức tính điểm (cơ sở dữ liệu thật): chỉ quản lý trung tâm ghi được; kiểm nghiêm; công khai CHỈ khi xuất bản + có nguồn; ghi nhật ký; dữ liệu hỏng không làm sập trang.
import { api, mkUser, mkTutor, mkSuper, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { loadPublicFormulas } from "@/lib/admissionFormulaServer";

const A00 = { name: "Khối A00 — Toán nhân đôi", school: "Trường mẫu", year: 2026, scale: 30, multiplier: 0.75,
  inputs: [{ label: "Toán", max: 10, weight: 2 }, { label: "Lý", max: 10, weight: 1 }, { label: "Hoá", max: 10, weight: 1 }],
  bonuses: [{ label: "Điểm ưu tiên", max: 2.75 }], sourceUrl: "https://example.edu.vn/thong-bao", published: true, verified: false };
const U = "/api/admin/diem-chuan/cong-thuc";

(async () => {
  await wipe();
  const SA = await mkSuper("Quản trị cấp 1"), CT = await mkUser({ name: "Biên tập", role: "admin", adminRole: "admin_content" });
  const T = await mkTutor("Cô Lan"), S = await mkUser({ name: "Minh Anh" });

  section("Quyền: chỉ quản lý trung tâm");
  check("chưa đăng nhập → 401/403 (GET và POST)", [401, 403].includes((await api("GET", U)).status) && [401, 403].includes((await api("POST", U, { body: A00 })).status));
  check("gia sư → bị chặn", [401, 403].includes((await api("POST", U, { as: T, body: A00 })).status) && [401, 403].includes((await api("GET", U, { as: T })).status));
  check("học sinh → bị chặn", [401, 403].includes((await api("POST", U, { as: S, body: A00 })).status));
  check("không có gì được ghi sau các lần bị chặn", (await prisma.admissionFormula.count()) === 0);

  section("Tạo / đọc / sửa / xoá");
  const c = await api("POST", U, { as: SA, body: A00 });
  check("quản trị cấp 1 POST hợp lệ → 201 + id", c.status === 201 && typeof c.json.id === "string", c.json);
  const row = await prisma.admissionFormula.findUniqueOrThrow({ where: { id: c.json.id } });
  check("lưu đúng: thang 30, hệ số nhân 0,75, khoá môn m1…m3 do máy sinh, nguồn có tên miền, xuất bản", row.scale === 30 && row.multiplier === 0.75 && JSON.stringify((row.inputs as { key: string }[]).map(i => i.key)) === '["m1","m2","m3"]' && row.sourceName === "example.edu.vn" && row.published, row);
  const c2 = await api("POST", U, { as: CT, body: { ...A00, name: "Khối B00 (bản nháp)", published: false, sourceUrl: "" } });
  check("quản trị nội dung cũng tạo được; bản nháp không cần nguồn", c2.status === 201, c2.json);
  const g = await api("GET", U, { as: CT });
  check("GET admin: thấy cả 2 (kể cả bản nháp), total 2, published 1", g.status === 200 && g.json.total === 2 && g.json.published === 1 && g.json.formulas.length === 2 && g.json.formulas.every((f: { broken: boolean }) => !f.broken), g.json);
  const up = await api("PATCH", `${U}/${c.json.id}`, { as: SA, body: { verified: true, note: "Đã so với thông báo năm 2026" } });
  check("PATCH một phần (đã đối chiếu + ghi chú) → 200, các trường khác giữ nguyên", up.status === 200 && (await prisma.admissionFormula.findUniqueOrThrow({ where: { id: c.json.id } })).verified === true && (await prisma.admissionFormula.findUniqueOrThrow({ where: { id: c.json.id } })).scale === 30);
  check("PATCH làm công thức vượt thang (bỏ hệ số nhân) → 400, bản ghi không đổi", (await api("PATCH", `${U}/${c.json.id}`, { as: SA, body: { multiplier: 1 } })).status === 400 && (await prisma.admissionFormula.findUniqueOrThrow({ where: { id: c.json.id } })).multiplier === 0.75);
  check("PATCH bật công khai khi bản nháp chưa có nguồn → 400", (await api("PATCH", `${U}/${c2.json.id}`, { as: SA, body: { published: true } })).status === 400);
  check("PATCH id không có → 404", (await api("PATCH", `${U}/khong-co`, { as: SA, body: { verified: true } })).status === 404 && (await api("DELETE", `${U}/khong-co`, { as: SA })).status === 404);

  section("Dữ liệu sai → 400, không ghi gì");
  const before = await prisma.admissionFormula.count();
  for (const [name, body] of [["thiếu tên", { ...A00, name: "" }], ["vượt thang", { ...A00, multiplier: 1 }], ["công khai không nguồn", { ...A00, sourceUrl: "" }], ["nguồn javascript:", { ...A00, sourceUrl: "javascript:alert(1)" }], ["môn trùng tên", { ...A00, inputs: [{ label: "Toán", max: 10 }, { label: "toán", max: 10 }] }], ["mảng", [A00]], ["không có môn", { ...A00, inputs: [] }]] as const)
    check(`POST ${name} → 400`, (await api("POST", U, { as: SA, body })).status === 400);
  check("thân không phải JSON → 400 (không 500)", (await api("POST", U, { as: SA, raw: "{hỏng", headers: { "content-type": "application/json" } })).status === 400);
  check("không có công thức nào được thêm sau các lần sai", (await prisma.admissionFormula.count()) === before);

  section("Công khai: chỉ công thức đã xuất bản + có nguồn; dữ liệu hỏng bị bỏ qua");
  let pub = await loadPublicFormulas();
  check("trang công khai thấy 1 công thức (bản nháp không lộ)", pub.length === 1 && pub[0].name === A00.name && pub[0].verified === true, pub);
  check("công thức công khai KHÔNG lộ trường nội bộ (published, createdAt…)", !("published" in pub[0]) && !("createdAt" in pub[0]) && !("updatedAt" in pub[0]));
  await prisma.admissionFormula.update({ where: { id: c.json.id }, data: { sourceUrl: "" } });
  check("công thức xuất bản nhưng mất nguồn (sửa tay trong CSDL) → KHÔNG công khai", (await loadPublicFormulas()).length === 0);
  await prisma.admissionFormula.update({ where: { id: c.json.id }, data: { sourceUrl: "https://example.edu.vn/thong-bao", inputs: [{ label: "Toán", max: -5, weight: 2, key: "m1" }] } });
  check("dữ liệu JSON hỏng trong CSDL → bỏ qua công thức đó, trang không sập", (await loadPublicFormulas()).length === 0);
  const gb = await api("GET", U, { as: SA });
  check("trang quản trị vẫn liệt kê công thức hỏng (broken = true) để sửa / xoá", gb.status === 200 && gb.json.formulas.some((f: { id: string; broken: boolean }) => f.id === c.json.id && f.broken));

  section("Nhật ký và xoá");
  const logs = await prisma.auditLog.findMany({ where: { resourceType: "AdmissionFormula" }, orderBy: { createdAt: "asc" } });
  check("nhật ký ghi create ×2 và update", logs.filter(l => l.action === "admission_formula.create").length === 2 && logs.some(l => l.action === "admission_formula.update"), logs.map(l => l.action));
  const del = await api("DELETE", `${U}/${c.json.id}`, { as: CT });
  check("DELETE → 200, bản ghi mất, nhật ký ghi delete", del.status === 200 && (await prisma.admissionFormula.count({ where: { id: c.json.id } })) === 0 && (await prisma.auditLog.count({ where: { action: "admission_formula.delete" } })) === 1);
  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
