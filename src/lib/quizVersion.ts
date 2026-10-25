// QZ-07 — quiz chỉnh sửa và phiên bản (Figma 521:5150): luật THUẦN. Không DB, không React.
// Nguyên tắc: bài đã có người làm thì KHÔNG sửa đè. Chỉnh sửa = tạo PHIÊN BẢN MỚI (một dòng Exam mới, cùng chuỗi rootExamId);
// phiên bản cũ giữ nguyên câu hỏi, đáp án, bài làm và điểm — bài làm cũ vẫn trỏ về ExamAttempt.examId của phiên bản cũ.

/** Có được sửa trực tiếp không? Chỉ khi chưa có bất kỳ lượt làm nào (kể cả lượt đang làm dở hay đã hết giờ). */
export function canEditInPlace(attemptCount: number): boolean {
  return Number.isFinite(attemptCount) && attemptCount <= 0;
}

export interface VersionedExamRef { id: string; rootExamId: string | null; versionNo: number; supersededById: string | null }

/** id gốc của chuỗi phiên bản: đề chưa từng có phiên bản thì chính nó là gốc. */
export function rootIdOf(e: Pick<VersionedExamRef, "id" | "rootExamId">): string {
  return e.rootExamId ?? e.id;
}

/** Phiên bản kế tiếp trong chuỗi = số lớn nhất đang có + 1 (không dựa vào đếm số dòng, vì có thể có dòng bị xoá). */
export function nextVersionNo(chain: readonly Pick<VersionedExamRef, "versionNo">[]): number {
  return chain.reduce((m, e) => Math.max(m, Number.isFinite(e.versionNo) ? e.versionNo : 1), 0) + 1;
}

/** Bản đang dùng của chuỗi: bản chưa bị thay thế và không phải nháp, có số phiên bản cao nhất. */
export function currentPublished<T extends VersionedExamRef & { isDraft: boolean }>(chain: readonly T[]): T | null {
  const live = chain.filter(e => !e.supersededById && !e.isDraft);
  return live.sort((a, b) => b.versionNo - a.versionNo)[0] ?? null;
}

/** Một chuỗi chỉ được có TỐI ĐA một bản nháp phiên bản mới cùng lúc (tránh hai bản nháp tranh nhau thay một bản). */
export function pendingDraft<T extends VersionedExamRef & { isDraft: boolean }>(chain: readonly T[]): T | null {
  return chain.filter(e => e.isDraft && !e.supersededById).sort((a, b) => b.versionNo - a.versionNo)[0] ?? null;
}

// ── So sánh hai phiên bản ──────────────────────────────────────────────────────────────────────
export interface SnapOption { text: string; isCorrect: boolean; subLabel?: string | null }
export interface SnapQuestion {
  type: string; text: string; points: number; sectionLabel?: string | null;
  imageUrl?: string | null; explanation?: string | null; hint?: string | null;
  studentGuide?: string | null; graderGuide?: string | null; rubric?: unknown;
  options: SnapOption[];
}

/** Chữ ký nội dung của một câu (mọi thứ ảnh hưởng điểm hay cách học sinh thấy câu). Hai câu cùng chữ ký = giống hệt. Thứ tự lựa chọn có tính. */
export function questionSignature(q: SnapQuestion): string {
  return JSON.stringify([
    q.type, q.text.trim(), q.points, q.sectionLabel ?? null, q.imageUrl ?? null, (q.explanation ?? "").trim(), (q.hint ?? "").trim(),
    (q.studentGuide ?? "").trim(), (q.graderGuide ?? "").trim(), q.rubric ?? null,
    q.options.map(o => [o.text.trim(), !!o.isCorrect, o.subLabel ?? null]),
  ]);
}

/** Chữ ký CHỈ phần đáp án đúng + điểm: dùng để cảnh báo "đổi đáp án / đổi điểm" — điều gia sư phải biết trước khi áp cho học sinh mới. */
export function answerKeySignature(q: SnapQuestion): string {
  return JSON.stringify([q.type, q.points, q.options.map(o => [o.text.trim(), !!o.isCorrect])]);
}

export type QuestionChange = "same" | "changed" | "added" | "removed";
export interface QuizDiff {
  rows: { index: number; change: QuestionChange; keyChanged: boolean }[];
  same: number; changed: number; added: number; removed: number;
  /** Số câu đổi đáp án đúng hoặc điểm (không tính chỉnh chữ). */
  keyChanges: number;
  totalPointsFrom: number; totalPointsTo: number;
  identical: boolean;
}

/** So hai danh sách câu theo vị trí (thứ tự câu trong đề). Câu chỉ ở một bên = thêm / bỏ. */
export function diffQuestionSets(from: readonly SnapQuestion[], to: readonly SnapQuestion[]): QuizDiff {
  const rows: QuizDiff["rows"] = [];
  let same = 0, changed = 0, added = 0, removed = 0, keyChanges = 0;
  const n = Math.max(from.length, to.length);
  for (let i = 0; i < n; i++) {
    const a = from[i], b = to[i];
    if (a && !b) { rows.push({ index: i, change: "removed", keyChanged: false }); removed++; continue; }
    if (!a && b) { rows.push({ index: i, change: "added", keyChanged: false }); added++; continue; }
    if (a && b) {
      if (questionSignature(a) === questionSignature(b)) { rows.push({ index: i, change: "same", keyChanged: false }); same++; continue; }
      const keyChanged = answerKeySignature(a) !== answerKeySignature(b);
      rows.push({ index: i, change: "changed", keyChanged });
      changed++; if (keyChanged) keyChanges++;
    }
  }
  const sum = (qs: readonly SnapQuestion[]) => Math.round(qs.reduce((s, q) => s + q.points, 0) * 100) / 100;
  return { rows, same, changed, added, removed, keyChanges, totalPointsFrom: sum(from), totalPointsTo: sum(to), identical: changed + added + removed === 0 };
}

/** Dòng tóm tắt thay đổi cho gia sư — nói đúng số, không làm nhẹ việc đổi đáp án. */
export function diffSummary(d: QuizDiff): string {
  if (d.identical) return "Chưa có thay đổi nào so với bản đang dùng.";
  const parts: string[] = [];
  if (d.changed) parts.push(`${d.changed} câu sửa`);
  if (d.added) parts.push(`${d.added} câu thêm`);
  if (d.removed) parts.push(`${d.removed} câu bỏ`);
  const key = d.keyChanges ? ` Trong đó ${d.keyChanges} câu đổi đáp án đúng hoặc điểm.` : "";
  return `${parts.join(", ")}.${key}`;
}

/** Dựng dữ liệu tạo câu mới từ một câu của phiên bản cũ: bỏ id cũ, giữ nội dung. Không dùng chung dòng giữa hai phiên bản (sửa dòng này không đụng dòng kia). */
export function cloneQuestionForVersion<Q extends SnapQuestion>(q: Q): SnapQuestion {
  return {
    type: q.type, text: q.text, points: q.points, sectionLabel: q.sectionLabel ?? null, imageUrl: q.imageUrl ?? null,
    explanation: q.explanation ?? null, hint: q.hint ?? null, studentGuide: q.studentGuide ?? null, graderGuide: q.graderGuide ?? null,
    rubric: q.rubric ?? null,
    options: q.options.map(o => ({ text: o.text, isCorrect: o.isCorrect, subLabel: o.subLabel ?? null })),
  };
}
