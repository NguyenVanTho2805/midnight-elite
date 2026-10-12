// FE-099 — API điểm chuẩn: công khai chỉ thấy dòng xuất bản; quản lý chỉ cho quản lý trung tâm; nhập hàng loạt tất cả-hoặc-không.
import { api, mkSuper, mkUser, mkTutor, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { SEED_SCORES } from "@/lib/admissionScoreSeed";

(async () => {
  await wipe();
  const SA = await mkSuper("Quản trị");
  const CA = await mkUser({ name: "Biên tập", role: "admin", adminRole: "admin_content" });
  const T = await mkTutor("Gia sư"), S = await mkUser({ name: "Học sinh" });
  const A = "/api/admin/diem-chuan";
  const row = (o: Record<string, unknown> = {}) => ({ school: "ĐH Thử", major: "CNTT", year: 2025, method: "thpt", score: "27,5", scale: 30, sourceUrl: "https://thu.edu.vn/diem-chuan", sourceName: "Trường Thử", ...o });

  section("Bảng trống: trang công khai dùng dữ liệu khởi đầu có nguồn");
  const pub0 = await api("GET", "/api/diem-chuan");
  check("200, source = seed, đủ số dòng khởi đầu", pub0.status === 200 && pub0.json.source === "seed" && pub0.json.rows.length === SEED_SCORES.length, pub0.json?.source);
  check("MỌI dòng công khai có sourceUrl http(s) + tên nguồn", pub0.json.rows.every((r: any) => /^https?:\/\//.test(r.sourceUrl) && r.sourceName));
  check("không lộ trường nội bộ (published, createdAt…)", pub0.json.rows.every((r: any) => !("published" in r) && !("createdAt" in r) && !("updatedAt" in r)));
  check("seed: tất cả chưa đối chiếu (không tự nhận đã kiểm)", pub0.json.rows.every((r: any) => r.verified === false));
  check("không cần đăng nhập, có cache ngắn cho CDN", pub0.headers.get("cache-control")?.includes("s-maxage"));

  section("Quyền: chỉ quản lý trung tâm");
  for (const [name, as] of [["chưa đăng nhập", undefined], ["học viên", S], ["gia sư", T]] as const) {
    const g = await api("GET", A, { as }), p = await api("POST", A, { as, body: row() }), im = await api("POST", `${A}/import`, { as, body: { text: "[]" } }), sd = await api("POST", `${A}/seed`, { as });
    check(`${name}: GET/POST/import/seed đều bị chặn (401/403)`, [g, p, im, sd].every(r => r.status === 401 || r.status === 403), [g.status, p.status, im.status, sd.status]);
  }
  check("chưa có dòng nào bị ghi sau các lần bị chặn", (await prisma.admissionScore.count()) === 0);
  const g0 = await api("GET", A, { as: SA });
  check("admin_super thấy trạng thái trống + usingSeed", g0.status === 200 && g0.json.total === 0 && g0.json.usingSeed === true && g0.json.seedCount === SEED_SCORES.length, g0.json);
  check("admin_content cũng được", (await api("GET", A, { as: CA })).status === 200);

  section("Thêm một dòng");
  const c1 = await api("POST", A, { as: SA, body: row() });
  check("201 và có id", c1.status === 201 && typeof c1.json.id === "string", c1.json);
  const saved = await prisma.admissionScore.findUnique({ where: { id: c1.json.id } });
  check("lưu đúng: điểm 27,5 → 27.5, mặc định chưa đối chiếu + công khai, variant rỗng", saved?.score === 27.5 && saved.verified === false && saved.published === true && saved.variant === "" && saved.note === null, saved);
  check("ghi nhật ký thao tác", (await prisma.auditLog.count({ where: { action: "admission_score.create", resourceId: c1.json.id, actorId: SA.id } })) === 1);
  const dup = await api("POST", A, { as: SA, body: row({ score: "20" }) });
  check("trùng khoá (trường, ngành, chương trình, năm, phương thức) → 409, không đè", dup.status === 409 && /Đã có dòng/.test(dup.json.error) && (await prisma.admissionScore.count()) === 1 && (await prisma.admissionScore.findFirst())?.score === 27.5, dup.json);
  const dupCase = await api("POST", A, { as: SA, body: row({ school: "đh thử", major: "cntt", score: "20" }) });
  check("trùng khoá KHÔNG phân biệt hoa/thường ('đh thử' / 'cntt') → 409, không tạo bản thứ hai", dupCase.status === 409 && (await prisma.admissionScore.count()) === 1, dupCase.json);
  const dupNfd = await api("POST", A, { as: SA, body: row({ school: "ĐH Thử".normalize("NFD"), score: "20" }) });
  check("trùng khoá dù chữ có dấu ở dạng tổ hợp (NFD) → 409", dupNfd.status === 409 && (await prisma.admissionScore.count()) === 1, dupNfd.json);
  check("khác chương trình thì không trùng", (await api("POST", A, { as: SA, body: row({ variant: "Tiên tiến", score: "28" }) })).status === 201);
  for (const [why, patch] of [["thiếu nguồn", { sourceUrl: "" }], ["nguồn javascript:", { sourceUrl: "javascript:alert(1)" }], ["điểm vượt thang", { score: "31" }], ["phương thức lạ", { method: "x" }], ["năm 1999", { year: 1999 }], ["thiếu ngành", { major: "" }]] as const) {
    const r = await api("POST", A, { as: SA, body: row({ major: "Ngành " + why, ...patch }) });
    check(`từ chối: ${why} → 400, không ghi`, r.status === 400 && !!r.json.error, r.json);
  }
  check("chỉ còn 2 dòng", (await prisma.admissionScore.count()) === 2);
  check("thân yêu cầu không phải JSON → 400", (await api("POST", A, { as: SA, raw: "xxx", headers: { "content-type": "application/json" } })).status === 400);

  section("Công khai chỉ thấy dòng xuất bản; có dữ liệu thì KHÔNG còn hiện dữ liệu khởi đầu");
  const pub1 = await api("GET", "/api/diem-chuan");
  check("source = db, 2 dòng, không lẫn seed", pub1.json.source === "db" && pub1.json.rows.length === 2 && pub1.json.rows.every((r: any) => r.school === "ĐH Thử"), pub1.json);
  const hide = await api("PATCH", `${A}/${c1.json.id}`, { as: SA, body: { published: false } });
  const pub2 = await api("GET", "/api/diem-chuan");
  check("ẩn một dòng → công khai chỉ còn 1; admin vẫn thấy cả 2", hide.status === 200 && pub2.json.rows.length === 1 && (await api("GET", A, { as: SA })).json.rows.length === 2);
  await prisma.admissionScore.updateMany({ data: { published: false } });
  const pub3 = await api("GET", "/api/diem-chuan");
  check("ẩn hết: trang công khai rỗng, KHÔNG quay về dữ liệu khởi đầu (vì bảng không trống)", pub3.json.source === "db" && pub3.json.rows.length === 0, pub3.json.source);
  await prisma.admissionScore.updateMany({ data: { published: true } });

  section("Sửa một phần (PATCH)");
  const p1 = await api("PATCH", `${A}/${c1.json.id}`, { as: SA, body: { verified: true } });
  const after = await prisma.admissionScore.findUnique({ where: { id: c1.json.id } });
  check("bật 'đã đối chiếu' giữ nguyên các trường khác", p1.status === 200 && after?.verified === true && after.score === 27.5 && after.school === "ĐH Thử" && after.sourceUrl === "https://thu.edu.vn/diem-chuan", after);
  const p2 = await api("PATCH", `${A}/${c1.json.id}`, { as: SA, body: { score: "28,25", note: "  Đợt 1 " } });
  const a2 = await prisma.admissionScore.findUnique({ where: { id: c1.json.id } });
  check("sửa điểm + ghi chú: 28.25, ghi chú gọn khoảng trắng", p2.status === 200 && a2?.score === 28.25 && a2.note === "Đợt 1");
  const p3 = await api("PATCH", `${A}/${c1.json.id}`, { as: SA, body: { sourceUrl: "https://u:p@evil.vn/x" } });
  check("sửa sang nguồn có mật khẩu/@ → 400, dữ liệu không đổi", p3.status === 400 && (await prisma.admissionScore.findUnique({ where: { id: c1.json.id } }))?.sourceUrl === "https://thu.edu.vn/diem-chuan");
  check("sửa điểm vượt thang cũ → 400; đổi cả thang và điểm cùng lúc → 200", (await api("PATCH", `${A}/${c1.json.id}`, { as: SA, body: { score: "95" } })).status === 400 && (await api("PATCH", `${A}/${c1.json.id}`, { as: SA, body: { score: "95", scale: 100 } })).status === 200);
  const other = await prisma.admissionScore.findFirst({ where: { variant: "Tiên tiến" } });
  const p4 = await api("PATCH", `${A}/${other!.id}`, { as: SA, body: { variant: "" } });
  check("sửa thành trùng khoá dòng khác → 409", p4.status === 409 && (await prisma.admissionScore.findUnique({ where: { id: other!.id } }))?.variant === "Tiên tiến", p4.json);
  const p5 = await api("PATCH", `${A}/${other!.id}`, { as: SA, body: { variant: "", school: "ĐH THỬ", major: "cntt" } });
  check("sửa thành trùng khoá dòng khác chỉ khác hoa/thường → 409", p5.status === 409, p5.json);
  check("sửa chính dòng mình (đổi hoa/thường tên trường) không bị coi là trùng với chính nó", (await api("PATCH", `${A}/${c1.json.id}`, { as: SA, body: { school: "ĐH Thử Đổi Hoa" } })).status === 200 && (await api("PATCH", `${A}/${c1.json.id}`, { as: SA, body: { school: "ĐH Thử" } })).status === 200);
  check("id không tồn tại → 404; thân không phải object → 400", (await api("PATCH", `${A}/khong-co`, { as: SA, body: { verified: true } })).status === 404 && (await api("PATCH", `${A}/${other!.id}`, { as: SA, body: [1] })).status === 400);
  check("gia sư/học viên không sửa/xoá được", (await api("PATCH", `${A}/${other!.id}`, { as: T, body: { verified: true } })).status >= 401 && (await api("DELETE", `${A}/${other!.id}`, { as: S })).status >= 401 && (await prisma.admissionScore.count()) === 2);

  section("Xoá");
  check("xoá → 200, mất dòng; xoá lại → 404", (await api("DELETE", `${A}/${other!.id}`, { as: CA })).status === 200 && (await prisma.admissionScore.count()) === 1 && (await api("DELETE", `${A}/${other!.id}`, { as: SA })).status === 404);
  check("ghi nhật ký xoá", (await prisma.auditLog.count({ where: { action: "admission_score.delete", resourceId: other!.id } })) === 1);

  section("Nhập hàng loạt: kiểm tra trước, tất cả hoặc không có gì");
  const head = "school,major,variant,year,method,score,scale,sourceUrl,sourceName,note,verified,published";
  const good = [head, "ĐH Mới,Toán,,2025,thpt,26,30,https://moi.edu.vn/a,Trường Mới,,false,true", "ĐH Mới,Lý,,2025,thpt,25.5,30,https://moi.edu.vn/b,,,,", "ĐH Thử,CNTT,,2025,thpt,29,30,https://thu.edu.vn/moi,Cập nhật,,true,"].join("\n");
  const im = (text: string, dryRun?: boolean) => api("POST", `${A}/import`, { as: SA, body: { text, dryRun } });
  const d1 = await im(good, true);
  check("dryRun: hợp lệ 3 dòng, sẽ thêm 2, cập nhật 1; KHÔNG ghi gì", d1.status === 200 && d1.json.valid === 3 && d1.json.willCreate === 2 && d1.json.willUpdate === 1 && (await prisma.admissionScore.count()) === 1, d1.json);
  const badText = [head, "ĐH Mới,Toán,,2025,thpt,26,30,https://moi.edu.vn/a,,,,", "ĐH Mới,Lý,,2025,thpt,99,30,https://moi.edu.vn/b,,,,", "ĐH Mới,Hoá,,2025,thpt,20,30,ftp://x.vn,,,,"].join("\n");
  const d2 = await im(badText);
  check("còn lỗi → 422, báo đúng dòng 3 và 4, và KHÔNG ghi dòng tốt (tất cả hoặc không)", d2.status === 422 && d2.json.errors.map((e: any) => e.line).join() === "3,4" && d2.json.valid === 1 && (await prisma.admissionScore.count()) === 1, d2.json);
  const real = await im(good);
  check("nhập thật: thêm 2, cập nhật 1", real.status === 200 && real.json.created === 2 && real.json.updated === 1 && (await prisma.admissionScore.count()) === 3, real.json);
  const upd = await prisma.admissionScore.findFirst({ where: { school: "ĐH Thử", year: 2025, variant: "" } });
  check("dòng cập nhật nhận điểm mới 29 + đã đối chiếu; ô published trống = công khai", upd?.score === 29 && upd.verified === true && upd.published === true && upd.sourceName === "Cập nhật", upd);
  check("ghi nhật ký nhập", (await prisma.auditLog.count({ where: { action: "admission_score.import", actorId: SA.id } })) === 1);
  check("thiếu text → 400; text không phải chuỗi → 400", (await api("POST", `${A}/import`, { as: SA, body: {} })).status === 400 && (await api("POST", `${A}/import`, { as: SA, body: { text: 5 } })).status === 400);
  const caseImp = await im([head, "đh thử,cntt,,2025,thpt,27,30,https://thu.edu.vn/chu-thuong,,,,"].join("\n"));
  check("nhập dòng chỉ khác hoa/thường với dòng có sẵn → CẬP NHẬT dòng đó (không tạo bản trùng)", caseImp.json.created === 0 && caseImp.json.updated === 1 && (await prisma.admissionScore.count({ where: { year: 2025, variant: "" } })) === 3, caseImp.json);
  await prisma.admissionScore.update({ where: { id: c1.json.id }, data: { score: 29, sourceName: "Cập nhật", school: "ĐH Thử", major: "CNTT", verified: true } });
  check("JSON cũng nhập được", (await im(JSON.stringify([row({ school: "ĐH JSON", score: 22 })]))).json.created === 1);

  section("Nạp dữ liệu khởi đầu: chỉ THÊM dòng còn thiếu, không đè chỉnh sửa");
  const sd1 = await api("POST", `${A}/seed`, { as: SA });
  check(`lần 1: thêm ${SEED_SCORES.length} dòng`, sd1.status === 200 && sd1.json.created === SEED_SCORES.length && sd1.json.skipped === 0, sd1.json);
  const firstSeed = SEED_SCORES[0];
  await prisma.admissionScore.updateMany({ where: { school: firstSeed.school, major: firstSeed.major, year: firstSeed.year }, data: { verified: true, score: 29.2, note: "đã sửa tay" } });
  const sd2 = await api("POST", `${A}/seed`, { as: SA });
  const kept = await prisma.admissionScore.findFirst({ where: { school: firstSeed.school, major: firstSeed.major, year: firstSeed.year } });
  check("lần 2: thêm 0, bỏ qua tất cả; dòng đã sửa tay và đã đối chiếu GIỮ NGUYÊN", sd2.json.created === 0 && sd2.json.skipped === SEED_SCORES.length && kept?.verified === true && kept.score === 29.2 && kept.note === "đã sửa tay", sd2.json);
  await prisma.admissionScore.deleteMany({ where: { school: { not: firstSeed.school } } });
  await prisma.admissionScore.updateMany({ where: { school: firstSeed.school, major: firstSeed.major, year: firstSeed.year }, data: { major: firstSeed.major.toUpperCase() } });
  const sd3 = await api("POST", `${A}/seed`, { as: SA });
  check("nạp lại khi dòng có sẵn chỉ khác hoa/thường → không nhân đôi dòng đó", sd3.json.skipped >= 1 && (await prisma.admissionScore.count({ where: { school: firstSeed.school, year: firstSeed.year, major: { in: [firstSeed.major, firstSeed.major.toUpperCase()] } } })) === 1, sd3.json);
  check("không nhân đôi dòng", (await prisma.admissionScore.count({ where: { school: firstSeed.school, year: firstSeed.year, major: { in: [firstSeed.major, firstSeed.major.toUpperCase()] } } })) === 1);

  section("Tổng kết quản lý");
  const g1 = await api("GET", A, { as: SA });
  check("tổng/công khai/đã đối chiếu khớp DB; usingSeed = false", g1.json.total === (await prisma.admissionScore.count()) && g1.json.published === g1.json.rows.filter((r: any) => r.published).length && g1.json.verified === g1.json.rows.filter((r: any) => r.verified).length && g1.json.usingSeed === false, [g1.json.total, g1.json.published, g1.json.verified]);
  check("API quản lý không bị cache công khai", !g1.headers.get("cache-control")?.includes("public"));
  done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
