import crypto from "crypto";

// Chuẩn hoá tối thiểu (hạ chữ thường, gộp khoảng trắng thừa, trim) — đủ bắt
// "trùng y hệt" theo nội dung. Khác cách chấm câu Trả lời ngắn ở
// examGrading.ts (ở đó cố ý nới hơn cho học viên) — ở đây cần chặt để không
// báo trùng nhầm 2 câu chỉ tình cờ gần giống.
export function normalizeQuestionText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export function computeContentHash(text: string): string {
  return crypto.createHash("sha256").update(normalizeQuestionText(text)).digest("hex");
}
