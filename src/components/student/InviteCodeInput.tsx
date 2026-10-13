// FE-161 — InviteCodeInput: ô nhập mã mời lớp, tự kiểm tra mã theo thời gian
// thực (debounce 400ms → GET /api/invites/by-code/<code>). Tách khỏi trang
// student/nhap-ma-lop để dùng lại (vd. hộp "Có mã mời?" ở nơi khác).
//
// Ô nhập chỉ giữ chữ/số, ép in hoa. Kết quả kiểm tra báo ra ngoài qua
// `onResult(preview, checking)` để chỗ dùng tự dựng thẻ xác nhận và nút tham
// gia; riêng thông báo lỗi và vòng chờ thì component tự hiện.
"use client";
import { useEffect, useRef, useState } from "react";

type OwnerLite = { id: string; name: string };
export type InvitePreviewOk = {
  status: "ok";
  code: string;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  course: {
    id: string; name: string; shortTitle: string; category: string;
    classStatus: string; capacity: number | null;
    owner: OwnerLite | null;
  };
  alreadyEnrolled: boolean;
  /** Xem trước (Figma 32:54): lịch cố định hàng tuần, số buổi lớp đã học, học phí/buổi sau khi vào lớp (null nếu lớp không có gia sư phụ trách). */
  schedule?: { dayOfWeek: number; startTime: string; endTime: string }[];
  taught?: number;
  tuition?: { subjectCount: number; pricePerSession: number; override: boolean } | null;
};
export type InvitePreviewInvalid = { status: "invalid"; error?: string; reason?: number };
export type InvitePreview = InvitePreviewOk | InvitePreviewInvalid;

// Chỉ giữ chữ/số, in hoa (mã 8 ký tự alphabet 2-9/A-Z của BE-064).
export function normalizeInviteCode(raw: string): string {
  return raw.replace(/[^0-9a-zA-Z]/g, "").toUpperCase().slice(0, 20);
}

const MIN_LEN = 4;

export default function InviteCodeInput({
  value, onChange, onResult, autoFocus = false, id = "ma-moi-lop",
}: {
  value: string;
  onChange: (code: string) => void;
  onResult?: (preview: InvitePreview | null, checking: boolean) => void;
  autoFocus?: boolean;
  id?: string;
}) {
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [checking, setChecking] = useState(false);
  const resultRef = useRef(onResult);
  useEffect(() => { resultRef.current = onResult; }, [onResult]);
  // Mỗi lần gõ tăng số thứ tự: phản hồi của mã cũ về muộn hơn mã mới thì bỏ.
  const seq = useRef(0);

  useEffect(() => { resultRef.current?.(preview, checking); }, [preview, checking]);

  useEffect(() => {
    const mine = ++seq.current;
    if (value.length < MIN_LEN) {
      // Đặt trong Promise để không setState đồng bộ trong thân effect (react-hooks/set-state-in-effect).
      Promise.resolve().then(() => { if (mine === seq.current) { setPreview(null); setChecking(false); } });
      return;
    }
    Promise.resolve().then(() => { if (mine === seq.current) setChecking(true); });
    const timer = setTimeout(async () => {
      let next: InvitePreview;
      try {
        const r = await fetch(`/api/invites/by-code/${encodeURIComponent(value)}`, { credentials: "same-origin" });
        next = r.status === 401
          ? { status: "invalid", error: "Bạn cần đăng nhập để nhập mã mời." }
          : await r.json();
      } catch {
        next = { status: "invalid", error: "Không kết nối được máy chủ." };
      }
      if (mine !== seq.current) return;
      setPreview(next);
      setChecking(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <div className="flex flex-col gap-2">
      {/* Figma 32:59: nhãn "Mã mời" phía trên, ô cao 48px, chữ đơn cách căn trái. Tên truy cập vẫn là "Mã mời lớp" (chứa nhãn hiện, đúng quy tắc label-in-name). */}
      <label htmlFor={id} className="text-[length:var(--kin-co-small)] font-medium text-[var(--kin-chu-phu)]">Mã mời</label>
      <input
        id={id}
        autoFocus={autoFocus}
        value={value}
        onChange={e => onChange(normalizeInviteCode(e.target.value))}
        placeholder="Mã mời (8 ký tự)"
        aria-label="Mã mời lớp"
        autoComplete="off"
        spellCheck={false}
        className="w-full h-12 px-[15px] font-mono text-[length:var(--kin-co-body)] tracking-[0.12em] rounded-[var(--kin-bo-md)] bg-[var(--kin-nen-trang)] text-[var(--kin-chu-chinh)] placeholder:tracking-normal placeholder:text-[var(--kin-chu-mo)]"
        style={{ border: "1px solid var(--kin-vien-o-nhap)" }}
      />

      {value.length > 0 && value.length < MIN_LEN && (
        <p className="text-xs text-center" style={{ color: "var(--kin-chu-mo)" }}>Mã có ít nhất {MIN_LEN} ký tự.</p>
      )}

      {/* Đang kiểm tra: khung xương đúng hình thẻ xem trước (không vòng xoay — Figma 28:2 / trạng thái đang tải) */}
      {checking && (
        <div role="status" aria-busy="true" aria-label="Đang kiểm tra mã" className="rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-bang)] p-[15px] flex flex-col gap-3 animate-pulse">
          <div className="h-[13px] w-1/3 rounded bg-[var(--kin-nen-re-chuot)]" />
          <div className="h-[19px] w-3/4 rounded bg-[var(--kin-nen-re-chuot)]" />
          <div className="h-[13px] w-full rounded bg-[var(--kin-nen-re-chuot)]" />
          <div className="h-[13px] w-5/6 rounded bg-[var(--kin-nen-re-chuot)]" />
        </div>
      )}

      {!checking && preview && preview.status === "invalid" && (
        <div className="rounded-xl p-3 text-center" role="alert" style={{ background: "var(--kin-tt-nen-loi)", color: "var(--kin-tt-chu-loi)" }}>
          <p className="text-sm font-semibold">{preview.error ?? "Mã không hợp lệ"}</p>
        </div>
      )}
    </div>
  );
}
