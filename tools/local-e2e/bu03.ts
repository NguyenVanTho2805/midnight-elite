// BU-03 — đồ dùng chung của các bài API đề thi gia sư (t-bank-word-import, t-bu03-quyen, t-blueprint, t-exam-variants, t-exam-source-file, t-assign,
// t-exam-results, t-exam-results-xlsx). KHÔNG phải bài test; không tự chạy gì. Mọi bài dùng h.ts (wipe() ở đầu bài → DB thử RIÊNG, không phải DB thật).
import JSZip from "jszip";
import { api, mkCourse, mkTutor, mkUser, check, type TUser } from "./h";
import { prisma } from "@/lib/prisma";
import { computeContentHash } from "@/lib/questionDedup";

// ── Người dùng mẫu ───────────────────────────────────────────────────────────────────────────
export interface Actors { A: TUser; B: TUser; S: TUser; P: TUser; SUP: TUser; CON: TUser; courseA: { id: string }; courseB: { id: string } }
/** A, B = hai gia sư đã duyệt (mỗi người một lớp); S = học sinh; P = gia sư CHỜ DUYỆT (vai học sinh, có tutorAppliedAt, tutorVerified=false);
 *  SUP = admin_super; CON = admin_content. */
export async function mkActors(): Promise<Actors> {
  const A = await mkTutor("Cô An"), B = await mkTutor("Cô Bình");
  const S = await mkUser({ name: "Em Sáu" });
  const P = await mkUser({ name: "Cô Chờ Duyệt" });
  await prisma.user.update({ where: { id: P.id }, data: { tutorAppliedAt: new Date(), tutorVerified: false } });
  const SUP = await mkUser({ name: "Quản trị cấp 1", role: "admin", adminRole: "admin_super" });
  const CON = await mkUser({ name: "Quản trị nội dung", role: "admin", adminRole: "admin_content" });
  const courseA = await mkCourse(A.id, { name: "Lớp của A" });
  const courseB = await mkCourse(B.id, { name: "Lớp của B" });
  return { A, B, S, P, SUP, CON, courseA, courseB };
}

type Call = (as?: TUser) => Promise<{ status: number; json: any; text: string }>;
/**
 * Ma trận quyền cho MỘT route: khách 401 · học sinh 403 · gia sư chờ duyệt 403 · admin_super 403 · admin_content 403.
 * `call(as)` phải gọi route với id/thân HỢP LỆ và THẬT (để 401/403 không đậu giả vì 404 hay 400). Trả về số ca đã chạy.
 * Mỗi ca là một check độc lập: route thiếu requireTutor() thì đúng ca đó đỏ (và `snap()` ở bài gọi sẽ lộ việc ghi nhầm).
 */
export async function roleMatrix(label: string, a: Actors, call: Call): Promise<void> {
  const g = await call(undefined);
  check(`${label}: khách → 401`, g.status === 401, [g.status, g.text.slice(0, 120)]);
  for (const [who, u] of [["học sinh", a.S], ["gia sư chờ duyệt", a.P], ["admin_super", a.SUP], ["admin_content", a.CON]] as const) {
    const r = await call(u);
    check(`${label}: ${who} → 403`, r.status === 403, [r.status, r.text.slice(0, 120)]);
  }
}

// ── Chụp trạng thái DB để chứng minh "bị từ chối thì KHÔNG ghi" ──────────────────────────────────────────────
export async function snap(): Promise<string> {
  const [bp, bank, exam, q, files, usage, logs, lim] = await Promise.all([
    prisma.examBlueprint.findMany({ select: { id: true, name: true, rows: true, updatedAt: true }, orderBy: { id: "asc" } }),
    prisma.questionBankItem.count(), prisma.exam.count(), prisma.examQuestion.count(),
    prisma.examFile.findMany({ select: { id: true, extractedExamId: true }, orderBy: { id: "asc" } }),
    prisma.usageEvent.count(), prisma.examChangeLog.count(), prisma.quizAttemptLimit.count(),
  ]);
  const exams = await prisma.exam.findMany({
    select: { id: true, title: true, mode: true, courseId: true, price: true, passwordHash: true, password: true, active: true, isDraft: true, date: true, time: true, duration: true, activeGuest: true, guestCanTake: true },
    orderBy: { id: "asc" },
  });
  return JSON.stringify({ bp, bank, exam, q, files, usage, logs, lim, exams });
}

