// HS-12 — kiểm dữ liệu gia đình dùng chung liên hệ. Hàm THUẦN. Chỉ chung LIÊN HỆ; KHÔNG gộp phiếu học phí theo gia đình.
import { cleanText } from "@/lib/tutorArea";
import { normalizeZaloPhone } from "@/lib/zaloShare";
import { LABEL_MAX, NAME_MAX } from "@/lib/studentProfile";

export const FAMILIES_MAX = 200;

export function parseFamily(b: Record<string, unknown> | null, partial: boolean): { data: { label?: string; guardianName?: string | null; guardianPhone?: string | null }; error?: string } {
  const data: { label?: string; guardianName?: string | null; guardianPhone?: string | null } = {};
  if (!b) return { data, error: "Dữ liệu gửi lên không hợp lệ" };
  if ("label" in b || !partial) {
    const l = typeof b.label === "string" ? cleanText(b.label) : "";
    if (!l) return { data, error: "Nhập tên gia đình (ví dụ “Gia đình Minh Anh”)" };
    if (l.length > LABEL_MAX) return { data, error: `Tên gia đình tối đa ${LABEL_MAX} ký tự` };
    data.label = l;
  }
  if ("guardianName" in b) {
    const n = typeof b.guardianName === "string" ? cleanText(b.guardianName) : "";
    if (n.length > NAME_MAX) return { data, error: `Tên phụ huynh tối đa ${NAME_MAX} ký tự` };
    data.guardianName = n || null;
  }
  if ("guardianPhone" in b) {
    const raw = typeof b.guardianPhone === "string" ? cleanText(b.guardianPhone) : "";
    if (!raw) data.guardianPhone = null;
    else { const p = normalizeZaloPhone(raw); if (!p) return { data, error: "Số điện thoại phụ huynh phải đủ 10 chữ số" }; data.guardianPhone = p; }
  }
  return { data };
}

