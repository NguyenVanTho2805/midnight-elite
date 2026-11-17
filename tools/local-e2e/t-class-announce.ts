// TB-LOP (17/11/2026) — API "Thông báo lớp" trên máy chủ dev thật + Postgres cục bộ:
//   POST /api/courses/<id>/thong-bao (form → 303 …/quan-lop/<id>/thong-bao?tb=<mã>, JSON → 201/409/400), GET (JSON), POST …/thong-bao/<tin> (action ghim | bo-ghim | xoa).
// Kiểm: chỉ chủ lớp đăng / ghim / gỡ; ai được đọc; thông báo chỉ tới học sinh active của ĐÚNG lớp, không chép nội dung tin; giới hạn 24 giờ (tính cả tin đã gỡ) và
// số tin ghim, kể cả khi bấm cùng lúc; tin lớp khác coi như không có; tin đã gỡ biến khỏi GET.
// Chạy: source tools/local-e2e/env.sh && TZ=Asia/Ho_Chi_Minh npx tsx tools/local-e2e/t-class-announce.ts
// Ca phá cố ý (17/11/2026): bỏ khoá advisory trong postAnnouncement → ca "bấm cùng lúc" đỏ; bỏ lọc courseId trong removeAnnouncement → ca "tin lớp khác" đỏ.
import { prisma } from "@/lib/prisma";
import { ANNOUNCE_DAILY_LIMIT, ANNOUNCE_PIN_MAX } from "@/lib/classAnnouncement";
import { api, check, done, mkCourse, mkSuper, mkTutor, mkUser, section, wipe, type TUser } from "./h";

