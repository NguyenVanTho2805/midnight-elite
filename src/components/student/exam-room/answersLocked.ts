// STU-001 §6 (chuyển từ trang phòng thi cũ vào BU-04): màn "Xem lại bài làm" nói VÌ SAO chưa xem được đáp án và KHI NÀO thì được.
// Chỉ dựng chữ từ dữ liệu /review trả (answersLockedReason / publicGuarded / attemptsMax / answersOpenAt), không đoán đáp án. Thuần: không React, không prisma.
// Máy chủ cũ chưa trả trường mới → giữ câu của BU-04 ("Gia sư chưa cho xem đáp án ở đề này" hoặc "Đáp án mở lúc …").
import type { AnswersLockedReason } from "@/lib/examPolicy";
import { answersOpenLabel } from "./roomLogic";

export interface AnswersLockedFields {
  canSeeAnswers: boolean;
  pendingManual?: boolean;
  answersLockedReason?: AnswersLockedReason;
  publicGuarded?: boolean;
  attemptsMax?: number | null;
  answersOpenAt?: string | null;
}

export function answersLockedNotice(r: AnswersLockedFields, nowIso: string): { reason: string; text: string } | null {
  // Giữ điểm (gia sư chưa công bố) được ưu tiên bằng khối "chờ công bố" riêng — không nói hai lần.
  if (r.pendingManual) return null;
  const reason = r.answersLockedReason;
  const soLuot = typeof r.attemptsMax === "number" && r.attemptsMax > 0 ? `${r.attemptsMax} lượt` : "số lượt làm bài";
  const openAt = r.answersOpenAt ? `${answersOpenLabel(r.answersOpenAt, nowIso)}.` : "";
  if (reason === "until_exam_ends") {
    return r.publicGuarded
      ? { reason, text: `Đây là đề thi thử công khai nên KiN chỉ hiện đáp án và lời giải khi em dùng hết ${soLuot} hoặc khi đề hết hạn — để bảng xếp hạng công bằng cho mọi người. ${openAt} Em vẫn xem được câu trả lời của mình.`.replace(/\s+/g, " ").trim() }
      : { reason, text: `Gia sư đặt đề này chỉ hiện đáp án sau khi hết hạn làm bài. ${openAt} Em vẫn xem được câu trả lời của mình.`.replace(/\s+/g, " ").trim() };
  }
  if (reason === "until_attempts_exhausted") {
    return { reason, text: `Đây là đề thi thử công khai: câu làm đúng có dấu ✓, câu chưa đúng sẽ hiện đáp án khi em dùng hết ${soLuot} — để bảng xếp hạng công bằng cho mọi người.` };
  }
  if (reason === "never") {
    return { reason, text: "Gia sư đặt đề này không hiện đáp án. Em xem được câu trả lời của mình và điểm." };
  }
  // Máy chủ chưa trả trường mới (hoặc trả null mà vẫn khoá): câu của BU-04.
  if (!r.canSeeAnswers) {
    return { reason: "khong-ro", text: r.answersOpenAt ? `${openAt} Bây giờ em chỉ xem được câu trả lời của mình.` : "Gia sư chưa cho xem đáp án ở đề này. Em chỉ xem được câu trả lời của mình." };
  }
  return null;
}
