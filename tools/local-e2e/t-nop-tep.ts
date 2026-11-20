// BU-HS-NOP-TEP — kiểm API thật (máy chủ thử ở BASE, kho cục bộ KIN_MEDIA_DIR, NODE_ENV khác production) theo ma trận vai × tệp, kèm CA PHÁ CỐ Ý của kẻ tấn công:
// nội dung giả đuôi (ảnh/exe/zip/xlsx/macro/zip bomb/PDF có JavaScript), 10 MiB + 1 byte (cả khi KHÔNG có Content-Length), tên tệp độc, MIME giả, 4 tệp song song,
// quyền tải (khách/HS khác/HS nghỉ lớp/phụ huynh/gia sư lớp khác/đồng giảng chưa chấp nhận-bị gỡ/bộ môn trong-ngoài nhóm/admin có nhật ký), hết hạn khi cron chưa chạy,
// nộp trùng + 5 yêu cầu song song, nộp lại xoá điểm + tệp trả, trả bài + thông báo (không tên/số/tên tệp), siết đường nộp cũ.
// Cần: máy chủ thử cùng DB và cùng KIN_MEDIA_DIR với bài test (chạy từ cùng thư mục gốc). Phần "tắt cấu hình" chỉ chạy khi máy chủ thử khởi động với KIN_NOP_TEP=0 và bài test có NOP_TEP_SERVER_OFF=1.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-nop-tep.ts        (CẢNH BÁO: gọi wipe() — chỉ dùng DB test)
import { existsSync } from "node:fs";
import { prisma } from "@/lib/prisma";
import { localPathFor } from "@/lib/mediaStorageServer";
import { api, check, cookieFor, done, mkCourse, mkSuper, mkTutor, mkUser, section, wipe, BASE, type TUser } from "./h";
import { EXE_BYTES, JPEG_BYTES, PNG_BYTES, plainZip, validDocx, validPdf, validXlsx } from "./nop-tep-fx";

const stamp = Date.now().toString(36);
let seq = 0;
const MiB = 1024 * 1024;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const LEAK = /storageKey|kin-nop-bai|cloudinary|\.kin-media|sha256/i;
const OFF_MODE = process.env.NOP_TEP_SERVER_OFF === "1";

type Json = Record<string, any>;
const INIT = "/api/media/nop-bai/init", COMPLETE = "/api/media/nop-bai/complete", LIST = "/api/media/nop-bai/danh-sach", ATTACH = "/api/media/nop-bai/dinh-kem";
const FILE = (id: string, q = "") => `/api/media/nop-bai/${id}${q}`;
const NOP = (asgId: string) => `/api/student/nop-bai/${asgId}/nop`;

async function dl(u: TUser | undefined, id: string, q = "", headers: Record<string, string> = {}) {
  const h: Record<string, string> = { ...headers };
  if (u) h.cookie = await cookieFor(u);
  const res = await fetch(BASE + FILE(id, q), { headers: h, redirect: "manual" });
  const buf = Buffer.from(await res.arrayBuffer());
  return { status: res.status, headers: res.headers, buf, text: buf.toString("utf8") };
}

