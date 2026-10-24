// QZ-11/QZ-12 phía học sinh — phần THUẦN (không prisma, không React) để test được: giờ theo máy chủ, danh sách câu chưa làm, cổng số lượt,
// ai được thấy điểm/đáp án, chữ ở màn "đã nộp", chọn bản nháp. Máy chủ vẫn là nơi quyết định cuối cùng; các hàm này chỉ dựng chữ và so sánh.

// ── Giờ theo máy chủ ──────────────────────────────────────────────────────────
/** Chênh lệch (máy chủ − trình duyệt) tính bằng ms, lấy từ `serverNow` máy chủ trả về. Không đọc được → 0 (không điều chỉnh). */
export function clockOffsetMs(serverNowIso: string | null | undefined, clientNowMs: number): number {
  if (!serverNowIso) return 0;
  const s = Date.parse(serverNowIso);
  return Number.isFinite(s) && Number.isFinite(clientNowMs) ? s - clientNowMs : 0;
}

/** Số giây còn lại tới `expiresAt`, tính theo giờ máy chủ = giờ trình duyệt + chênh lệch. Không âm; hạn không đọc được → 0 (coi như hết giờ, an toàn hơn kéo dài). */
export function remainingSecFrom(expiresAtIso: string | null | undefined, offsetMs: number, clientNowMs: number): number {
  if (!expiresAtIso) return 0;
  const e = Date.parse(expiresAtIso);
  if (!Number.isFinite(e) || !Number.isFinite(clientNowMs)) return 0;
  return Math.max(0, Math.floor((e - (clientNowMs + (Number.isFinite(offsetMs) ? offsetMs : 0))) / 1000));
}

// ── Câu chưa làm ──────────────────────────────────────────────────────────────
export interface RoomQuestion { id: string; type: string; options: { id: string }[] }
export interface RoomAnswerState {
  selected: Record<string, string | null | undefined>;
  text: Record<string, string | undefined>;
  cluster: Record<string, boolean | null | undefined>;
}

/** Một câu đã trả lời chưa — cùng quy tắc với trang phòng thi: tự luận/trả lời ngắn cần chữ không rỗng; cụm Đúng–Sai cần đủ mọi ý; trắc nghiệm cần một đáp án. */
export function isAnswered(q: RoomQuestion, st: RoomAnswerState): boolean {
  if (q.type === "ESSAY" || q.type === "SHORT_ANSWER") return !!st.text[q.id]?.trim();
  if (q.type === "TRUE_FALSE_CLUSTER") return q.options.length > 0 && q.options.every(o => st.cluster[o.id] === true || st.cluster[o.id] === false);
  return !!st.selected[q.id];
}

export interface UnansweredItem { index: number; id: string; essay: boolean }
/** Các câu chưa làm theo thứ tự hiển thị; `index` tính từ 1 (số câu hiện cho học sinh). */
export function unansweredList(questions: RoomQuestion[], st: RoomAnswerState): UnansweredItem[] {
  const out: UnansweredItem[] = [];
  questions.forEach((q, i) => { if (!isAnswered(q, st)) out.push({ index: i + 1, id: q.id, essay: q.type === "ESSAY" }); });
  return out;
}

/** "Câu 3, 5, 9" — danh sách dài thì rút gọn ("Câu 1, 2, 3, 4, 5, 6 và 4 câu nữa"). */
export function unansweredLabel(items: UnansweredItem[], maxShown = 8): string {
  if (items.length === 0) return "";
  const shown = items.slice(0, maxShown).map(i => i.index).join(", ");
  const rest = items.length - maxShown;
  return rest > 0 ? `Câu ${shown} và ${rest} câu nữa` : `Câu ${shown}`;
}

/** Lời trong hộp xác nhận nộp: liệt kê câu chưa làm, nhắc phần tự luận chờ chấm, và nói thẳng là nộp rồi không sửa. */
export function submitConfirmMessage(items: UnansweredItem[], hasEssay: boolean): string {
  const lines: string[] = [];
  lines.push(items.length > 0 ? `Em còn ${items.length} câu chưa làm: ${unansweredLabel(items)}.` : "Em đã trả lời hết các câu.");
  if (hasEssay) lines.push("Phần tự luận sẽ chờ gia sư chấm; điểm tổng chưa hiện ngay.");
  lines.push("Nộp rồi thì không sửa lại được.");
  return lines.join(" ");
}

