import { api, mkTutor, mkUser, mkCourse, mkSuper, mkAttendanceSession, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";

const RUN = Math.random().toString(16).slice(2, 10);
let ipSeq = 0;
const ip = () => `10.${(Date.now() >> 8) % 250}.${Math.floor(Math.random() * 250)}.${++ipSeq % 250}`; // mỗi yêu cầu một IP riêng để không dính giới hạn tốc độ giữa các lần chạy
const H = (x?: string) => ({ "x-forwarded-for": x ?? ip() });
const vk = (n: number) => `${RUN}-visitor-${n}`;

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), T2 = await mkTutor("Thầy Khác");
  await prisma.user.updateMany({ where: { id: { in: [T.id, T2.id] } }, data: { tutorVerified: true } });
  const pending = await mkTutor("Chưa duyệt"); // adminRole teacher nhưng chưa verified
  await prisma.user.update({ where: { id: pending.id }, data: { tutorVerified: false } });
  const SA = await mkSuper("Quản trị");
  const S = await mkUser({ name: "Học sinh" });
  await prisma.user.update({ where: { id: T.id }, data: { phone: "+84 901 234 567", bio: "Gia sư Toán" , subjects: ["Toán 9"] } });
  const c1 = await mkCourse(T.id, { name: "Toán 9" }), c2 = await mkCourse(T.id, { name: "Toán 10" });
  // 3 buổi ĐÃ DẠY: có mặt / một phiên lẫn "có phép + có mặt + muộn" (không được đếm đôi) / chỉ có "muộn"
  const taught: Array<[typeof c1, string, string[]]> = [[c1, "2026-09-03", ["present"]], [c1, "2026-09-10", ["excused", "present", "late"]], [c2, "2026-09-11", ["late"]]];
  for (const [c, d, st] of taught) await mkAttendanceSession(c.id, T.id, new Date(`${d}T00:00:00Z`), st);
  // ĐX-00: những phiên KHÔNG được tính — rỗng, chỉ có "có phép", chỉ có "có phép + vắng", và phiên ở ngày tương lai dù có em có mặt
  await mkAttendanceSession(c1.id, T.id, new Date("2026-09-17T00:00:00Z"), []);
  await mkAttendanceSession(c1.id, T.id, new Date("2026-09-24T00:00:00Z"), ["excused"]);
  await mkAttendanceSession(c2.id, T.id, new Date("2026-09-25T00:00:00Z"), ["excused", "absent"]);
  await mkAttendanceSession(c2.id, T.id, new Date(Date.now() + 5 * 86400_000), ["present"]);
  await mkAttendanceSession((await mkCourse(T2.id, { name: "Lý" })).id, T2.id, new Date("2026-09-05T00:00:00Z"));

  section("Hồ sơ công khai: số buổi đã dạy từ sổ lớp");
  let g = await api("GET", `/api/tutors/${T.id}`);
  check("200, 3 buổi (chỉ lớp của gia sư này, không lẫn buổi của gia sư khác; phiên rỗng / chỉ có phép / ngày tương lai KHÔNG tính)", g.status === 200 && g.json?.stats?.sessionsTaught === 3 && g.json?.stats?.classCount === 2, g.json?.stats);
  check("số Zalo KHÔNG lộ khi chưa bật (tắt sẵn)", g.json?.tutor?.zalo === null && !JSON.stringify(g.json).includes("901234567"));
  check("gia sư chưa duyệt → 404", (await api("GET", `/api/tutors/${pending.id}`)).status === 404);

  section("Hiện số Zalo trên hồ sơ (PH-215): chỉ khi gia sư bật");
  const patch = (as: any, body: unknown) => api("PUT", "/api/users/me/preferences", { as, body });
  check("gia sư bật showZalo", (await patch(T, { connections: { showZalo: true } })).status === 200);
  g = await api("GET", `/api/tutors/${T.id}`);
  check("bật rồi: số được chuẩn hoá 0901234567", g.json?.tutor?.zalo === "0901234567", g.json?.tutor?.zalo);
  check("tắt lại → ẩn ngay", (await patch(T, { connections: { showZalo: false } })).status === 200 && (await api("GET", `/api/tutors/${T.id}`)).json?.tutor?.zalo === null);
  check("số điện thoại hỏng → null chứ không lộ rác", await (async () => { await prisma.user.update({ where: { id: T.id }, data: { phone: "abc" } }); await patch(T, { connections: { showZalo: true } }); const x = (await api("GET", `/api/tutors/${T.id}`)).json?.tutor?.zalo; await prisma.user.update({ where: { id: T.id }, data: { phone: "+84 901 234 567" } }); await patch(T, { connections: { showZalo: false } }); return x === null; })());
  check("khoá lạ trong connections → 400", (await patch(T, { connections: { oa: true } })).status === 400);

  section("Đo lượt mở / xem hết (PH-210)");
  const visit = (id: string, body: unknown, h = H()) => api("POST", `/api/tutors/${id}/visit`, { body, headers: h });
  let v = await visit(T.id, { n: "FB-HN9", kind: "open", vk: vk(1) });
  check("lượt mở đầu: counted, kênh được chuẩn hoá thường", v.status === 200 && v.json?.counted === true && !!(await prisma.profileVisit.findFirst({ where: { tutorId: T.id, channel: "fb-hn9", kind: "open" } })));
  v = await visit(T.id, { n: "fb-hn9", kind: "open", vk: vk(1) });
  check("mở lại cùng phiên: KHÔNG đếm trùng", v.json?.counted === false && (await prisma.profileVisit.count({ where: { tutorId: T.id, channel: "fb-hn9", kind: "open" } })) === 1);
  await visit(T.id, { n: "fb-hn9", kind: "open", vk: vk(2) });
  await visit(T.id, { n: "fb-hn9", kind: "full", vk: vk(2) });
  await visit(T.id, { kind: "open", vk: vk(3) });
  check("phiên khác tính riêng; không ?n= → truc-tiep", (await prisma.profileVisit.count({ where: { tutorId: T.id, channel: "fb-hn9", kind: "open" } })) === 2 && (await prisma.profileVisit.count({ where: { tutorId: T.id, channel: "truc-tiep" } })) === 1);
  check("kind lạ → 400", (await visit(T.id, { kind: "click", vk: vk(4) })).status === 400);
  check("vk thiếu / quá ngắn / ký tự lạ → 400", (await visit(T.id, { kind: "open" })).status === 400 && (await visit(T.id, { kind: "open", vk: "ab" })).status === 400 && (await visit(T.id, { kind: "open", vk: "a b c d e f g h" })).status === 400);
  check("gia sư không có / chưa duyệt → 404, không ghi", (await visit("khong-co", { kind: "open", vk: vk(5) })).status === 404 && (await visit(pending.id, { kind: "open", vk: vk(5) })).status === 404 && (await prisma.profileVisit.count({ where: { tutorId: pending.id } })) === 0);
  check("đuôi ?n= bẩn bị làm sạch, không lưu ký tự lạ", await (async () => { await visit(T.id, { n: "../x?<s>", kind: "open", vk: vk(6) }); return !!(await prisma.profileVisit.findFirst({ where: { tutorId: T.id, channel: "xs" } })); })());
  const sameIp = `172.${Math.floor(Math.random() * 15) + 16}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  let blockedAt = 0;
  for (let i = 0; i < 125; i++) { const r = await visit(T.id, { kind: "open", vk: `${RUN}-flood-${i}-xxxx` }, H(sameIp)); if (r.status === 429) { blockedAt = i; break; } }
  check("một IP spam > 120 lượt/giờ → 429", blockedAt > 100 && blockedAt <= 121, blockedAt);

  section("Báo cáo hồ sơ (PH-212)");
  const report = (id: string, body: unknown, h = H()) => api("POST", `/api/tutors/${id}/report`, { body, headers: h });
  check("thiếu / sai lý do → 400", (await report(T.id, {})).status === 400 && (await report(T.id, { reason: "spam" })).status === 400);
  check("'Lý do khác' phải có mô tả", (await report(T.id, { reason: "khac" })).status === 400 && (await report(T.id, { reason: "khac", detail: "   " })).status === 400);
  check("mô tả > 500 ký tự → 400; mô tả không phải chữ → 400", (await report(T.id, { reason: "gia-mao", detail: "x".repeat(501) })).status === 400 && (await report(T.id, { reason: "gia-mao", detail: 5 })).status === 400);
  check("gia sư không có → 404", (await report("khong-co", { reason: "gia-mao" })).status === 404);
  const r1 = await report(T.id, { reason: "thu-phi-truoc", detail: "Đòi 500k trước buổi thử", n: "FB-HN9" });
  check("báo cáo hợp lệ → 201, không cần đăng nhập", r1.status === 201 && (await prisma.tutorProfileReport.count({ where: { tutorId: T.id, status: "open" } })) === 1);
  const stored = await prisma.tutorProfileReport.findFirst({ where: { tutorId: T.id } });
  check("lưu lý do, mô tả, kênh đã chuẩn hoá", stored?.reason === "thu-phi-truoc" && stored.detail === "Đòi 500k trước buổi thử" && stored.channel === "fb-hn9");
  const same = `192.168.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  const a = await report(T2.id, { reason: "gia-mao" }, H(same)), b = await report(T2.id, { reason: "gia-mao" }, H(same)), c = await report(T2.id, { reason: "gia-mao" }, H(same));
  check("cùng IP báo cáo cùng một gia sư: 2 lần/ngày, lần 3 → 429", a.status === 201 && b.status === 201 && c.status === 429, [a.status, b.status, c.status]);
  await report(T2.id, { reason: "khac", detail: "Hồ sơ có vẻ giả" });

  section("Bảng phễu của quản trị: quyền");
  const fun = (as?: any, q = "") => api("GET", `/api/admin/funnel${q}`, as ? { as } : {});
  check("chưa đăng nhập → 401", (await fun()).status === 401);
  check("học sinh → 401/403", [401, 403].includes((await fun(S)).status));
  check("gia sư (teacher) → 403: không xem được phễu của trung tâm", (await fun(T)).status === 403);
  const f = await fun(SA);
  check("quản trị trung tâm → 200", f.status === 200, f.json);

  section("Bảng phễu: số liệu");
  const row = (ch: string) => f.json?.rows?.find((r: any) => r.channel === ch);
  check("fb-hn9: 2 lượt mở, 1 xem hết, 50%", row("fb-hn9")?.opens === 2 && row("fb-hn9")?.fulls === 1 && row("fb-hn9")?.fullRate === 0.5 && row("fb-hn9")?.groupLabel === "Nhóm Facebook", row("fb-hn9"));
  check("truc-tiep có lượt (các kênh ghi ở trên đều xuất hiện)", !!row("truc-tiep") && !!row("xs"));
  check("tổng = cộng các dòng", f.json.totals.opens === f.json.rows.reduce((s: number, r: any) => s + r.opens, 0) && f.json.totals.fulls === 1);
  check("hàng chờ có 4 báo cáo (1 của Cô Lan + 3 của Thầy Khác), kèm lý do bằng chữ", f.json.reportsOpen === 4 && f.json.reports.every((r: any) => r.reasonLabel && r.tutorName), f.json.reports?.length);
  check("báo cáo về Thầy Khác: openForTutor = 3 (nhận ra gia sư bị báo nhiều)", f.json.reports.filter((r: any) => r.tutorId === T2.id).every((r: any) => r.openForTutor === 3));
  check("days sai → mặc định 30; days=7 hợp lệ", (await fun(SA, "?days=0")).json?.days === 30 && (await fun(SA, "?days=abc")).json?.days === 30 && (await fun(SA, "?days=7")).json?.days === 7);
  await prisma.profileVisit.updateMany({ where: { channel: "xs" }, data: { createdAt: new Date(Date.now() - 40 * 86400_000) } });
  check("lượt cũ hơn khoảng chọn không tính (xs 40 ngày trước: có ở 90 ngày, không có ở 30)", !(await fun(SA, "?days=30")).json.rows.find((r: any) => r.channel === "xs") && !!(await fun(SA, "?days=90")).json.rows.find((r: any) => r.channel === "xs"));

  section("Xử lý báo cáo: bỏ qua / khoá hồ sơ");
  const rep = (id: string, as: any, body: unknown) => api("PATCH", `/api/admin/profile-reports/${id}`, { as, body });
  const reports = f.json.reports as any[];
  const rT = reports.find(r => r.tutorId === T.id), rT2 = reports.filter(r => r.tutorId === T2.id);
  check("gia sư không được xử lý báo cáo (403)", (await rep(rT.id, T, { action: "dismiss" })).status === 403);
  check("action lạ → 400; báo cáo không có → 404", (await rep(rT.id, SA, { action: "x" })).status === 400 && (await rep("khong-co", SA, { action: "dismiss" })).status === 404);
  check("bỏ qua → resolved/dismissed, hồ sơ vẫn công khai", (await rep(rT.id, SA, { action: "dismiss" })).status === 200 && (await prisma.tutorProfileReport.findUnique({ where: { id: rT.id } }))?.resolution === "dismissed" && (await api("GET", `/api/tutors/${T.id}`)).status === 200);
  check("bỏ qua lần nữa: idempotent", (await rep(rT.id, SA, { action: "dismiss" })).json?.alreadyResolved === true);
  check("khoá cần lý do (400)", (await rep(rT2[0].id, SA, { action: "lock" })).status === 400 && (await rep(rT2[0].id, SA, { action: "lock", reason: "  " })).status === 400 && (await rep(rT2[0].id, SA, { action: "lock", reason: "x".repeat(501) })).status === 400);
  check("khoá → 200", (await rep(rT2[0].id, SA, { action: "lock", reason: "Đòi chuyển khoản trước, 3 báo cáo" })).status === 200);
  const t2 = await prisma.user.findUnique({ where: { id: T2.id } });
  check("User.profileLockedAt + lý do được ghi", !!t2?.profileLockedAt && t2.profileLockReason === "Đòi chuyển khoản trước, 3 báo cáo");
  check("MỌI báo cáo đang mở về gia sư đó được đóng (resolution=locked)", (await prisma.tutorProfileReport.count({ where: { tutorId: T2.id, status: "open" } })) === 0 && (await prisma.tutorProfileReport.count({ where: { tutorId: T2.id, resolution: "locked" } })) === 3);
  check("báo cáo của gia sư KHÁC không bị đóng nhầm", (await prisma.tutorProfileReport.count({ where: { tutorId: T.id, resolution: "locked" } })) === 0);

  section("Hồ sơ bị khoá = như không tồn tại với người ngoài");
  check("GET hồ sơ → 404", (await api("GET", `/api/tutors/${T2.id}`)).status === 404);
  check("không còn trong danh sách gia sư", !(await api("GET", "/api/tutors")).json?.items?.some((x: any) => x.id === T2.id) && (await api("GET", "/api/tutors")).json?.items?.some((x: any) => x.id === T.id));
  check("không ghi lượt mở / không nhận báo cáo mới? (lượt mở 404)", (await visit(T2.id, { kind: "open", vk: vk(9) })).status === 404);
  check("gia sư bị khoá vẫn đăng nhập & dùng sổ lớp (đọc lớp của mình)", (await api("GET", "/api/tutor/schedule", { as: T2 })).status !== 401);
  check("bảng phễu đếm hồ sơ đang khoá = 1", (await fun(SA)).json?.lockedProfiles === 1);

  section("Mở khoá");
  const unlock = (as: any, id: string) => api("DELETE", `/api/admin/profile-lock/${id}`, { as });
  check("gia sư không mở khoá được (403)", (await unlock(T2, T2.id)).status === 403);
  check("quản trị mở khoá → hồ sơ công khai lại", (await unlock(SA, T2.id)).status === 200 && (await api("GET", `/api/tutors/${T2.id}`)).status === 200 && (await prisma.user.findUnique({ where: { id: T2.id } }))?.profileLockReason === null);
  check("mở khoá lần nữa: idempotent", (await unlock(SA, T2.id)).json?.alreadyUnlocked === true);

  section("Nhật ký thao tác");
  check("có log khoá / bỏ qua / mở khoá", (await prisma.auditLog.count({ where: { action: { in: ["profile_report.lock", "profile_report.dismiss", "profile_lock.remove"] } } })) === 3);
  done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
