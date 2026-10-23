// QZ-14 — mật khẩu vào thi. Trước đây lưu CHUỖI THÔ ở Exam.password; giờ lưu băm ở Exam.passwordHash.
// Tương thích ngược: đề cũ còn password thô vẫn vào thi được (so khớp thẳng, thời gian không đổi), và được tự nâng lên băm khi
// (a) gia sư đặt lại mật khẩu, hoặc (b) một học viên nhập đúng lần đầu. Không bao giờ trả password / passwordHash qua API.
import bcrypt from "bcryptjs";
import { createHash, timingSafeEqual } from "node:crypto";

export const MAX_EXAM_PASSWORD_LEN = 200;

// bcrypt chỉ đọc 72 byte đầu: băm sha256 trước để mật khẩu dài/có dấu không bị cắt ngầm.
const pre = (pw: string) => createHash("sha256").update(pw, "utf8").digest("base64");

export interface ExamPasswordFields { password: string | null; passwordHash: string | null }

export const hasExamPassword = (e: Partial<ExamPasswordFields>): boolean => !!(e.passwordHash || e.password);

/** Giá trị cần ghi vào cột khi gia sư gửi `password`. Chuỗi rỗng / null / không phải chuỗi = bỏ mật khẩu. Luôn xoá bản thô. */
export async function examPasswordPatch(input: unknown): Promise<{ password: null; passwordHash: string | null }> {
  const pw = typeof input === "string" ? input.trim() : "";
  if (!pw) return { password: null, passwordHash: null };
  return { password: null, passwordHash: await bcrypt.hash(pre(pw.slice(0, MAX_EXAM_PASSWORD_LEN)), 10) };
}

const safeEq = (a: string, b: string): boolean => {
  const da = createHash("sha256").update(a).digest(), db = createHash("sha256").update(b).digest();
  return timingSafeEqual(da, db);
};

/** `needsUpgrade` = khớp nhưng đề còn lưu bản thô (nên băm lại). Đề có passwordHash thì CHỈ xét băm. */
export async function verifyExamPassword(e: ExamPasswordFields, input: unknown): Promise<{ ok: boolean; needsUpgrade: boolean }> {
  if (!hasExamPassword(e)) return { ok: true, needsUpgrade: false };
  if (typeof input !== "string" || !input || input.length > MAX_EXAM_PASSWORD_LEN * 4) return { ok: false, needsUpgrade: false };
  if (e.passwordHash) {
    const ok = await bcrypt.compare(pre(input.trim().slice(0, MAX_EXAM_PASSWORD_LEN)), e.passwordHash).catch(() => false);
    return { ok, needsUpgrade: false };
  }
  // Bản thô cũ: cách lưu cũ không cắt khoảng trắng đầu/cuối lúc kiểm, nên giữ so khớp nguyên văn.
  const ok = safeEq(input, e.password as string);
  return { ok, needsUpgrade: ok };
}

/** Bỏ cả hai cột bí mật khỏi một đề trước khi trả về client, thêm hasPassword. */
export function withoutExamSecrets<T extends Partial<ExamPasswordFields>>(exam: T): Omit<T, "password" | "passwordHash"> & { hasPassword: boolean } {
  const { password, passwordHash, ...rest } = exam;
  return { ...rest, hasPassword: hasExamPassword({ password, passwordHash }) };
}
