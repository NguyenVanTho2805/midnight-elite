// Bản sao nháp tự luận ở localStorage của TRÌNH DUYỆT, chỉ để không mất chữ khi mạng đứt giữa lúc gõ (QZ-11). Máy chủ mới là bản chuẩn;
// quy tắc chọn giữa hai bản nằm ở quizRoom.pickDraft. Chỉ lưu chữ em đã gõ, theo (lượt, câu); xoá khi lượt đã được máy chủ xác nhận nộp.
// Không có chuyện lưu thông tin cá nhân; mọi lỗi (chế độ riêng tư, đầy bộ nhớ) bị nuốt vì đây chỉ là lưới an toàn.
import type { LocalDraft } from "@/lib/quizRoom";

const key = (attemptId: string, questionId: string) => `kin-quiz-nhap:${attemptId}:${questionId}`;

export function readLocalDraft(attemptId: string, questionId: string): LocalDraft | null {
  try {
    const raw = typeof window === "undefined" ? null : window.localStorage.getItem(key(attemptId, questionId));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<LocalDraft>;
    return typeof v.text === "string" && typeof v.synced === "boolean" ? { text: v.text, synced: v.synced } : null;
  } catch { return null; }
}

export function writeLocalDraft(attemptId: string, questionId: string, d: LocalDraft): void {
  try { window.localStorage.setItem(key(attemptId, questionId), JSON.stringify(d)); } catch { /* lưới an toàn, bỏ qua */ }
}

export function clearLocalDrafts(attemptId: string): void {
  try {
    const prefix = `kin-quiz-nhap:${attemptId}:`;
    const del: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) { const k = window.localStorage.key(i); if (k?.startsWith(prefix)) del.push(k); }
    del.forEach(k => window.localStorage.removeItem(k));
  } catch { /* bỏ qua */ }
}