(async () => {
  await wipe();
  const T = await mkTutor("Gia sư chủ lớp"), T2 = await mkTutor("Gia sư lớp khác"), CO = await mkTutor("Đồng giảng hiệu lực"), COI = await mkTutor("Đồng giảng chưa chấp nhận");
  const COR = await mkTutor("Đồng giảng bị gỡ"), SUBT = await mkTutor("Giáo viên bộ môn"), SUP = await mkSuper("Quản trị cấp 1");
  const A = await mkCourse(T.id, { name: "Lớp A" }), B = await mkCourse(T2.id, { name: "Lớp B" });
  for (const [u, role, status] of [[CO, "co_teacher", "active"], [COI, "co_teacher", "invited"], [COR, "co_teacher", "removed"], [SUBT, "subject_teacher", "active"]] as const)
    await prisma.courseTeacher.create({ data: { courseId: A.id, userId: u.id, role, status, invitedBy: T.id } });

  const sec = await prisma.section.create({ data: { id: `sec-${stamp}`, title: "Phần 1", order: 1, courseId: A.id } });
  const ch1 = await prisma.chapter.create({ data: { id: `ch1-${stamp}`, title: "Nhóm của bộ môn", order: 1, sectionId: sec.id, teacherId: SUBT.id } });
  const ch2 = await prisma.chapter.create({ data: { id: `ch2-${stamp}`, title: "Nhóm của chủ lớp", order: 2, sectionId: sec.id } });
  const mkLesson = (chId: string, extra: Json = {}) => prisma.lesson.create({ data: { id: `les-${stamp}-${++seq}`, code: `B${seq}`, title: `Bài ${seq}`, type: "record", order: seq, chapterId: chId, isLocked: false, isFree: false, ...extra } as never });
  const mkAsg = async (chId: string, o: { ownerId?: string; mode?: string; lessonExtra?: Json } = {}) => {
    const l = await mkLesson(chId, o.lessonExtra ?? {});
    const a = await prisma.assignment.create({ data: { id: `asg-${stamp}-${++seq}`, lessonId: l.id, title: `Bài tập ${seq}`, mode: o.mode ?? "file", maxPoints: 10, ownerId: o.ownerId ?? T.id } });
    return { ...a, lessonId: l.id };
  };
  const AS_IN = await mkAsg(ch1.id);                                   // trong nhóm của bộ môn
  const AS = await mkAsg(ch2.id);                                      // bài chính: ngoài nhóm bộ môn
  const AS_OWN = await mkAsg(ch2.id, { ownerId: SUBT.id });            // do bộ môn soạn nhưng ngoài nhóm ⇒ namesVisible=false
  const AS_DRAFT = await mkAsg(ch2.id, { lessonExtra: { status: "draft" } });
  const AS_AZOTA = await mkAsg(ch2.id, { mode: "azota" });

  let sn = 0;
  const newStudent = async (name?: string, status: string | null = "active") => {
    const u = await mkUser({ name: name ?? `Học sinh ${++sn}` });
    if (status) await prisma.enrollment.create({ data: { userId: u.id, courseId: A.id, status } });
    return u;
  };
  const S = await newStudent("Nguyễn Văn An"), S2 = await newStudent("Trần Thị Bình"), SX = await newStudent("Học sinh ngoài lớp", null);
  const PAR = await mkUser({ name: "Phụ huynh của An" });
  await prisma.parentLink.create({ data: { parentId: PAR.id, studentId: S.id, status: "verified", verifiedAt: new Date() } });

  const keyOf = async (id: string) => (await prisma.submissionFile.findUnique({ where: { id } }))?.storageKey ?? null;
  const onDisk = async (id: string) => { const k = await keyOf(id); return k ? existsSync(localPathFor(k)) : false; };
  const noLeak = (...rs: { text: string; headers?: Headers }[]) => rs.every(r => !LEAK.test(r.text) && !LEAK.test([...(r.headers?.entries() ?? [])].map(([k, v]) => `${k}:${v}`).join("\n")));

  /** init → PUT → complete. Trả mọi bước để test đọc; không tự kiểm. */
  async function upload(u: TUser, asg: { id: string }, name: string, bytes: Uint8Array | Buffer, o: { kind?: "student" | "tutor_return"; submissionId?: string; claimType?: string; putType?: string } = {}) {
    const init = await api("POST", INIT, { as: u, body: { kind: o.kind ?? "student", assignmentId: asg.id, submissionId: o.submissionId, name, size: bytes.length, type: o.claimType } });
    if (init.status !== 200) return { init, put: null, complete: null, fileId: null as string | null, key: null as string | null };
    const fileId = init.json.fileId as string;
    const key = await keyOf(fileId);
    const put = await api("PUT", init.json.upload.url, { as: u, raw: bytes as unknown as BodyInit, headers: { "content-type": o.putType ?? "application/octet-stream" } });
    const complete = put.status === 200 ? await api("POST", COMPLETE, { as: u, body: { fileId } }) : null;
    return { init, put, complete, fileId, key };
  }
  const ready = async (u: TUser, asg: { id: string }, name = "bai-lam.docx", bytes: Buffer = validDocx(), o: Parameters<typeof upload>[4] = {}) => {
    const r = await upload(u, asg, name, bytes, o);
    if (r.complete?.status !== 200) throw new Error(`upload thất bại: init=${r.init.status} put=${r.put?.status} complete=${r.complete?.status} ${JSON.stringify(r.complete?.json ?? r.put?.json ?? r.init.json)}`);
    return r.fileId!;
  };
  const submitOf = (asgId: string, userId: string) => prisma.assignmentSubmission.findUnique({ where: { assignmentId_userId: { assignmentId: asgId, userId } } });

  // ── 0. Cấu hình ───────────────────────────────────────────────────────────
  section("0. Cấu hình máy chủ thử");
  const cfgList = await api("GET", `${LIST}?assignmentId=${AS.id}`, { as: S });
  if (OFF_MODE) {
    check("KIN_NOP_TEP=0: danh sách vẫn trả 200 nhưng enabled=false + reason", cfgList.status === 200 && cfgList.json.enabled === false && !!cfgList.json.reason, cfgList.json);
    const off = await api("POST", INIT, { as: S, body: { kind: "student", assignmentId: AS.id, name: "a.docx", size: 100 } });
    check("tắt cấu hình: init ⇒ 409 + reason, KHÔNG tạo hàng", off.status === 409 && !!off.json.reason && (await prisma.submissionFile.count()) === 0, off.json);
    const nopOff = await api("POST", NOP(AS.id), { as: S });
    check("tắt cấu hình: nop ⇒ 303 ?nop=loi-tat", nopOff.status === 303 && /nop=loi-tat/.test(nopOff.headers.get("location") ?? ""), nopOff.status);
    check("tắt cấu hình: link Azota cũ vẫn nộp được (đường submit)", (await api("POST", `/api/assignments/${AS.id}/submit`, { as: S, body: { linkUrl: "https://azota.vn/de-thi/abc123" } })).status === 200);
    return done();
  }
  if (cfgList.status !== 200 || cfgList.json?.enabled !== true) {
    console.log("DỪNG: tính năng nộp tệp chưa bật ở máy chủ thử (cần NODE_ENV khác production hoặc đủ ba biến CLOUDINARY_*, và KIN_NOP_TEP khác 0). Nhận được:", cfgList.status, JSON.stringify(cfgList.json));
    process.exit(2);
  }
  check("danh sách: enabled, giới hạn 10 MiB / 3 tệp / 60 ngày / docx+pdf, chưa có tệp, chưa có bài nộp", cfgList.json.limits.maxBytes === 10 * MiB && cfgList.json.limits.maxFiles === 3 && cfgList.json.retentionDays === 60 && cfgList.json.limits.exts.join() === "docx,pdf" && cfgList.json.files.length === 0 && cfgList.json.submission === null, cfgList.json);

  // ── 1. Đường chính: tải lên → nộp → tải xuống ─────────────────────────────
  section("1. Đường chính (học sinh An)");
  const DOCX = validDocx();
  const up1 = await upload(S, AS, "Nguyen Van An - Toan.docx", DOCX, { claimType: DOCX_MIME, putType: "image/png" /* PUT khai láo: không được tin */ });
  check("init 200 (driver local, PUT tới /api/media/nop-bai/dai/<id>), KHÔNG lộ storageKey", up1.init.status === 200 && up1.init.json.driver === "local" && up1.init.json.upload.method === "PUT" && up1.init.json.upload.url.startsWith("/api/media/nop-bai/dai/") && noLeak(up1.init), up1.init.json);
  check("PUT 200 ghi đúng dung lượng; complete 200, status ready, đúng trường", up1.put?.status === 200 && up1.complete?.status === 200 && up1.complete.json.file.status === "ready" && up1.complete.json.file.sizeBytes === DOCX.length && up1.complete.json.file.submitted === false && up1.complete.json.file.ext === "docx", [up1.put?.json, up1.complete?.json]);
  const F1 = up1.fileId!;
  const row1 = await prisma.submissionFile.findUnique({ where: { id: F1 } });
  check("hàng: kind student, mimeType THEO BẢNG ĐUÔI (dù PUT khai image/png), expiresAt = createdAt + 60 ngày do máy chủ đặt, storageKey không chứa tên tệp", row1?.kind === "student" && row1.mimeType === DOCX_MIME && row1.expiresAt.getTime() - row1.createdAt.getTime() === 60 * 86_400_000 && !!row1.sha256 && /^kin-nop-bai\/[^/]+\/[^/]+\/[^/]+\.docx$/.test(row1.storageKey) && !/Nguyen|Toan/i.test(row1.storageKey), row1);
  check("complete lần hai (đã ready) ⇒ 200 như cũ (idempotent)", (await api("POST", COMPLETE, { as: S, body: { fileId: F1 } })).status === 200);
  const nop1 = await api("POST", NOP(AS.id), { as: S });
  check(`nop ⇒ 303 về /student/bai-giang/${AS.lessonId}?nop=ok`, nop1.status === 303 && (nop1.headers.get("location") ?? "").endsWith(`/student/bai-giang/${AS.lessonId}?nop=ok`), [nop1.status, nop1.headers.get("location")]);
  const sub1 = await submitOf(AS.id, S.id);
  check("bài nộp: kind=tep, fileUrl = đường riêng tư /api/media/nop-bai/<id> (KHÔNG phải URL công khai), submittedAt do máy chủ, tệp đã gắn", sub1?.kind === "tep" && sub1.fileUrl === FILE(F1) && !/^https?:/.test(sub1.fileUrl) && Math.abs(Date.now() - sub1.submittedAt.getTime()) < 60_000 && (await prisma.submissionFile.findUnique({ where: { id: F1 } }))?.submissionId === sub1.id, sub1);
  const own = await dl(S, F1);
  check("học sinh chủ tải: 200, ĐÚNG TỪNG BYTE, Content-Type theo bảng đuôi", own.status === 200 && own.buf.equals(DOCX) && own.headers.get("content-type") === DOCX_MIME, [own.status, own.headers.get("content-type")]);
  check("tiêu đề: attachment + filename*=UTF-8'', nosniff, private no-store, Referrer-Policy, CSP chặn mọi thứ", /^attachment; filename\*=UTF-8''/.test(own.headers.get("content-disposition") ?? "") && own.headers.get("x-content-type-options") === "nosniff" && /no-store/.test(own.headers.get("cache-control") ?? "") && /sandbox/.test(own.headers.get("content-security-policy") ?? "") && own.headers.get("referrer-policy") === "no-referrer", Object.fromEntries(own.headers));
  const xemDocx = await dl(S, F1, "?xem=1");
  check("docx + ?xem=1 vẫn attachment (không inline)", /^attachment/.test(xemDocx.headers.get("content-disposition") ?? ""));
  const rng = await dl(S, F1, "", { range: "bytes=0-3" });
  check("Range bytes=0-3 ⇒ 206, 4 byte đầu", rng.status === 206 && rng.buf.length === 4 && rng.buf.equals(DOCX.subarray(0, 4)), rng.status);
  check("Range sai (bytes=999999999-) ⇒ 416", (await dl(S, F1, "", { range: "bytes=999999999-" })).status === 416);
  const lst1 = await api("GET", `${LIST}?assignmentId=${AS.id}`, { as: S });
  check("danh sách của An: 1 tệp submitted=true, href riêng tư, có mốc nộp từ máy chủ, graded=false, KHÔNG lộ khoá/đường kho", lst1.status === 200 && lst1.json.files.length === 1 && lst1.json.files[0].submitted === true && lst1.json.files[0].href === FILE(F1) && lst1.json.submission?.graded === false && !!lst1.json.submission.submittedAt && noLeak(lst1) && !/studentUserId|ownerUserId|courseId|driver/.test(lst1.text), lst1.json);

  // PDF: xem trong tab
  const PDF = validPdf();
  const FP = await ready(S2, AS, "de.pdf", PDF);
  await api("POST", NOP(AS.id), { as: S2 });
  const pdfView = await dl(S2, FP, "?xem=1"), pdfDl = await dl(S2, FP);
  check("PDF + ?xem=1 ⇒ inline, Content-Type application/pdf, CSP default-src 'none' (không sandbox để trình xem PDF chạy); không ?xem ⇒ attachment", /^inline/.test(pdfView.headers.get("content-disposition") ?? "") && pdfView.headers.get("content-type") === "application/pdf" && pdfView.headers.get("content-security-policy") === "default-src 'none'" && pdfView.buf.equals(PDF) && /^attachment/.test(pdfDl.headers.get("content-disposition") ?? ""));

  // ── 2. Ca phá nội dung (kẻ tấn công tải lên) ──────────────────────────────
  section("2. Ca phá nội dung: PUT/complete từ chối, KHÔNG còn tệp trên đĩa, KHÔNG còn hàng");
  const attacks: [string, string, Buffer][] = [
    ["ảnh PNG đổi .docx", "anh.docx", PNG_BYTES], ["ảnh JPEG đổi .docx", "anh2.docx", JPEG_BYTES], ["ảnh PNG đổi .pdf", "anh.pdf", PNG_BYTES], ["ảnh JPEG đổi .pdf", "anh2.pdf", JPEG_BYTES],
    ["exe giả .docx", "virus.docx", EXE_BYTES], ["exe giả .pdf", "virus.pdf", EXE_BYTES], ["zip thường giả .docx", "nen.docx", plainZip()], ["xlsx giả .docx", "bang.docx", validXlsx()],
    ["docx có macro (vbaProject.bin)", "macro.docx", validDocx({ extra: [{ name: "word/vbaProject.bin", data: "MZ" }] })],
    ["docx khai macroEnabled", "macro2.docx", validDocx({ mainType: "application/vnd.ms-word.document.macroEnabled.main+xml" })],
    ["docx có word/embeddings", "nhung.docx", validDocx({ extra: [{ name: "word/embeddings/o.bin", data: "x" }] })],
    ["zip bomb (khai 1 GiB giải nén)", "bomb.docx", validDocx({ extra: [{ name: "word/big.xml", data: "x", declUncomp: 1024 * MiB, declComp: 100_000 }] })],
    ["zip-slip (../evil.xml)", "slip.docx", validDocx({ extra: [{ name: "../evil.xml", data: "x" }] })],
    ["PDF có /JavaScript", "js.pdf", validPdf({ body: "<< /S /JavaScript /JS (app.alert(1)) >>" })], ["PDF có /Launch", "launch.pdf", validPdf({ body: "<< /S /Launch >>" })],
    ["PDF thiếu %%EOF", "cut.pdf", Buffer.from("%PDF-1.7\nnoi dung cut")], ["HTML đổi .pdf", "trang.pdf", Buffer.from("<html><script>alert(1)</script></html>")],
  ];
  let ai = 0;
  for (const [label, name0, bytes] of attacks) {
    const atk = await newStudent();
    const tok = `zqx${++ai}k`;                                // dấu riêng để chắc thông điệp lỗi không lặp lại tên tệp
    const name = `${tok}_${name0}`;
    const r = await upload(atk, AS, name, bytes);
    const fileId = r.fileId!;
    check(`${label} ⇒ complete 400, hàng bị xoá, tệp biến khỏi đĩa, lỗi không lặp tên tệp`, r.complete?.status === 400 && !!r.complete.json.error && !r.complete.text.includes(tok) && (await prisma.submissionFile.count({ where: { id: fileId } })) === 0 && !!r.key && !existsSync(localPathFor(r.key)), [r.put?.status, r.complete?.status, r.complete?.json]);
  }
  {
    const atk = await newStudent();
    const init = await api("POST", INIT, { as: atk, body: { kind: "student", assignmentId: AS.id, name: "rong.docx", size: 5 } });
    const key = await keyOf(init.json.fileId);
    const put = await api("PUT", init.json.upload.url, { as: atk, raw: Buffer.alloc(0) });
    check("tệp rỗng (PUT 0 byte) ⇒ 400, hàng xoá, không còn tệp", put.status === 400 && (await prisma.submissionFile.count({ where: { id: init.json.fileId } })) === 0 && !!key && !existsSync(localPathFor(key)), put.json);
    const e0 = await api("POST", INIT, { as: atk, body: { kind: "student", assignmentId: AS.id, name: "rong.docx", size: 0 } });
    check("init khai size 0 ⇒ 400 code empty; size NaN/âm ⇒ 400", e0.status === 400 && e0.json.code === "empty" && (await api("POST", INIT, { as: atk, body: { kind: "student", assignmentId: AS.id, name: "a.docx", size: -3 } })).status === 400);
  }
  {
    const atk = await newStudent();
    const init = await api("POST", INIT, { as: atk, body: { kind: "student", assignmentId: AS.id, name: "to.docx", size: 1000 } });
    const key = await keyOf(init.json.fileId);
    const big = await api("PUT", init.json.upload.url, { as: atk, raw: Buffer.alloc(10 * MiB + 1, 1) });
    check("10 MiB + 1 byte qua PUT ⇒ 413, tệp dở bị xoá, hàng bị xoá", big.status === 413 && (await prisma.submissionFile.count({ where: { id: init.json.fileId } })) === 0 && !!key && !existsSync(localPathFor(key)), [big.status, big.json]);
    const init2 = await api("POST", INIT, { as: atk, body: { kind: "student", assignmentId: AS.id, name: "to2.docx", size: 1000 } });
    const key2 = await keyOf(init2.json.fileId);
    // Không có Content-Length (chunked): máy chủ phải tự đếm khi nhận, không tin gì từ trình duyệt.
    const chunk = Buffer.alloc(MiB, 2); let sent = 0;
    const stream = new ReadableStream<Uint8Array>({ pull(c) { if (sent >= 11) { c.close(); return; } c.enqueue(chunk); sent++; } });
    const res = await fetch(BASE + init2.json.upload.url, { method: "PUT", headers: { cookie: await cookieFor(atk) }, body: stream, duplex: "half" } as RequestInit);
    const rows2 = await prisma.submissionFile.count({ where: { id: init2.json.fileId } });
    const onDisk2 = !!key2 && existsSync(localPathFor(key2));
    check("11 MiB gửi dạng chunked (không Content-Length) ⇒ 413, tệp dở bị xoá", res.status === 413 && rows2 === 0 && !!key2 && !onDisk2, { status: res.status, hàngConLai: rows2, key2: !!key2, tệpConTrênĐĩa: onDisk2 });
    const init3 = await api("POST", INIT, { as: atk, body: { kind: "student", assignmentId: AS.id, name: "ok.docx", size: 1000 } });
    const exact = await api("PUT", init3.json.upload.url, { as: atk, raw: Buffer.alloc(10 * MiB, 3) });
    check("ĐÚNG 10 MiB ⇒ 413 (dưới 10 MB mới nhận)", exact.status === 413, exact.status);
    const initN = await api("POST", INIT, { as: atk, body: { kind: "student", assignmentId: AS.id, name: "sat.docx", size: 10 * MiB - 1 } });
    check("init khai 10 MiB − 1 ⇒ 200 (biên nhận); khai 10 MiB ⇒ 400 too_big", initN.status === 200 && (await api("POST", INIT, { as: atk, body: { kind: "student", assignmentId: AS.id, name: "sat2.docx", size: 10 * MiB } })).json.code === "too_big");
  }
  {
    const atk = await newStudent();
    const bad = await Promise.all([
      api("POST", INIT, { as: atk, body: { kind: "student", assignmentId: AS.id, name: "a.docx", size: 100, type: "image/png" } }),
      api("POST", INIT, { as: atk, body: { kind: "student", assignmentId: AS.id, name: "a.docx", size: 100, type: "text/html" } }),
      api("POST", INIT, { as: atk, body: { kind: "student", assignmentId: AS.id, name: "a.docx.exe", size: 100 } }),
      api("POST", INIT, { as: atk, body: { kind: "student", assignmentId: AS.id, name: "a.png", size: 100 } }),
      api("POST", INIT, { as: atk, body: { kind: "student", assignmentId: AS.id, name: "a.mp4", size: 100 } }),
      api("POST", INIT, { as: atk, body: { kind: "student", assignmentId: AS.id, name: "a.docm", size: 100 } }),
      api("POST", INIT, { as: atk, body: { kind: "student", assignmentId: AS.id, name: "a.zip", size: 100 } }),
      api("POST", INIT, { as: atk, body: { kind: "student", assignmentId: AS.id, name: "a.doc", size: 100 } }),
      api("POST", INIT, { as: atk, body: { kind: "evil", assignmentId: AS.id, name: "a.docx", size: 100 } }),
      api("POST", INIT, { as: atk, body: { kind: "student", name: "a.docx", size: 100 } }),
    ]);
    check("MIME khai láo (image/png, text/html) / .docx.exe / ảnh / video / macro / zip / .doc / kind lạ / thiếu bài tập ⇒ 400, không tạo hàng", bad.every(r => r.status === 400) && (await prisma.submissionFile.count({ where: { studentUserId: atk.id } })) === 0, bad.map(r => r.status));
    const names = ["../x.docx", "..%2fx.docx", "C:\\Windows\\y.docx", "a\u202Efdp.docx", "x".repeat(300) + ".docx", "😀.docx"];
    const okNames = [];
    // LOI-07: kiểm đuôi khoá ĐÚNG BẰNG `<mã hàng>.docx` thay cho "không chứa x.docx" — cuid tận cùng bằng "x" (≈1/36 lần) làm ca cũ đỏ oan.
    const keyFromId = (key: string, id: string) => key.endsWith(`/${id}.docx`);
    check("phá: khoá dựng từ tên tệp (…/x.docx) bị bắt; khoá dựng từ mã tận cùng 'x' thì đúng", !keyFromId("kin-nop-bai/c/a/x.docx", "cmabcx") && keyFromId("kin-nop-bai/c/a/cmabcx.docx", "cmabcx"));
    for (const n of names) {
      const u = await newStudent();
      const r = await api("POST", INIT, { as: u, body: { kind: "student", assignmentId: AS.id, name: n, size: 100 } });
      const row = r.status === 200 ? await prisma.submissionFile.findUnique({ where: { id: r.json.fileId } }) : null;
      okNames.push(!!row && !row.storageKey.includes("..") && !row.storageKey.includes("%") && keyFromId(row.storageKey, row.id) && row.originalName.length <= 130 && !row.originalName.includes("/") && !row.originalName.includes("\\") && !row.originalName.startsWith(".") && row.originalName.endsWith(".docx") && !/[\u202a-\u202e]/.test(row.originalName) && /^kin-nop-bai\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.docx$/.test(row.storageKey));
    }
    check("tên độc (../x, ..%2f, C:\\…, ký tự đổi chiều, 300 ký tự, emoji) ⇒ lưu được nhưng storageKey KHÔNG chứa tên, tên hiển thị đã làm sạch, đuôi giữ nguyên", okNames.every(Boolean), okNames);
    const par = await newStudent();
    const four = await Promise.all([1, 2, 3, 4].map(i => api("POST", INIT, { as: par, body: { kind: "student", assignmentId: AS.id, name: `p${i}.docx`, size: 100 } })));
    check("4 init cùng lúc (Promise.all) ⇒ ĐÚNG 3 thành công, 1 bị 409 too_many; DB có đúng 3 hàng", four.filter(r => r.status === 200).length === 3 && four.filter(r => r.status === 409 && r.json.code === "too_many").length === 1 && (await prisma.submissionFile.count({ where: { studentUserId: par.id } })) === 3, four.map(r => r.status));
  }

  // ── 3. Quyền tải ──────────────────────────────────────────────────────────
  section("3. Quyền tải: ma trận vai × tệp của An (đã nộp)");
  const probe = async (label: string, u: TUser | undefined, want: number, id = F1, extra: (r: Awaited<ReturnType<typeof dl>>) => boolean = () => true) => {
    const r = await dl(u, id);
    check(`${label} ⇒ ${want}`, r.status === want && noLeak(r) && extra(r), [r.status, r.text.slice(0, 120)]);
    return r;
  };
  await probe("khách (chưa đăng nhập)", undefined, 401);
  await probe("học sinh KHÁC cùng lớp (Bình)", S2, 404);
  await probe("học sinh ngoài lớp", SX, 404);
  await probe("phụ huynh đã liên kết (ParentLink verified) — mặc định KHÔNG", PAR, 403);
  await probe("gia sư lớp KHÁC", T2, 403);
  await probe("đồng giảng status=invited (chưa chấp nhận)", COI, 403);
  await probe("đồng giảng status=removed (đã gỡ)", COR, 403);
  await probe("giáo viên bộ môn, bài NGOÀI nhóm của mình", SUBT, 403);
  await probe("id lạ (không có hàng)", S, 404, "cmkhongcotepnaoca");
  await probe("id có byte NUL", S, 404, "ab%00cdefghijk");
  await probe("id kiểu ../", S, 404, "..%2f..%2fetc%2fpasswd");
  await probe("chủ lớp", T, 200, F1, r => r.buf.equals(DOCX));
  await probe("đồng giảng đang hiệu lực", CO, 200, F1, r => r.buf.equals(DOCX));
  const auditBefore = await prisma.auditLog.count({ where: { action: "submission_file.download" } });
  await probe("quản trị cấp 1", SUP, 200, F1, r => r.buf.equals(DOCX));
  const audits = await prisma.auditLog.findMany({ where: { action: "submission_file.download" } });
  check("quản trị tải ⇒ đúng MỘT dòng nhật ký submission_file.download, chỉ fileId + assignmentId, KHÔNG tên tệp/tên học sinh", audits.length === auditBefore + 1 && audits.length === 1 && audits[0].resourceId === F1 && audits[0].actorId === SUP.id && !/Nguyen|Toan|Nguyễn/.test(JSON.stringify(audits[0].metadata)) && JSON.stringify(audits[0].metadata).includes(AS.id), audits[0]);
  check("chủ lớp / đồng giảng tải KHÔNG ghi nhật ký (chỉ quản trị trung tâm)", (await prisma.auditLog.count({ where: { action: "submission_file.download" } })) === 1);

  section("3b. Giáo viên bộ môn: trong nhóm / bài do mình soạn ngoài nhóm");
  const FIN = await ready(S2, AS_IN, "Tran Thi Binh - Ly.docx"); await api("POST", NOP(AS_IN.id), { as: S2 });
  const inGroup = await dl(SUBT, FIN);
  check("bài TRONG nhóm giao cho bộ môn ⇒ 200, tên thật (namesVisible) trong Content-Disposition", inGroup.status === 200 && decodeURIComponent(inGroup.headers.get("content-disposition") ?? "").includes("Tran Thi Binh - Ly.docx"), inGroup.headers.get("content-disposition"));
  const FOWN = await ready(S2, AS_OWN, "Tran Thi Binh - Hoa.docx"); await api("POST", NOP(AS_OWN.id), { as: S2 });
  const ownGroup = await dl(SUBT, FOWN);
  check("bài do bộ môn soạn nhưng NGOÀI nhóm (namesVisible=false) ⇒ 200 nhưng tên chung 'Bài nộp 1.docx', không lộ tên thật", ownGroup.status === 200 && decodeURIComponent(ownGroup.headers.get("content-disposition") ?? "").includes("Bài nộp 1.docx") && !/Tran Thi Binh|Hoa/.test(decodeURIComponent(ownGroup.headers.get("content-disposition") ?? "")));
  const lstHidden = await api("GET", `${LIST}?submissionId=${(await submitOf(AS_OWN.id, S2.id))!.id}`, { as: SUBT });
  check("danh sách cho bộ môn ngoài nhóm: tên chung, không tên thật, không lộ khoá", lstHidden.status === 200 && lstHidden.json.files[0].name === "Bài nộp 1.docx" && !/Tran Thi Binh/.test(lstHidden.text) && noLeak(lstHidden), lstHidden.json);

  section("3c. Tệp NHÁP (chưa bấm Nộp bài): gia sư không thấy");
  const S4 = await newStudent("Học sinh nháp");
  const FD = await ready(S4, AS, "nhap.docx");
  await probe("gia sư chủ lớp mở bản nháp", T, 404, FD);
  await probe("đồng giảng mở bản nháp", CO, 404, FD);
  await probe("quản trị mở bản nháp", SUP, 404, FD);
  await probe("gia sư lớp khác mở bản nháp (403 như bảng, không lộ tồn tại)", T2, 403, FD);
  await probe("học sinh chủ vẫn mở được bản nháp của mình", S4, 200, FD);
  const lstTut = await api("GET", `${LIST}?submissionId=${sub1!.id}`, { as: T });
  check("danh sách của gia sư chủ lớp cho bài của An: thấy đúng tệp ĐÃ nộp (tên thật), không thấy tệp nháp của em khác", lstTut.status === 200 && lstTut.json.files.length === 1 && lstTut.json.files[0].id === F1 && lstTut.json.files[0].name === "Nguyen Van An - Toan.docx" && noLeak(lstTut), lstTut.json);
  check("danh sách: gia sư lớp khác ⇒ 403; học sinh gọi bằng ?submissionId ⇒ 403; thiếu cả hai tham số ⇒ 400; khách ⇒ 401", (await api("GET", `${LIST}?submissionId=${sub1!.id}`, { as: T2 })).status === 403 && (await api("GET", `${LIST}?submissionId=${sub1!.id}`, { as: S })).status === 403 && (await api("GET", LIST, { as: S })).status === 400 && (await api("GET", `${LIST}?assignmentId=${AS.id}`)).status === 401);
  check("danh sách học sinh KHÁC cùng bài: không thấy tệp của An", (await api("GET", `${LIST}?assignmentId=${AS.id}`, { as: SX })).status === 403 && !(await api("GET", `${LIST}?assignmentId=${AS.id}`, { as: S4 })).text.includes(F1));

  section("3d. Học sinh đã NGHỈ LỚP không còn mở được bài đã nộp");
  const S3 = await newStudent("Học sinh sắp nghỉ");
  const F3 = await ready(S3, AS); await api("POST", NOP(AS.id), { as: S3 });
  check("trước khi nghỉ: mở được (200)", (await dl(S3, F3)).status === 200);
  await prisma.enrollment.update({ where: { userId_courseId: { userId: S3.id, courseId: A.id } }, data: { status: "suspended" } });
  const sus = await dl(S3, F3);
  check("sau khi nghỉ (suspended) ⇒ 403, thân có chữ nghỉ lớp", sus.status === 403 && noLeak(sus), sus.text.slice(0, 150));
  const susInit = await api("POST", INIT, { as: S3, body: { kind: "student", assignmentId: AS.id, name: "b.docx", size: 100 } });
  check("nghỉ lớp: init ⇒ 403 (code enrollment_suspended), nop ⇒ 303 ?nop=loi-lop", susInit.status === 403 && /suspended/.test(JSON.stringify(susInit.json)) && /nop=loi-lop/.test((await api("POST", NOP(AS.id), { as: S3 })).headers.get("location") ?? ""), susInit.json);

  // ── 4. Hết hạn khi cron CHƯA chạy ─────────────────────────────────────────
  section("4. expiresAt thực thi ngay cả khi cron chưa chạy");
  const S5 = await newStudent("Học sinh hết hạn");
  const F5 = await ready(S5, AS); await api("POST", NOP(AS.id), { as: S5 });
  const sub5 = (await submitOf(AS.id, S5.id))!;
  await prisma.assignmentSubmission.update({ where: { id: sub5.id }, data: { score: 8, comment: "Khá tốt", gradedAt: new Date(), gradedBy: T.id } });
  await prisma.submissionFile.update({ where: { id: F5 }, data: { expiresAt: new Date(Date.now() - 1000) } });
  const e1 = await dl(S5, F5), e2 = await dl(T, F5), e3 = await dl(S2, F5), e4 = await dl(T2, F5), e5 = await dl(SUP, F5);
  check("hết hạn 1 giây: học sinh chủ ⇒ 410, chủ lớp ⇒ 410, quản trị ⇒ 410 (có câu 'xoá sau 60 ngày… vẫn giữ')", [e1, e2, e5].every(r => r.status === 410 && /60 ngày/.test(r.text) && /vẫn giữ/.test(r.text)), [e1.status, e2.status, e5.status]);
  check("người KHÔNG quyền không phân biệt được: học sinh khác 404, gia sư lớp khác 403", e3.status === 404 && e4.status === 403);
  check("tệp vẫn còn trên đĩa (cron chưa chạy) nhưng API đã ngừng phát", await onDisk(F5));
  const lstExp = await api("GET", `${LIST}?assignmentId=${AS.id}`, { as: S5 });
  check("danh sách: expired=true cho tệp quá hạn", lstExp.json.files.find((f: Json) => f.id === F5)?.expired === true, lstExp.json);
  const subs = await api("GET", `/api/assignments/${AS.id}/submissions`, { as: T });
  const s5row = (subs.json as Json[]).find(x => x.id === sub5.id);
  check("điểm và nhận xét vẫn trả qua API cũ sau khi tệp hết hạn", s5row?.score === 8 && s5row?.comment === "Khá tốt", s5row);
  await prisma.submissionFile.update({ where: { id: F5 }, data: { expiresAt: new Date(Date.now() + 3600_000) } });
  check("đối chứng: còn hạn lại ⇒ 200", (await dl(S5, F5)).status === 200);

  // ── 5. Nộp trùng / tương tranh / nộp lại ──────────────────────────────────
  section("5. Nộp trùng và tương tranh");
  const S6 = await newStudent("Học sinh bấm đúp");
  const F6 = await ready(S6, AS);
  const notifBefore = await prisma.notification.count({ where: { userId: T.id, type: "submission_received" } });
  const twice = [await api("POST", NOP(AS.id), { as: S6 }), await api("POST", NOP(AS.id), { as: S6 })];
  check("bấm nop hai lần liên tiếp ⇒ cả hai 303 ?nop=ok; đúng 1 bài nộp; tệp gắn một lần", twice.every(r => r.status === 303 && /nop=ok/.test(r.headers.get("location") ?? "")) && (await prisma.assignmentSubmission.count({ where: { assignmentId: AS.id, userId: S6.id } })) === 1 && (await prisma.submissionFile.count({ where: { id: F6, submissionId: { not: null } } })) === 1, twice.map(r => r.status));
  const S7 = await newStudent("Học sinh năm tab");
  const F7 = await ready(S7, AS);
  const five = await Promise.all([1, 2, 3, 4, 5].map(() => api("POST", NOP(AS.id), { as: S7 })));
  check("nop 5 lần SONG SONG ⇒ cả 5 đều 303 ?nop=ok; đúng 1 AssignmentSubmission; tệp gắn đúng một lần", five.every(r => r.status === 303 && /nop=ok/.test(r.headers.get("location") ?? "")) && (await prisma.assignmentSubmission.count({ where: { assignmentId: AS.id, userId: S7.id } })) === 1 && (await prisma.submissionFile.count({ where: { studentUserId: S7.id, assignmentId: AS.id, submissionId: { not: null }, status: "ready" } })) === 1, five.map(r => r.status));
  const notifAfter = await prisma.notification.count({ where: { userId: T.id, type: "submission_received" } });
  check("thông báo submission_received tới chủ lớp: mỗi học sinh nộp MỘT dòng (bấm đúp/song song không nhân bản)", notifAfter - notifBefore === 2, notifAfter - notifBefore);
  const nn = await prisma.notification.findFirst({ where: { userId: T.id, type: "submission_received" }, orderBy: { createdAt: "desc" } });
  check("nội dung thông báo không có tên học sinh/tên tệp/số/tên bài; link /lop-cua-toi/bai-tap", !!nn && !/\d|\.docx|Nguyễn|Trần|bấm đúp|năm tab|Bài tập/.test(`${nn.title} ${nn.message}`) && nn.link === "/lop-cua-toi/bai-tap", nn);
  check("nop không có tệp nào ⇒ 303 ?nop=loi-chua-co-tep", (await (async () => { const u = await newStudent(); const r = await api("POST", NOP(AS.id), { as: u }); return r.status === 303 && /nop=loi-chua-co-tep/.test(r.headers.get("location") ?? ""); })()));
  {
    const victim = await newStudent("Nạn nhân"), thief = await newStudent("Kẻ gian");
    const FV = await ready(victim, AS);
    const stolen = await api("POST", NOP(AS.id), { as: thief, raw: `fileId=${FV}` as unknown as BodyInit, headers: { "content-type": "application/x-www-form-urlencoded" } });
    check("nop với fileId của học sinh khác trong thân ⇒ không gắn (303 loi-chua-co-tep), tệp nạn nhân vẫn nháp của nạn nhân", stolen.status === 303 && /loi-chua-co-tep/.test(stolen.headers.get("location") ?? "") && (await prisma.submissionFile.findUnique({ where: { id: FV } }))?.submissionId === null && (await prisma.assignmentSubmission.count({ where: { userId: thief.id } })) === 0);
    const hijack = await api("POST", COMPLETE, { as: thief, body: { fileId: FV } });
    const hijack2 = await api("POST", `/api/media/nop-bai/${FV}/xoa`, { as: thief });
    const hijack3 = await api("PUT", `/api/media/nop-bai/dai/${FV}`, { as: thief, raw: Buffer.from("x") });
    check("kẻ gian complete / xoá / PUT đè tệp của học sinh khác ⇒ 404 hết, tệp nạn nhân nguyên vẹn", [hijack, hijack2, hijack3].every(r => r.status === 404) && (await prisma.submissionFile.findUnique({ where: { id: FV } }))?.status === "ready");
  }
  check("nop: khách 401; gia sư 403; bài Azota 404; bài thuộc mục Nháp 404 (TRƯỚC kiểm ghi danh); id lạ 404; học sinh chưa ghi danh ⇒ 303 loi-lop", (await api("POST", NOP(AS.id))).status === 401 && (await api("POST", NOP(AS.id), { as: T })).status === 403 && (await api("POST", NOP(AS_AZOTA.id), { as: S })).status === 404 && (await api("POST", NOP(AS_DRAFT.id), { as: S })).status === 404 && (await api("POST", NOP("khong-co-bai-nay"), { as: S })).status === 404 && /loi-lop/.test((await api("POST", NOP(AS.id), { as: SX })).headers.get("location") ?? ""));
  check("init: khách 401; bài Nháp / Azota 404; học sinh ngoài lớp 403; gia sư khai kind student 403", (await api("POST", INIT, { body: { kind: "student", assignmentId: AS.id, name: "a.docx", size: 5 } })).status === 401 && (await api("POST", INIT, { as: S, body: { kind: "student", assignmentId: AS_DRAFT.id, name: "a.docx", size: 5 } })).status === 404 && (await api("POST", INIT, { as: S, body: { kind: "student", assignmentId: AS_AZOTA.id, name: "a.docx", size: 5 } })).status === 404 && (await api("POST", INIT, { as: SX, body: { kind: "student", assignmentId: AS.id, name: "a.docx", size: 5 } })).status === 403 && (await api("POST", INIT, { as: T, body: { kind: "student", assignmentId: AS.id, name: "a.docx", size: 5 } })).status === 403);

  // ── 6. Trả bài kèm tệp + nộp lại ──────────────────────────────────────────
  section("6. Gia sư chấm + trả bài kèm tệp; học sinh nộp lại");
  const S8 = await newStudent("Học sinh trả bài");
  const F8a = await ready(S8, AS, "lan1-a.docx"), F8b = await ready(S8, AS, "lan1-b.pdf", validPdf());
  await api("POST", NOP(AS.id), { as: S8 });
  const sub8 = (await submitOf(AS.id, S8.id))!;
  check("nộp 2 tệp ⇒ fileUrl trỏ tệp ĐẦU (theo thứ tự tạo), cả hai đã gắn", sub8.fileUrl === FILE(F8a) && (await prisma.submissionFile.count({ where: { submissionId: sub8.id, kind: "student", status: "ready" } })) === 2);
  const grade = await api("PATCH", `/api/assignments/${AS.id}/submissions/${sub8.id}/grade`, { as: T, body: { score: 9, comment: "Tốt lắm" } });
  check("gia sư chấm qua API cũ (không đổi) ⇒ 200", grade.status === 200 && grade.json.score === 9);
  const RET = Buffer.from(validDocx());
  const ret = await upload(T, AS, "nhan-xet.docx", RET, { kind: "tutor_return", submissionId: sub8.id });
  check("gia sư init kind=tutor_return + PUT + complete ⇒ ready; hàng ownerUserId=gia sư, studentUserId=học sinh, CHƯA gắn (nháp của gia sư)", ret.complete?.status === 200 && (await prisma.submissionFile.findUnique({ where: { id: ret.fileId! } }))?.ownerUserId === T.id && (await prisma.submissionFile.findUnique({ where: { id: ret.fileId! } }))?.submissionId === null);
  check("học sinh CHƯA thấy tệp trả bài khi chưa đính kèm (404); gia sư lớp khác init tutor_return ⇒ 403; học sinh init tutor_return ⇒ 403", (await dl(S8, ret.fileId!)).status === 404 && (await api("POST", INIT, { as: T2, body: { kind: "tutor_return", assignmentId: AS.id, submissionId: sub8.id, name: "x.docx", size: 100 } })).status === 403 && (await api("POST", INIT, { as: S8, body: { kind: "tutor_return", assignmentId: AS.id, submissionId: sub8.id, name: "x.docx", size: 100 } })).status === 403);
  const draftList = await api("GET", `${LIST}?submissionId=${sub8.id}`, { as: T });
  check("danh sách của gia sư thấy cả 2 tệp học sinh + bản nháp tệp trả của chính mình (submitted=false)", draftList.json.files.length === 3 && draftList.json.files.find((f: Json) => f.id === ret.fileId)?.submitted === false, draftList.json.files.map((f: Json) => [f.kind, f.submitted]));
  const retNotifBefore = await prisma.notification.count({ where: { userId: S8.id, type: "submission_returned" } });
  const denyAttach = [await api("POST", ATTACH, { as: S8, body: { submissionId: sub8.id, fileIds: [ret.fileId] } }), await api("POST", ATTACH, { as: T2, body: { submissionId: sub8.id, fileIds: [ret.fileId] } }), await api("POST", ATTACH, { body: { submissionId: sub8.id, fileIds: [ret.fileId] } })];
  check("dinh-kem: học sinh ⇒ 403, gia sư lớp khác ⇒ 403, khách ⇒ 401", denyAttach.map(r => r.status).join() === "403,403,401", denyAttach.map(r => r.status));
  check("dinh-kem tệp của HỌC SINH (kind student) hoặc tệp người khác ⇒ 400, không gắn", (await api("POST", ATTACH, { as: T, body: { submissionId: sub8.id, fileIds: [F8a] } })).status === 400 && (await api("POST", ATTACH, { as: T, body: { submissionId: sub8.id, fileIds: [] } })).status === 400 && (await api("POST", ATTACH, { as: T, body: { submissionId: sub8.id, fileIds: ["a", "b", "c", "d"] } })).status === 400);
  const att = await api("POST", ATTACH, { as: T, body: { submissionId: sub8.id, fileIds: [ret.fileId] } });
  check("gia sư đính kèm ⇒ 200, tệp gắn vào bài nộp", att.status === 200 && att.json.files.length === 1 && (await prisma.submissionFile.findUnique({ where: { id: ret.fileId! } }))?.submissionId === sub8.id && noLeak(att), att.json);
  const retNotif = await prisma.notification.findMany({ where: { userId: S8.id, type: "submission_returned" } });
  check("thông báo submission_returned: ĐÚNG MỘT dòng, nội dung không tên/số/tên tệp, link bài giảng", retNotif.length === retNotifBefore + 1 && !/nhan-xet|\.docx|\d/.test(`${retNotif[0].title} ${retNotif[0].message}`) && retNotif[0].link === `/student/bai-giang/${AS.lessonId}`, retNotif);
  await api("POST", ATTACH, { as: T, body: { submissionId: sub8.id, fileIds: [ret.fileId] } });
  check("đính kèm lại cùng tệp (bấm đúp) ⇒ không thông báo thêm", (await prisma.notification.count({ where: { userId: S8.id, type: "submission_returned" } })) === retNotifBefore + 1);
  const seeRet = await dl(S8, ret.fileId!);
  const lst8 = await api("GET", `${LIST}?assignmentId=${AS.id}`, { as: S8 });
  check("học sinh thấy + tải được tệp gia sư trả (đúng từng byte); danh sách có cả kind tutor_return", seeRet.status === 200 && seeRet.buf.equals(RET) && lst8.json.files.some((f: Json) => f.kind === "tutor_return" && f.id === ret.fileId) && lst8.json.submission.graded === true);
  check("học sinh khác không thấy tệp trả bài (404)", (await dl(S2, ret.fileId!)).status === 404);
  const keyRet = (await keyOf(ret.fileId!))!, keyA = (await keyOf(F8a))!;

  // học sinh xoá một tệp đã nộp
  const delGraded = await api("POST", `/api/media/nop-bai/${F8b}/xoa`, { as: S8, body: {} });
  check("bỏ tệp của bài ĐÃ CHẤM không xác nhận ⇒ 409 graded_confirm, chưa xoá gì", delGraded.status === 409 && delGraded.json.code === "graded_confirm" && (await prisma.submissionFile.findUnique({ where: { id: F8b } }))?.status === "ready" && (await submitOf(AS.id, S8.id))?.score === 9);
  check("tệp gia sư trả: học sinh không xoá được (404, vì không phải chủ tải)", (await api("POST", `/api/media/nop-bai/${ret.fileId}/xoa`, { as: S8, body: { confirm: true } })).status === 404);

  // nộp lại
  const F8c = await ready(S8, AS, "lan2.docx");
  const re = await api("POST", NOP(AS.id), { as: S8 });
  const sub8b = (await submitOf(AS.id, S8.id))!;
  check("nộp lại ⇒ 303 ok; vẫn MỘT bài nộp; điểm + nhận xét cũ bị xoá; submittedAt mới; fileUrl trỏ tệp mới", re.status === 303 && sub8b.id === sub8.id && sub8b.score === null && sub8b.comment === null && sub8b.gradedAt === null && sub8b.gradedBy === null && sub8b.fileUrl === FILE(F8c) && sub8b.submittedAt.getTime() > sub8.submittedAt.getTime(), sub8b);
  check("nộp lại ⇒ tệp học sinh cũ + tệp gia sư đã trả đều 'removed', đã xoá khỏi đĩa, deletedAt đặt", await Promise.all([F8a, F8b, ret.fileId!].map(async id => { const r = await prisma.submissionFile.findUnique({ where: { id } }); return r?.status === "removed" && !!r.deletedAt; })).then(a => a.every(Boolean)) && !existsSync(localPathFor(keyRet)) && !existsSync(localPathFor(keyA)));
  check("tệp cũ không còn tải được (404); tệp mới tải được; số tệp hiện hành = 1", (await dl(S8, F8a)).status === 404 && (await dl(S8, ret.fileId!)).status === 404 && (await dl(S8, F8c)).status === 200 && (await prisma.submissionFile.count({ where: { studentUserId: S8.id, assignmentId: AS.id, status: "ready" } })) === 1);
  const lastDel = await api("POST", `/api/media/nop-bai/${F8c}/xoa`, { as: S8, body: {} });
  check("không bỏ được tệp CUỐI CÙNG của bài đã nộp (409 last_file; hãy nộp lại)", lastDel.status === 409 && lastDel.json.code === "last_file");

  section("6b. Bỏ tệp nháp");
  const S9 = await newStudent("Học sinh bỏ tệp");
  const F9 = await ready(S9, AS, "bo.docx"); const k9 = (await keyOf(F9))!;
  const del9 = await api("POST", `/api/media/nop-bai/${F9}/xoa`, { as: S9, body: {} });
  check("bỏ tệp nháp ⇒ 200, removed + deletedAt, đã xoá khỏi đĩa; xoá lần hai ⇒ 200 (idempotent)", del9.status === 200 && (await prisma.submissionFile.findUnique({ where: { id: F9 } }))?.status === "removed" && !existsSync(localPathFor(k9)) && (await api("POST", `/api/media/nop-bai/${F9}/xoa`, { as: S9, body: {} })).status === 200);
  check("tệp đã bỏ ⇒ tải 404 và nhường chỗ trong hạn mức 3 tệp", (await dl(S9, F9)).status === 404 && (await Promise.all([1, 2, 3].map(i => api("POST", INIT, { as: S9, body: { kind: "student", assignmentId: AS.id, name: `q${i}.docx`, size: 100 } })))).every(r => r.status === 200));

  // ── 7. Siết đường nộp cũ ──────────────────────────────────────────────────
  section("7. Đường nộp cũ POST /api/assignments/[id]/submit");
  const S10 = await newStudent("Học sinh đường cũ");
  const oldFile = await api("POST", `/api/assignments/${AS.id}/submit`, { as: S10, body: { fileUrl: "https://res.cloudinary.com/x/raw/upload/bai.pdf", fileName: "bai.pdf" } });
  check("fileUrl do trình duyệt gửi ⇒ 400 'Hãy dùng chức năng nộp tệp mới', KHÔNG tạo bài nộp", oldFile.status === 400 && /nộp tệp mới/.test(oldFile.json.error) && (await prisma.assignmentSubmission.count({ where: { userId: S10.id } })) === 0, oldFile.json);
  const oldLink = await api("POST", `/api/assignments/${AS.id}/submit`, { as: S10, body: { linkUrl: "https://azota.vn/de-thi/abc123" } });
  check("linkUrl Azota ⇒ vẫn 200, kind=link", oldLink.status === 200 && oldLink.json.kind === "link", oldLink.json);
  // P2 (rà soát): đang có bài nộp bằng TỆP mà nộp lại bằng link Azota ⇒ bộ tệp cũ phải bị gỡ khỏi kho (không để gia sư tải tệp cũ sau khi điểm bị xoá).
  {
    const S11 = await newStudent("Học sinh đổi sang link");
    const F11 = await ready(S11, AS, "truoc-khi-doi-link.docx");
    await api("POST", NOP(AS.id), { as: S11 });
    const before = await prisma.submissionFile.findUnique({ where: { id: F11 } });
    const sw = await api("POST", `/api/assignments/${AS.id}/submit`, { as: S11, body: { linkUrl: "https://azota.vn/de-thi/abc123" } });
    const afterRow = await prisma.submissionFile.findUnique({ where: { id: F11 } });
    check("nộp tệp rồi nộp lại bằng link Azota ⇒ tệp cũ removed, đã xoá khỏi kho, gia sư không tải được nữa", before?.status === "ready" && sw.status === 200 && afterRow?.status === "removed" && afterRow?.deletedAt !== null && (await dl(T, F11)).status === 404, [before?.status, sw.status, afterRow?.status, afterRow?.deletedAt]);
  }
  // P2 (rà soát): form POST của trình duyệt (Accept: text/html) gặp lỗi phải được 303 về trang thật, không hiện JSON thô; gọi API vẫn nhận mã lỗi.
  {
    const asHtml = { headers: { accept: "text/html,application/xhtml+xml" } };
    const g = await api("POST", NOP(AS.id), asHtml);
    const tt = await api("POST", NOP(AS.id), { as: T, ...asHtml });
    const nf = await api("POST", NOP("khong-co-bai-nay"), { as: S10, ...asHtml });
    check("form (Accept html): khách ⇒ 303 /dang-nhap; gia sư ⇒ 303 /; bài không có ⇒ 303 /student/hoc-tap", g.status === 303 && /\/dang-nhap/.test(g.headers.get("location") ?? "") && tt.status === 303 && nf.status === 303 && /\/student\/hoc-tap/.test(nf.headers.get("location") ?? ""), [g.status, tt.status, nf.status]);
  }
  check("thân rỗng ⇒ 400", (await api("POST", `/api/assignments/${AS.id}/submit`, { as: S10, body: {} })).status === 400);

  // ── 7b. Ca phá bổ sung của stu-test (10/11/2026): lớp mình không ghi danh, bài Nháp/Ẩn, tệp trả bài của gia sư lớp khác, tệp kind=tutor_return do học sinh gắn/đụng vào ──
  section("7b. Học sinh ghi danh lớp A nộp / xem / đụng tệp của LỚP B (lớp mình không ghi danh)");
  const secB = await prisma.section.create({ data: { id: `secB-${stamp}`, title: "Phần của lớp B", order: 1, courseId: B.id } });
  const chB = await prisma.chapter.create({ data: { id: `chB-${stamp}`, title: "Nhóm lớp B", order: 1, sectionId: secB.id } });
  const AS_B = await mkAsg(chB.id, { ownerId: T2.id });
  const SB = await mkUser({ name: "Học sinh lớp B" }); await prisma.enrollment.create({ data: { userId: SB.id, courseId: B.id, status: "active" } });
  const SA1 = await newStudent("Học sinh chỉ lớp A");
  const FB = await ready(SB, AS_B, "bai-lop-b.docx"); await api("POST", NOP(AS_B.id), { as: SB });
  const subB = (await submitOf(AS_B.id, SB.id))!;
  check("học sinh lớp A init vào bài của lớp B ⇒ 403, không tạo hàng", (await api("POST", INIT, { as: SA1, body: { kind: "student", assignmentId: AS_B.id, name: "a.docx", size: 50 } })).status === 403 && (await prisma.submissionFile.count({ where: { assignmentId: AS_B.id, studentUserId: SA1.id } })) === 0);
  const crossNop = await api("POST", NOP(AS_B.id), { as: SA1 });
  check("học sinh lớp A bấm nop bài lớp B ⇒ 303 ?nop=loi-lop, không tạo bài nộp", crossNop.status === 303 && /nop=loi-lop/.test(crossNop.headers.get("location") ?? "") && (await submitOf(AS_B.id, SA1.id)) === null, crossNop.headers.get("location"));
  check("học sinh lớp A xem danh sách tệp của bài lớp B ⇒ 403", (await api("GET", `${LIST}?assignmentId=${AS_B.id}`, { as: SA1 })).status === 403);
  const crossDl = await dl(SA1, FB);
  check("học sinh lớp A tải tệp của học sinh lớp B ⇒ 404 (không lộ tồn tại), complete / xoá / PUT đè ⇒ 404 hết, tệp nguyên vẹn", crossDl.status === 404 && noLeak(crossDl) && (await api("POST", COMPLETE, { as: SA1, body: { fileId: FB } })).status === 404 && (await api("POST", `/api/media/nop-bai/${FB}/xoa`, { as: SA1, body: {} })).status === 404 && (await api("PUT", `/api/media/nop-bai/dai/${FB}`, { as: SA1, raw: Buffer.from("x") })).status === 404 && (await prisma.submissionFile.findUnique({ where: { id: FB } }))?.status === "ready");
  check("gia sư lớp A (không phải chủ lớp B) tải tệp học sinh lớp B ⇒ 403; danh sách theo bài nộp của B ⇒ 403", (await dl(T, FB)).status === 403 && (await api("GET", `${LIST}?submissionId=${subB.id}`, { as: T })).status === 403);

  section("7c. Học sinh không ghi danh / đã nghỉ lớp: các đường còn lại (danh sách, chốt, bỏ tệp, PUT)");
  const SP = await newStudent("Học sinh sẽ nghỉ giữa chừng");
  // init + PUT nhưng KHÔNG complete (helper `upload` tự complete nên làm tay)
  const pInit = await api("POST", INIT, { as: SP, body: { kind: "student", assignmentId: AS.id, name: "dang-do.docx", size: 20, type: DOCX_MIME } });
  const pend = { fileId: pInit.json?.fileId as string, put: await api("PUT", pInit.json.upload.url, { as: SP, raw: validDocx() as unknown as BodyInit }) };
  check("tiền đề: tệp đã PUT nhưng còn 'pending'", pInit.status === 200 && pend.put.status === 200 && (await prisma.submissionFile.findUnique({ where: { id: pend.fileId } }))?.status === "pending", [pInit.status, pend.put.status]);
  await prisma.enrollment.update({ where: { userId_courseId: { userId: SP.id, courseId: A.id } }, data: { status: "suspended" } });
  const cSus = await api("POST", COMPLETE, { as: SP, body: { fileId: pend.fileId } });
  check("nghỉ lớp giữa chừng: complete ⇒ 403 (không chốt được nữa), tệp vẫn pending", cSus.status === 403 && (await prisma.submissionFile.findUnique({ where: { id: pend.fileId } }))?.status === "pending", [cSus.status, cSus.json]);
  check("nghỉ lớp: xoá tệp của mình ⇒ 403; xem danh sách của bài ⇒ 403", (await api("POST", `/api/media/nop-bai/${pend.fileId}/xoa`, { as: SP, body: {} })).status === 403 && (await api("GET", `${LIST}?assignmentId=${AS.id}`, { as: SP })).status === 403);
  check("học sinh chưa ghi danh (SX): danh sách ⇒ 403, init tutor_return ⇒ 403 (đã có ca student)", (await api("GET", `${LIST}?assignmentId=${AS.id}`, { as: SX })).status === 403);
  const putSus = await api("PUT", `/api/media/nop-bai/dai/${pend.fileId}`, { as: SP, raw: Buffer.from("x") });
  console.log(`     [thông tin] học sinh đã nghỉ lớp PUT byte vào tệp pending của mình ⇒ HTTP ${putSus.status} (route dai/[fileId] KHÔNG kiểm ghi danh; byte chỉ vào tệp nháp của chính em, không chốt được, cron dọn sau 24 giờ)`);

  section("7d. Bài tập Nháp / Ẩn: học sinh đã nộp lúc đang Đã đăng, sau đó mục bị chuyển Nháp rồi Ẩn");
  const AS_H = await mkAsg(ch2.id);
  const SH = await newStudent("Học sinh bài bị ẩn");
  const FH = await ready(SH, AS_H, "truoc-khi-an.docx"); await api("POST", NOP(AS_H.id), { as: SH });
  const SHB = await newStudent("Học sinh khác bài bị ẩn"); const FHB = await ready(SHB, AS_H, "khac.docx");   // nháp của em khác
  for (const st of ["draft", "hidden"] as const) {
    await prisma.lesson.update({ where: { id: AS_H.lessonId }, data: { status: st } });
    check(`mục ${st}: init ⇒ 404, nop ⇒ 404, danh sách ⇒ 404, complete tệp nháp mới ⇒ 404 (studentGate), xoá ⇒ 404`, (await api("POST", INIT, { as: SH, body: { kind: "student", assignmentId: AS_H.id, name: "n.docx", size: 50 } })).status === 404 && (await api("POST", NOP(AS_H.id), { as: SH })).status === 404 && (await api("GET", `${LIST}?assignmentId=${AS_H.id}`, { as: SH })).status === 404 && (await api("POST", COMPLETE, { as: SHB, body: { fileId: FHB } })).status === 404 && (await api("POST", `/api/media/nop-bai/${FH}/xoa`, { as: SH, body: {} })).status === 404);
    const own = await dl(SH, FH), other = await dl(SHB, FH);
    check(`mục ${st}: em KHÁC tải tệp đã nộp ⇒ 404; khách ⇒ 401`, other.status === 404 && (await dl(undefined, FH)).status === 401);
    console.log(`     [thông tin] mục ${st}: CHÍNH chủ bài tải lại tệp của mình ⇒ HTTP ${own.status} (spec 3.3 không có điều khoản theo trạng thái mục; mọi đường GHI đều 404). Gia sư chủ lớp tải ⇒ ${(await dl(T, FH)).status}`);
  }
  await prisma.lesson.update({ where: { id: AS_H.lessonId }, data: { status: "published" } });

  section("7e. Tệp trả bài (kind=tutor_return): gia sư lớp khác, học sinh, và gắn nhầm bài / nhầm học sinh");
  const SR = await newStudent("Học sinh nhận trả bài"), SR2 = await newStudent("Học sinh nhận trả bài 2");
  await ready(SR, AS, "sr.docx"); await api("POST", NOP(AS.id), { as: SR });
  await ready(SR2, AS, "sr2.docx"); await api("POST", NOP(AS.id), { as: SR2 });
  const subR = (await submitOf(AS.id, SR.id))!, subR2 = (await submitOf(AS.id, SR2.id))!;
  const trA = await upload(T, AS, "nhan-xet-1.docx", validDocx(), { kind: "tutor_return", submissionId: subR.id });
  const trB = await upload(T, AS, "nhan-xet-2.docx", validDocx(), { kind: "tutor_return", submissionId: subR.id });
  const trCrossSub = await api("POST", INIT, { as: T, body: { kind: "tutor_return", assignmentId: AS.id, submissionId: subB.id, name: "x.docx", size: 50 } });
  check("tiền đề: hai tệp trả bài ready của gia sư T cho bài của SR", trA.complete?.status === 200 && trB.complete?.status === 200);
  check("gia sư init tutor_return với assignmentId của bài NÀY nhưng submissionId của bài lớp KHÁC ⇒ 404, không tạo hàng", trCrossSub.status === 404 && (await prisma.submissionFile.count({ where: { kind: "tutor_return", studentUserId: SB.id } })) === 0, trCrossSub.json);
  const attOk = await api("POST", ATTACH, { as: T, body: { submissionId: subR.id, fileIds: [trA.fileId] } });
  check("gia sư T đính kèm tệp trả bài đúng học sinh ⇒ 200", attOk.status === 200 && (await prisma.submissionFile.findUnique({ where: { id: trA.fileId! } }))?.submissionId === subR.id);
  // gắn nhầm
  const mis1 = await api("POST", ATTACH, { as: T, body: { submissionId: subR2.id, fileIds: [trB.fileId] } });
  check("gia sư T gắn tệp trả bài của SR vào bài nộp của SR2 (nhầm học sinh) ⇒ 400, tệp vẫn chưa gắn", mis1.status === 400 && (await prisma.submissionFile.findUnique({ where: { id: trB.fileId! } }))?.submissionId === null, [mis1.status, mis1.json]);
  const mis2 = await api("POST", ATTACH, { as: T, body: { submissionId: subR2.id, fileIds: [trA.fileId] } });
  check("gia sư T gắn tệp trả bài ĐÃ gắn của SR vào bài nộp của SR2 ⇒ 400, tệp vẫn thuộc bài của SR", mis2.status === 400 && (await prisma.submissionFile.findUnique({ where: { id: trA.fileId! } }))?.submissionId === subR.id, [mis2.status, mis2.json]);
  const mis3 = await api("POST", ATTACH, { as: T2, body: { submissionId: subB.id, fileIds: [trB.fileId] } });
  check("gia sư LỚP KHÁC (chủ lớp B) gắn tệp trả bài của gia sư T vào bài nộp của lớp B mình ⇒ 400, tệp không đổi chủ", mis3.status === 400 && (await prisma.submissionFile.findUnique({ where: { id: trB.fileId! } }))?.submissionId === null, [mis3.status, mis3.json]);
  const mis4 = await api("POST", ATTACH, { as: T2, body: { submissionId: subR.id, fileIds: [trB.fileId] } });
  check("gia sư LỚP KHÁC gắn tệp vào bài nộp của lớp A ⇒ 403 (không qua cổng chấm)", mis4.status === 403 && (await prisma.submissionFile.findUnique({ where: { id: trB.fileId! } }))?.submissionId === null, mis4.status);
  // gia sư lớp khác đụng tệp trả bài (đã gắn)
  const t2dl = await dl(T2, trA.fileId!);
  check("gia sư lớp B tải tệp trả bài (đã gắn) của lớp A ⇒ 403, không lộ khoá", t2dl.status === 403 && noLeak(t2dl), t2dl.status);
  check("gia sư lớp B complete / xoá / PUT đè tệp trả bài của gia sư T ⇒ 404 hết, tệp nguyên vẹn", (await api("POST", COMPLETE, { as: T2, body: { fileId: trA.fileId } })).status === 404 && (await api("POST", `/api/media/nop-bai/${trA.fileId}/xoa`, { as: T2, body: { confirm: true } })).status === 404 && (await api("PUT", `/api/media/nop-bai/dai/${trA.fileId}`, { as: T2, raw: Buffer.from("x") })).status === 404 && (await prisma.submissionFile.findUnique({ where: { id: trA.fileId! } }))?.status === "ready");
  const t2list = await api("GET", `${LIST}?submissionId=${subR.id}`, { as: T2 });
  check("gia sư lớp B xem danh sách bài nộp của lớp A ⇒ 403 và thân không chứa id tệp trả bài", t2list.status === 403 && !t2list.text.includes(trA.fileId!), t2list.status);
  // học sinh đụng kind=tutor_return
  check("học sinh nhận bài tải tệp trả bài ĐÃ gắn của mình ⇒ 200; học sinh KHÁC (SR2) ⇒ 404", (await dl(SR, trA.fileId!)).status === 200 && (await dl(SR2, trA.fileId!)).status === 404);
  check("học sinh tải tệp trả bài CHƯA gắn (nháp của gia sư) ⇒ 404", (await dl(SR, trB.fileId!)).status === 404);
  const stuTouch = [await api("POST", COMPLETE, { as: SR, body: { fileId: trB.fileId } }), await api("POST", `/api/media/nop-bai/${trB.fileId}/xoa`, { as: SR, body: { confirm: true } }), await api("PUT", `/api/media/nop-bai/dai/${trB.fileId}`, { as: SR, raw: Buffer.from("x") }),
    await api("POST", COMPLETE, { as: SR, body: { fileId: trA.fileId } }), await api("POST", `/api/media/nop-bai/${trA.fileId}/xoa`, { as: SR, body: { confirm: true } })];
  check("học sinh complete / xoá / PUT đè tệp kind=tutor_return (đã gắn hoặc chưa gắn) ⇒ 404 hết (không phải chủ tải)", stuTouch.every(r => r.status === 404), stuTouch.map(r => r.status));
  const beforeSub = await submitOf(AS.id, SR.id);
  const stuNop = await api("POST", NOP(AS.id), { as: SR, raw: `fileId=${trB.fileId}&fileIds=${trB.fileId},${trA.fileId}&kind=tutor_return` as unknown as BodyInit, headers: { "content-type": "application/x-www-form-urlencoded" } });
  const afterSub = await submitOf(AS.id, SR.id);
  check("học sinh bấm nop kèm id tệp tutor_return trong thân ⇒ bị bỏ qua: bài nộp không đổi, tệp trả bài giữ nguyên (đã gắn / chưa gắn như cũ)", stuNop.status === 303 && beforeSub?.submittedAt.getTime() === afterSub?.submittedAt.getTime() && beforeSub?.fileUrl === afterSub?.fileUrl && (await prisma.submissionFile.findUnique({ where: { id: trA.fileId! } }))?.submissionId === subR.id && (await prisma.submissionFile.findUnique({ where: { id: trB.fileId! } }))?.submissionId === null && (await prisma.submissionFile.count({ where: { submissionId: subR.id, kind: "student", status: "ready" } })) === 1, [stuNop.status, stuNop.headers.get("location")]);
  check("học sinh gọi dinh-kem với tệp tutor_return của mình ⇒ 403 (không phải người chấm), không gắn", (await api("POST", ATTACH, { as: SR, body: { submissionId: subR.id, fileIds: [trB.fileId] } })).status === 403 && (await prisma.submissionFile.findUnique({ where: { id: trB.fileId! } }))?.submissionId === null);
  check("học sinh nhận bài bấm danh sách: thấy tệp trả bài ĐÃ gắn, KHÔNG thấy tệp trả bài chưa gắn", await (async () => { const l = await api("GET", `${LIST}?assignmentId=${AS.id}`, { as: SR }); return l.status === 200 && l.json.files.some((f: Json) => f.id === trA.fileId) && !l.json.files.some((f: Json) => f.id === trB.fileId) && noLeak(l); })());

  section("7f. Khách gọi mọi đường còn lại của nop-bai ⇒ 401, và không phát sinh gì");
  const rowsBefore = await prisma.submissionFile.count();
  const guestAll = [
    await api("GET", `${LIST}?assignmentId=${AS.id}`), await api("GET", `${LIST}?submissionId=${subR.id}`), await api("POST", COMPLETE, { body: { fileId: trA.fileId } }),
    await api("POST", `/api/media/nop-bai/${trA.fileId}/xoa`, { body: {} }), await api("PUT", `/api/media/nop-bai/dai/${trB.fileId}`, { raw: Buffer.from("x") }),
    await api("POST", NOP(AS.id)), await api("POST", INIT, { body: { kind: "tutor_return", assignmentId: AS.id, submissionId: subR.id, name: "x.docx", size: 5 } }),
  ];
  check("khách: danh-sach ×2, complete, xoa, PUT dai, nop, init(tutor_return) ⇒ 401 hết, không tạo / đổi hàng nào", guestAll.every(r => r.status === 401) && (await prisma.submissionFile.count()) === rowsBefore, guestAll.map(r => r.status));
  check("khách: không phản hồi nào lộ khoá kho / tên tệp", noLeak(...guestAll.map(r => ({ text: r.text, headers: r.headers }))));

  // ── 8. Không lộ gì ở bất kỳ phản hồi nào ──────────────────────────────────
  section("8. Quét rò rỉ");
  const all = [lst1, lst8, lstTut, att, up1.init, up1.complete!, own, rng, e1, e2, e3, e4];
  check("không phản hồi nào (JSON, tiêu đề, lỗi) chứa storageKey / kin-nop-bai / cloudinary / sha256 / .kin-media", noLeak(...all.map(r => ({ text: r.text, headers: (r as { headers: Headers }).headers }))));
  check("tệp trên đĩa nằm dưới thư mục kho, không nơi nào trong thư mục tĩnh /public", (await prisma.submissionFile.findMany({ where: { status: "ready" }, take: 50 })).every(r => !r.storageKey.startsWith("/") && !r.storageKey.includes("public")));
  done();
})().catch(e => { console.error(e); process.exit(1); });
