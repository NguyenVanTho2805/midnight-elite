// SCL nhóm E (21/11/2026) — Vào lớp, phía API. Cần máy chủ dev + Postgres riêng.
//   Q7: lớp cũ joinPolicy null ⇒ dùng mã thành YÊU CẦU CHỜ DUYỆT (không vào thẳng); "Đổi mã" một chạm: mã cũ chết, mã mới dùng được, lớp người khác 403.
//   P2-9: tra mã / dùng mã bị giới hạn tần suất theo tài khoản (429).
//   P2-20: hàng chờ gộp /lop-cua-toi/xin-vao-lop chỉ có lớp của chính gia sư; duyệt bằng form kèm ve=hang-cho ⇒ 303 về hàng chờ; em vào lớp.
//   P2-17: đăng ký học sinh chỉ cần họ tên + email + mật khẩu và đăng nhập được ngay (chưa xác thực email).
import { BASE, mkUser, mkTutor, mkCourse, api, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { INVITE_LOOKUP_LIMIT } from "@/lib/joinRequest";

const form = (o: Record<string, string>) => ({ raw: new URLSearchParams(o).toString(), headers: { "content-type": "application/x-www-form-urlencoded" } });

(async () => {
  await wipe();
  const T = await mkTutor("Cô Thử E");
  const T2 = await mkTutor("Thầy Khác E");
  const S = await mkUser({ name: "Em Thử E" });
  const LEGACY = await mkCourse(T.id, { name: "Lớp cũ chưa chọn cách vào", joinPolicy: null });
  const OTHER = await mkCourse(T2.id, { name: "Lớp của thầy khác", joinPolicy: "approve" });

  section("Q7: lớp joinPolicy null — mã thành yêu cầu chờ duyệt");
  const ens = await api("POST", `/api/courses/${LEGACY.id}/invites`, { as: T, body: { ensure: true } });
  check("có mã lớp", ens.status === 201 && typeof ens.json?.code === "string", ens);
  const pv = await api("GET", `/api/invites/by-code/${ens.json.code}`, { as: S });
  check("xem trước báo joinPolicy=approve (nút thành 'Gửi yêu cầu')", pv.json?.joinPolicy === "approve", pv.json);
  const rd = await api("POST", `/api/invites/${ens.json.code}/redeem`, { as: S });
  check("CA PHÁ: redeem ⇒ pending, KHÔNG có Enrollment", rd.status === 200 && rd.json?.pending === true && (await prisma.enrollment.count({ where: { userId: S.id, courseId: LEGACY.id } })) === 0, rd.json);

  section("Q7: Đổi mã một chạm");
  const rot = await api("POST", `/api/courses/${LEGACY.id}/invites`, { as: T, body: { rotate: true } });
  check("đổi mã ⇒ 201, mã mới khác mã cũ", rot.status === 201 && rot.json?.code && rot.json.code !== ens.json.code && rot.json.rotated === 1, rot.json);
  const live = await prisma.classInvite.findMany({ where: { courseId: LEGACY.id, kind: "class", revoked: false, maxUses: null, expiresAt: null } });
  check("DB: còn đúng MỘT mã lớp dùng được, là mã mới", live.length === 1 && live[0].code === rot.json.code, live.map(l => l.code));
  const S2 = await mkUser({ name: "Em Hai E" });
  const oldTry = await api("POST", `/api/invites/${ens.json.code}/redeem`, { as: S2 });
  check("mã cũ không dùng được nữa", oldTry.status >= 400 && oldTry.status < 500, oldTry);
  const newTry = await api("POST", `/api/invites/${rot.json.code}/redeem`, { as: S2 });
  check("mã mới dùng được (chờ duyệt)", newTry.status === 200 && newTry.json?.pending === true, newTry.json);
  const ensAgain = await api("POST", `/api/courses/${LEGACY.id}/invites`, { as: T, body: { ensure: true } });
  check("ensure sau khi đổi trả đúng mã mới (khối Cách vào lớp đọc đúng)", ensAgain.json?.code === rot.json.code, ensAgain.json);
  const steal = await api("POST", `/api/courses/${OTHER.id}/invites`, { as: T, body: { rotate: true } });
  check("đổi mã lớp người khác ⇒ 403", steal.status === 403, steal);
  const byStudent = await api("POST", `/api/courses/${LEGACY.id}/invites`, { as: S, body: { rotate: true } });
  check("học sinh đổi mã ⇒ bị chặn (401/403)", byStudent.status === 401 || byStudent.status === 403, byStudent.status);

  section("P2-20: hàng chờ gộp");
  await api("POST", `/api/courses/${OTHER.id}/invites`, { as: T2, body: { ensure: true } });
  const otherCode = (await prisma.classInvite.findFirstOrThrow({ where: { courseId: OTHER.id } })).code;
  const S3 = await mkUser({ name: "Em Ba Lớp Khác" });
  await api("POST", `/api/invites/${otherCode}/redeem`, { as: S3 });
  const page = await api("GET", "/lop-cua-toi/xin-vao-lop", { as: T });
  check("trang hàng chờ mở được (200) và đếm đúng 2 yêu cầu", page.status === 200 && /Xin vào lớp \(2\)/.test(page.text.replace(/<!-- -->/g, "")), page.status);
  check("có tên lớp + tên em của lớp mình", page.text.includes("Lớp cũ chưa chọn cách vào") && page.text.includes("Em Thử E"));
  check("KHÔNG lộ lớp / em của gia sư khác", !page.text.includes("Lớp của thầy khác") && !page.text.includes("Em Ba Lớp Khác"));
  check("mỗi form duyệt mang ve=hang-cho", /name="ve" value="hang-cho"/.test(page.text));
  const reqS = await prisma.classJoinRequest.findFirstOrThrow({ where: { userId: S.id, courseId: LEGACY.id } });
  const ok = await api("POST", `/api/tutor/lop/${LEGACY.id}/yeu-cau/${reqS.id}/duyet`, { as: T, ...form({ ve: "hang-cho" }) });
  check("duyệt ⇒ 303 về /lop-cua-toi/xin-vao-lop?duyet=ok", ok.status === 303 && (ok.headers.get("location") ?? "").includes("/lop-cua-toi/xin-vao-lop?duyet=ok"), ok.headers.get("location"));
  check("em đã vào lớp (Enrollment active)", (await prisma.enrollment.findFirst({ where: { userId: S.id, courseId: LEGACY.id } }))?.status === "active");
  const reqS2 = await prisma.classJoinRequest.findFirstOrThrow({ where: { userId: S2.id, courseId: LEGACY.id } });
  const plain = await api("POST", `/api/tutor/lop/${LEGACY.id}/yeu-cau/${reqS2.id}/tu-choi`, { as: T, ...form({ note: "" }) });
  check("không có ve ⇒ vẫn 303 về tab Học sinh của lớp như cũ", plain.status === 303 && (plain.headers.get("location") ?? "").includes(`/lop-cua-toi/${LEGACY.id}?tab=hoc-sinh&duyet=tuchoi`), plain.headers.get("location"));
  const cross = await api("POST", `/api/tutor/lop/${OTHER.id}/yeu-cau/x/duyet`, { as: T, ...form({ ve: "hang-cho" }) });
  check("duyệt ở lớp người khác ⇒ 403", cross.status === 403, cross.status);
  const empty = await api("GET", "/lop-cua-toi/xin-vao-lop", { as: T });
  check("hết yêu cầu ⇒ trạng thái rỗng có lời giải thích", empty.text.includes("Chưa có ai xin vào lớp"));

  section("P2-9: giới hạn tần suất tra mã theo tài khoản");
  const R = await mkUser({ name: "Em Dò Mã" });
  let first429 = -1;
  for (let i = 0; i < INVITE_LOOKUP_LIMIT.max + 2; i++) {
    const r = await api("GET", `/api/invites/by-code/ZZZZ${String(i).padStart(4, "2")}`, { as: R });
    if (r.status === 429) { first429 = i; break; }
  }
  check(`CA PHÁ: lần thứ ${INVITE_LOOKUP_LIMIT.max + 1} bị 429`, first429 === INVITE_LOOKUP_LIMIT.max, first429);
  const blockedRedeem = await api("POST", `/api/invites/${rot.json.code}/redeem`, { as: R });
  check("dùng mã cũng chung bộ đếm ⇒ 429", blockedRedeem.status === 429, blockedRedeem.status);
  const otherUser = await api("GET", `/api/invites/by-code/${rot.json.code}`, { as: S2 });
  check("tài khoản khác không bị ảnh hưởng", otherUser.status === 200, otherUser.status);

  section("P2-17: đăng ký học sinh 3 ô, đăng nhập ngay");
  const email = `scl-e-${Date.now()}@test.local`;
  const reg = await api("POST", "/api/auth/register", { body: { name: "Học Sinh Mới", email, password: "MatKhau#2026" }, headers: { "x-forwarded-for": `10.98.${Math.floor(Math.random() * 250)}.7` } });
  check("register chỉ với họ tên + email + mật khẩu ⇒ 200", reg.status === 200, reg.json);
  const row = await prisma.user.findUnique({ where: { email } });
  check("không lưu thêm SĐT / trường / tỉnh", !!row && row.phone === null && row.school === null && row.city === null && row.parentPhone === null);
  const lg = await api("POST", "/api/auth/login", { body: { identifier: email, password: "MatKhau#2026" }, headers: { "x-forwarded-for": `10.98.${Math.floor(Math.random() * 250)}.8` } });
  check("đăng nhập được ngay dù chưa xác thực email", lg.status === 200 && lg.json?.emailVerified === false, lg.json);
  void BASE;

  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