// ── Số lượt làm ───────────────────────────────────────────────────────────────
export interface AttemptsGate { canStart: boolean; remaining: number | null; reason: "ok" | "resume" | "attempts_exhausted" }
/** `max` null/không hợp lệ = không giới hạn. Lượt đang làm dở luôn được tiếp tục (không tạo lượt mới nên không vượt số lần). `used` = mọi lượt đã tạo, kể cả đang làm. */
export function attemptsGate(opts: { used: number; max: number | null | undefined; hasInProgress: boolean }): AttemptsGate {
  const max = typeof opts.max === "number" && Number.isInteger(opts.max) && opts.max > 0 ? opts.max : null;
  const used = Math.max(0, Math.floor(opts.used) || 0);
  if (opts.hasInProgress) return { canStart: true, remaining: max === null ? null : Math.max(0, max - used), reason: "resume" };
  if (max === null) return { canStart: true, remaining: null, reason: "ok" };
  if (used >= max) return { canStart: false, remaining: 0, reason: "attempts_exhausted" };
  return { canStart: true, remaining: max - used, reason: "ok" };
}

/** "Lượt 1/1" — số thứ tự lượt sắp làm (hoặc đang làm). */
export function attemptCounterLabel(used: number, max: number | null | undefined, hasInProgress: boolean): string {
  const m = typeof max === "number" && max > 0 ? max : null;
  const n = hasInProgress ? Math.max(1, used) : used + 1;
  return m ? `Lượt ${Math.min(n, m)}/${m}` : `Lượt ${n}`;
}

// ── Ai được thấy gì ───────────────────────────────────────────────────────────
export interface PublishState { hasEssay: boolean; published: boolean }
export interface ResultVisibility { showScore: boolean; showEssayPoints: boolean; showAnswers: boolean; pendingManual: boolean }
/**
 * Bài có tự luận mà gia sư chưa công bố: KHÔNG điểm tổng, KHÔNG điểm/nhận xét tự luận, KHÔNG đáp án đúng/lời giải (chỉ thấy câu trả lời của chính mình).
 * Bài không có tự luận: chấm tự động xong là có điểm; việc xem đáp án vẫn theo cài đặt của đề (answerVisibility), không do hàm này quyết.
 * `answersAllowedByExam` = kết quả của answerVisibility/hasExamWindowEnded; công bố chỉ có thể THU HẸP, không bao giờ mở rộng.
 */
export function resultVisibility(p: PublishState, answersAllowedByExam: boolean): ResultVisibility {
  const locked = p.hasEssay && !p.published;
  return { showScore: !locked, showEssayPoints: !locked, showAnswers: !locked && answersAllowedByExam, pendingManual: locked };
}

/** Chữ ở màn "đã nộp". Trung thực: chỉ nói "đã chấm" khi điểm thật đã hiện. */
export function submittedNotice(p: PublishState, lateOrExpired: boolean): { heading: string; body: string } {
  const heading = lateOrExpired ? "Hết giờ · bài đã được ghi nhận" : "Đã nộp bài";
  if (p.hasEssay && !p.published) {
    return { heading, body: "KiN đã ghi nhận bài của em. Phần trắc nghiệm đã được tính, phần tự luận chờ gia sư chấm. Điểm tổng, đáp án và lời giải chưa hiển thị cho tới khi gia sư công bố." };
  }
  return { heading, body: p.hasEssay ? "Gia sư đã công bố kết quả bài này." : "KiN đã ghi nhận và chấm xong bài của em." };
}

// ── Bản nháp ──────────────────────────────────────────────────────────────────
export interface LocalDraft { text: string; synced: boolean }
/**
 * Chọn bản nháp để đổ lại vào ô: bản trên máy chủ là chuẩn. Chỉ khi bản trên máy này còn "chưa đồng bộ" (gõ xong mà mạng đứt trước khi gửi được)
 * và khác bản máy chủ thì dùng bản trên máy — để mất mạng giữa chừng không làm mất chữ. `fromLocal` báo để trang đẩy lại lên máy chủ.
 */
export function pickDraft(server: string | undefined | null, local: LocalDraft | null | undefined): { text: string; fromLocal: boolean } {
  const s = server ?? "";
  if (local && !local.synced && local.text.trim() && local.text !== s) return { text: local.text, fromLocal: true };
  return { text: s, fromLocal: false };
}

export type DraftState = { kind: "idle" } | { kind: "saving" } | { kind: "saved"; at: string } | { kind: "failed" };
/** Dòng trạng thái dưới ô tự luận. Chỉ nói "đã lưu trên máy chủ" khi máy chủ thật sự đã trả về thành công. */
export function draftStatusLabel(s: DraftState): string {
  switch (s.kind) {
    case "saving": return "Đang lưu bản nháp…";
    case "saved": return `Bản nháp đã lưu trên máy chủ · ${s.at}`;
    case "failed": return "Chưa lưu được bản nháp. Chữ vẫn còn trên máy này, KiN sẽ thử lại.";
    default: return "Bản nháp tự lưu khi em ngừng gõ.";
  }
}

/** Mã lượt ngắn để đối chiếu với gia sư khi mất kết nối: 8 ký tự cuối của id lượt, in hoa. Không có thông tin cá nhân. */
export function receiptCode(attemptId: string): string {
  const t = (attemptId || "").replace(/[^A-Za-z0-9]/g, "");
  return t ? `KN-${t.slice(-8).toUpperCase()}` : "";
}
