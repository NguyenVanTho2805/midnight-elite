// NC2-043 — API /api/student/lich-rieng (cơ sở dữ liệu thật): tạo / đọc / sửa / xoá việc riêng; CHỈ chủ đọc được; chưa đăng nhập 401; dữ liệu sai 400; giới hạn.
import { api, mkUser, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { vnDateKeyOf, addDaysKey } from "@/lib/classSessions";
import { PERSONAL_MAX_PER_USER } from "@/lib/personalEvents";

(async () => {
  await wipe();
  const A = await mkUser({ name: "Minh Anh" }), B = await mkUser({ name: "Bảo Ngọc" });
  const today = vnDateKeyOf(new Date()), tomorrow = addDaysKey(today, 1);
  const ev = { title: "Ôn Sử chương 3", dateKey: tomorrow, startTime: "19:30", endTime: "21:00", note: "Làm đề cương" };

  section("Chưa đăng nhập");
  check("GET → 401", (await api("GET", `/api/student/lich-rieng?from=${today}&to=${tomorrow}`)).status === 401);
  check("POST → 401", (await api("POST", "/api/student/lich-rieng", { body: ev })).status === 401);
  check("PATCH / DELETE → 401", (await api("PATCH", "/api/student/lich-rieng/x", { body: ev })).status === 401 && (await api("DELETE", "/api/student/lich-rieng/x")).status === 401);

  section("Tạo và đọc");
  const c1 = await api("POST", "/api/student/lich-rieng", { as: A, body: ev });
  check("POST hợp lệ → 201, trả đúng việc vừa tạo", c1.status === 201 && c1.json.event.title === ev.title && c1.json.event.dateKey === tomorrow && c1.json.event.startTime === "19:30" && c1.json.event.endTime === "21:00" && c1.json.event.note === "Làm đề cương" && typeof c1.json.event.id === "string", c1.json);
  check("phản hồi KHÔNG lộ userId / mốc tạo", !("userId" in c1.json.event) && !("createdAt" in c1.json.event), Object.keys(c1.json.event));
  const c2 = await api("POST", "/api/student/lich-rieng", { as: A, body: { title: "Học thêm Toán", dateKey: today, startTime: "07:05" } });
  check("chỉ tên + ngày + giờ bắt đầu → 201, endTime / note null", c2.status === 201 && c2.json.event.endTime === null && c2.json.event.note === null, c2.json);
  const list = await api("GET", `/api/student/lich-rieng?from=${today}&to=${tomorrow}`, { as: A });
  check("GET trong khoảng → 2 việc, xếp theo ngày rồi giờ (hôm nay 07:05 trước ngày mai 19:30)", list.status === 200 && list.json.events.map((e: { title: string }) => e.title).join("|") === "Học thêm Toán|Ôn Sử chương 3", list.json);
  check("GET có Cache-Control: no-store", (list.headers.get("cache-control") ?? "").includes("no-store"));
  check("GET ngoài khoảng → rỗng", (await api("GET", `/api/student/lich-rieng?from=${addDaysKey(today, 10)}&to=${addDaysKey(today, 12)}`, { as: A })).json.events.length === 0);

  section("Cô lập: chỉ chủ đọc / sửa / xoá được");
  const lb = await api("GET", `/api/student/lich-rieng?from=${today}&to=${tomorrow}`, { as: B });
  check("học sinh khác GET cùng khoảng → rỗng (không thấy việc của Minh Anh)", lb.status === 200 && lb.json.events.length === 0, lb.json);
  const id = c1.json.event.id as string;
  const pb = await api("PATCH", `/api/student/lich-rieng/${id}`, { as: B, body: { ...ev, title: "Bị sửa trộm" } });
  check("học sinh khác PATCH → 404 (không lộ là có tồn tại), việc gốc không đổi", pb.status === 404 && (await prisma.studentPersonalEvent.findUnique({ where: { id } }))?.title === ev.title, pb.json);
  const db = await api("DELETE", `/api/student/lich-rieng/${id}`, { as: B });
  check("học sinh khác DELETE → 404, việc gốc còn nguyên", db.status === 404 && (await prisma.studentPersonalEvent.count({ where: { id } })) === 1, db.json);
  check("id không có → 404 (cả PATCH lẫn DELETE)", (await api("PATCH", "/api/student/lich-rieng/khong-co", { as: A, body: ev })).status === 404 && (await api("DELETE", "/api/student/lich-rieng/khong-co", { as: A })).status === 404);

  section("Sửa và xoá của chủ");
  const up = await api("PATCH", `/api/student/lich-rieng/${id}`, { as: A, body: { title: "Ôn Sử chương 4", dateKey: tomorrow, startTime: "20:00", endTime: null, note: "" } });
  check("PATCH hợp lệ → 200, trả bản mới (giờ 20:00, bỏ giờ kết thúc và ghi chú)", up.status === 200 && up.json.event.title === "Ôn Sử chương 4" && up.json.event.startTime === "20:00" && up.json.event.endTime === null && up.json.event.note === null, up.json);
  check("PATCH dữ liệu sai (giờ kết thúc trước giờ bắt đầu) → 400, bản ghi không đổi", (await api("PATCH", `/api/student/lich-rieng/${id}`, { as: A, body: { ...ev, startTime: "21:00", endTime: "20:00" } })).status === 400 && (await prisma.studentPersonalEvent.findUnique({ where: { id } }))?.startTime === "20:00");
  const del = await api("DELETE", `/api/student/lich-rieng/${id}`, { as: A });
  check("DELETE của chủ → 200, bản ghi mất", del.status === 200 && (await prisma.studentPersonalEvent.count({ where: { id } })) === 0, del.json);
  check("DELETE lần hai → 404", (await api("DELETE", `/api/student/lich-rieng/${id}`, { as: A })).status === 404);

  section("Dữ liệu sai → 400, không ghi gì");
  const before = await prisma.studentPersonalEvent.count();
  for (const [name, body] of [["tên rỗng", { ...ev, title: "" }], ["ngày không có thật", { ...ev, dateKey: "2026-02-31" }], ["giờ sai", { ...ev, startTime: "99:99" }], ["ghi chú quá dài", { ...ev, note: "x".repeat(301) }], ["mảng", [ev]], ["quá xa trong tương lai", { ...ev, dateKey: addDaysKey(today, 900) }]] as const)
    check(`POST ${name} → 400`, (await api("POST", "/api/student/lich-rieng", { as: A, body })).status === 400);
  const raw = await api("POST", "/api/student/lich-rieng", { as: A, raw: "{không phải json" , headers: { "content-type": "application/json" } });
  check("thân không phải JSON → 400 (không 500)", raw.status === 400, raw.status);
  check("không có bản ghi nào được thêm sau các lần sai", (await prisma.studentPersonalEvent.count()) === before);
  check("GET khoảng sai / quá rộng → 400", (await api("GET", `/api/student/lich-rieng?from=${tomorrow}&to=${today}`, { as: A })).status === 400 && (await api("GET", `/api/student/lich-rieng?from=${today}&to=${addDaysKey(today, 100)}`, { as: A })).status === 400 && (await api("GET", "/api/student/lich-rieng", { as: A })).status === 400);

  section("Giới hạn và xoá theo tài khoản");
  const C = await mkUser({ name: "Nhiều Việc" });
  await prisma.studentPersonalEvent.createMany({ data: Array.from({ length: PERSONAL_MAX_PER_USER }, (_, i) => ({ userId: C.id, title: `v${i}`, dateKey: tomorrow, startTime: "08:00" })) });
  const full = await api("POST", "/api/student/lich-rieng", { as: C, body: ev });
  check(`đủ ${PERSONAL_MAX_PER_USER} việc → POST thêm bị 409 kèm lời hướng dẫn xoá bớt`, full.status === 409 && /xoá bớt/.test(full.json.error), full.json);
  await prisma.user.delete({ where: { id: C.id } });
  check("xoá tài khoản → việc riêng xoá theo (cascade)", (await prisma.studentPersonalEvent.count({ where: { userId: C.id } })) === 0);
  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
