import { api, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), T2 = await mkTutor("Thầy Khang"), N = await mkTutor("Nguyễn Văn Mới");
  await prisma.user.updateMany({ where: { id: { in: [T.id, T2.id] } }, data: { tutorVerified: true } });
  await prisma.user.update({ where: { id: N.id }, data: { tutorVerified: false } });
  await prisma.user.update({ where: { id: T.id }, data: { subjects: ["Toán 9", "Toán 10"] } });
  const S = await mkUser({ name: "Học sinh" });
  const open1 = await mkCourse(T.id, { name: "Toán 9", capacity: 5 });
  const open2 = await mkCourse(T.id, { name: "Toán 10" });
  const closed = await mkCourse(T.id, { name: "Lớp đã đóng", classStatus: "closed" });
  const other = await mkCourse(T2.id, { name: "Lý 9" });
  for (let i = 0; i < 3; i++) await prisma.enrollment.create({ data: { userId: (await mkUser({ name: `HS ${i}` })).id, courseId: open1.id, status: "active" } });
  await prisma.enrollment.create({ data: { userId: (await mkUser({ name: "HS chờ" })).id, courseId: open1.id, status: "pending_consent" } }); // không chiếm chỗ
  for (const [c, d] of [[open1, "2026-09-03"], [open1, "2026-09-10"], [open2, "2026-09-11"], [other, "2026-09-12"]] as const) await prisma.attendanceSession.create({ data: { courseId: c.id, date: new Date(`${d}T00:00:00Z`), createdBy: T.id } });

  section("/api/tutor/post-draft");
  check("chưa đăng nhập → 401; học sinh → bị chặn", (await api("GET", "/api/tutor/post-draft")).status === 401 && [401, 403].includes((await api("GET", "/api/tutor/post-draft", { as: S })).status));
  const d = await api("GET", "/api/tutor/post-draft", { as: T });
  check("200, xưng hô gợi ý 'Cô', môn từ hồ sơ", d.status === 200 && d.json?.pronoun === "Cô" && d.json?.name === "Cô Lan" && JSON.stringify(d.json?.subjects) === JSON.stringify(["Toán 9", "Toán 10"]), d.json);
  check("chỉ lớp đang MỞ của chính gia sư (không lớp đã đóng, không lớp người khác)", JSON.stringify(d.json?.classes?.map((c: any) => c.name).sort()) === JSON.stringify(["Toán 10", "Toán 9"]), d.json?.classes);
  check("chỗ còn: 5 − 3 học sinh đang học = 2 (không tính 'chờ đồng ý'); lớp không giới hạn → null", d.json?.classes?.find((c: any) => c.name === "Toán 9")?.seatsLeft === 2 && d.json?.classes?.find((c: any) => c.name === "Toán 10")?.seatsLeft === null);
  check("số buổi đã dạy = 3 (chỉ lớp của mình, kể cả lớp đã đóng, không lẫn lớp gia sư khác)", d.json?.sessionsTaught === 3, d.json?.sessionsTaught);
  check("hồ sơ công khai: đã duyệt → true", d.json?.profilePublic === true && d.json?.profileLocked === false);
  const d2 = await api("GET", "/api/tutor/post-draft", { as: T2 });
  check("Thầy Khang: xưng 'Thầy', 1 buổi", d2.json?.pronoun === "Thầy" && d2.json?.sessionsTaught === 1);
  const dn = await api("GET", "/api/tutor/post-draft", { as: N });
  check("gia sư chưa duyệt: profilePublic=false (giao diện cảnh báo link chưa mở được), xưng 'Mình'", dn.json?.profilePublic === false && dn.json?.pronoun === "Mình");
  await prisma.user.update({ where: { id: T2.id }, data: { profileLockedAt: new Date(), profileLockReason: "x" } });
  const dl = await api("GET", "/api/tutor/post-draft", { as: T2 });
  check("hồ sơ bị khoá: profilePublic=false, profileLocked=true", dl.json?.profilePublic === false && dl.json?.profileLocked === true);

  section("Nhóm đã lưu (preferences.connections.groups)");
  check("chưa lưu: danh sách rỗng", JSON.stringify(d.json?.groups) === "[]");
  const put = (body: unknown) => api("PUT", "/api/users/me/preferences", { as: T, body });
  check("lưu 2 nhóm (bỏ trùng)", (await put({ connections: { groups: ["Gia sư Toán Hà Nội", "Lớp 9 ôn thi", "gia sư toán hà nội"] } })).status === 200);
  check("đọc lại đúng 2 nhóm, giữ thứ tự", JSON.stringify((await api("GET", "/api/tutor/post-draft", { as: T })).json?.groups) === JSON.stringify(["Gia sư Toán Hà Nội", "Lớp 9 ôn thi"]));
  check("tên quá dài → 400, không ghi đè", (await put({ connections: { groups: ["x".repeat(61)] } })).status === 400 && (await api("GET", "/api/tutor/post-draft", { as: T })).json?.groups?.length === 2);
  check("lưu nhóm không xoá showZalo (gộp khoá)", (await put({ connections: { showZalo: true } })).status === 200 && (await api("GET", "/api/tutor/post-draft", { as: T })).json?.groups?.length === 2);

  section("/api/tutor/channels: lượt mở link của CHÍNH gia sư");
  const vk = (n: number) => `${Math.random().toString(16).slice(2, 10)}-visit-${n}`;
  const visit = (id: string, n: string | undefined, kind: string, v: string) => api("POST", `/api/tutors/${id}/visit`, { body: { n, kind, vk: v }, headers: { "x-forwarded-for": `10.9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` } });
  await prisma.user.update({ where: { id: T2.id }, data: { profileLockedAt: null, profileLockReason: null } }); // mở khoá lại sau phần kiểm tra khoá ở trên
  const a = vk(1), b = vk(2), c = vk(3);
  await visit(T.id, "fb-gia-su-toan-ha-noi", "open", a); await visit(T.id, "fb-gia-su-toan-ha-noi", "full", a);
  await visit(T.id, "fb-gia-su-toan-ha-noi", "open", b); await visit(T.id, "fb-lop-9-on-thi", "open", c);
  await visit(T2.id, "fb-gia-su-toan-ha-noi", "open", a); // của gia sư khác — không được lọt vào số của T
  check("chưa đăng nhập → 401; học sinh → bị chặn", (await api("GET", "/api/tutor/channels")).status === 401 && [401, 403].includes((await api("GET", "/api/tutor/channels", { as: S })).status));
  const ch = await api("GET", "/api/tutor/channels", { as: T });
  const row = (n: string) => ch.json?.rows?.find((r: any) => r.channel === n);
  check("kênh nhóm 1: 2 mở, 1 xem hết (50%); kênh nhóm 2: 1 mở, 0 xem hết", row("fb-gia-su-toan-ha-noi")?.opens === 2 && row("fb-gia-su-toan-ha-noi")?.fulls === 1 && row("fb-gia-su-toan-ha-noi")?.fullRate === 0.5 && row("fb-lop-9-on-thi")?.opens === 1 && row("fb-lop-9-on-thi")?.fulls === 0, ch.json?.rows);
  check("không lẫn số của gia sư khác; nhãn loại 'Nhóm Facebook'", ch.json?.rows?.length === 2 && row("fb-lop-9-on-thi")?.groupLabel === "Nhóm Facebook");
  const ch2 = await api("GET", "/api/tutor/channels", { as: T2 });
  check("gia sư khác chỉ thấy số của mình (1 lượt mở)", ch2.json?.rows?.length === 1 && ch2.json?.rows?.[0]?.opens === 1);
  await prisma.profileVisit.updateMany({ where: { tutorId: T.id, channel: "fb-lop-9-on-thi" }, data: { createdAt: new Date(Date.now() - 45 * 86400_000) } });
  check("lượt cũ hơn 30 ngày không tính; days=90 thì có", !(await api("GET", "/api/tutor/channels", { as: T })).json?.rows?.find((r: any) => r.channel === "fb-lop-9-on-thi") && !!(await api("GET", "/api/tutor/channels?days=90", { as: T })).json?.rows?.find((r: any) => r.channel === "fb-lop-9-on-thi"));
  check("days sai → mặc định 30", (await api("GET", "/api/tutor/channels?days=-5", { as: T })).json?.days === 30);
  done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
