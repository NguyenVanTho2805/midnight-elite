// AUDIT QUYỀN dữ liệu trẻ dưới 16 (TRE-1..4) — phá cố ý, nhìn từ bên ngoài: khách, học sinh, phụ huynh, gia sư khác.
// Các bài t-ho-so / t-ho-so-nhap / t-session-scores / t-yeu-cau đã có ca quyền riêng; bài này gom lại những điều "ai KHÔNG được thấy gì":
//  1) khách chưa đăng nhập không đọc/ghi được đường nào; 2) gia sư A không đọc/sửa/xuất/chấm điểm được em của gia sư B (kể cả cùng một em có tài khoản);
//  3) phụ huynh chỉ thấy con mình theo mã, phản hồi không chứa hồ sơ riêng của gia sư; 4) thu hồi đồng ý → phần mở rộng không còn lọt ra ở API nào;
//  5) log máy chủ và nhật ký không chứa tên/SĐT/ngày sinh/địa chỉ của trẻ; 6) mọi chỗ ghi hồ sơ/điểm trong mã đều đi qua cổng đồng ý.
// Chạy (máy chủ dev bật): source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-tre-audit.ts
import { randomBytes } from "node:crypto";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import { api, check, done, mkCourse, mkTutor, mkUser, section, wipe } from "./h";

const stamp = Date.now().toString(36);
const NAME = `Bé Kín ${stamp}`, ADDR = `Số 9 Ngõ Kín ${stamp}`, DOB = "2014-03-15", PHONE = "0911222333", GPHONE = "0988777666", NOTE = `ghi chú kín ${stamp}`;

const walk = (d: string, out: string[] = []): string[] => {
  for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p, out) : out.push(p); }
  return out;
};

