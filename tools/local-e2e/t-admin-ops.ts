// QT-01/02/03/04/07 (API + DB thật): Triển khai và hạn mức (chỉ đọc, không lộ giá trị biến), lần gọi cron, nhật ký đọc được và KHÔNG lộ tên trẻ,
// "hôm nay cần làm gì" theo quyền, nhắc hàng loạt CHỈ theo lớp, thẻ hạn mức + khối Kết nối ở Cài đặt gia sư.
import { prisma } from "@/lib/prisma";
import { api, mkTutor, mkUser, mkCourse, mkSuper, cookieFor, wipe, check, section, done, BASE } from "./h";

(async () => {
  await wipe();
  const SA = await mkSuper("Quản trị Hà"), SA2 = await mkSuper("Quản trị Khác");
  const CA = await mkUser({ name: "Quản trị nội dung", role: "admin", adminRole: "admin_content" });
  const T = await mkTutor("Cô Lan");
  const kidName = "Nguyễn Bé Bí Mật";
  const kid = await mkUser({ name: kidName });
  const course = await mkCourse(T.id, { name: "Toán 9 Lan" }), other = await mkCourse(T.id, { name: "Lý 9 Lan" });
  const inA = await mkUser({ name: "Em Một" }), inA2 = await mkUser({ name: "Em Hai" }), inB = await mkUser({ name: "Em Ba" });
  for (const [u, c] of [[inA, course], [inA2, course], [inB, other]] as const) await prisma.enrollment.create({ data: { userId: u.id, courseId: c.id, status: "active" } });
  const SECRET = process.env.CRON_SECRET!;

  section("Triển khai và hạn mức: quyền và nội dung");
  check("không cookie → 401", (await api("GET", "/api/admin/trien-khai")).status === 401);
  check("quản trị nội dung → 403; gia sư → 403; học sinh → 403", (await api("GET", "/api/admin/trien-khai", { as: CA })).status === 403 && (await api("GET", "/api/admin/trien-khai", { as: T })).status === 403 && (await api("GET", "/api/admin/trien-khai", { as: kid })).status === 403);
  let r = await api("GET", "/api/admin/trien-khai", { as: SA });
  check("cấp 1 → 200, có cờ, cron, hạn mức, số đo", r.status === 200 && r.json.flags.length === 4 && r.json.crons.length === 3 && r.json.limits.free.studentLimit > 0 && typeof r.json.measure.tutors === "number", r.json);
  check("KHÔNG lộ giá trị CRON_SECRET / DATABASE_URL / SESSION_SECRET / VAPID_PRIVATE_KEY", ![SECRET, process.env.DATABASE_URL, process.env.SESSION_SECRET, process.env.VAPID_PRIVATE_KEY].some(v => v && r.text.includes(v)));
  const fl = (k: string) => r.json.flags.find((f: any) => f.key === k);
  check("CRON_SECRET hiện 'Đã đặt' (máy chủ thử có đặt), chỉ là chữ", fl("CRON_SECRET").on === true && fl("CRON_SECRET").state === "Đã đặt");
  check("không có đường GHI: POST/PUT/PATCH/DELETE đều 405", (await Promise.all(["POST", "PUT", "PATCH", "DELETE"].map(m => api(m, "/api/admin/trien-khai", { as: SA, body: {} })))).every(x => x.status === 405));
  check("số đo khớp dữ liệu: 1 gia sư", r.json.measure.tutors === 1, r.json.measure);

  section("Lần gọi cron gần nhất");
  check("trước khi gọi: cả ba 'Chưa ghi nhận'", r.json.crons.every((c: any) => c.status === "Chưa ghi nhận"));
  const bad = await fetch(`${BASE}/api/cron/remind-exam`);
  check("gọi KHÔNG khoá → 401 và KHÔNG được ghi nhận", bad.status === 401 && (await api("GET", "/api/admin/trien-khai", { as: SA })).json.crons.find((c: any) => c.key === "remind-exam").status === "Chưa ghi nhận");
  const wrong = await fetch(`${BASE}/api/cron/remind-exam`, { headers: { authorization: "Bearer sai-khoa" } });
  check("khoá SAI → 401 và không ghi nhận", wrong.status === 401 && (await api("GET", "/api/admin/trien-khai", { as: SA })).json.crons.find((c: any) => c.key === "remind-exam").status === "Chưa ghi nhận");
  const ok = await fetch(`${BASE}/api/cron/remind-exam`, { headers: { authorization: `Bearer ${SECRET}` } });
  check("gọi đúng khoá → 200", ok.status === 200, ok.status);
  r = await api("GET", "/api/admin/trien-khai", { as: SA });
  const ce = r.json.crons.find((c: any) => c.key === "remind-exam"), cc = r.json.crons.find((c: any) => c.key === "remind-class");
  check("remind-exam: 'Đúng lịch', 'hôm nay'; remind-class vẫn 'Chưa ghi nhận'", ce.status === "Đúng lịch" && /hôm nay/.test(ce.lastText) && cc.status === "Chưa ghi nhận", ce);
  check("khoá lưu trong SettingKV là ISO (không phải chữ rác)", !Number.isNaN(new Date((await prisma.settingKV.findUnique({ where: { key: "cron.remind-exam.lastCall" } }))!.value).getTime()));
  await prisma.settingKV.update({ where: { key: "cron.remind-exam.lastCall" }, data: { value: new Date(Date.now() - 4 * 86_400_000).toISOString() } });
  check("lần gọi cũ 4 ngày → 'Chậm so với lịch'", (await api("GET", "/api/admin/trien-khai", { as: SA })).json.crons.find((c: any) => c.key === "remind-exam").status === "Chậm so với lịch");

  section("Nhật ký: quyền, không lộ tên trẻ, lọc, phân trang");
  check("không cookie → 401; quản trị nội dung 403; gia sư 403", (await api("GET", "/api/admin/nhat-ky")).status === 401 && (await api("GET", "/api/admin/nhat-ky", { as: CA })).status === 403 && (await api("GET", "/api/admin/nhat-ky", { as: T })).status === 403);
  // việc thật: đổi vai qua API cũ → phải có dòng nhật ký
  const target = await mkUser({ name: "Người được đổi vai" });
  const rc = await api("PUT", `/api/users/${target.id}/role`, { as: SA, body: { role: "admin", adminRole: "admin_content" } });
  check("đổi vai (API cũ) thành công", rc.status === 200, rc.json);
  // dòng có metadata chứa tên + SĐT + ngày sinh của trẻ, người làm là học sinh
  await prisma.auditLog.create({ data: { actorId: kid.id, action: "student_profile.update", resourceType: "StudentProfile", resourceId: "cmhoso0000000000000abcdef", metadata: { studentName: kidName, phone: "0912345678", dob: "2015-05-05" } } });
  await prisma.auditLog.create({ data: { actorId: null, action: "tutor_subscription.expire", resourceType: "TutorSubscription", resourceId: "sub1" } });
  r = await api("GET", "/api/admin/nhat-ky", { as: SA });
  check("cấp 1 → 200, có dòng 'Đổi vai người dùng' do 'Quản trị cấp 1 · Quản trị Hà'", r.status === 200 && r.json.rows.some((x: any) => x.actionLabel === "Đổi vai người dùng" && x.actor === "Quản trị cấp 1 · Quản trị Hà"), r.json.rows);
  check("KHÔNG lộ tên trẻ, SĐT, ngày sinh, hay trường metadata trong phản hồi", !r.text.includes(kidName) && !/0912345678|2015-05-05|metadata|studentName/.test(r.text) && !r.text.includes("Bí Mật"));
  check("người làm là học sinh chỉ hiện vai: 'Học sinh hoặc phụ huynh'; hệ thống: 'Hệ thống'", r.json.rows.some((x: any) => x.action === "student_profile.update" && x.actor === "Học sinh hoặc phụ huynh") && r.json.rows.some((x: any) => x.action === "tutor_subscription.expire" && x.actor === "Hệ thống"));
  check("mã tài nguyên bị rút gọn", r.json.rows.find((x: any) => x.action === "student_profile.update").resourceId === "…abcdef");
  check("không lộ email, mật khẩu, băm", !/@test\.local|password|\$2[aby]\$/i.test(r.text));
  const f = await api("GET", "/api/admin/nhat-ky?action=user.role_change", { as: SA });
  check("lọc theo loại việc: chỉ còn 'Đổi vai'", f.json.rows.length === 1 && f.json.rows[0].action === "user.role_change", f.json.rows.length);
  const injected = await api("GET", "/api/admin/nhat-ky?action=%27%3B%20drop%20table%20users--&from=hỏng&page=-9", { as: SA });
  check("tham số phá (SQL, ngày hỏng, trang âm) bị bỏ, vẫn 200 và trả cả nhật ký", injected.status === 200 && injected.json.filter.action === null && injected.json.filter.from === null && injected.json.filter.page === 1 && injected.json.rows.length >= 3, injected.json.filter);
  const today = new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
  const byDay = await api("GET", `/api/admin/nhat-ky?from=${today}&to=${today}`, { as: SA });
  const tmr = new Date(Date.now() + 7 * 3_600_000 + 86_400_000).toISOString().slice(0, 10);
  const future = await api("GET", `/api/admin/nhat-ky?from=${tmr}`, { as: SA });
  check("lọc ngày: hôm nay có dòng, từ ngày mai không có dòng", byDay.json.rows.length >= 3 && future.json.rows.length === 0, [byDay.json.rows.length, future.json.rows.length]);
  await prisma.auditLog.createMany({ data: Array.from({ length: 60 }, (_, i) => ({ actorId: null, action: "pro_order.cancel", resourceType: "ProOrder", resourceId: `po${i}`, createdAt: new Date(Date.now() - (i + 1) * 60_000) })) });
  const p1 = await api("GET", "/api/admin/nhat-ky?action=pro_order.cancel", { as: SA }), p2 = await api("GET", "/api/admin/nhat-ky?action=pro_order.cancel&page=2", { as: SA });
  check("phân trang: trang 1 có 50 dòng và còn tiếp; trang 2 có 10 dòng và hết", p1.json.rows.length === 50 && p1.json.hasMore === true && p2.json.rows.length === 10 && p2.json.hasMore === false, [p1.json.rows.length, p2.json.rows.length]);
  check("mới nhất trước, không trùng giữa hai trang", p1.json.rows[0].resourceId === "po0" && new Set([...p1.json.rows, ...p2.json.rows].map((x: any) => x.id)).size === 60);
  check("không có đường ghi vào nhật ký qua trang đọc: POST → 405", (await api("POST", "/api/admin/nhat-ky", { as: SA, body: {} })).status === 405);

  section("Hôm nay cần làm gì (theo quyền)");
  check("không cookie → 401; học sinh → 403", (await api("GET", "/api/admin/hom-nay")).status === 401 && (await api("GET", "/api/admin/hom-nay", { as: kid })).status === 403);
  check("trống: cấp 1 → items [] và total 0", (await api("GET", "/api/admin/hom-nay", { as: SA })).json.total === 0);
  const applicant = await mkUser({ name: "Gia sư xin duyệt", emailVerified: true });
  await prisma.user.update({ where: { id: applicant.id }, data: { tutorAppliedAt: new Date(Date.now() - 86_400_000), subjects: ["Toán"] } });
  await prisma.coinTopupRequest.create({ data: { userId: kid.id, amountVnd: 100000, coinAmount: 100, status: "pending" } as never });
  await prisma.supportRequest.create({ data: { userId: T.id, kind: "setup", subject: "Cần giúp", message: "nội dung", status: "open", planAtSend: "free" } as never });
  const hn = await api("GET", "/api/admin/hom-nay", { as: SA });
  check("cấp 1 thấy: gia sư chờ duyệt 1, nạp Coin 1, hỗ trợ 1 (total 3)", hn.json.items.map((i: any) => `${i.key}:${i.count}`).sort().join() === "gia-su:1,ho-tro:1,nap-coin:1" && hn.json.total === 3, hn.json);
  const hc = await api("GET", "/api/admin/hom-nay", { as: CA });
  check("quản trị nội dung: thấy gia sư + hỗ trợ (MANAGE_TUTORS) nhưng KHÔNG thấy nạp Coin (MANAGE_REVENUE)", hc.json.items.map((i: any) => i.key).sort().join() === "gia-su,ho-tro", hc.json);
  const ht = await api("GET", "/api/admin/hom-nay", { as: T });
  check("gia sư: không thấy hồ sơ gia sư, nạp Coin, hỗ trợ", ht.status === 200 && ht.json.items.length === 0, ht.json);
  check("phản hồi chỉ có số đếm, không có tên người", !/Gia sư xin duyệt|Nguyễn|@test\.local/.test(hn.text));

  section("Nhắc hàng loạt CHỈ theo lớp");
  check("không cookie → 401; gia sư → 403", (await api("POST", "/api/admin/remind-all", { body: { message: "x" } })).status === 401 && (await api("POST", "/api/admin/remind-all", { as: T, body: { message: "x", courseId: course.id } })).status === 403);
  const noCourse = await api("POST", "/api/admin/remind-all", { as: SA, body: { message: "Nhắc học nhé" } });
  check("không chọn lớp → 400, nói rõ không nhắc toàn nền tảng, KHÔNG gửi", noCourse.status === 400 && /toàn nền tảng/.test(noCourse.json.error), noCourse.json);
  const ghost = await api("POST", "/api/admin/remind-all", { as: SA2, body: { message: "Nhắc học nhé", courseId: "khong-co" } });
  check("lớp không tồn tại → 404", ghost.status === 404, ghost.json);
  const noMsg = await api("POST", "/api/admin/remind-all", { as: SA2, body: { courseId: course.id } });
  check("thiếu nội dung → 400", noMsg.status === 400);
  const sent = await api("POST", "/api/admin/remind-all", { as: SA, body: { message: "Nhắc học nhé", courseId: course.id } });
  check("nhắc lớp Toán: total = 2 (đúng học sinh của lớp), KHÔNG phải 5 học sinh của nền tảng", sent.status === 200 && sent.json.total === 2, sent.json);
  await prisma.enrollment.updateMany({ where: { userId: inA2.id }, data: { status: "paused" } });
  const sent2 = await api("POST", "/api/admin/remind-all", { as: SA2, body: { message: "Nhắc học nhé", courseId: course.id } });
  check("học sinh tạm dừng không nhận nhắc: total = 1", sent2.status === 200 && sent2.json.total === 1, sent2.json);

  section("Cài đặt gia sư: khối Kết nối trung thực + thẻ hạn mức");
  const html = await fetch(`${BASE}/lop-cua-toi/cai-dat`, { headers: { cookie: await cookieFor(T) } });
  const page = await html.text();
  check("trang 200, có khối 'Google và lưu trữ' và thẻ hạn mức", html.status === 200 && /Google và lưu trữ/.test(page) && /Hạn mức và dung lượng/.test(page));
  check("Calendar / Meet / Drive đều ghi trung thực là chưa có tích hợp (không có nút Kết nối giả)", /Google Calendar/.test(page) && /Chưa có đồng bộ lịch/.test(page) && /KiN không tạo phòng họp/.test(page) && !/Kết nối Google|Cấp quyền Google|Đã kết nối/.test(page));
  check("thẻ học sinh: đang học 2 (lớp Toán 1 đã tạm dừng + lớp Lý 1 → 2) trên trần Free", /2 \/ 10/.test(page));
  check("mẫu phiếu và Drive ghi 'Chưa có' / 'Chưa kết nối'; không có thanh % cho chúng", /Mẫu phiếu/.test(page) && /Chưa kết nối/.test(page) && (page.match(/role="progressbar"/g) ?? []).length === 1, (page.match(/role="progressbar"/g) ?? []).length);
  await prisma.fileAsset.create({ data: { ownerId: T.id, courseId: course.id, kind: "video", driver: "local", storageKey: "k1", mimeType: "video/mp4", bytes: 33_554_432, originalName: "bai.mp4", status: "ready" } });
  const page2 = await (await fetch(`${BASE}/lop-cua-toi/cai-dat`, { headers: { cookie: await cookieFor(T) } })).text();
  check("dung lượng đọc từ FileAsset thật: 32 MB, 1 tệp", /32 MB/.test(page2) && /1 tệp/.test(page2));
  // Trang gia sư gửi dòng đầu trước khi chạy redirect() nên trạng thái có thể là 200; điều cần chắc là NỘI DUNG của trang không lộ ra.
  const redirect = await fetch(`${BASE}/lop-cua-toi/cai-dat`, { headers: { cookie: await cookieFor(SA) }, redirect: "manual" });
  const rtext = await redirect.text();
  check("quản trị (không phải gia sư) vào trang gia sư → không thấy khối Kết nối / hạn mức", !/Google và lưu trữ|Hạn mức và dung lượng|Nhóm Zalo của lớp/.test(rtext), redirect.status);

  await done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
