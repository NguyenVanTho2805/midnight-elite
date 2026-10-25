// Hồ sơ học sinh của gia sư + sổ đồng ý dữ liệu trẻ (23/10/2026) — API thật.
// Kiểm: chưa đủ đồng ý thì KHÔNG lưu gì; đồng ý kép 7-15; 16+ tự đồng ý; thu hồi → che; quyền chặt (gia sư khác 403, không có 404);
// nhật ký sửa chỉ ghi TÊN trường; log máy chủ không chứa tên trẻ; trường tuỳ chỉnh; em tự đồng ý (selfConsentAt); công tắc vào lớp.
// Chạy (máy chủ dev đang bật ở BASE): source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-ho-so.ts
import { readFileSync, existsSync } from "node:fs";
import { prisma } from "@/lib/prisma";
import { deriveStatusForNewEnrollment } from "@/lib/enrollment";
import { api, check, done, mkCourse, mkTutor, mkUser, section, wipe } from "./h";

const stamp = Date.now().toString(36);
const NAME = `TENTRE${stamp}`; // tên trẻ thử, phải KHÔNG xuất hiện trong log máy chủ / nhật ký
const G = { guardian: true, scopes: ["basic"] };
const GC = { guardian: true, child: true, scopes: ["basic"] };
const GCX = { guardian: true, child: true, scopes: ["basic", "extended"] };