const FORM = { "content-type": "application/x-www-form-urlencoded" };
const form = (path: string, as: TUser | undefined, pairs: [string, string][] = []) => api("POST", path, { as, raw: new URLSearchParams(pairs), headers: FORM });
const tbOf = (r: { status: number; headers: Headers }) => { const l = r.headers.get("location"); return r.status === 303 && l ? new URL(l, "http://x").searchParams.get("tb") : `status ${r.status}`; };

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), T2 = await mkTutor("Thầy Minh"), CO = await mkTutor("Cô Đồng"), SU = await mkSuper();
  const S1 = await mkUser({ name: "Em An" }), S2 = await mkUser({ name: "Em Bình" }), SX = await mkUser({ name: "Em Nghỉ" }), SP = await mkUser({ name: "Em Chờ" }), SO = await mkUser({ name: "Em Lớp Khác" }), SN = await mkUser({ name: "Em Ngoài" });
  const C = (await mkCourse(T.id, { name: "Lý 10" })).id;
  const C2 = (await mkCourse(T2.id, { name: "Hoá 11" })).id;
  for (const [u, status] of [[S1, "active"], [S2, "active"], [SX, "suspended"], [SP, "pending_consent"]] as const) await prisma.enrollment.create({ data: { userId: u.id, courseId: C, status } });
  await prisma.enrollment.create({ data: { userId: SO.id, courseId: C2, status: "active" } });
  await prisma.courseTeacher.create({ data: { courseId: C, userId: CO.id, role: "co_teacher", status: "active", invitedBy: T.id } });
  const P = `/api/courses/${C}/thong-bao`;
  const BODY = "Tối thứ Sáu học online. Link: https://meet.google.com/abc-defg-hij\nEm An nhớ mang máy tính.";

  section("1. Chủ lớp đăng bằng form → 303, có tin, thông báo đúng người");
  const r1 = await form(P, T, [["body", BODY], ["pinned", "on"]]);
  check("303 về …/quan-lop/<id>/thong-bao?tb=ok", tbOf(r1) === "ok" && new URL(r1.headers.get("location")!, "http://x").pathname === `/lop-cua-toi/quan-lop/${C}/thong-bao`, { s: r1.status, l: r1.headers.get("location") });
  const row1 = await prisma.classAnnouncement.findFirst({ where: { courseId: C } });
  check("DB: 1 tin, đúng nội dung, đã ghim, người đăng = chủ lớp", row1?.body === BODY && row1?.pinned === true && row1?.authorId === T.id, row1);
  const notes = await prisma.notification.findMany({ where: { type: "class_announcement" } });
  check("thông báo tới đúng 2 em active của lớp (không em nghỉ, em chờ đồng ý, em lớp khác, chủ lớp)", notes.length === 2 && new Set(notes.map(n => n.userId)).size === 2 && notes.every(n => [S1.id, S2.id].includes(n.userId)), notes.map(n => n.userId));
  check("chữ thông báo KHÔNG chép nội dung tin, không tên người; link về tab Thông báo", notes.every(n => !/Em An|meet\.google|máy tính|Cô Lan/.test(n.title + n.message) && n.link === `/student/hoc-tap?course=${C}&tab=thong-bao`), notes[0]);

  section("2. Nội dung sai → không lưu, không gửi");
  check("rỗng → tb=trong", tbOf(await form(P, T, [["body", "   \n "]])) === "trong");
  check("thiếu trường → tb=trong", tbOf(await form(P, T, [])) === "trong");
  check("quá 1500 ký tự → tb=dai", tbOf(await form(P, T, [["body", "a".repeat(1501)]])) === "dai");
  check("vẫn 1 tin, vẫn 2 thông báo", (await prisma.classAnnouncement.count()) === 1 && (await prisma.notification.count({ where: { type: "class_announcement" } })) === 2);
  const j = await api("POST", P, { as: T, body: { body: "Nghỉ học thứ Hai." } });
  check("gửi JSON → 201 { ok }", j.status === 201 && j.json?.ok === true, j);

  section("3. Ai được đăng (chỉ chủ lớp)");
  for (const [who, u, st] of [["gia sư lớp khác", T2, 403], ["đồng giảng", CO, 403], ["quản trị", SU, 403], ["học sinh trong lớp", S1, 403]] as const) {
    const r = await form(P, u, [["body", "x"]]);
    check(`${who} → ${st}`, r.status === st, { s: r.status, j: r.json });
  }
  const guest = await form(P, undefined, [["body", "x"]]);
  check("chưa đăng nhập gửi form → 303 về đăng nhập, quay lại trang Thông báo của lớp", guest.status === 303 && decodeURIComponent(guest.headers.get("location") ?? "").includes(`/dang-nhap?redirect=/lop-cua-toi/quan-lop/${C}/thong-bao`), guest.headers.get("location"));
  check("chưa đăng nhập gửi JSON → 401", (await api("POST", P, { body: { body: "x" } })).status === 401);
  check("CA PHÁ: JSON null / mảng → 400 trong, không 500", (await api("POST", P, { as: T, raw: "null", headers: { "content-type": "application/json" } })).status === 400 && (await api("POST", P, { as: T, raw: "[1]", headers: { "content-type": "application/json" } })).status === 400);
  check("lớp không có → 404", (await form("/api/courses/khong-co-lop/thong-bao", T, [["body", "x"]])).status === 404);
  check("không có tin nào được thêm", (await prisma.classAnnouncement.count()) === 2);

  section("4. Ai được đọc (GET)");
  const g1 = await api("GET", P, { as: S1 });
  check("em active → 200, 2 tin, tin ghim đứng đầu", g1.status === 200 && g1.json?.items?.length === 2 && g1.json.items[0].pinned === true && g1.json.items[0].body === BODY, g1.json);
  check("không trả người đăng / courseId / deletedAt", g1.json?.items?.every((i: Record<string, unknown>) => Object.keys(i).sort().join(",") === "body,createdAt,id,pinned"), g1.json?.items?.[0]);
  for (const [who, u] of [["chủ lớp", T], ["đồng giảng", CO], ["quản trị", SU]] as const) check(`${who} → 200`, (await api("GET", P, { as: u })).status === 200);
  const gx = await api("GET", P, { as: SX });
  check("em đã nghỉ lớp → 403 enrollment_suspended (kèm lối liên hệ gia sư)", gx.status === 403 && gx.json?.code === "enrollment_suspended" && !gx.text.includes("meet.google"), gx.json);
  for (const [who, u] of [["em chờ đồng ý", SP], ["em lớp khác", SO], ["em ngoài", SN], ["gia sư lớp khác", T2]] as const) {
    const r = await api("GET", P, { as: u });
    check(`${who} → 403, không lộ tin`, r.status === 403 && !r.text.includes("meet.google"), r.status);
  }
  check("chưa đăng nhập → 401", (await api("GET", P)).status === 401);

  section("5. Ghim / bỏ ghim (tối đa 3)");
  const ids: string[] = [];
  for (let i = 0; i < 3; i++) ids.push((await prisma.classAnnouncement.create({ data: { courseId: C, authorId: T.id, body: `tin ${i}`, createdAt: new Date(Date.now() - 30 * 3600_000) } })).id);
  const act = (id: string, action: string, u: TUser | undefined = T) => form(`${P}/${id}`, u, [["action", action]]);
  check("ghim tin thứ 2 → tb=ghim", tbOf(await act(ids[0], "ghim")) === "ghim");
  check("ghim tin thứ 3 → tb=ghim", tbOf(await act(ids[1], "ghim")) === "ghim");
  check(`ghim tin thứ ${ANNOUNCE_PIN_MAX + 1} → tb=ghim-day, không đổi`, tbOf(await act(ids[2], "ghim")) === "ghim-day" && (await prisma.classAnnouncement.findUnique({ where: { id: ids[2] } }))?.pinned === false);
  check("đăng mới kèm ghim khi đã đủ → tb=ghim-day, không lưu", tbOf(await form(P, T, [["body", "mới"], ["pinned", "on"]])) === "ghim-day" && (await prisma.classAnnouncement.count({ where: { body: "mới" } })) === 0);
  check("ghim lại tin đã ghim → vẫn tb=ghim (bấm hai lần không lỗi)", tbOf(await act(ids[0], "ghim")) === "ghim");
  check("bỏ ghim → tb=bo-ghim, DB đổi", tbOf(await act(ids[0], "bo-ghim")) === "bo-ghim" && (await prisma.classAnnouncement.findUnique({ where: { id: ids[0] } }))?.pinned === false);
  check("action lạ → 400", (await act(ids[0], "sua")).status === 400);
  check("đồng giảng / em / gia sư khác ghim → 403", (await act(ids[2], "ghim", CO)).status === 403 && (await act(ids[2], "ghim", S1)).status === 403 && (await act(ids[2], "ghim", T2)).status === 403);

  section("6. Gỡ tin");
  const other = await prisma.classAnnouncement.create({ data: { courseId: C2, authorId: T2.id, body: "tin của lớp Hoá" } });
  check("CA PHÁ: gỡ tin LỚP KHÁC qua đường lớp mình → tb=khong-co, tin kia còn nguyên", tbOf(await act(other.id, "xoa")) === "khong-co" && (await prisma.classAnnouncement.findUnique({ where: { id: other.id } }))?.deletedAt === null);
  check("CA PHÁ: ghim tin lớp khác → tb=khong-co", tbOf(await act(other.id, "ghim")) === "khong-co" && (await prisma.classAnnouncement.findUnique({ where: { id: other.id } }))?.pinned === false);
  check("gỡ tin ghim của lớp → tb=xoa, deletedAt đặt, bỏ ghim", tbOf(await act(row1!.id, "xoa")) === "xoa" && await (async () => { const r = await prisma.classAnnouncement.findUnique({ where: { id: row1!.id } }); return !!r?.deletedAt && r.pinned === false; })());
  check("gỡ lần hai → tb=khong-co", tbOf(await act(row1!.id, "xoa")) === "khong-co");
  const g2 = await api("GET", P, { as: S2 });
  check("GET không còn tin đã gỡ", g2.status === 200 && !g2.json.items.some((i: { id: string }) => i.id === row1!.id), g2.json?.items?.map((i: { id: string }) => i.id));
  check("ghim tin đã gỡ → tb=khong-co", tbOf(await act(row1!.id, "ghim")) === "khong-co");

  section("7. Giới hạn 24 giờ (tính cả tin đã gỡ) và bấm cùng lúc");
  const recent = await prisma.classAnnouncement.count({ where: { courseId: C, createdAt: { gt: new Date(Date.now() - 86_400_000) } } });
  const fill = ANNOUNCE_DAILY_LIMIT - 1 - recent;
  for (let i = 0; i < fill; i++) await prisma.classAnnouncement.create({ data: { courseId: C, authorId: T.id, body: `đầy ${i}`, deletedAt: new Date() } });
  const before = await prisma.notification.count({ where: { type: "class_announcement" } });
  const burst = (await Promise.all(Array.from({ length: 6 }, (_, i) => form(P, T, [["body", `cùng lúc ${i}`]])))).map(tbOf);
  check("6 lần bấm cùng lúc khi còn 1 suất → đúng 1 ok, 5 nhieu", burst.filter(x => x === "ok").length === 1 && burst.filter(x => x === "nhieu").length === 5, burst);
  check(`đúng ${ANNOUNCE_DAILY_LIMIT} tin trong 24 giờ`, (await prisma.classAnnouncement.count({ where: { courseId: C, createdAt: { gt: new Date(Date.now() - 86_400_000) } } })) === ANNOUNCE_DAILY_LIMIT);
  check("thông báo chỉ thêm 2 (một lần đăng thành công)", (await prisma.notification.count({ where: { type: "class_announcement" } })) === before + 2);
  check("đăng tiếp → tb=nhieu", tbOf(await form(P, T, [["body", "nữa"]])) === "nhieu");
  check("lớp khác không bị giới hạn của lớp này", tbOf(await form(`/api/courses/${C2}/thong-bao`, T2, [["body", "Hoá: mai kiểm tra 15 phút"]])) === "ok");
  check("tin lớp Hoá chỉ báo cho em lớp Hoá", (await prisma.notification.count({ where: { type: "class_announcement", userId: SO.id } })) === 1 && (await prisma.notification.count({ where: { type: "class_announcement", userId: S1.id } })) === 3);

  done();
})().catch(e => { console.error(e); process.exit(1); });
