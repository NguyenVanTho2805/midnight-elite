// GO-08 — thẻ hạn mức ở Cài đặt gia sư: PHẦN THUẦN. Chỉ HIỂN THỊ số đã có (học sinh đang học và trần của gói từ planServer; dung lượng đã dùng từ FileAsset).
// KHÔNG bịa hạn mức chưa có: mẫu phiếu, dung lượng và Drive chưa có hạn mức trong cấu hình gói nên chỉ ghi "chưa có", không vẽ thanh phần trăm cho chúng.
import type { Quota, QuotaState } from "@/lib/planLimits";

export type QuotaTone = "xong" | "cho" | "loi" | "mo";
export interface QuotaCard { key: "hoc-sinh" | "mau-phieu" | "dung-luong" | "drive"; label: string; value: string; hint: string; tone: QuotaTone; /** null = không có hạn mức nên không có thanh */ pct: number | null; stateText: string }

/** 1024-based, làm tròn 1 chữ số thập phân khi dưới 10 (vd "1,5 MB"), số nguyên khi lớn hơn. Âm / không phải số → "0 B". */
export function formatBytes(raw: number): string {
  const n = Number.isFinite(raw) && raw > 0 ? raw : 0;
  const units = ["B", "KB", "MB", "GB"];
  let v = n, i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  const txt = i === 0 || v >= 10 ? String(Math.round(v)) : (Math.round(v * 10) / 10).toString().replace(".", ",");
  return `${txt} ${units[i]}`;
}

const STUDENT_STATE: Record<QuotaState, { tone: QuotaTone; text: string }> = {
  ok: { tone: "xong", text: "Còn thoải mái" },
  warn: { tone: "cho", text: "Gần đến hạn mức" },
  blocked: { tone: "loi", text: "Đã đạt hạn mức" },
  over: { tone: "loi", text: "Đang vượt hạn mức" },
};

export interface QuotaCardsInput { students: Quota; planName: string; enforced: boolean; storageBytes: number; storageFiles: number }
export function quotaCards(i: QuotaCardsInput): QuotaCard[] {
  const st = STUDENT_STATE[i.students.state];
  return [
    { key: "hoc-sinh", label: "Học sinh đang học", value: `${i.students.used} / ${i.students.limit}`, tone: st.tone, pct: Math.min(100, i.students.pct), stateText: st.text,
      hint: i.enforced ? `Gói ${i.planName}. Chạm trần thì chỉ chưa nhận thêm, lớp và sổ hiện có giữ nguyên.` : `Gói ${i.planName}. Hạn mức chưa áp dụng: KiN chỉ đo, không chặn ai.` },
    { key: "mau-phieu", label: "Mẫu phiếu", value: "Chưa có", tone: "mo", pct: null, stateText: "Chưa có hạn mức",
      hint: "KiN chưa có khái niệm mẫu phiếu để đếm hay giới hạn." },
    { key: "dung-luong", label: "Dung lượng đã dùng", value: formatBytes(i.storageBytes), tone: "mo", pct: null, stateText: "Chưa có hạn mức",
      hint: `${i.storageFiles} tệp đã tải lên KiN. Chỉ đo, chưa có hạn mức dung lượng nên không có thanh phần trăm.` },
    { key: "drive", label: "Google Drive", value: "Chưa kết nối", tone: "mo", pct: null, stateText: "Chưa có tích hợp",
      hint: "KiN chưa nối với Drive. Bạn vẫn dán link chia sẻ Drive vào bài giảng hoặc tài liệu; KiN chỉ mở link, không đọc Drive của bạn." },
  ];
}