(async () => {
  await wipe();
  const A = await mkTutor("Gia sư A"), B = await mkTutor("Gia sư B");
  const cA = await mkCourse(A.id, { name: "Lớp của A" }), cB = await mkCourse(B.id, { name: "Lớp của B" });
  const S = await mkUser({ name: "Học sinh có tài khoản" }), S2 = await mkUser({ name: "Học sinh lớp khác" });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: cA.id, status: "active" } });
  await prisma.enrollment.create({ data: { userId: S2.id, courseId: cB.id, status: "active" } });
  const stu = await mkUser({ name: "Học sinh thường" });

  section("Đăng nhập và vai");
  check("chưa đăng nhập → 401", (await api("GET", "/api/tutor/ho-so")).status === 401);
  check("học sinh (không phải gia sư) → 403", (await api("GET", "/api/tutor/ho-so", { as: stu })).status === 403);
  check("học sinh không tạo được hồ sơ → 403", (await api("POST", "/api/tutor/ho-so", { as: stu, body: { name: NAME, ageGroup: "u7", consent: G } })).status === 403);

  section("Chưa đủ đồng ý ⇒ KHÔNG lưu gì (mặc định an toàn)");
  const none = await api("POST", "/api/tutor/ho-so", { as: A, body: { name: NAME, ageGroup: "u7" } });
  check("không có hộp đồng ý → 422 needsConsent, nêu bên còn thiếu", none.status === 422 && none.json?.needsConsent === true && none.json.missing?.join() === "guardian", none.json);
  check("… và DB không có hồ sơ nào", (await prisma.studentProfile.count()) === 0);
  const half = await api("POST", "/api/tutor/ho-so", { as: A, body: { name: NAME, ageGroup: "7to15", consent: G } });
  check("em 7-15 mà chỉ có phụ huynh → 422 thiếu 'child' (đồng ý kép)", half.status === 422 && half.json?.missing?.join() === "child", half.json);
  const noScope = await api("POST", "/api/tutor/ho-so", { as: A, body: { name: NAME, ageGroup: "u7", consent: { guardian: true } } });
  check("tích bên nhưng không chọn phạm vi → 422 thiếu phạm vi 'basic'", noScope.status === 422 && noScope.json?.scopesMissing?.includes("basic"));
  const strTrue = await api("POST", "/api/tutor/ho-so", { as: A, body: { name: NAME, ageGroup: "u7", consent: { guardian: "true", scopes: ["basic"] } } });
  check("'guardian':'true' (chuỗi) KHÔNG tính là đã tích", strTrue.status === 422);
  const ext = await api("POST", "/api/tutor/ho-so", { as: A, body: { name: NAME, ageGroup: "u7", address: "Số 1 đường thử", consent: G } });
  check("có địa chỉ (mở rộng) mà phạm vi chỉ 'basic' → 422 thiếu 'extended'", ext.status === 422 && ext.json?.scopesMissing?.join() === "extended", ext.json);
  const adultWrong = await api("POST", "/api/tutor/ho-so", { as: A, body: { name: NAME, ageGroup: "16plus", consent: G } });
  check("người học 16+ mà chỉ có đồng ý của phụ huynh → 422 thiếu 'self'", adultWrong.status === 422 && adultWrong.json?.missing?.join() === "self", adultWrong.json);
  const conflict = await api("POST", "/api/tutor/ho-so", { as: A, body: { name: NAME, ageGroup: "16plus", birthDate: "2016-05-01", consent: { self: true, scopes: ["basic", "extended"] } } });
  check("khai 16+ nhưng ngày sinh 10 tuổi → vẫn đòi phụ huynh + em (ngày sinh quyết định)", conflict.status === 422 && conflict.json?.missing?.join() === "guardian,child", conflict.json);
  check("sau mọi lần bị từ chối: vẫn KHÔNG có hồ sơ và KHÔNG có dòng đồng ý nào", (await prisma.studentProfile.count()) === 0 && (await prisma.consentRecord.count()) === 0);
  check("dữ liệu sai (tên trống) → 400, không đụng tới đồng ý", (await api("POST", "/api/tutor/ho-so", { as: A, body: { name: " ", ageGroup: "u7", consent: G } })).status === 400);

  section("Tạo hồ sơ có đồng ý — ghi vết ai, khi nào, phạm vi, phiên bản chữ");
  const ok1 = await api("POST", "/api/tutor/ho-so", { as: A, body: { name: NAME, ageGroup: "7to15", courseId: cA.id, guardianName: "Cô Lan", guardianPhone: "0912345678", consent: GC } });
  check("7-15 tuổi, phụ huynh + em, phạm vi cơ bản → 201", ok1.status === 201 && !!ok1.json?.id, ok1.json);
  const pid = ok1.json?.id as string;
  const recs = await prisma.consentRecord.findMany({ where: { subjectId: pid }, orderBy: { party: "asc" } });
  check("2 dòng đồng ý: child + guardian, đều tutor_attestation, người bấm = gia sư A, có phiên bản chữ + giờ", recs.length === 2 && recs.every(r => r.method === "tutor_attestation" && r.givenById === A.id && r.givenByRole === "tutor" && /^\d{4}-/.test(r.textVersion) && r.scopes.join() === "basic" && !r.revokedAt && !!r.grantedAt) && recs.map(r => r.party).join() === "child,guardian", recs);
  check("dòng đồng ý KHÔNG chứa tên / số của trẻ", !JSON.stringify(recs).includes(NAME) && !JSON.stringify(recs).includes("0912345678"));
  const u7 = await api("POST", "/api/tutor/ho-so", { as: A, body: { name: `${NAME}-bé`, ageGroup: "u7", consent: G } });
  const adult = await api("POST", "/api/tutor/ho-so", { as: A, body: { name: `${NAME}-lớn`, ageGroup: "16plus", consent: { self: true, scopes: ["basic"] } } });
  check("dưới 7 chỉ cần phụ huynh → 201; 16+ chỉ cần self → 201", u7.status === 201 && adult.status === 201);
  const withExt = await api("POST", "/api/tutor/ho-so", { as: A, body: { name: `${NAME}-mr`, ageGroup: "7to15", birthDate: "2014-05-01", phone: "0987654321", subjects: ["Toán"], notes: "ghi chú thử", consent: GCX } });
  check("có thông tin mở rộng + phạm vi extended → 201", withExt.status === 201, withExt.json);
  const extId = withExt.json?.id as string;

  section("Che theo đồng ý khi đọc");
  const list = await api("GET", "/api/tutor/ho-so", { as: A });
  const byId = (id: string) => (list.json?.profiles ?? []).find((p: { id: string }) => p.id === id);
  check("danh sách của A có 4 hồ sơ, kèm giới hạn cấu hình", list.status === 200 && list.json.profiles.length === 4 && list.json.limits.customFields >= 0 && list.json.limits.importRows >= 1, list.json?.limits);
  check("hồ sơ cơ bản: thấy tên + phụ huynh, KHÔNG có trường mở rộng", byId(pid)?.consentLevel === "basic_only" && byId(pid)?.guardianPhone === "0912345678" && !("birthDate" in byId(pid)) && !("notes" in byId(pid)));
  check("hồ sơ có extended: thấy ngày sinh, SĐT em, ghi chú", byId(extId)?.consentLevel === "full" && byId(extId)?.birthDate === "2014-05-01" && byId(extId)?.phone === "0987654321" && byId(extId)?.notes === "ghi chú thử");
  check("loại Con/Người lớn: nhóm 16+ → adult, còn lại → child (HS-11)", byId(adult.json.id)?.consent?.kind === "adult" && byId(pid)?.consent?.kind === "child");

  section("Phân quyền: gia sư khác 403, không có 404, API tổng hợp không lộ chéo");
  const lB = await api("GET", "/api/tutor/ho-so", { as: B });
  check("gia sư B không thấy hồ sơ nào của A", lB.status === 200 && lB.json.profiles.length === 0 && !lB.text.includes(NAME));
  for (const [m, path, body] of [["GET", `/api/tutor/ho-so/${pid}`], ["PATCH", `/api/tutor/ho-so/${pid}`, { notes: "x", consent: GCX }], ["DELETE", `/api/tutor/ho-so/${pid}`], ["POST", `/api/tutor/ho-so/${pid}/dong-y`, GCX], ["POST", `/api/tutor/ho-so/${pid}/thu-hoi`, { party: "guardian" }]] as const) {
    const r = await api(m, path, { as: B, body });
    check(`B ${m} ${path.replace(pid, ":id")} → 403 và không lộ tên`, r.status === 403 && !r.text.includes(NAME), r.status);
  }
  check("hồ sơ KHÔNG tồn tại → 404", (await api("GET", "/api/tutor/ho-so/khong-co", { as: A })).status === 404 && (await api("DELETE", "/api/tutor/ho-so/khong-co", { as: A })).status === 404);
  check("sau các lần B thử: hồ sơ của A còn nguyên, đồng ý chưa bị đổi", (await prisma.studentProfile.count({ where: { id: pid } })) === 1 && (await prisma.consentRecord.count({ where: { subjectId: pid, revokedAt: null } })) === 2);
  const bCourse = await api("POST", "/api/tutor/ho-so", { as: A, body: { name: `${NAME}-x`, ageGroup: "u7", courseId: cB.id, consent: G } });
  check("gắn hồ sơ vào lớp của gia sư KHÁC → 403, không lưu", bCourse.status === 403 && (await prisma.studentProfile.count({ where: { name: `${NAME}-x` } })) === 0);
  const notMine = await api("POST", "/api/tutor/ho-so", { as: A, body: { name: `${NAME}-y`, ageGroup: "16plus", userId: S2.id, consent: { self: true, scopes: ["basic"] } } });
  check("ghi hồ sơ riêng về em KHÔNG học lớp của mình → 403", notMine.status === 403);
  const fam = await prisma.familyGroup.create({ data: { tutorId: B.id, label: "Gia đình của B" } });
  const famX = await api("POST", "/api/tutor/ho-so", { as: A, body: { name: `${NAME}-z`, ageGroup: "u7", familyId: fam.id, consent: { guardian: true, scopes: ["basic", "family"] } } });
  check("gắn vào gia đình của gia sư khác → 403", famX.status === 403);

  section("Em có tài khoản: hồ sơ riêng của gia sư, tự đồng ý (selfConsentAt) thay phần của em");
  await prisma.user.update({ where: { id: S.id }, data: { dateOfBirth: new Date("2014-05-01T00:00:00Z") } }); // 12 tuổi
  const noSelf = await api("POST", "/api/tutor/ho-so", { as: A, body: { name: NAME + "-tk", ageGroup: "7to15", userId: S.id, consent: G } });
  check("em 12 tuổi chưa tự đồng ý, chỉ có phụ huynh → 422 thiếu child", noSelf.status === 422 && noSelf.json?.missing?.join() === "child");
  check("em chưa đăng nhập → API tự đồng ý 401", (await api("POST", "/api/users/me/self-consent", { body: { agree: true } })).status === 401);
  check("em không tích 'agree' → 400", (await api("POST", "/api/users/me/self-consent", { as: S, body: {} })).status === 400);
  const sc = await api("POST", "/api/users/me/self-consent", { as: S, body: { agree: true } });
  check("em tự đồng ý → ghi selfConsentAt", sc.status === 200 && !!(await prisma.user.findUnique({ where: { id: S.id }, select: { selfConsentAt: true } }))?.selfConsentAt);
  const linked = await api("POST", "/api/tutor/ho-so", { as: A, body: { name: NAME + "-tk", ageGroup: "7to15", userId: S.id, consent: G } });
  check("giờ chỉ cần phụ huynh (xác nhận của gia sư) → 201", linked.status === 201, linked.json);
  const lrecs = await prisma.consentRecord.findMany({ where: { subjectId: linked.json?.id } });
  check("chỉ ghi dòng 'guardian' (phần em nằm ở tài khoản của em)", lrecs.length === 1 && lrecs[0].party === "guardian");
  check("tạo lần hai cho cùng em → 409 (mỗi gia sư một hồ sơ riêng cho một em)", (await api("POST", "/api/tutor/ho-so", { as: A, body: { name: NAME + "-tk", ageGroup: "7to15", userId: S.id, consent: G } })).status === 409);
  await api("DELETE", "/api/users/me/self-consent", { as: S });
  const afterRevokeSelf = (await api("GET", "/api/tutor/ho-so", { as: A })).json.profiles.find((p: { id: string }) => p.id === linked.json.id);
  check("em thu hồi tự đồng ý → hồ sơ về em bị KHOÁ ngay (chỉ còn tên)", afterRevokeSelf?.consentLevel === "locked" && !("guardianPhone" in afterRevokeSelf));
  check("hồ sơ riêng KHÔNG đổi dữ liệu tài khoản của em", (await prisma.user.findUnique({ where: { id: S.id }, select: { name: true, phone: true, parentPhone: true } }))?.name === "Học sinh có tài khoản");

  section("Sửa hồ sơ (HS-03): cần đồng ý, nhật ký chỉ ghi TÊN trường");
  const pe1 = await api("PATCH", `/api/tutor/ho-so/${pid}`, { as: A, body: { phone: "0987000111" } });
  check("sửa SĐT em (mở rộng) khi hồ sơ chỉ có phạm vi cơ bản → 422 thiếu 'extended'", pe1.status === 422 && pe1.json?.scopesMissing?.join() === "extended", pe1.json);
  const pe2 = await api("PATCH", `/api/tutor/ho-so/${pid}`, { as: A, body: { phone: "0987000111", address: "Số 99 phố Bí Mật", consent: GCX } });
  check("kèm xác nhận thêm phạm vi extended → 200, ghi nhận các trường đổi", pe2.status === 200 && pe2.json.changed.join() === "phone,address", pe2.json);
  check("hồ sơ cập nhật thật", (await prisma.studentProfile.findUnique({ where: { id: pid } }))?.phone === "0987000111");
  const logs = await prisma.auditLog.findMany({ where: { resourceType: "StudentProfile" } });
  const logText = JSON.stringify(logs);
  check("nhật ký có các sự kiện tạo / đồng ý / sửa", ["student_profile.create", "student_profile.consent", "student_profile.update"].every(a => logs.some(l => l.action === a)));
  check("nhật ký KHÔNG chứa tên trẻ, SĐT, địa chỉ, phụ huynh — chỉ tên trường", !logText.includes(NAME) && !logText.includes("0987000111") && !logText.includes("Bí Mật") && !logText.includes("0912345678") && !logText.includes("Cô Lan"));
  const upd = logs.find(l => l.action === "student_profile.update" && l.resourceId === pid);
  check("sự kiện sửa ghi đúng tên trường đã đổi", JSON.stringify(upd?.metadata) === JSON.stringify({ fields: ["phone", "address"] }), upd?.metadata);
  const det = await api("GET", `/api/tutor/ho-so/${pid}`, { as: A });
  check("GET chi tiết có nhật ký sửa + sổ đồng ý (4 dòng: 2 cơ bản + 2 thêm extended)", det.status === 200 && det.json.editLog.some((e: { action: string; fields: string[] }) => e.action === "student_profile.update" && e.fields.join() === "phone,address") && det.json.ledger.length === 4, det.json?.ledger?.length);
  check("sửa không đổi gì → 200, không ghi thêm nhật ký sửa", (await api("PATCH", `/api/tutor/ho-so/${pid}`, { as: A, body: { phone: "0987000111" } })).json?.changed.length === 0 && (await prisma.auditLog.count({ where: { resourceId: pid, action: "student_profile.update" } })) === 1);
  const toU7 = await api("PATCH", `/api/tutor/ho-so/${extId}`, { as: A, body: { birthDate: "2025-01-01" } });
  check("đổi ngày sinh thành em 1 tuổi: nhóm khai 7to15 vẫn nghiêm hơn nên đủ đồng ý cũ → 200", toU7.status === 200);
  const grow = await api("PATCH", `/api/tutor/ho-so/${extId}`, { as: A, body: { ageGroup: "16plus", birthDate: "2008-01-01" } });
  check("đổi sang người lớn 16+ khi chưa có đồng ý của chính người đó → 422 thiếu 'self'", grow.status === 422 && grow.json?.missing?.join() === "self", grow.json);
  check("tên trường tuỳ chỉnh lạ / courseId của gia sư khác khi sửa → 400 / 403", (await api("PATCH", `/api/tutor/ho-so/${pid}`, { as: A, body: { customData: { lạ: "x" }, consent: GCX } })).status === 400 && (await api("PATCH", `/api/tutor/ho-so/${pid}`, { as: A, body: { courseId: cB.id } })).status === 403);

  section("Thu hồi đồng ý → che hồ sơ, không ghi thêm, giữ vết");
  const rv = await api("POST", `/api/tutor/ho-so/${pid}/thu-hoi`, { as: A, body: { party: "guardian", cause: "guardian_request" } });
  check("thu hồi bên phụ huynh → 200", rv.status === 200 && rv.json.revoked >= 1, rv.json);
  const locked = (await api("GET", "/api/tutor/ho-so", { as: A })).json.profiles.find((p: { id: string }) => p.id === pid);
  check("hồ sơ bị KHOÁ: chỉ còn id + tên + nhãn", locked.consentLevel === "locked" && !("guardianPhone" in locked) && !("phone" in locked) && !JSON.stringify(locked).includes("0912345678"));
  const lockedDetail = await api("GET", `/api/tutor/ho-so/${pid}`, { as: A });
  check("GET chi tiết khi khoá cũng không lộ trường nào", !JSON.stringify(lockedDetail.json.profile).includes("0987000111") && !JSON.stringify(lockedDetail.json.profile).includes("Bí Mật"));
  check("khoá thì KHÔNG sửa được (422), kể cả chỉ đổi trạng thái", (await api("PATCH", `/api/tutor/ho-so/${pid}`, { as: A, body: { status: "inactive" } })).status === 422);
  check("thu hồi lần nữa khi không còn gì để thu hồi → 409", (await api("POST", `/api/tutor/ho-so/${pid}/thu-hoi`, { as: A, body: { party: "guardian" } })).status === 409);
  check("thu hồi thiếu 'party' → 400", (await api("POST", `/api/tutor/ho-so/${pid}/thu-hoi`, { as: A, body: {} })).status === 400);
  check("vết còn nguyên: dòng cũ KHÔNG bị xoá, có revokedAt + lý do", await (async () => { const r = await prisma.consentRecord.findMany({ where: { subjectId: pid, party: "guardian" } }); return r.length === 2 && r.every(x => !!x.revokedAt && x.revokeCause === "guardian_request" && x.revokedById === A.id); })());
  const re = await api("POST", `/api/tutor/ho-so/${pid}/dong-y`, { as: A, body: GCX });
  check("đồng ý lại (dòng MỚI) → mở khoá", re.status === 200 && (await api("GET", "/api/tutor/ho-so", { as: A })).json.profiles.find((p: { id: string }) => p.id === pid).consentLevel === "full");
  check("đồng ý lại KHÔNG tích gì → 400; tích bên không thuộc nhóm tuổi (self cho em 7-15) → 422", (await api("POST", `/api/tutor/ho-so/${pid}/dong-y`, { as: A, body: { scopes: ["basic"] } })).status === 400 && (await api("POST", `/api/tutor/ho-so/${pid}/dong-y`, { as: A, body: { self: true, scopes: ["basic"] } })).status === 422);

  section("Xoá hẳn hồ sơ (quyền xoá)");
  const del = await api("DELETE", `/api/tutor/ho-so/${pid}`, { as: A });
  check("xoá → 200, hồ sơ biến mất", del.status === 200 && (await prisma.studentProfile.count({ where: { id: pid } })) === 0);
  check("dòng đồng ý còn lại được thu hồi với lý do profile_deleted (giữ vết, không còn hiệu lực)", await (async () => { const r = await prisma.consentRecord.findMany({ where: { subjectId: pid } }); return r.length > 0 && r.every(x => !!x.revokedAt) && r.some(x => x.revokeCause === "profile_deleted"); })());
  check("xoá lần hai → 404", (await api("DELETE", `/api/tutor/ho-so/${pid}`, { as: A })).status === 404);

  section("Trường tuỳ chỉnh (LO-18)");
  const mkF = (label: string, as = A) => api("POST", "/api/tutor/truong-tuy-chinh", { as, body: { label } });
  const f1 = await mkF("Lớp ở trường"), f2 = await mkF("Sở thích"), f3 = await mkF("Ghi chú phụ");
  check("tạo 3 trường (mặc định tối đa 3) → 201", f1.status === 201 && f2.status === 201 && f3.status === 201);
  check("trường thứ 4 → 409 nêu số tối đa", (await mkF("Thêm nữa")).status === 409 && ((await mkF("Thêm nữa")).json?.error ?? "").includes("3"));
  check("trùng tên (không phân biệt hoa thường) → 409", (await mkF("lớp Ở trường")).status === 409);
  check("tên rỗng → 400", (await mkF("  ")).status === 400);
  check("gia sư B có danh sách riêng, không thấy trường của A", (await api("GET", "/api/tutor/truong-tuy-chinh", { as: B })).json.fields.length === 0);
  const cf = await api("POST", "/api/tutor/ho-so", { as: A, body: { name: `${NAME}-cf`, ageGroup: "u7", customData: { [f1.json.field.id]: "6A" }, consent: { guardian: true, scopes: ["basic", "extended"] } } });
  check("lưu giá trị trường tuỳ chỉnh (cần phạm vi extended) → 201", cf.status === 201);
  const bUse = await api("POST", "/api/tutor/ho-so", { as: B, body: { name: `${NAME}-b`, ageGroup: "u7", customData: { [f1.json.field.id]: "lậu" }, consent: { guardian: true, scopes: ["basic", "extended"] } } });
  check("B dùng id trường tuỳ chỉnh của A → 400 (không lưu im lặng)", bUse.status === 400);
  check("B xoá trường của A → 403", (await api("DELETE", `/api/tutor/truong-tuy-chinh?id=${f1.json.field.id}`, { as: B })).status === 403);
  check("xoá trường → xoá luôn giá trị đã nhập ở các hồ sơ", (await api("DELETE", `/api/tutor/truong-tuy-chinh?id=${f1.json.field.id}`, { as: A })).status === 200 && (await prisma.studentProfile.findUnique({ where: { id: cf.json.id } }))?.customData === null);

  section("Công tắc vào lớp KIN_ENROLL_CONSENT_GATE (mặc định tắt)");
  const kid = await mkUser({ name: "Em nhỏ" });
  await prisma.user.update({ where: { id: kid.id }, data: { dateOfBirth: new Date("2016-01-01T00:00:00Z") } });
  delete process.env.KIN_ENROLL_CONSENT_GATE;
  check("tắt → active", (await deriveStatusForNewEnrollment(kid.id)) === "active");
  process.env.KIN_ENROLL_CONSENT_GATE = "1";
  check("bật + em 10 tuổi chưa có ParentConsent duyệt → pending_consent", (await deriveStatusForNewEnrollment(kid.id)) === "pending_consent");
  const par = await mkUser({ name: "Phụ huynh" });
  const link = await prisma.parentLink.create({ data: { parentId: par.id, studentId: kid.id, status: "verified", verifiedAt: new Date() } });
  await prisma.parentConsent.create({ data: { parentLinkId: link.id, token: "tk-" + stamp, status: "approved", contentVersion: "t", expiresAt: new Date(Date.now() + 1e6), respondedAt: new Date() } });
  check("bật + phụ huynh đã duyệt → active", (await deriveStatusForNewEnrollment(kid.id)) === "active");
  check("bật + người dùng không có ngày sinh → active", (await deriveStatusForNewEnrollment(stu.id)) === "active");
  delete process.env.KIN_ENROLL_CONSENT_GATE;

  section("Log máy chủ không chứa dữ liệu của trẻ");
  const logFile = `/tmp/kin-dev-${process.env.PORT ?? "3621"}.log`;
  if (existsSync(logFile)) {
    const log = readFileSync(logFile, "utf8");
    check(`log dev (${logFile}) không có tên trẻ thử / số phụ huynh / địa chỉ`, !log.includes(NAME) && !log.includes("0912345678") && !log.includes("Bí Mật"));
  } else check("không có tệp log dev để quét (bỏ qua)", true);

  await done();
})();
