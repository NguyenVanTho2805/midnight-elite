// SCL-F2 (P2-25) — "Môn · khối" của lớp chọn từ danh sách CỐ ĐỊNH (KinSelect), thay ô gõ tự do. Lưu vẫn vào Course.category dạng "Toán · Lớp 9"
// như trước. Dữ liệu cũ KHÔNG sửa: chỉ chuẩn hoá lúc hiển thị (splitCategory); giá trị lạ giữ nguyên làm một lựa chọn thêm để lưu lại không mất.
// Thuần (không React, không DB) — test: tools/local-e2e/t-class-subject-lib.ts.
import { ADMIN_CATEGORIES } from "@/lib/courseData";

export const CLASS_SUBJECTS: readonly string[] = [
  "Toán", "Ngữ văn", "Tiếng Anh", "Vật lý", "Hoá học", "Sinh học", "Lịch sử", "Địa lý", "Tin học",
  ...ADMIN_CATEGORIES, // kỳ thi (ĐGNL HSA, Tốt nghiệp THPT…) — lớp cũ đang dùng
  "Khác",
];
export const CLASS_GRADES: readonly string[] = [...Array.from({ length: 12 }, (_, i) => `Lớp ${i + 1}`), "Ôn thi"];

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/\s+/g, " ").trim();

/** Tên gọi tắt hay gặp → môn chuẩn (so sau khi bỏ dấu, chữ thường). */
const ALIASES: Record<string, string> = {
  "toan": "Toán", "van": "Ngữ văn", "ngu van": "Ngữ văn", "anh": "Tiếng Anh", "tieng anh": "Tiếng Anh", "english": "Tiếng Anh",
  "ly": "Vật lý", "li": "Vật lý", "vat ly": "Vật lý", "vat li": "Vật lý", "hoa": "Hoá học", "hoa hoc": "Hoá học",
  "sinh": "Sinh học", "sinh hoc": "Sinh học", "su": "Lịch sử", "lich su": "Lịch sử", "dia": "Địa lý", "dia ly": "Địa lý", "dia li": "Địa lý",
  "tin": "Tin học", "tin hoc": "Tin học", "khac": "Khác",
};

/** Môn chuẩn của một chuỗi, hoặc null nếu không nhận ra. */
export function normalizeSubject(raw: string): string | null {
  const f = fold(raw);
  if (!f) return null;
  const exact = CLASS_SUBJECTS.find(s => fold(s) === f);
  return exact ?? ALIASES[f] ?? null;
}

/** Khối chuẩn ("Lớp 9", "Ôn thi") hoặc null. Nhận "Lớp 9", "lop9", "9", "L9". */
export function normalizeGrade(raw: string): string | null {
  const f = fold(raw);
  if (!f) return null;
  if (f === "on thi") return "Ôn thi";
  const m = /^(?:lop|l)?\s*(\d{1,2})$/.exec(f);
  if (m) { const n = Number(m[1]); return n >= 1 && n <= 12 ? `Lớp ${n}` : null; }
  return null;
}

/** Course.category → { subject, grade } để hiện ở hai KinSelect. Phần không nhận ra giữ NGUYÊN chữ cũ (không đổi dữ liệu khi người dùng không sửa). */
export function splitCategory(raw: string | null | undefined): { subject: string; grade: string } {
  const parts = (raw ?? "").split(/\s*[·|]\s*/).map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) return { subject: "", grade: "" };
  const [a, ...rest] = parts;
  const restText = rest.join(" · ");
  return { subject: normalizeSubject(a) ?? a, grade: rest.length ? normalizeGrade(restText) ?? restText : "" };
}

/** Hai ô → Course.category. Không chọn môn thì "Khác" (như TaoLop cũ khi bỏ trống). */
export function joinCategory(subject: string, grade: string): string {
  const s = subject.trim() || "Khác";
  const g = grade.trim();
  return g ? `${s} · ${g}` : s;
}

/** Danh sách lựa chọn cho KinSelect: danh sách cố định + giá trị cũ không nằm trong đó (để không mất khi lưu). */
export function optionsWith(list: readonly string[], current: string): string[] {
  return current && !list.includes(current) ? [...list, current] : [...list];
}