// ── Cây ngân hàng + câu ngân hàng ───────────────────────────────────────────────────────────────────────────
export interface Tree { root: string; lop: string; c1: string; c11: string; c2: string }
export async function mkTree(): Promise<Tree> {
  const mk = (name: string, parentId: string | null, sortOrder = 0) => prisma.questionCategory.create({ data: { name, parentId, sortOrder } }).then(c => c.id);
  const root = await mk("Toán", null), lop = await mk("Lớp 12", root), c1 = await mk("Chương 1", lop), c11 = await mk("YCCĐ 1.1", c1), c2 = await mk("Chương 2", lop, 1);
  return { root, lop, c1, c11, c2 };
}
let bankSeq = 0;
const stamp = Date.now().toString(36);
/** Câu ngân hàng MC có 4 phương án, đáp án A. `text` mặc định duy nhất nên hash không trùng. */
export async function mkBank(o: { ownerId: string | null; categoryId: string; difficulty: "NB" | "TH" | "VD" | "VDC"; status?: "approved" | "draft" | "pending"; text?: string; points?: number }) {
  bankSeq++;
  const text = o.text ?? `Câu ngân hàng ${stamp}-${bankSeq}: giá trị của biểu thức ${bankSeq} + ${bankSeq}?`;
  return prisma.questionBankItem.create({
    data: {
      type: "MC", text, points: o.points ?? 1, categoryId: o.categoryId, difficulty: o.difficulty, contentHash: computeContentHash(text),
      ownerId: o.ownerId, status: o.status ?? "approved",
      options: { create: ["A", "B", "C", "D"].map((t, i) => ({ order: i, text: `Đáp án ${t}`, isCorrect: i === 0 })) },
    },
    include: { options: true },
  });
}

