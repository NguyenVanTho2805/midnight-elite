// Học liệu video + tài liệu + Azota — kiểm API thật (máy chủ dev ở BASE) theo ma trận vai x tài nguyên, kèm CA PHÁ CỐ Ý.
// Cần máy chủ thử chạy với KIN_VIDEO_MAX_MB=1 (để thử vượt dung lượng mà không ghi hàng trăm MB lên đĩa):
//   KIN_VIDEO_MAX_MB=1 bash ~/Documents/Code/midnight-elite/.local-dev/wt-up.sh
// Phủ: che nội dung bài cho người chưa ghi danh (courses/[id], context), phát video (/api/media/[id]/stream), tải video lên
// (init → PUT → chốt, báo trước dung lượng/loại/xác nhận), Azota "em đã làm xong" (bảng riêng, không còn Assignment ảo), nộp bài bằng link,
// tách đang xem / đã xong, kiểm link theo ô lúc lưu bài.
import { existsSync } from "node:fs";
import { api, mkUser, mkTutor, mkSuper, mkCourse, wipe, check, section, done, cookieFor, BASE } from "./h";
import { prisma } from "@/lib/prisma";
import { localPathFor } from "@/lib/mediaStorageServer";

const YT = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const AZ = "https://azota.vn/de-thi/abc123";
let seq = 0; const stamp = Date.now().toString(36);

async function mkTree(courseId: string, lessons: Record<string, unknown>[]) {
  const sec = await prisma.section.create({ data: { id: `sec-${stamp}-${++seq}`, title: "Phần 1", order: 1, courseId } });
  const ch = await prisma.chapter.create({ data: { id: `ch-${stamp}-${++seq}`, title: "Chương 1", order: 1, sectionId: sec.id } });
  const out = [];
  for (let i = 0; i < lessons.length; i++) {
    out.push(await prisma.lesson.create({ data: { id: `les-${stamp}-${++seq}`, code: `B${i + 1}`, title: `Bài ${i + 1}`, type: "record", order: i + 1, chapterId: ch.id, isLocked: false, isFree: false, ...lessons[i] } as never }));
  }
  return { chapter: ch, lessons: out };
}