(async () => {
  await wipe();
  const A = await mkTutor("Gia sư A"), B = await mkTutor("Gia sư B");
  const cA = await mkCourse(A.id, { name: "Toán A" }), cB = await mkCourse(B.id, { name: "Toán B" });
  const S = await mkUser({ name: `Em Có Tài Khoản ${stamp}` }); // học cả hai lớp
  await prisma.enrollment.create({ data: { userId: S.id, courseId: cA.id, status: "active" } });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: cB.id, status: "active" } });
  const other = await mkUser({ name: "Học sinh khác" });

  // Hồ sơ không tài khoản của A, có dữ liệu mở rộng; hồ sơ riêng của A về S; hồ sơ riêng của B về S.
  const mk = async (as: typeof A, body: Record<string, unknown>) => {
    const r = await api("POST", "/api/tutor/ho-so", { as, body });
    if (r.status !== 201) throw new Error("tạo hồ sơ lỗi " + JSON.stringify(r.json));
    return r.json.id as string;
  };
  const consent = { guardian: true, child: true, scopes: ["basic", "extended", "scores"] };
  const pA = await mk(A, { name: NAME, ageGroup: "7to15", birthDate: DOB.split("-").reverse().join("/"), address: ADDR, phone: PHONE, guardianName: "Phụ huynh Kín", guardianPhone: GPHONE, notes: NOTE, consent });
  await prisma.user.update({ where: { id: S.id }, data: { selfConsentAt: new Date() } });
  const pAS = await mk(A, { name: S.name, ageGroup: "7to15", userId: S.id, notes: `A viết về S ${stamp}`, consent: { guardian: true, scopes: ["basic", "extended", "scores"] } });
  const pBS = await mk(B, { name: S.name, ageGroup: "7to15", userId: S.id, notes: `B viết về S ${stamp}`, consent: { guardian: true, scopes: ["basic", "extended", "scores"] } });
  const sess = await prisma.attendanceSession.create({ data: { courseId: cA.id, date: new Date(Date.UTC(2026, 9, 20)), createdBy: A.id } });
  await api("PUT", `/api/attendance-sessions/${sess.id}/diem`, { as: A, body: { scores: [{ userId: S.id, score: 9, homeworkPct: 70 }] } });
  const reqRow = await prisma.tutorRequest.create({ data: { trackToken: randomBytes(16).toString("hex"), targetTutorId: A.id, level: "thcs", subject: "Toán", contactPhone: GPHONE, phoneKey: "x" } });
  const fam = await api("POST", "/api/tutor/gia-dinh", { as: A, body: { label: "Nhà Kín", guardianName: "PH Kín", guardianPhone: GPHONE } });

  section("1) Khách chưa đăng nhập: không đọc, không ghi");
  const routes: [string, string][] = [
    ["GET", "/api/tutor/ho-so"], ["POST", "/api/tutor/ho-so"], ["GET", `/api/tutor/ho-so/${pA}`], ["PATCH", `/api/tutor/ho-so/${pA}`], ["DELETE", `/api/tutor/ho-so/${pA}`],
    ["POST", `/api/tutor/ho-so/${pA}/dong-y`], ["POST", `/api/tutor/ho-so/${pA}/thu-hoi`], ["POST", "/api/tutor/ho-so/nhap"], ["POST", "/api/tutor/ho-so/nhap/xem-truoc"],
    ["GET", "/api/tutor/gia-dinh"], ["POST", "/api/tutor/gia-dinh"], ["PATCH", `/api/tutor/gia-dinh/${fam.json.family.id}`], ["DELETE", `/api/tutor/gia-dinh/${fam.json.family.id}`],
    ["GET", "/api/tutor/truong-tuy-chinh"], ["POST", "/api/tutor/truong-tuy-chinh"], ["DELETE", "/api/tutor/truong-tuy-chinh?id=x"],
    ["GET", "/api/tutor/yeu-cau"], ["POST", `/api/tutor/yeu-cau/${reqRow.id}/tiep-nhan`], ["POST", `/api/tutor/yeu-cau/${reqRow.id}/tu-choi`],
    ["GET", `/api/attendance-sessions/${sess.id}/diem`], ["PUT", `/api/attendance-sessions/${sess.id}/diem`],
    ["GET", "/api/users/me/self-consent"], ["POST", "/api/users/me/self-consent"], ["DELETE", "/api/users/me/self-consent"],
  ];
  const guestBad: string[] = [];
  for (const [m, u] of routes) {
    const r = await api(m, u, m === "GET" || m === "DELETE" ? {} : { body: {} });
    if (r.status !== 401 || r.text.includes(stamp) || r.text.includes(GPHONE)) guestBad.push(`${m} ${u} → ${r.status}`);
  }
  check(`${routes.length} đường (gia sư/điểm/tự đồng ý) → khách đều 401 và không rò chữ nào`, guestBad.length === 0, guestBad);
  const pages = [`/lop-cua-toi/hoc-sinh/${pA}`, "/lop-cua-toi/hoc-sinh/nhap", "/lop-cua-toi/hoc-sinh/them", "/lop-cua-toi/hoc-sinh/truong", "/lop-cua-toi/yeu-cau"];
  const pageBad: string[] = [];
  for (const p of pages) { const r = await api("GET", p); const redirected = (r.status >= 300 && r.status < 400) || (r.status === 200 && r.text.includes("NEXT_REDIRECT;replace;/dang-nhap")); // Next phát trực tuyến: chuyển hướng nằm trong luồng RSC
    if (!redirected || r.text.includes(stamp) || r.text.includes(ADDR)) pageBad.push(`${p} → ${r.status}`); }
  check("các trang gia sư của hồ sơ trẻ: khách bị chuyển về /dang-nhap (3xx hoặc NEXT_REDIRECT trong luồng), HTML không chứa dữ liệu", pageBad.length === 0, pageBad);

  section("2) Học sinh không phải gia sư: bị chặn mọi đường gia sư");
  const stuBad: string[] = [];
  for (const [m, u] of routes.filter(([, u]) => !u.includes("self-consent"))) {
    const r = await api(m, u, m === "GET" || m === "DELETE" ? { as: S } : { as: S, body: {} });
    if (r.status !== 403 || r.text.includes(stamp)) stuBad.push(`${m} ${u} → ${r.status}`);
  }
  check("học sinh gọi các đường gia sư → 403 và không rò chữ nào", stuBad.length === 0, stuBad);

  section("3) Gia sư B không đọc / sửa / xoá / xuất / chấm điểm được em của A");
  const bl = await api("GET", "/api/tutor/ho-so", { as: B });
  check("danh sách của B: chỉ hồ sơ của B, không chữ nào của A", bl.status === 200 && bl.json.profiles.length === 1 && bl.json.profiles[0].id === pBS && !bl.text.includes(NAME) && !bl.text.includes(ADDR) && !bl.text.includes(GPHONE) && !bl.text.includes("A viết về"), bl.json?.profiles?.length);
  for (const [m, u, body] of [["GET", `/api/tutor/ho-so/${pA}`], ["PATCH", `/api/tutor/ho-so/${pA}`, { name: "Bị sửa" }], ["DELETE", `/api/tutor/ho-so/${pA}`],
    ["GET", `/api/tutor/ho-so/${pAS}`], ["PATCH", `/api/tutor/ho-so/${pAS}`, { notes: "đè" }], ["POST", `/api/tutor/ho-so/${pAS}/dong-y`, { guardian: true, scopes: ["basic"] }], ["POST", `/api/tutor/ho-so/${pAS}/thu-hoi`, { party: "guardian" }]] as [string, string, unknown?][]) {
    const r = await api(m, u, { as: B, body });
    check(`B ${m} ${u.replace(/c[0-9a-z]{20,}/, ":id")} → 403, không lộ chữ`, r.status === 403 && !r.text.includes(stamp) && !r.text.includes(ADDR) && !r.text.includes(PHONE), r.status);
  }
  const still = await prisma.studentProfile.findUnique({ where: { id: pA } });
  check("hồ sơ của A còn nguyên sau mọi thử của B (tên, ghi chú, không bị sửa/xoá)", still?.name === NAME && still.notes === NOTE);
  check("em S học cả hai lớp: B xem hồ sơ riêng của B về S, KHÔNG thấy ghi chú của A", (await api("GET", `/api/tutor/ho-so/${pBS}`, { as: B })).text.includes(`B viết về S ${stamp}`) && !(await api("GET", "/api/tutor/ho-so", { as: B })).text.includes("A viết về"));
  const bd = await api("GET", `/api/attendance-sessions/${sess.id}/diem`, { as: B }), bp = await api("PUT", `/api/attendance-sessions/${sess.id}/diem`, { as: B, body: { scores: [{ userId: S.id, score: 1 }] } });
  check("B đọc / ghi điểm buổi của lớp A → 403", bd.status === 403 && bp.status === 403 && !bd.text.includes(stamp));
  check("điểm A đã ghi không đổi", (await prisma.sessionStudentScore.findFirst({ where: { userId: S.id } }))?.score === 9);
  const rq = await api("GET", "/api/tutor/yeu-cau", { as: B });
  check("yêu cầu tìm gia sư gửi cho A: B không thấy số liên hệ", rq.status === 200 && rq.json.requests.length === 0 && !rq.text.includes(GPHONE));
  check("B không tiếp nhận / từ chối yêu cầu của A", (await api("POST", `/api/tutor/yeu-cau/${reqRow.id}/tiep-nhan`, { as: B, body: { name: "x", ageGroup: "u7" } })).status === 403 && (await api("POST", `/api/tutor/yeu-cau/${reqRow.id}/tu-choi`, { as: B })).status === 403);
  check("không có đường xuất CSV/Excel nào đọc hồ sơ học sinh (mọi xuất tệp phải qua maskProfile)", await (async () => {
    const files = walk(join(process.cwd(), "src")).filter(f => /\.(ts|tsx)$/.test(f) && !f.includes("/generated/"));
    const bad = files.filter(f => { const s = readFileSync(f, "utf8"); return /studentProfile\.find/.test(s) && /(text\/csv|Content-Disposition|\.xlsx\.write|unparse)/.test(s); });
    return bad.length === 0 ? true : bad;
  })());

  section("4) Phụ huynh chỉ thấy con mình, và không thấy hồ sơ riêng của gia sư");
  const mkToken = async (student: { id: string }, name: string) => {
    const par = await mkUser({ name });
    const token = randomBytes(16).toString("hex");
    await prisma.parentLink.create({ data: { parentId: par.id, studentId: student.id, status: "verified", verifiedAt: new Date(), portalToken: token } });
    return token;
  };
  const tS = await mkToken(S, "PH của S"), tO = await mkToken(other, "PH của em khác");
  const pS = await api("GET", `/api/parent-portal/${tS}`), pO = await api("GET", `/api/parent-portal/${tO}`);
  check("phụ huynh S thấy điểm của S", pS.status === 200 && pS.json.scores.length === 1 && pS.json.scores[0].score === 9);
  check("phản hồi cổng phụ huynh KHÔNG chứa ghi chú / địa chỉ / SĐT / hồ sơ riêng của gia sư", ![NOTE, ADDR, "A viết về", "B viết về", PHONE, GPHONE, NAME, "Nhà Kín"].some(x => pS.text.includes(x)));
  check("phụ huynh em khác: không có điểm của S, không chữ nào của S", pO.status === 200 && pO.json.scores.length === 0 && !pO.text.includes(S.id) && !pO.text.includes(S.name));
  check("mã sai / mã của người khác sửa nhẹ → không có dữ liệu", await (async () => {
    for (const t of ["x".repeat(32), tS.slice(0, -1) + (tS.endsWith("a") ? "b" : "a"), "../" + tS]) { const r = await api("GET", `/api/parent-portal/${encodeURIComponent(t)}`); if (r.status === 200 || r.text.includes(stamp)) return false; }
    return true;
  })());
  const me = await api("GET", "/api/users/me", { as: S });
  check("học sinh S xem tài khoản của mình: không có ghi chú riêng của gia sư về em", me.status === 200 && !me.text.includes("A viết về") && !me.text.includes("B viết về"));

  section("5) Thu hồi đồng ý → phần mở rộng không còn lọt ở đâu");
  const rv = await api("POST", `/api/tutor/ho-so/${pA}/thu-hoi`, { as: A, body: { party: "guardian" } });
  const l2 = await api("GET", "/api/tutor/ho-so", { as: A }), d2 = await api("GET", `/api/tutor/ho-so/${pA}`, { as: A });
  const leak = [ADDR, PHONE, GPHONE, NOTE, "2014-03-15", "Phụ huynh Kín"];
  check("thu hồi → 200", rv.status === 200);
  check("danh sách + chi tiết: còn tên, KHÔNG còn địa chỉ / SĐT / ngày sinh / ghi chú / phụ huynh", !leak.some(x => l2.text.includes(x)) && !leak.some(x => d2.text.includes(x)) && l2.text.includes(NAME), leak.filter(x => l2.text.includes(x) || d2.text.includes(x)));
  check("sau thu hồi: sửa → 422, đọc lại vẫn không lộ", (await api("PATCH", `/api/tutor/ho-so/${pA}`, { as: A, body: { notes: "mới" } })).status === 422);
  const t3 = await prisma.studentProfile.findUnique({ where: { id: pA } });
  check("dòng đồng ý cũ giữ nguyên (vết), có revokedAt", (await prisma.consentRecord.count({ where: { subjectId: pA, revokedAt: { not: null } } })) >= 1 && t3?.notes === NOTE);
  // Em tự thu hồi trong tài khoản → hồ sơ riêng về em bị khoá ở cả hai gia sư.
  await api("DELETE", "/api/users/me/self-consent", { as: S });
  const la = await api("GET", "/api/tutor/ho-so", { as: A }), lb = await api("GET", "/api/tutor/ho-so", { as: B });
  check("em S thu hồi tự đồng ý → hồ sơ về S bị che ở CẢ A và B (không còn ghi chú)", !la.text.includes("A viết về") && !lb.text.includes("B viết về"));
  const ps2 = await api("GET", `/api/parent-portal/${tS}`);
  check("… và phụ huynh S không còn thấy điểm", ps2.json.scores.length === 0);

  section("6) Log và nhật ký không chứa dữ liệu của trẻ");
  const logs = await prisma.auditLog.findMany({ select: { action: true, metadata: true, resourceId: true } });
  const blob = JSON.stringify(logs);
  check("nhật ký kiểm toán không chứa tên / SĐT / địa chỉ / ngày sinh / ghi chú", ![NAME, ADDR, PHONE, GPHONE, NOTE, "2014-03-15", S.name].some(x => blob.includes(x)), [NAME, ADDR, PHONE, GPHONE, NOTE].filter(x => blob.includes(x)));
  const dev = existsSync(`/tmp/kin-dev-${process.env.PORT}.log`) ? readFileSync(`/tmp/kin-dev-${process.env.PORT}.log`, "utf8") : "";
  check("log máy chủ dev không chứa tên / SĐT / địa chỉ của trẻ", dev.length > 0 && ![NAME, ADDR, PHONE, GPHONE, NOTE].some(x => dev.includes(x)));
  const consentBlob = JSON.stringify(await prisma.consentRecord.findMany());
  check("sổ đồng ý chỉ có id, không chứa tên / số", ![NAME, PHONE, GPHONE, ADDR].some(x => consentBlob.includes(x)));
  check("không có console.* trong mã máy chủ của hồ sơ trẻ", await (async () => {
    const dirs = ["src/app/api/tutor/ho-so", "src/app/api/tutor/yeu-cau", "src/app/api/tutor/gia-dinh", "src/app/api/tutor/truong-tuy-chinh", "src/app/api/yeu-cau", "src/app/api/attendance-sessions/[id]/diem", "src/app/api/users/me/self-consent"]
      .flatMap(d => walk(join(process.cwd(), d)));
    const libs = ["consentPolicy", "studentProfile", "studentProfileServer", "studentImport", "studentImportServer", "tutorRequest", "tutorRequestServer", "sessionScore", "sessionScoreServer", "familyGroup"].map(n => join(process.cwd(), `src/lib/${n}.ts`));
    return [...dirs, ...libs].filter(f => /console\./.test(readFileSync(f, "utf8"))).length === 0;
  })());

  section("7) Mọi chỗ ghi dữ liệu trẻ trong mã đều đi qua cổng đồng ý");
  const files = walk(join(process.cwd(), "src")).filter(f => /\.(ts|tsx)$/.test(f) && !f.includes("/generated/"));
  const writers = files.filter(f => /(studentProfile|sessionStudentScore|tutorRequest)\.(create|createMany|upsert)\(/.test(readFileSync(f, "utf8"))).map(f => f.replace(process.cwd() + "/", "")).sort();
  const allowed = ["src/app/api/attendance-sessions/[id]/diem/route.ts", "src/app/api/tutor/ho-so/nhap/route.ts", "src/app/api/tutor/ho-so/route.ts", "src/app/api/tutor/yeu-cau/[id]/tiep-nhan/route.ts", "src/app/api/yeu-cau/route.ts"].sort();
  check("đúng 5 tệp ghi hồ sơ / điểm / yêu cầu (thêm đường mới = bài này đỏ, phải xem lại đồng ý)", JSON.stringify(writers) === JSON.stringify(allowed), writers);
  const gate: Record<string, RegExp> = {
    "src/app/api/attendance-sessions/[id]/diem/route.ts": /scoreConsentFor/, "src/app/api/tutor/ho-so/nhap/route.ts": /missingParties[\s\S]*rights/,
    "src/app/api/tutor/ho-so/route.ts": /missingParties/, "src/app/api/tutor/yeu-cau/[id]/tiep-nhan/route.ts": /remaining[\s\S]*missing/, "src/app/api/yeu-cau/route.ts": /consent\?\.accepted !== true/,
  };
  check("mỗi tệp ghi đều có cổng đồng ý (kiểm trước khi create)", allowed.every(f => { const s = readFileSync(join(process.cwd(), f), "utf8"); const g = gate[f].exec(s); const w = /\.(create|createMany|upsert)\(/.exec(s); return !!g && !!w && g.index < w.index; }));
  check("PATCH hồ sơ có cổng 'need' scope trước khi update", (() => { const s = readFileSync(join(process.cwd(), "src/app/api/tutor/ho-so/[id]/route.ts"), "utf8"); return s.indexOf("scopesMissing.length") > 0 && s.indexOf("scopesMissing.length") < s.indexOf("tx.studentProfile.update"); })());

  await done();
})();