// ── Đề (qua API thật, đúng đường gia sư đi) ───────────────────────────────────────────────────────────────
export const MCQ = (text: string, correct = 0, points = 1) => ({ type: "MC", text, points, options: ["A", "B", "C", "D"].map((t, i) => ({ text: `Đáp án ${t}`, isCorrect: i === correct })) });
/** Tạo đề NHÁP của `as` với `n` câu MC (mỗi câu `points` điểm, text duy nhất). Trả id. */
export async function mkDraft(as: TUser, o: { n?: number; points?: number; courseId?: string | null; title?: string } = {}): Promise<string> {
  const made = await api("POST", "/api/tutor/quiz", { as, body: { title: o.title ?? "Đề thử BU-03", ...(o.courseId ? { courseId: o.courseId } : {}) } });
  const id = made.json?.id as string;
  if (made.status !== 201 || !id) throw new Error(`mkDraft: tạo đề lỗi ${made.status} ${made.text.slice(0, 200)}`);
  const n = o.n ?? 5;
  for (let i = 1; i <= n; i++) {
    const r = await api("POST", `/api/tutor/quiz/${id}/questions`, { as, body: MCQ(`Câu ${i} của đề ${id.slice(-6)}: tính ${i} × ${i + 3}`, i % 4, o.points ?? 2) });
    if (r.status !== 201) throw new Error(`mkDraft: thêm câu ${i} lỗi ${r.status} ${r.text.slice(0, 200)}`);
  }
  return id;
}
/** Đề đã PHÁT HÀNH (một mã). Cần `courseId` của chính `as`. */
export async function mkPublished(as: TUser, courseId: string, o: { n?: number; points?: number; title?: string } = {}): Promise<string> {
  const id = await mkDraft(as, { ...o, courseId });
  const r = await api("POST", `/api/tutor/quiz/${id}/publish`, { as });
  if (r.status !== 200) throw new Error(`mkPublished: phát hành lỗi ${r.status} ${r.text.slice(0, 200)}`);
  return id;
}
/** Các câu của một đề, theo thứ tự, kèm phương án (đọc thẳng DB — thứ tự thật mà học sinh sẽ thấy). */
export async function questionsOf(examId: string) {
  return prisma.examQuestion.findMany({ where: { examId }, orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" } } } });
}

// ── Tệp .docx tổng hợp (jszip) ────────────────────────────────────────────────────────────────────────────────
const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const para = (t: string, bold = false) => `<w:p><w:r>${bold ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p>`;
export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function mkDocx(body: string, o: { files?: Record<string, Buffer | string>; rawDoc?: string } = {}): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
  zip.file("word/document.xml", o.rawDoc ?? `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body}</w:body></w:document>`);
  zip.file("word/_rels/document.xml.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>');
  for (const [k, v] of Object.entries(o.files ?? {})) zip.file(k, v);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
/** Đề Word mẫu Azota: một phần "nhiều phương án lựa chọn", `n` câu, đáp án đúng đánh dấu `*` đầu phương án (xoay A..D). Nội dung mỗi câu khác nhau. */
export function azotaBody(n: number, tag = "w"): string {
  let b = para("PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn.", true);
  for (let i = 1; i <= n; i++) {
    const right = i % 4;
    b += para(`Câu ${i}. ${tag} nội dung số ${i}: tính ${i} + ${i * 2}`);
    b += ["A", "B", "C", "D"].map((L, k) => para(`${k === right ? "*" : ""}${L}. kết quả ${k + i}`)).join("");
  }
  return b;
}
export const azotaDocx = (n: number, tag = "w") => mkDocx(azotaBody(n, tag));

// ── Gửi tệp (multipart) ───────────────────────────────────────────────────────────────────────────────────────────
export function uploadDocx(path: string, as: TUser | undefined, buf: Buffer | Uint8Array, name = "de.docx", field = "file") {
  const fd = new FormData();
  fd.append(field, new File([new Uint8Array(buf)], name, { type: DOCX_MIME }));
  return api("POST", path, { as, raw: fd });
}

/** In một dòng "tài liệu hoá lỗ có sẵn": KHÔNG tính pass/fail (nhãn KNOWN-ISSUE). */
export function knownIssue(msg: string) { console.log(`  ⚠ KNOWN-ISSUE (không tính đỏ): ${msg}`); }
/** In SKIP có lý do, không tính. */
export function skip(msg: string) { console.log(`  – SKIP (không tính pass): ${msg}`); }

// ── Thế giới kết quả (dùng chung t-exam-results và t-exam-results-xlsx) ───────────────────────────────────────────────────────────────
export const RES_NAMES = ["Học sinh Alpha Một", "Học sinh Beta Hai", "Học sinh Gamma Ba", "Học sinh Delta Bốn"] as const;
export interface ResultsWorld {
  root: string; child: string; s: TUser[]; rootQ: Awaited<ReturnType<typeof questionsOf>>; childQ: Awaited<ReturnType<typeof questionsOf>>;
  attempts: { s1a: string; s1b: string; s2: string; s3: string; s4: string };
}
/**
 * Đề gốc 5 câu × 2 điểm (tổng 10) + 1 mã con (variantNo 2). Bốn học sinh:
 *   Alpha: hai lượt nộp trên mã gốc — 4 điểm (sớm, 600 giây) và 9 điểm (muộn, 1200 giây);  Beta: 6 điểm trên gốc (900 giây, rời màn hình 3 lần);
 *   Gamma: 8 điểm trên MÃ CON (300 giây);  Delta: đang làm dở (không tính).
 * Trả lời: câu 1 của gốc (khoá câu K1): Alpha-a đúng, Alpha-b đúng, Beta sai, Gamma đúng trên câu TƯƠNG ỨNG ở mã con (gộp theo variantKey) → 4 lượt, 3/4 đúng.
 *          câu 2 của gốc (K2): Alpha-a, Alpha-b, Beta đều SAI → 3 lượt, 0 đúng → cần xem lại.
 */
export async function mkResultsWorld(A: TUser, courseId: string): Promise<ResultsWorld> {
  const root = await mkDraft(A, { n: 5, points: 2, courseId, title: "Đề kết quả BU-03" });
  const mk = await api("POST", `/api/tutor/de-thi/${root}/ma-de`, { as: A, body: { count: 2 } });
  if (mk.status !== 201) throw new Error(`mkResultsWorld: tạo mã đề lỗi ${mk.status} ${mk.text.slice(0, 200)}`);
  const child = (await prisma.exam.findFirstOrThrow({ where: { variantOfId: root } })).id;
  const s: TUser[] = [];
  for (const n of RES_NAMES) s.push(await mkUser({ name: n }));
  const t0 = new Date("2026-10-01T10:00:00Z").getTime();
  const mkA = (user: TUser, examId: string, o: { score: number | null; status?: string; startMin: number; secs: number; tabs?: number }) =>
    prisma.examAttempt.create({
      data: {
        userId: user.id, examId, expiresAt: new Date(t0 + 86_400_000), status: o.status ?? "submitted", score: o.score, totalPoints: o.score === null ? null : 10,
        startedAt: new Date(t0 + o.startMin * 60_000), submittedAt: o.status === "in_progress" ? null : new Date(t0 + o.startMin * 60_000 + o.secs * 1000), tabSwitchCount: o.tabs ?? 0,
      },
    }).then(x => x.id);
  const s1a = await mkA(s[0], root, { score: 4, startMin: 0, secs: 600 });
  const s1b = await mkA(s[0], root, { score: 9, startMin: 120, secs: 1200 });
  const s2 = await mkA(s[1], root, { score: 6, startMin: 30, secs: 900, tabs: 3 });
  const s3 = await mkA(s[2], child, { score: 8, startMin: 40, secs: 300 });
  const s4 = await mkA(s[3], root, { score: null, status: "in_progress", startMin: 50, secs: 0 });
  const rootQ = await questionsOf(root), childQ = await questionsOf(child);
  const key = (q: (typeof rootQ)[number]) => JSON.stringify([q.type, q.text, q.options.map(o => [o.text, o.isCorrect]).sort()]);
  const ans = (attemptId: string, q: (typeof rootQ)[number], right: boolean) =>
    prisma.examAnswer.create({ data: { attemptId, questionId: q.id, optionId: q.options.find(o => o.isCorrect === right)!.id } });
  const childOf = (q: (typeof rootQ)[number]) => childQ.find(c => key(c) === key(q))!;
  await ans(s1a, rootQ[0], true); await ans(s1b, rootQ[0], true); await ans(s2, rootQ[0], false); await ans(s3, childOf(rootQ[0]), true);
  await ans(s1a, rootQ[1], false); await ans(s1b, rootQ[1], false); await ans(s2, rootQ[1], false);
  return { root, child, s, rootQ, childQ, attempts: { s1a, s1b, s2, s3, s4 } };
}