(async () => {
  await wipe();
  const cfg0 = await api("GET", "/api/media/config", { as: await mkTutor("Cấu hình") });
  if (!cfg0.json || cfg0.json.video?.maxBytes !== 1024 * 1024 || !cfg0.json.video?.enabled) {
    console.log("DỪNG: bật máy chủ thử bằng  KIN_VIDEO_MAX_MB=1 bash ~/Documents/Code/midnight-elite/.local-dev/wt-up.sh  (cần kho video cục bộ bật, giới hạn 1 MB). Nhận được:", JSON.stringify(cfg0.json?.video));
    process.exit(2);
  }

  const T = await mkTutor("Gia sư A"), T2 = await mkTutor("Gia sư B"), SUP = await mkSuper("Quản trị");
  const S = await mkUser({ name: "HS đã ghi danh" }), S2 = await mkUser({ name: "HS chưa ghi danh" }), S3 = await mkUser({ name: "HS chờ đồng ý" }), S4 = await mkUser({ name: "HS khác lớp" });
  const A = await mkCourse(T.id, { name: "Lớp A" }), B = await mkCourse(T2.id, { name: "Lớp B" });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: A.id, status: "active" } });
  await prisma.enrollment.create({ data: { userId: S3.id, courseId: A.id, status: "pending_consent" } });
  await prisma.enrollment.create({ data: { userId: S4.id, courseId: B.id, status: "active" } });
  const docs = JSON.stringify([{ name: "Đề.pdf", url: "https://res.cloudinary.com/x/raw/upload/de.pdf" }]);
  const { lessons: [L1, L0, LN] } = await mkTree(A.id, [
    { videoUrl: YT, azotaUrl: AZ, azotaDeadline: "2026-10-30T20:00", documents: docs, adminNote: "ghi chú riêng", zoomUrl: "https://zoom.us/j/123456789" },
    { videoUrl: "https://youtu.be/aaaaaaaaaaa", isFree: true },
    { type: "document" },
  ]);

  section("1. Che nội dung bài cho người chưa ghi danh (MD-03)");
  const leaks = (j: unknown) => /dQw4w9WgXcQ|azota\.vn|de\.pdf|ghi chú riêng|zoom\.us/.test(JSON.stringify(j));
  const guest = await api("GET", `/api/courses/${A.id}`);
  check("khách: GET /api/courses/[id] không có videoUrl, documents, azotaUrl, zoomUrl, ghi chú của bài trả phí", guest.status === 200 && !leaks(guest.json), guest.status);
  check("khách: bài MIỄN PHÍ vẫn giữ link (cho xem thử)", JSON.stringify(guest.json).includes("aaaaaaaaaaa"));
  const s2 = await api("GET", `/api/courses/${A.id}`, { as: S2 });
  check("học sinh chưa ghi danh: không lộ link bài trả phí", s2.status === 200 && !leaks(s2.json));
  const s3 = await api("GET", `/api/courses/${A.id}`, { as: S3 });
  check("học sinh chờ phụ huynh đồng ý (pending_consent): không lộ link", s3.status === 200 && !leaks(s3.json));
  const sOk = await api("GET", `/api/courses/${A.id}`, { as: S });
  check("học sinh đã ghi danh: nhận đủ link", sOk.status === 200 && JSON.stringify(sOk.json).includes("dQw4w9WgXcQ") && JSON.stringify(sOk.json).includes("azota.vn"));
  const tOk = await api("GET", `/api/courses/${A.id}`, { as: T });
  check("gia sư chủ lớp: nhận đủ link", tOk.status === 200 && JSON.stringify(tOk.json).includes("dQw4w9WgXcQ"));
  const ctxFree = await api("GET", `/api/lessons/${L0.id}/context`, { as: S2 });
  check("context bài MIỄN PHÍ cho người chưa vào lớp: 200 nhưng KHÔNG lộ link của bài trả phí cùng khoá", ctxFree.status === 200 && !leaks(ctxFree.json.course), ctxFree.status);
  const ctxPaid = await api("GET", `/api/lessons/${L1.id}/context`, { as: S2 });
  check("context bài TRẢ PHÍ cho người chưa vào lớp → 403", ctxPaid.status === 403, ctxPaid.status);
  check("context bài trả phí cho học sinh chờ đồng ý → 403", (await api("GET", `/api/lessons/${L1.id}/context`, { as: S3 })).status === 403);

  section("1b. Link nhóm Zalo + link học online của lớp: chỉ người trong lớp (cột Course: zaloGroupLink, zaloGroupUrl, classJoinUrl)");
  const ZG = "https://zalo.me/g/abc123", ZU = "https://zalo.me/g/xyz789", CJ = "https://meet.google.com/abc-defg-hij";
  await prisma.course.update({ where: { id: A.id }, data: { zaloGroupLink: ZG, zaloGroupUrl: ZU, classJoinUrl: CJ } });
  const zleak = (j: unknown) => /zalo\.me\/g\/|meet\.google\.com/.test(JSON.stringify(j));
  const zfull = (j: unknown) => { const t = JSON.stringify(j); return t.includes(ZG) && t.includes(ZU) && t.includes(CJ); };
  const rowA = (r: { json: unknown }) => (Array.isArray(r.json) ? r.json : []).find((c: { id: string }) => c.id === A.id);
  const outsiders = [["khách", undefined], ["học sinh chưa ghi danh", S2], ["học sinh chờ đồng ý", S3], ["học sinh lớp khác", S4], ["gia sư lớp khác", T2]] as const;
  const members = [["học sinh đang học", S], ["gia sư chủ lớp", T], ["quản trị", SUP]] as const;
  for (const [ten, who] of outsiders) {
    const d = await api("GET", `/api/courses/${A.id}`, who ? { as: who } : undefined);
    check(`${ten}: GET /api/courses/[id] KHÔNG lộ link nhóm Zalo / link học online`, d.status === 200 && !zleak(d.json), d.status);
    const l = await api("GET", "/api/courses", who ? { as: who } : undefined);
    check(`${ten}: GET /api/courses (danh sách công khai) có lớp A nhưng KHÔNG lộ ba link`, l.status === 200 && !!rowA(l) && !zleak(l.json), l.status);
  }
  for (const [ten, who] of members) {
    const d = await api("GET", `/api/courses/${A.id}`, { as: who });
    check(`${ten}: GET /api/courses/[id] vẫn nhận đủ ba link`, d.status === 200 && zfull(d.json), d.status);
    const l = await api("GET", "/api/courses", { as: who });
    check(`${ten}: GET /api/courses vẫn nhận đủ ba link của lớp A`, l.status === 200 && !!rowA(l) && zfull(rowA(l)), l.status);
  }
  for (const [ten, who] of [["gia sư chủ lớp", T], ["quản trị", SUP]] as const) {
    const l = await api("GET", "/api/courses?all=1", { as: who });
    check(`${ten}: bảng quản trị (?all=1) vẫn nhận đủ ba link`, l.status === 200 && !!rowA(l) && zfull(rowA(l)), l.status);
  }
  for (const [ten, who] of [["học sinh chưa ghi danh", S2], ["học sinh chờ đồng ý", S3], ["gia sư lớp khác", T2]] as const) {
    const c = await api("GET", `/api/lessons/${L0.id}/context`, { as: who });
    check(`${ten}: context bài miễn phí → 200 nhưng KHÔNG lộ ba link (cả course lẫn lesson.chapter.section.course)`, c.status === 200 && !zleak(c.json), c.status);
  }
  const cOk = await api("GET", `/api/lessons/${L0.id}/context`, { as: S });
  check("học sinh đang học: context vẫn nhận đủ ba link", cOk.status === 200 && zfull(cOk.json), cOk.status);

  section("2. Tải video lên (init → PUT → chốt): báo trước, giới hạn, quyền");
  const initBody = (o: Record<string, unknown> = {}) => ({ courseId: A.id, fileName: "bai-1.mp4", size: 1000, mimeType: "video/mp4", confirmedNotice: true, ...o });
  check("học sinh xin tải video → bị chặn (403)", (await api("POST", "/api/media/video/init", { as: S, body: initBody() })).status === 403);
  check("không đăng nhập → 401", (await api("POST", "/api/media/video/init", { body: initBody() })).status === 401);
  check("KHÔNG tích xác nhận bản quyền/riêng tư → 400, nêu rõ", (await api("POST", "/api/media/video/init", { as: T, body: initBody({ confirmedNotice: false }) })).json?.error?.includes("xác nhận"));
  check("xác nhận gửi dạng chuỗi 'true' (không phải boolean true) → 400", (await api("POST", "/api/media/video/init", { as: T, body: initBody({ confirmedNotice: "true" }) })).status === 400);
  const other = await api("POST", "/api/media/video/init", { as: T2, body: initBody() });
  check("gia sư LỚP KHÁC xin tải vào lớp A → 403", other.status === 403, other.json);
  const big = await api("POST", "/api/media/video/init", { as: T, body: initBody({ size: 5 * 1024 * 1024 }) });
  check("khai nặng 5 MB > giới hạn 1 MB → 400 kèm lý do + gợi ý YouTube, chưa tạo hàng nào", big.status === 400 && /vượt giới hạn/.test(big.json?.error ?? "") && (await prisma.fileAsset.count()) === 0, big.json);
  const exe = await api("POST", "/api/media/video/init", { as: T, body: initBody({ fileName: "virus.exe", mimeType: "application/x-msdownload" }) });
  check("tệp .exe → 400 (chỉ nhận .mp4 .webm .mov .m4v)", exe.status === 400 && /Chỉ nhận video/.test(exe.json?.error ?? ""), exe.json);
  check("tên 'video.mp4.exe' → 400", (await api("POST", "/api/media/video/init", { as: T, body: initBody({ fileName: "video.mp4.exe" }) })).status === 400);
  check("size 0 hoặc âm → 400", (await api("POST", "/api/media/video/init", { as: T, body: initBody({ size: 0 }) })).status === 400 && (await api("POST", "/api/media/video/init", { as: T, body: initBody({ size: -5 }) })).status === 400);
  check("khoá học không tồn tại → 404", (await api("POST", "/api/media/video/init", { as: T, body: initBody({ courseId: "khong-co" }) })).status === 404);

  const init = await api("POST", "/api/media/video/init", { as: T, body: initBody({ fileName: "../../etc/passwd-bai.mp4" }) });
  check("init hợp lệ → 200, kho local, link kin-media:<mã>", init.status === 200 && init.json.driver === "local" && /^kin-media:[A-Za-z0-9_-]{8,40}$/.test(init.json.link), init.json);
  const asset = await prisma.fileAsset.findUnique({ where: { id: init.json.assetId } });
  check("tên có ../ bị làm sạch: khoá lưu nằm trong thư mục kho, không chứa '..'", !!asset && !asset.storageKey.includes("..") && (() => { try { localPathFor(asset.storageKey); return true; } catch { return false; } })(), asset?.storageKey);
  const bytes = Buffer.alloc(300_000, 7);
  check("người khác (gia sư B) PUT vào phiên của gia sư A → 404", (await api("PUT", `/api/media/upload/${init.json.assetId}`, { as: T2, raw: bytes })).status === 404);
  check("học sinh PUT → 403", (await api("PUT", `/api/media/upload/${init.json.assetId}`, { as: S, raw: bytes })).status === 403);
  const stream0 = await api("GET", `/api/media/${init.json.assetId}/stream`, { as: T });
  check("video CHƯA tải xong (pending) không phát được kể cả chủ → 404", stream0.status === 404);
  const put = await api("PUT", `/api/media/upload/${init.json.assetId}`, { as: T, raw: bytes });
  check("PUT hợp lệ → 200, bytes ghi đúng (sai lệch 0)", put.status === 200 && put.json.bytes === bytes.length, put.json);
  check("bytes trong FileAsset khớp, status ready", (await prisma.fileAsset.findUnique({ where: { id: init.json.assetId } }))?.bytes === bytes.length);
  check("PUT lần hai vào phiên đã xong → 409", (await api("PUT", `/api/media/upload/${init.json.assetId}`, { as: T, raw: bytes })).status === 409);
  const init2 = await api("POST", "/api/media/video/init", { as: T, body: initBody() });
  const huge = await api("PUT", `/api/media/upload/${init2.json.assetId}`, { as: T, raw: Buffer.alloc(2 * 1024 * 1024, 1) });
  const a2 = await prisma.fileAsset.findUnique({ where: { id: init2.json.assetId } });
  check("tải thực tế 2 MB > 1 MB (dù khai nhỏ ở init) → 413, tệp dở bị xoá, vẫn pending", huge.status === 413 && a2?.status === "pending" && !existsSync(localPathFor(a2.storageKey)), [huge.status, a2?.status]);
  const empty = await api("PUT", `/api/media/upload/${init2.json.assetId}`, { as: T, raw: Buffer.alloc(0) });
  check("tệp rỗng → 400", empty.status === 400, empty.status);
  let n = 0; for (let i = 0; i < 12; i++) { const r = await api("POST", "/api/media/video/init", { as: T, body: initBody() }); if (r.status === 429) n++; }
  check("mở quá nhiều phiên tải dở → bị chặn 429 (chống đầy đĩa)", n > 0, n);
  await prisma.fileAsset.deleteMany({ where: { status: "pending" } });

  section("3. Phát video đã tải lên: ma trận vai x quyền (MD-04)");
  const assetId = init.json.assetId as string, link = init.json.link as string;
  const attach = await api("PUT", `/api/lessons/${L1.id}`, { as: T, body: { videoUrl: link } });
  check("gia sư gắn video đã tải vào bài của lớp mình → 200", attach.status === 200, attach.json);
  check("FileAsset được gắn lessonId", (await prisma.fileAsset.findUnique({ where: { id: assetId } }))?.lessonId === L1.id);
  const st = (u: Awaited<ReturnType<typeof mkUser>> | null, h: Record<string, string> = {}) => api("GET", `/api/media/${assetId}/stream`, { as: u ?? undefined, headers: h });
  check("khách (không đăng nhập) → 401", (await st(null)).status === 401);
  check("học sinh CHƯA ghi danh → 403", (await st(S2)).status === 403);
  check("học sinh CHỜ PHỤ HUYNH ĐỒNG Ý → 403", (await st(S3)).status === 403);
  check("học sinh ghi danh lớp KHÁC → 403", (await st(S4)).status === 403);
  check("gia sư lớp khác → 403", (await st(T2)).status === 403);
  const okS = await st(S);
  check("học sinh đã ghi danh → 200, đủ byte, không cache công khai, nosniff", okS.status === 200 && okS.text.length === bytes.length && /no-store/.test(okS.headers.get("cache-control") ?? "") && okS.headers.get("x-content-type-options") === "nosniff", [okS.status, okS.headers.get("cache-control")]);
  const rng = await st(S, { range: "bytes=0-99" });
  check("Range bytes=0-99 → 206, đúng 100 byte, Content-Range", rng.status === 206 && rng.text.length === 100 && /bytes 0-99\/300000/.test(rng.headers.get("content-range") ?? ""), [rng.status, rng.headers.get("content-range")]);
  check("Range vượt cỡ tệp → 416", (await st(S, { range: "bytes=999999-9999999" })).status === 416);
  check("gia sư chủ lớp → 200", (await st(T)).status === 200);
  check("quản trị cấp 1 → 200", (await st(SUP)).status === 200);
  check("mã video sai dạng (../) → 404", (await api("GET", "/api/media/..%2F..%2Fetc/stream", { as: S })).status === 404);
  const freeAsset = await prisma.fileAsset.create({ data: { ownerId: T.id, courseId: A.id, kind: "video", driver: "local", storageKey: (await prisma.fileAsset.findUnique({ where: { id: assetId } }))!.storageKey, mimeType: "video/mp4", bytes: bytes.length, originalName: "x.mp4", status: "ready", lessonId: L0.id } });
  await prisma.lesson.update({ where: { id: L0.id }, data: { videoUrl: `kin-media:${freeAsset.id}` } });
  check("video của bài MIỄN PHÍ: người chưa ghi danh xem thử được → 200", (await api("GET", `/api/media/${freeAsset.id}/stream`, { as: S2 })).status === 200);
  const foreign = await prisma.fileAsset.create({ data: { ownerId: T2.id, courseId: B.id, kind: "video", driver: "local", storageKey: (await prisma.fileAsset.findUnique({ where: { id: assetId } }))!.storageKey, mimeType: "video/mp4", bytes: bytes.length, originalName: "y.mp4", status: "ready" } });
  check("video của lớp B CHƯA gắn vào bài nào: học sinh lớp A → 403", (await api("GET", `/api/media/${foreign.id}/stream`, { as: S })).status === 403);
  const dangling = await prisma.fileAsset.create({ data: { ownerId: T.id, courseId: A.id, kind: "video", driver: "local", storageKey: `${A.id}/khong-ton-tai.mp4`, mimeType: "video/mp4", bytes: 10, originalName: "z.mp4", status: "ready" } });
  check("tệp trong DB nhưng mất trên đĩa → 404 (không treo, không lộ đường dẫn)", (await api("GET", `/api/media/${dangling.id}/stream`, { as: T })).status === 404);

  section("4. Gắn video / link vào bài: máy chủ tự kiểm theo ô (MD-01, MD-04)");
  const bad = (r: { status: number; json: { error?: string } | null }) => r.status === 400;
  check("dán link Azota vào ô Video → 400", bad(await api("PUT", `/api/lessons/${L1.id}`, { as: T, body: { videoUrl: AZ } })));
  check("dán link Zoom vào ô Video → 400", bad(await api("PUT", `/api/lessons/${L1.id}`, { as: T, body: { videoUrl: "https://zoom.us/j/987654321" } })));
  check("dán link youtube giả mạo máy chủ vào ô Video → 400", bad(await api("PUT", `/api/lessons/${L1.id}`, { as: T, body: { videoUrl: "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ" } })));
  check("link javascript: vào ô Video → 400", bad(await api("PUT", `/api/lessons/${L1.id}`, { as: T, body: { videoUrl: "javascript:alert(1)" } })));
  check("video của LỚP KHÁC (kin-media) gắn vào bài lớp A → 400", bad(await api("PUT", `/api/lessons/${L1.id}`, { as: T, body: { videoUrl: `kin-media:${foreign.id}` } })));
  check("mã kin-media không tồn tại → 400", bad(await api("PUT", `/api/lessons/${L1.id}`, { as: T, body: { videoUrl: "kin-media:khongcotrongdb123" } })));
  check("gia sư LỚP KHÁC sửa bài của lớp A → 403", (await api("PUT", `/api/lessons/${L1.id}`, { as: T2, body: { title: "x" } })).status === 403);
  check("hai link (JSON mảng YouTube + Vimeo) → 200", (await api("PUT", `/api/lessons/${L1.id}`, { as: T, body: { videoUrl: JSON.stringify([YT, "https://vimeo.com/123456789"]) } })).status === 200);
  check("tài liệu javascript: → 400", bad(await api("PUT", `/api/lessons/${L1.id}`, { as: T, body: { documents: JSON.stringify([{ name: "x", url: "javascript:alert(1)" }]) } })));
  check("tài liệu: quá 30 mục → 400", bad(await api("PUT", `/api/lessons/${L1.id}`, { as: T, body: { documents: JSON.stringify(Array.from({ length: 31 }, (_, i) => ({ name: `t${i}`, url: `https://res.cloudinary.com/x/raw/upload/${i}.pdf` }))) } })));
  await api("PUT", `/api/lessons/${L1.id}`, { as: T, body: { videoUrl: link } });

  section("5. Azota: 'Em đã làm xong' (bảng riêng, không Assignment ảo) — MD-14");
  const done0 = await api("GET", `/api/lessons/${L1.id}/azota-done`, { as: S });
  check("trước khi bấm: done=false", done0.status === 200 && done0.json.done === false, done0.json);
  check("khách bấm → 401", (await api("POST", `/api/lessons/${L1.id}/azota-done`, { body: {} })).status === 401);
  check("học sinh CHƯA ghi danh bấm → 403", (await api("POST", `/api/lessons/${L1.id}/azota-done`, { as: S2, body: {} })).status === 403);
  check("học sinh CHỜ ĐỒNG Ý bấm → 403", (await api("POST", `/api/lessons/${L1.id}/azota-done`, { as: S3, body: {} })).status === 403);
  check("gia sư bấm 'em đã làm' → 403", (await api("POST", `/api/lessons/${L1.id}/azota-done`, { as: T, body: {} })).status === 403);
  check("bài KHÔNG có Azota (L0) → 400", (await api("POST", `/api/lessons/${L0.id}/azota-done`, { as: S, body: {} })).status === 400);
  const d1 = await api("POST", `/api/lessons/${L1.id}/azota-done`, { as: S, body: {} });
  check("học sinh đã ghi danh bấm → 200 kind=done, không link", d1.status === 200 && d1.json.kind === "done" && d1.json.link === null, d1.json);
  check("KHÔNG tạo Assignment ảo nào cho bài", (await prisma.assignment.count({ where: { lessonId: L1.id } })) === 0);
  check("KHÔNG có AssignmentSubmission nào", (await prisma.assignmentSubmission.count()) === 0);
  const wl = await api("POST", `/api/lessons/${L1.id}/azota-done`, { as: S, body: { linkUrl: "azota.vn/bai-lam/xyz789" } });
  check("kèm link bài làm azota.vn (thiếu https tự bù) → 200 kind=link, link chuẩn hoá https", wl.status === 200 && wl.json.kind === "link" && wl.json.link === "https://azota.vn/bai-lam/xyz789", wl.json);
  for (const [name, v] of [["ảnh .jpg trên azota.vn", "https://azota.vn/anh/bai-lam.jpg"], ["ảnh .png", "https://azota.vn/a/b.png"], ["máy chủ lạ", "https://evil.example/azota.vn"], ["azota.vn.evil.example", "https://azota.vn.evil.example/x"], ["javascript:", "javascript:alert(1)"], ["data: ảnh", "data:image/png;base64,AAAA"], ["http thường", "http://azota.vn/x"], ["có khoảng trắng", "https://azota.vn/a b"], ["quá dài", "https://azota.vn/" + "a".repeat(600)]] as const) {
    const r = await api("POST", `/api/lessons/${L1.id}/azota-done`, { as: S, body: { linkUrl: v } });
    check(`link bài làm ${name} → 400, không lưu`, r.status === 400, [r.status, r.json]);
  }
  check("sau các lần bị từ chối vẫn giữ bản đúng trước đó", (await prisma.lessonAzotaDone.findFirst({ where: { lessonId: L1.id, userId: S.id } }))?.linkUrl === "https://azota.vn/bai-lam/xyz789");
  check("bản ghi không có trường ảnh (kind chỉ là done/link)", ["done", "link"].includes((await prisma.lessonAzotaDone.findFirst({ where: { lessonId: L1.id } }))!.kind));
  const stT = await api("GET", `/api/lessons/${L1.id}/azota-status`, { as: T });
  const rowS = stT.json?.rows?.find((r: { userId: string }) => r.userId === S.id);
  check("gia sư chủ lớp thấy bảng đã làm / chưa làm: 1/1 em đang học đã làm", stT.status === 200 && stT.json.total === 1 && stT.json.done === 1 && rowS?.done === true && !!rowS?.link, stT.json);
  check("học sinh chờ đồng ý KHÔNG nằm trong bảng", !stT.json.rows.some((r: { userId: string }) => r.userId === S3.id));
  check("gia sư LỚP KHÁC xem bảng → 403", (await api("GET", `/api/lessons/${L1.id}/azota-status`, { as: T2 })).status === 403);
  check("học sinh xem bảng của gia sư → 403", (await api("GET", `/api/lessons/${L1.id}/azota-status`, { as: S })).status === 403);
  check("khách xem bảng → 401", (await api("GET", `/api/lessons/${L1.id}/azota-status`)).status === 401);
  const asgS = await api("GET", `/api/lessons/${L1.id}/assignments`, { as: S });
  check("danh sách bài tập của học sinh KHÔNG có bài 'Azota' ảo", asgS.status === 200 && Array.isArray(asgS.json) && asgS.json.length === 0, asgS.json);
  check("đường nộp tệp cũ cho 'azota-<bài>' → 404 (không đưa tệp/ảnh vào)", (await api("POST", `/api/assignments/azota-${L1.id}/submit`, { as: S, body: { fileUrl: "https://x.example/anh.jpg" } })).status === 404);
  const ghost = await prisma.assignment.create({ data: { id: `azota-ghost-${stamp}`, lessonId: L1.id, title: "Bài Azota ảo cũ", mode: "azota", maxPoints: 10, ownerId: T.id } });
  check("dữ liệu cũ mode='azota': nộp tệp vào vẫn bị chặn 404", (await api("POST", `/api/assignments/${ghost.id}/submit`, { as: S, body: { fileUrl: "https://x.example/anh.jpg" } })).status === 404);
  check("dữ liệu cũ mode='azota': không hiện trong danh sách bài tập của học sinh", (await api("GET", `/api/lessons/${L1.id}/assignments`, { as: S })).json.length === 0);
  await prisma.assignment.delete({ where: { id: ghost.id } });
  const undo = await api("DELETE", `/api/lessons/${L1.id}/azota-done`, { as: S });
  check("bỏ đánh dấu → done=false, bảng gia sư cập nhật 0/1", undo.json.done === false && (await api("GET", `/api/lessons/${L1.id}/azota-status`, { as: T })).json.done === 0);
  check("bỏ đánh dấu của người khác không ảnh hưởng: S2 xoá không lỗi", (await api("DELETE", `/api/lessons/${L1.id}/azota-done`, { as: S2 })).status === 200);

  section("6. Nộp bài tự nộp bằng LINK (MD-14) — chỉ link, không ảnh");
  const asg = await prisma.assignment.create({ data: { id: `asg-${stamp}`, lessonId: L1.id, title: "Bài tự nộp", mode: "file", maxPoints: 10, ownerId: T.id } });
  const sub1 = await api("POST", `/api/assignments/${asg.id}/submit`, { as: S, body: { linkUrl: AZ } });
  check("nộp bằng link azota.vn → 200, kind=link", sub1.status === 200 && sub1.json.kind === "link", sub1.json);
  check("nộp bằng link ảnh → 400", (await api("POST", `/api/assignments/${asg.id}/submit`, { as: S, body: { linkUrl: "https://azota.vn/x/anh.jpeg" } })).status === 400);
  check("nộp bằng link máy chủ lạ → 400", (await api("POST", `/api/assignments/${asg.id}/submit`, { as: S, body: { linkUrl: "https://drive.google.com/file/d/abcdefghijk/view" } })).status === 400);
  check("nộp thiếu cả tệp lẫn link → 400", (await api("POST", `/api/assignments/${asg.id}/submit`, { as: S, body: {} })).status === 400);
  check("học sinh CHƯA ghi danh nộp → 403", (await api("POST", `/api/assignments/${asg.id}/submit`, { as: S2, body: { linkUrl: AZ } })).status === 403);
  const sub2 = await api("POST", `/api/assignments/${asg.id}/submit`, { as: S, body: { fileUrl: "https://res.cloudinary.com/x/raw/upload/bai.pdf", fileName: "bai.pdf" } });
  check("đường nộp TỆP cũ vẫn chạy (kind=file)", sub2.status === 200 && sub2.json.kind === "file", sub2.json);

  section("7. Tách 'đang xem' và 'đã xong' (MD-06) + xem tiếp (MD-05)");
  check("PATCH giây không hợp lệ (-1, chữ) → 400", (await api("PATCH", `/api/progress/${LN.id}`, { as: S, body: { watchedSeconds: -1 } })).status === 400 && (await api("PATCH", `/api/progress/${LN.id}`, { as: S, body: { watchedSeconds: "abc" } })).status === 400);
  check("PATCH khi chưa ghi danh → 403", (await api("PATCH", `/api/progress/${L1.id}`, { as: S2, body: { watchedSeconds: 30 } })).status === 403);
  const p1 = await api("PATCH", `/api/progress/${L1.id}`, { as: S, body: { watchedSeconds: 312 } });
  check("xem dở: lưu 312 giây, completed=false", p1.status === 200 && p1.json.watchedSeconds === 312 && p1.json.completed === false, p1.json);
  const g1 = (await api("GET", "/api/progress", { as: S })).json;
  check("GET: bài nằm ở watching + positions[312], KHÔNG nằm trong completedIds (xem 30% không thành 'xong')", g1.watching[L1.id] === 312 && g1.positions[L1.id] === 312 && !g1.completedIds.includes(L1.id), g1);
  const p2 = await api("POST", `/api/progress/${L1.id}`, { as: S, body: {} });
  check("đánh dấu xong KHÔNG ghi đè giây xem về 0", p2.status === 200 && p2.json.completed === true && p2.json.watchedSeconds === 312, p2.json);
  const g2 = (await api("GET", "/api/progress", { as: S })).json;
  check("sau khi xong: có trong completedIds, không còn trong watching, positions vẫn 312 (xem lại từ chỗ cũ)", g2.completedIds.includes(L1.id) && !(L1.id in g2.watching) && g2.positions[L1.id] === 312 && g2.byCourse[A.id] === 1, g2);
  await api("DELETE", `/api/progress/${L1.id}`, { as: S });
  const g3 = (await api("GET", "/api/progress", { as: S })).json;
  check("bỏ đánh dấu xong: giữ giây xem, quay về 'đang xem'", !g3.completedIds.includes(L1.id) && g3.watching[L1.id] === 312, g3);
  const p3 = await api("PATCH", `/api/progress/${L1.id}`, { as: S, body: { watchedSeconds: 99999999 } });
  check("giây xem quá lớn bị kẹp 24 giờ (86400)", p3.status === 200 && p3.json.watchedSeconds === 86400, p3.json);
  check("tiến độ của học sinh này không lẫn sang học sinh khác", Object.keys((await api("GET", "/api/progress", { as: S4 })).json.positions).length === 0);

  section("8. Tài liệu: giới hạn khi lưu");
  const okDoc = await api("PUT", `/api/lessons/${L1.id}`, { as: T, body: { documents: JSON.stringify([{ name: "A.pdf", url: "https://res.cloudinary.com/x/raw/upload/a.pdf" }, { name: "B", url: "https://docs.google.com/document/d/abcdefghijk/edit" }]) } });
  check("tài liệu Cloudinary + Google Docs hợp lệ → 200", okDoc.status === 200, okDoc.json);
  check("tài liệu http (không https) → 400", bad(await api("PUT", `/api/lessons/${L1.id}`, { as: T, body: { documents: JSON.stringify([{ name: "x", url: "http://res.cloudinary.com/x/a.pdf" }]) } })));
  check("documents không phải JSON mảng → 400", bad(await api("PUT", `/api/lessons/${L1.id}`, { as: T, body: { documents: "{}" } })));
  void BASE; void cookieFor;

  await done();
})().catch(e => { console.error(e); process.exit(1); });
