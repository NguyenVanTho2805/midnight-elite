// LOI-04 — API "Nhắc học" (/api/student/nhac-hoc, /[id], /xoa-da-xong) + cron /api/cron/nhac-hoc-sang. Đặc tả: docs/kin/phong-ban/dac-ta/LOI-04.md mục 8.
// Cần máy chủ thử ở BASE (cùng CRON_SECRET trong env.sh). KHÔNG gọi wipe(): dữ liệu mang hậu tố `stamp` riêng của lượt chạy.
//   source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-nhac-hoc.ts
// Chạy sát 00:00 giờ VN có thể đỏ giả (mục "hôm nay" thành "hôm qua" giữa lúc tạo và lúc chạy cron) — bài in giờ VN lúc chạy; chạy lại.
// Cron là việc TOÀN HỆ THỐNG: chạy thật sẽ tạo thông báo cho mọi học sinh trong DB thử có bài/nhắc việc hôm nay (chỉ dùng DB thử).
//
// CA PHÁ (đỏ nếu máy chủ làm sai):
//   • JSON lộ: thân MỌI GET không khớp LEAK_RE (của t-loi03-api) + /userId|notifiedAt|isCorrect/, không mã hex, không NHAP-BI-MAT, không tên/email người —
//     bài 19:30 có Assignment kèm AssignmentQuestion (explanation) + AssignmentOption.isCorrect để bắt lộ.
//   • Gọi trùng: cron chạy thật HAI lần ⇒ lần hai 0 tin mới; PATCH done:true hai lần ⇒ doneAt giữ mốc đầu; xoa-da-xong lần hai ⇒ deleted 0.
//   • Chéo người: B sửa/xoá mục của A ⇒ 404 và mục A không đổi.
//   • Coin: đếm CoinTransaction + Wallet.balance của A trước/sau tạo + xong/bỏ xong ⇒ bằng nhau.
//   • Push: study_today / reminder_due ngoài PUSH_TYPES; notify() với bộ gửi giả + thiết bị giả ⇒ 0 lần gửi (đối chứng: unmarked_daily ⇒ có gửi).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import { addDaysKey, instantOf, vnDateKeyOf, inQuietHours } from "@/lib/classSessions";
import { isPushType } from "@/lib/pushRules";
import { pushToUser, setPushSender, type PushSender } from "@/lib/pushServer";
import { notify } from "@/lib/notify";
import { NHAC_ATTACH_ERROR, NHAC_FULL_ERROR, NHAC_NOT_FOUND_ERROR } from "@/lib/nhacHoc";
import { api, mkUser, mkTutor, mkSuper, mkCourse, check, section, done, BASE, type TUser } from "./h";

const stamp = Date.now().toString(36);
const LEAK_RE = /adminNote|videoUrl|zoomUrl|"documents"|"status"|isLocked|statsViews|ownerId|email|phone|price|feeMode|"bg"|"strip"|tagColor|correct|explanation|loiGiai|options|answer|score|submission|storageKey/i;
const EXTRA_LEAK_RE = /userId|notifiedAt|isCorrect/;
const HEX_RE = /#[0-9a-f]{3,8}\b/i;
const EP = "/api/student/nhac-hoc";
const CRON = "/api/cron/nhac-hoc-sang";

let seq = 0;
const lid = (p: string) => `l-loi04t-${p}-${stamp}-${++seq}`;
async function mkTree(courseId: string) {
  const sid = `s-loi04t-${stamp}-${++seq}`, cid = `c-loi04t-${stamp}-${++seq}`;
  await prisma.section.create({ data: { id: sid, title: "Phần 1", courseId, order: 0 } });
  await prisma.chapter.create({ data: { id: cid, title: "Chương 1", sectionId: sid, order: 0 } });
  return cid;
}
async function mkLesson(chapterId: string, o: { title: string; order: number; scheduledAt: Date | null; status?: string; documents?: string; azotaUrl?: string; videoUrl?: string; adminNote?: string }) {
  const id = lid(o.title.slice(0, 6).replace(/[^a-z]/gi, "x"));
  await prisma.lesson.create({ data: {
    id, code: id.slice(-12), title: o.title, type: "record", chapterId, order: o.order, isLocked: true, status: o.status ?? "published",
    scheduledAt: o.scheduledAt, documents: o.documents ?? "[]", azotaUrl: o.azotaUrl ?? null, videoUrl: o.videoUrl ?? null, adminNote: o.adminNote ?? null,
  } });
  return id;
}

(async () => {
  const now0 = new Date();
  const today = vnDateKeyOf(now0);
  const tomorrow = addDaysKey(today, 1);
  const at = (d: number, h: number, m: number) => instantOf(addDaysKey(today, d), h * 60 + m);
  console.log(`Giờ VN lúc chạy: ${today} ${new Date(now0.getTime() + 7 * 3_600_000).toISOString().slice(11, 16)} · BASE=${BASE}`);
  const cronKey = { authorization: `Bearer ${process.env.CRON_SECRET}` };

  // ── Dữ liệu ──
  const T = await mkTutor(`GiaSuT-${stamp}`);
  const S = await mkSuper(`QuanTriS-${stamp}`);
  const A = await mkUser({ name: `HocSinhA-${stamp}` }), B = await mkUser({ name: `HocSinhB-${stamp}` });
  const C = await mkUser({ name: `HocSinhC-${stamp}` }), D = await mkUser({ name: `HocSinhD-${stamp}` });
  const F = await mkUser({ name: `HocSinhF-${stamp}` }), G = await mkUser({ name: `HocSinhG-${stamp}` });
  const people = [T, S, A, B, C, D, F, G];
  await prisma.user.update({ where: { id: D.id }, data: { deletedAt: new Date(), banned: true } }); // ẩn danh hoá (accountDelete) ⇒ không bao giờ được báo

  const X = await mkCourse(T.id, { name: `Lop X ${stamp}` });
  const Y = await mkCourse(T.id, { name: `Lop Y ${stamp}` });
  const cx = await mkTree(X.id), cy = await mkTree(Y.id);
  const X1930 = await mkLesson(cx, { title: `Bai X toi nay ${stamp}`, order: 0, scheduledAt: at(0, 19, 30),
    documents: JSON.stringify([{ name: "De cuong.pdf", url: "https://res.cloudinary.com/demo/raw/upload/de-cuong.pdf" }]),
    azotaUrl: "https://azota.vn/de-thi/loi04-api", videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", adminNote: `GHICHU-GS-${stamp}` });
  const XNHAP = await mkLesson(cx, { title: `NHAP-BI-MAT-${stamp}`, order: 1, scheduledAt: at(0, 20, 0), status: "draft" });
  const XGAN = await mkLesson(cx, { title: `BAI-GAN-${stamp}`, order: 2, scheduledAt: null });       // gắn rồi chuyển nháp
  const XMAI = await mkLesson(cx, { title: `Bai X ngay mai ${stamp}`, order: 3, scheduledAt: at(1, 19, 30) });
  const YMAI = await mkLesson(cy, { title: `LOP-KHAC-${stamp}`, order: 0, scheduledAt: at(1, 19, 0) }); // lớp Y: KHÔNG có bài hôm nay ⇒ B không vào tóm tắt

  const asg = await prisma.assignment.create({ data: { lessonId: X1930, title: `Phieu X ${stamp}`, instructions: "Lam bai", maxPoints: 10, ownerId: T.id, mode: "quiz" } });
  const q = await prisma.assignmentQuestion.create({ data: { assignmentId: asg.id, order: 1, text: `CAUHOI-${stamp}`, type: "MC", explanation: `LOIGIAI-${stamp}` } });
  await prisma.assignmentOption.createMany({ data: [{ questionId: q.id, order: 1, text: `DAPANDUNG-${stamp}`, isCorrect: true }, { questionId: q.id, order: 2, text: `DAPANSAI-${stamp}`, isCorrect: false }] });

  await prisma.enrollment.create({ data: { userId: A.id, courseId: X.id, status: "active" } });
  await prisma.enrollment.create({ data: { userId: B.id, courseId: Y.id, status: "active" } });
  await prisma.enrollment.create({ data: { userId: C.id, courseId: X.id, status: "suspended" } });
  await prisma.enrollment.create({ data: { userId: D.id, courseId: X.id, status: "active" } });
  await prisma.studentReminder.create({ data: { userId: D.id, title: `D-${stamp}`, dueAt: instantOf(today, 0) } }); // D có việc hôm nay nhưng đã ẩn danh

  const getBodies: { who: string; text: string }[] = [];
  const get = async (u?: TUser, who = u ? people.find(p => p.id === u.id)?.name ?? "?" : "khach") => {
    const r = await api("GET", EP, { as: u });
    getBodies.push({ who, text: r.text });
    return r;
  };
  const post = (u: TUser | undefined, body: unknown, path = EP) => api("POST", path, { as: u, body });
  const patch = (u: TUser | undefined, id: string, body: unknown) => api("PATCH", `${EP}/${encodeURIComponent(id)}`, { as: u, body });
  const del = (u: TUser | undefined, id: string) => api("DELETE", `${EP}/${encodeURIComponent(id)}`, { as: u });
  const noStore = (r: { headers: Headers }) => /private/.test(r.headers.get("cache-control") ?? "") && /no-store/.test(r.headers.get("cache-control") ?? "");

  // Mục đầu tiên của A (không hẹn): dùng cho cổng vai và chéo người.
  const a0 = await post(A, { title: `A-${stamp} Ôn chương 2 #toan #on-thi`, note: `Ghi chú riêng A-${stamp}` });
  check("A tạo mục ⇒ 201, tách #thẻ khỏi tiêu đề", a0.status === 201 && a0.json?.item?.title === `A-${stamp} Ôn chương 2` && JSON.stringify(a0.json.item.tags) === '["toan","on-thi"]', a0.json);
  const aId: string = a0.json?.item?.id ?? "khong-co";
  const aRow0 = JSON.stringify(await prisma.studentReminder.findUnique({ where: { id: aId } }));

  section("Cổng vai: khách 401, gia sư / quản trị 403 ở MỌI route và phương thức; no-store");
  for (const [who, u, want] of [["khách", undefined, 401], ["gia sư T", T, 403], ["quản trị S", S, 403]] as const) {
    const rs = [
      ["GET", await get(u, who)],
      ["POST", await post(u, { title: "x" })],
      ["PATCH", await patch(u, aId, { title: "đổi" })],
      ["DELETE", await del(u, aId)],
      ["POST xoa-da-xong", await post(u, undefined, `${EP}/xoa-da-xong`)],
    ] as const;
    for (const [m, r] of rs) check(`${who} ${m} ⇒ ${want} + private, no-store`, r.status === want && noStore(r), [r.status, r.headers.get("cache-control")]);
  }
  check("mục của A không đổi sau các lượt gọi của khách / gia sư / quản trị", JSON.stringify(await prisma.studentReminder.findUnique({ where: { id: aId } })) === aRow0);
  const c0 = await post(C, { title: `C-${stamp} được tạo (không hẹn)` });
  check("C (học sinh, lớp X đã nghỉ) vẫn dùng được Nhắc học ⇒ 201", c0.status === 201, c0.json);

  section("Chéo người: B không đọc / sửa / xoá được mục của A");
  const pb = await patch(B, aId, { title: `B-sua-${stamp}`, done: true });
  check("B PATCH mục A ⇒ 404, chữ chung", pb.status === 404 && pb.json?.error === NHAC_NOT_FOUND_ERROR && noStore(pb), pb.json);
  const db = await del(B, aId);
  check("B DELETE mục A ⇒ 404", db.status === 404 && db.json?.error === NHAC_NOT_FOUND_ERROR, db.json);
  check("mục A không đổi", JSON.stringify(await prisma.studentReminder.findUnique({ where: { id: aId } })) === aRow0);
  const gb = await get(B);
  check("GET của B ⇒ 200, không chứa tiêu đề / ghi chú / id của A", gb.status === 200 && !gb.text.includes(`A-${stamp}`) && !gb.text.includes(aId), gb.text.slice(0, 200));
  const pk = await patch(A, `khong-co-${stamp}`, { title: "x" });
  check("A PATCH id không có ⇒ 404 cùng chữ", pk.status === 404 && pk.json?.error === NHAC_NOT_FOUND_ERROR);
  const dk = await del(A, `khong-co-${stamp}`);
  check("A DELETE id không có ⇒ 404 cùng chữ", dk.status === 404 && dk.json?.error === NHAC_NOT_FOUND_ERROR);
  check("A PATCH id sai dạng (có dấu chấm) ⇒ 404", (await patch(A, "a.b", { title: "x" })).status === 404);

  section("Giới hạn: 400 / 413 / 409, JSON hỏng");
  for (const [name, body] of [
    ["tiêu đề 201 ký tự", { title: "a".repeat(201) }],
    ["ghi chú 4001 ký tự", { title: "x", note: "n".repeat(4001) }],
    ["11 thẻ", { title: "x", tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }],
    ["thẻ 31 ký tự", { title: "x", tags: ["a".repeat(31)] }],
    ["giờ không ngày", { title: "x", dueTime: "19:30" }],
    ["ngày 31/02", { title: "x", dueDate: "2026-02-31" }],
    ["tiêu đề rỗng sau khi tách #thẻ", { title: "#toan" }],
  ] as const) {
    const r = await post(A, body);
    check(`POST ${name} ⇒ 400 có chữ lỗi tiếng Việt`, r.status === 400 && typeof r.json?.error === "string" && r.json.error.length > 0, [r.status, r.json]);
  }
  check("PATCH tiêu đề 201 ⇒ 400; done \"true\" ⇒ 400; thân rỗng ⇒ 400", (await patch(A, aId, { title: "a".repeat(201) })).status === 400 && (await patch(A, aId, { done: "true" })).status === 400 && (await patch(A, aId, {})).status === 400);
  const big = await post(A, { title: "x", note: "n".repeat(25_000) });
  check("thân 25 KB ⇒ 413", big.status === 413 && noStore(big), [big.status, big.json]);
  const bigP = await patch(A, aId, { note: "n".repeat(25_000) });
  check("PATCH thân 25 KB ⇒ 413", bigP.status === 413, bigP.status);
  const bad = await api("POST", EP, { as: A, raw: "{oops", headers: { "content-type": "application/json" } });
  check("JSON hỏng ⇒ 400", bad.status === 400 && typeof bad.json?.error === "string", [bad.status, bad.json]);
  const badP = await api("PATCH", `${EP}/${aId}`, { as: A, raw: "[1,", headers: { "content-type": "application/json" } });
  check("PATCH JSON hỏng ⇒ 400", badP.status === 400, badP.status);
  await prisma.studentReminder.createMany({ data: Array.from({ length: 500 }, (_, i) => ({ userId: F.id, title: `F-${i}`, doneAt: i % 2 ? new Date() : null })) });
  const full = await post(F, { title: "mục 501" });
  check("đủ 500 mục (kể cả đã xong) ⇒ 409 đúng chữ", full.status === 409 && full.json?.error === NHAC_FULL_ERROR, [full.status, full.json]);
  check("F vẫn đúng 500 mục", (await prisma.studentReminder.count({ where: { userId: F.id } })) === 500);
  const gf = await get(F);
  check("GET của F: used 500, max 500, items 500", gf.json?.used === 500 && gf.json?.max === 500 && gf.json?.items?.length === 500, [gf.json?.used, gf.json?.items?.length]);

  // stu-test (vòng 1): ca kẻ tấn công còn thiếu — token cũ, vượt trần bằng gửi song song, rate limit 120/giờ.
  section("stu-test: token còn ghi 'student' nhưng DB đã đổi vai ⇒ 403; gửi song song không vượt 500; rate limit 120 lần ghi/giờ");
  const H1 = await mkUser({ name: `HocSinhH1-${stamp}` });
  await prisma.user.update({ where: { id: H1.id }, data: { role: "admin", adminRole: "teacher" } }); // cookieFor(H1) vẫn mang role "student"
  const h1g = await get(H1), h1p = await post(H1, { title: `H1-${stamp}` });
  check("token cũ 'student', DB là gia sư: GET ⇒ 403, POST ⇒ 403, không tạo mục", h1g.status === 403 && h1p.status === 403 && (await prisma.studentReminder.count({ where: { userId: H1.id } })) === 0, [h1g.status, h1p.status]);
  const J = await mkUser({ name: `HocSinhJ-${stamp}` });
  await prisma.studentReminder.createMany({ data: Array.from({ length: 495 }, (_, i) => ({ userId: J.id, title: `J-${i}` })) });
  const par = await Promise.all(Array.from({ length: 20 }, (_, i) => post(J, { title: `J song song ${i}` })));
  const jCount = await prisma.studentReminder.count({ where: { userId: J.id } });
  check("495 mục + 20 POST song song ⇒ tổng ≤ 500, số 201 ≤ 5, phần còn lại 409", jCount <= 500 && par.filter(r => r.status === 201).length <= 5 && par.every(r => r.status === 201 || r.status === 409),
    { tong: jCount, s201: par.filter(r => r.status === 201).length, s409: par.filter(r => r.status === 409).length, khac: par.filter(r => r.status !== 201 && r.status !== 409).map(r => r.status) });
  const K = await mkUser({ name: `HocSinhK-${stamp}` });
  people.push(H1, J, K);
  const k0 = await post(K, { title: `K-${stamp}` });
  const kId: string = k0.json?.item?.id ?? "x";
  let kOk = k0.status === 201;
  for (let i = 0; i < 119; i++) { const r = await patch(K, kId, { done: i % 2 === 0 }); if (r.status !== 200) { kOk = false; break; } }
  check("120 lần ghi đầu (1 POST + 119 PATCH) đều qua", kOk);
  const k121 = await patch(K, kId, { title: "lan 121" }), kPost = await post(K, { title: "sau tran" }), kXoa = await post(K, undefined, `${EP}/xoa-da-xong`), kDel = await del(K, kId);
  check("lần ghi thứ 121 ⇒ 429 ở PATCH / POST / xoa-da-xong / DELETE (chung một ô đếm), có no-store", [k121, kPost, kXoa, kDel].every(r => r.status === 429 && noStore(r)), [k121.status, kPost.status, kXoa.status, kDel.status]);
  const kG = await get(K);
  check("đọc không bị chặn: GET vẫn 200; mục K còn đúng 1, tiêu đề không đổi", kG.status === 200 && (await prisma.studentReminder.count({ where: { userId: K.id } })) === 1 && (await prisma.studentReminder.findUnique({ where: { id: kId } }))?.title === `K-${stamp}`, kG.status);

  section("Gắn lớp / bài: mọi kiểu sai ⇒ CÙNG 400, cùng chữ");
  for (const [name, u, body] of [
    ["bài lớp Y (A không học)", A, { title: "x", lessonId: YMAI }],
    ["bài NHÁP của X", A, { title: "x", lessonId: XNHAP }],
    ["courseId lệch bài", A, { title: "x", lessonId: X1930, courseId: Y.id }],
    ["chỉ courseId lớp Y", A, { title: "x", courseId: Y.id }],
    ["id bịa", A, { title: "x", lessonId: `bia-${stamp}` }],
    ["C (X suspended) gắn bài X", C, { title: "x", lessonId: X1930 }],
    ["C gắn lớp X", C, { title: "x", courseId: X.id }],
  ] as const) {
    const r = await post(u, body);
    check(`${name} ⇒ 400 "${NHAC_ATTACH_ERROR}"`, r.status === 400 && r.json?.error === NHAC_ATTACH_ERROR, [r.status, r.json]);
  }
  const pa = await patch(A, aId, { lessonId: XNHAP });
  check("PATCH gắn bài nháp ⇒ 400 cùng chữ", pa.status === 400 && pa.json?.error === NHAC_ATTACH_ERROR, pa.json);
  const g1 = await post(A, { title: `Gan bai ${stamp}`, lessonId: XGAN, dueDate: tomorrow });
  const gi = g1.json?.item;
  check("gắn bài hợp lệ ⇒ 201 có lop (courseId suy từ bài, href bài)", g1.status === 201 && gi?.lop?.courseId === X.id && gi?.lop?.lessonId === XGAN && gi?.lop?.lessonTitle === `BAI-GAN-${stamp}` && gi?.lop?.href === `/student/bai-giang/${XGAN}` && gi?.lop?.courseName === X.name, g1.json);
  const g2 = await post(A, { title: `Gan lop ${stamp}`, courseId: X.id });
  check("chỉ gắn lớp ⇒ 201, lop.lessonId null, href /student/hoc-tap?course=", g2.status === 201 && g2.json?.item?.lop?.lessonId === null && g2.json?.item?.lop?.href === `/student/hoc-tap?course=${encodeURIComponent(X.id)}`, g2.json);
  await prisma.lesson.update({ where: { id: XGAN }, data: { status: "draft" } });
  const gAfter = await get(A);
  const gItem = (gAfter.json?.items ?? []).find((x: { id: string }) => x.id === gi?.id);
  check("bài chuyển nháp ⇒ GET trả lop: null, mục vẫn hiện", !!gItem && gItem.lop === null, gItem);
  check("thân GET không chứa tên / id bài đã chuyển nháp", !gAfter.text.includes(`BAI-GAN-${stamp}`) && !gAfter.text.includes(XGAN));
  const pg = await patch(A, gi?.id ?? "x", { title: `Gan bai doi ten ${stamp}` });
  check("PATCH mục đó sau khi bài thành nháp ⇒ 200, lop: null, không tên bài", pg.status === 200 && pg.json?.item?.lop === null && !pg.text.includes(`BAI-GAN-${stamp}`), pg.json);
  const pu = await patch(A, gi?.id ?? "x", { lessonId: null, courseId: null });
  check("gỡ gắn ⇒ 200, lop null", pu.status === 200 && pu.json?.item?.lop === null);

  section("Máy chủ đặt doneAt / notifiedAt; client không đặt được");
  const sneak = await post(A, { title: `Sneak ${stamp}`, doneAt: "2000-01-01T00:00:00Z", notifiedAt: "2000-01-01T00:00:00Z", userId: B.id });
  const sRow = await prisma.studentReminder.findUnique({ where: { id: sneak.json?.item?.id ?? "x" } });
  check("POST có doneAt/notifiedAt/userId ⇒ mục của A, doneAt null, notifiedAt null", sneak.status === 201 && sRow?.userId === A.id && sRow?.doneAt === null && sRow?.notifiedAt === null, sRow);
  const d1 = await patch(A, sRow?.id ?? "x", { done: true, doneAt: "2000-01-01T00:00:00Z" });
  const doneAt1 = d1.json?.item?.doneAt as string | undefined;
  check("PATCH done:true ⇒ doneAt = giờ máy chủ (không phải 2000)", d1.status === 200 && !!doneAt1 && Math.abs(Date.parse(doneAt1) - Date.now()) < 5 * 60_000, d1.json);
  const d2 = await patch(A, sRow?.id ?? "x", { done: true });
  check("gọi trùng done:true ⇒ doneAt giữ mốc đầu", d2.status === 200 && d2.json?.item?.doneAt === doneAt1, [doneAt1, d2.json?.item?.doneAt]);
  const d3 = await patch(A, sRow?.id ?? "x", { done: false });
  check("done:false ⇒ doneAt null", d3.status === 200 && d3.json?.item?.doneAt === null);

  section("Coin: không route nào cộng / trừ");
  const coinOf = async (u: TUser) => JSON.stringify({ n: await prisma.coinTransaction.count({ where: { userId: u.id } }), w: (await prisma.wallet.findUnique({ where: { userId: u.id } }))?.balance ?? null });
  const coin0 = await coinOf(A);
  const made: string[] = [];
  for (let i = 0; i < 3; i++) { const r = await post(A, { title: `Coin ${i} ${stamp}` }); if (r.json?.item?.id) made.push(r.json.item.id); }
  for (const id of made) { await patch(A, id, { done: true }); await patch(A, id, { done: false }); }
  check("3 lần tạo + xong / bỏ xong ⇒ CoinTransaction + Wallet của A không đổi", made.length === 3 && (await coinOf(A)) === coin0, [coin0, await coinOf(A)]);

  section("Xoá các mục đã xong: chỉ của chính em");
  await patch(A, made[0], { done: true }); await patch(A, made[1], { done: true });
  const bDone = await prisma.studentReminder.create({ data: { userId: B.id, title: `B-xong-${stamp}`, doneAt: new Date() } });
  const aDoneCount = await prisma.studentReminder.count({ where: { userId: A.id, doneAt: { not: null } } });
  const x1 = await post(A, undefined, `${EP}/xoa-da-xong`);
  check("xoa-da-xong ⇒ 200 { deleted: số mục đã xong của A }", x1.status === 200 && x1.json?.deleted === aDoneCount && aDoneCount >= 2 && noStore(x1), [x1.json, aDoneCount]);
  check("mục đã xong của B vẫn còn; mục chưa xong của A vẫn còn", !!(await prisma.studentReminder.findUnique({ where: { id: bDone.id } })) && !!(await prisma.studentReminder.findUnique({ where: { id: made[2] } })));
  const x2 = await post(A, undefined, `${EP}/xoa-da-xong`);
  check("gọi trùng ⇒ deleted 0", x2.status === 200 && x2.json?.deleted === 0, x2.json);
  const dOwn = await del(A, made[2]);
  check("A xoá mục của mình ⇒ 200 { ok: true }; xoá lại ⇒ 404", dOwn.status === 200 && dOwn.json?.ok === true && (await del(A, made[2])).status === 404);

  section("GET của A: mục tự động theo lớp = loadHomNay; bài nháp không lộ");
  // Đúng MỘT mục hẹn hôm nay chưa xong của A (cho cron), cộng một mục hôm nay ĐÃ XONG (không được đếm).
  const due = await post(A, { title: `Hen hom nay ${stamp}`, dueDate: today });
  const dueId: string = due.json?.item?.id ?? "x";
  check("mục hẹn hôm nay chỉ ngày ⇒ 201, dueDate hôm nay, dueTime null", due.status === 201 && due.json?.item?.dueDate === today && due.json?.item?.dueTime === null && due.json?.item?.dueHasTime === false, due.json);
  const dueDone = await post(A, { title: `Hen hom nay da xong ${stamp}`, dueDate: today, dueTime: "06:00" });
  await patch(A, dueDone.json?.item?.id ?? "x", { done: true });
  const ga = await get(A);
  const ja = ga.json as { now: string; todayKey: string; items: Record<string, any>[]; lop: { today: Record<string, any>[]; upcoming: Record<string, any>[] }; used: number; max: number };
  check("now ISO, todayKey = ngày VN của now = hôm nay", typeof ja?.now === "string" && ja.todayKey === vnDateKeyOf(new Date(ja.now)) && ja.todayKey === today, [ja?.now, ja?.todayKey]);
  check("used = số mục trong DB, max 500", ja.used === (await prisma.studentReminder.count({ where: { userId: A.id } })) && ja.max === 500, [ja.used, ja.max]);
  const t1930 = ja.lop?.today?.find(x => x.lessonId === X1930);
  check("lop.today có bài 19:30 kèm docs + azota + baiTapHref", !!t1930 && t1930.time === "19:30" && t1930.docs?.length === 1 && t1930.azota?.[0]?.url === "https://azota.vn/de-thi/loi04-api" && t1930.baiTapHref === `/student/bai-giang/${X1930}?tab=bai-tap`, t1930);
  check("lop.upcoming có bài ngày mai của X", ja.lop?.upcoming?.some(x => x.lessonId === XMAI));
  check("bài NHÁP hẹn hôm nay KHÔNG có trong mục tự động (tên + id)", !ga.text.includes(`NHAP-BI-MAT-${stamp}`) && !ga.text.includes(XNHAP));
  check("không có bài lớp Y", !ga.text.includes(YMAI) && !ga.text.includes(`LOP-KHAC-${stamp}`));
  check("mỗi item đúng khoá NhacItem", ja.items.every(it => JSON.stringify(Object.keys(it).sort()) === '["createdAt","doneAt","dueAt","dueDate","dueHasTime","dueTime","id","lop","note","tags","title"]'), ja.items[0] && Object.keys(ja.items[0]));
  const gaAgain = await get(A);
  check("gọi GET hai lần liền ⇒ items y hệt (chỉ đọc)", JSON.stringify(gaAgain.json?.items) === JSON.stringify(ja.items));

  section("Ca phá JSON lộ — mọi thân GET");
  for (const b of getBodies) {
    const leak = LEAK_RE.exec(b.text) ?? EXTRA_LEAK_RE.exec(b.text);
    check(`GET (${b.who}): không khớp LEAK_RE / userId / notifiedAt / isCorrect`, !leak, leak?.[0]);
    check(`GET (${b.who}): không mã hex, không NHAP-BI-MAT, không câu hỏi/đáp án/lời giải, không ghi chú gia sư`, !HEX_RE.test(b.text) && !b.text.includes("NHAP-BI-MAT") && ![`CAUHOI-${stamp}`, `DAPANDUNG-${stamp}`, `LOIGIAI-${stamp}`, `GHICHU-GS-${stamp}`].some(n => b.text.includes(n)));
    check(`GET (${b.who}): không tên / email người nào`, !people.some(p => b.text.includes(p.name) || b.text.includes(p.email)));
  }

  section("Cron nhac-hoc-sang: khoá, chạy khô, chạy thật hai lần");
  const n0 = await fetch(`${BASE}${CRON}`);
  check("không khoá ⇒ 401", n0.status === 401, n0.status);
  const n1 = await fetch(`${BASE}${CRON}?dryRun=1`, { headers: { authorization: "Bearer sai-khoa-sai-khoa-sai-khoa-123" } });
  check("sai khoá (kể cả dryRun) ⇒ 401", n1.status === 401, n1.status);
  const watched = [A, B, C, D, T, S, G];
  const notifCount = async () => prisma.notification.count({ where: { userId: { in: watched.map(u => u.id) }, type: { in: ["study_today", "reminder_due"] } } });
  const notif0 = await notifCount();
  const dryRes = await fetch(`${BASE}${CRON}?dryRun=1`, { headers: cronKey });
  const dryText = await dryRes.text();
  const dry = JSON.parse(dryText || "{}") as { dryRun: boolean; dateKey: string; studyToday: { userId: string; count: number }[]; reminderDue: { userId: string; count: number }[]; alreadySent: { studyToday: number } };
  const inList = (l: { userId: string; count: number }[] | undefined, u: TUser) => (l ?? []).find(x => x.userId === u.id);
  check("dryRun ⇒ 200, dryRun true, dateKey hôm nay", dryRes.status === 200 && dry.dryRun === true && dry.dateKey === today, dry);
  check("dryRun: A có studyToday 1 (bài nháp không đếm)", inList(dry.studyToday, A)?.count === 1, inList(dry.studyToday, A));
  check("dryRun: A có reminderDue 1 (mục đã xong không đếm)", inList(dry.reminderDue, A)?.count === 1, inList(dry.reminderDue, A));
  for (const [who, u] of [["B (không bài, không mục)", B], ["C (lớp X suspended)", C], ["D (ẩn danh)", D], ["T (gia sư)", T]] as const) {
    check(`dryRun: không có ${who}`, !inList(dry.studyToday, u) && !inList(dry.reminderDue, u));
  }
  check("dryRun: thân chỉ id + số (không stamp, không tên lớp / bài / người)", !dryText.includes(stamp) && !people.some(p => dryText.includes(p.name)), dryText.slice(0, 300));
  check("dryRun: dòng chỉ có khoá userId + count", [...(dry.studyToday ?? []), ...(dry.reminderDue ?? [])].every(x => JSON.stringify(Object.keys(x).sort()) === '["count","userId"]'));
  check("sau dryRun: 0 Notification mới", (await notifCount()) === notif0);
  check("sau dryRun: notifiedAt của mục A vẫn null", (await prisma.studentReminder.findUnique({ where: { id: dueId } }))?.notifiedAt === null);

  const run1 = await (await fetch(`${BASE}${CRON}`, { headers: cronKey })).json() as typeof dry & { notified: { studyToday: number; reminderDue: number } };
  check("chạy thật ⇒ dryRun false, có notified", run1.dryRun === false && typeof run1.notified?.studyToday === "number", run1);
  const aNotif = await prisma.notification.findMany({ where: { userId: A.id, type: { in: ["study_today", "reminder_due"] } }, select: { type: true, title: true, message: true, link: true } });
  check("A đúng 1 study_today + 1 reminder_due", aNotif.filter(n => n.type === "study_today").length === 1 && aNotif.filter(n => n.type === "reminder_due").length === 1, aNotif);
  check("chữ: đúng mẫu đếm, link /student/nhac-hoc", aNotif.some(n => n.type === "study_today" && n.title === "Hôm nay có lớp" && n.message === "Hôm nay bạn có 1 buổi học. Mở Nhắc học để xem phiếu bài.")
    && aNotif.some(n => n.type === "reminder_due" && n.title === "Nhắc việc hôm nay" && n.message === "Bạn có 1 nhắc việc đến hạn hôm nay.") && aNotif.every(n => n.link === "/student/nhac-hoc"), aNotif);
  const leakWords = [stamp, X.name, `Bai X toi nay ${stamp}`, `Hen hom nay ${stamp}`, A.name];
  check("chữ thông báo không chứa stamp, tên lớp, tên bài, tiêu đề mục, tên người", aNotif.every(n => !leakWords.some(w => `${n.title} ${n.message}`.includes(w))), aNotif);
  check("notifiedAt của mục A đã đặt", (await prisma.studentReminder.findUnique({ where: { id: dueId } }))?.notifiedAt instanceof Date);
  check("B, C, D, T, G: 0 thông báo nhắc học", (await prisma.notification.count({ where: { userId: { in: [B, C, D, T, G].map(u => u.id) }, type: { in: ["study_today", "reminder_due"] } } })) === 0);
  const n2 = await notifCount();
  const run2Res = await fetch(`${BASE}${CRON}`, { headers: cronKey });
  const run2 = await run2Res.json() as typeof run1;
  check("chạy thật LẦN 2 ⇒ 0 tin mới (A không còn trong danh sách)", run2Res.status === 200 && (await notifCount()) === n2 && !inList(run2.studyToday, A) && !inList(run2.reminderDue, A), run2);
  check("lần 2: alreadySent.studyToday ≥ 1", (run2.alreadySent?.studyToday ?? 0) >= 1, run2.alreadySent);
  // stu-test: hai lượt chạy CHỒNG nhau (Vercel gọi lại / người bấm tay cùng lúc) — đặc tả mục 7 "giành chỗ trước" ⇒ không báo trùng.
  const H = await mkUser({ name: `HocSinhH-${stamp}` });
  await prisma.enrollment.create({ data: { userId: H.id, courseId: X.id, status: "active" } });
  await prisma.studentReminder.create({ data: { userId: H.id, title: `H-${stamp}`, dueAt: instantOf(today, 0) } });
  const par2 = await Promise.all([0, 1].map(() => fetch(`${BASE}${CRON}`, { headers: cronKey })));
  const hN = await prisma.notification.findMany({ where: { userId: H.id, type: { in: ["study_today", "reminder_due"] } }, select: { type: true } });
  check("hai lượt chạy song song ⇒ cả hai 200; H đúng 1 reminder_due (giành chỗ notifiedAt)", par2.every(r => r.status === 200) && hN.filter(n => n.type === "reminder_due").length === 1, hN);
  check("hai lượt chạy song song ⇒ H đúng 1 study_today", hN.filter(n => n.type === "study_today").length === 1, hN);

  section("Đổi ngày / giờ hẹn ⇒ notifiedAt về null; đổi chữ thì không");
  await patch(A, dueId, { title: `Hen hom nay doi chu ${stamp}` });
  check("PATCH chỉ tiêu đề ⇒ notifiedAt giữ nguyên", (await prisma.studentReminder.findUnique({ where: { id: dueId } }))?.notifiedAt instanceof Date);
  const mv = await patch(A, dueId, { dueDate: tomorrow });
  check("dời sang ngày mai ⇒ 200, notifiedAt null", mv.status === 200 && mv.json?.item?.dueDate === tomorrow && (await prisma.studentReminder.findUnique({ where: { id: dueId } }))?.notifiedAt === null, mv.json);
  await prisma.studentReminder.update({ where: { id: dueId }, data: { notifiedAt: new Date() } });
  const mt = await patch(A, dueId, { dueTime: "15:00" });
  check("thêm giờ (giữ ngày) ⇒ notifiedAt null, dueTime 15:00", mt.status === 200 && mt.json?.item?.dueTime === "15:00" && mt.json?.item?.dueDate === tomorrow && (await prisma.studentReminder.findUnique({ where: { id: dueId } }))?.notifiedAt === null, mt.json);

  section("Push / giờ yên lặng");
  check('isPushType("study_today") === false && isPushType("reminder_due") === false', isPushType("study_today") === false && isPushType("reminder_due") === false);
  const env = { ...process.env, PUSH_ENABLED: "1", VERCEL_ENV: "production" };
  for (const t of ["study_today", "reminder_due"]) {
    const o = await pushToUser(G.id, t, { env, now: at(0, 10, 0) });
    check(`pushToUser(G, "${t}", PUSH_ENABLED=1) ⇒ skipped "type-not-allowed"`, o.skipped === "type-not-allowed" && o.sent === 0, o);
  }
  // Bộ gửi giả + thiết bị giả cho G: notify() hai loại mới KHÔNG gọi bộ gửi; đối chứng unmarked_daily qua pushToUser thì có gọi.
  const sent: string[] = [];
  const fake: PushSender = async (target) => { sent.push(target.endpoint); };
  setPushSender(fake);
  await prisma.pushSubscription.create({ data: { userId: G.id, endpoint: `https://push.example.test/loi04-${stamp}`, p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" } });
  await notify(G.id, { type: "study_today", title: "Hôm nay có lớp", message: "x", link: "/student/nhac-hoc" });
  await notify(G.id, { type: "reminder_due", title: "Nhắc việc hôm nay", message: "x", link: "/student/nhac-hoc" });
  await new Promise(r => setTimeout(r, 800));
  check("notify() study_today / reminder_due ⇒ bộ gửi giả KHÔNG được gọi", sent.length === 0, sent);
  const ctl = await pushToUser(G.id, "unmarked_daily", { env, now: at(0, 10, 0), count: 1 });
  check("đối chứng: unmarked_daily (loại đẩy) lúc 10:00 VN ⇒ bộ gửi giả được gọi (đường đẩy thật sự sống, nên ca trên không xanh giả)", ctl.skipped === null && ctl.sent >= 1 && sent.length >= 1, [ctl, sent.length]);
  setPushSender(null);
  await prisma.pushSubscription.deleteMany({ where: { userId: G.id } });
  await prisma.notification.deleteMany({ where: { userId: G.id } });

  const root = process.cwd();
  const srcOf = (p: string) => readFileSync(join(root, p), "utf8");
  const importsPush = (s: string) => /from\s+["']@\/lib\/pushServer["']|import\(\s*["']@\/lib\/pushServer["']\s*\)/.test(s);
  check("mã cron (route + nhacHocServer) không import pushServer", !importsPush(srcOf("src/app/api/cron/nhac-hoc-sang/route.ts")) && !importsPush(srcOf("src/lib/nhacHocServer.ts")));
  const vj = JSON.parse(srcOf("vercel.json")) as { crons: { path: string; schedule: string }[] };
  const sch = vj.crons.find(c => c.path === CRON)?.schedule ?? "";
  const m = /^(\d+) (\d+) \* \* \*$/.exec(sch);
  const vnMin = m ? ((Number(m[2]) + 7) % 24) * 60 + Number(m[1]) : -1;
  check("vercel.json: nhac-hoc-sang \"5 0 * * *\" = 07:05 VN, ngoài giờ yên lặng", sch === "5 0 * * *" && vnMin === 425 && !inQuietHours(vnMin), [sch, vnMin]);

  await done();
})();
