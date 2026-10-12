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
};
export type InvitePreviewInvalid = { status: "invalid"; error?: string; reason?: number };
export type InvitePreview = InvitePreviewOk | InvitePreviewInvalid;

// Chỉ giữ chữ/số, in hoa (mã 8 ký tự alphabet 2-9/A-Z của BE-064).
export function normalizeInviteCode(raw: string): string {
  return raw.replace(/[^0-9a-zA-Z]/g, "").toUpperCase().slice(0, 20);
}

const MIN_LEN = 4;

export default function InviteCodeInput({
  value, onChange, onResult, autoFocus = false,
}: {
  value: string;
  onChange: (code: string) => void;
  onResult?: (preview: InvitePreview | null, checking: boolean) => void;
  autoFocus?: boolean;
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
    <div className="space-y-4">
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={e => onChange(normalizeInviteCode(e.target.value))}
        placeholder="Mã mời (8 ký tự)"
        aria-label="Mã mời lớp"
        autoComplete="off"
        spellCheck={false}
        className="w-full text-center text-2xl font-mono tracking-widest font-bold py-3 rounded-xl focus:outline-none"
        style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)", color: "#1E2938", letterSpacing: "0.4em" }}
      />

      {value.length > 0 && value.length < MIN_LEN && (
        <p className="text-xs text-center" style={{ color: "#9CA3AF" }}>Mã có ít nhất {MIN_LEN} ký tự.</p>
      )}

      {checking && (
        <div className="flex justify-center py-2 gap-1.5" role="status" aria-label="Đang kiểm tra mã">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full animate-bounce"
              style={{ background: "var(--kin-nhan-nen)", animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      )}

      {!checking && preview && preview.status === "invalid" && (
        <div className="rounded-xl p-3 text-center" role="alert" style={{ background: "#FEE2E2", color: "#B91C1C" }}>
          <p className="text-sm font-semibold">{preview.error ?? "Mã không hợp lệ"}</p>
        </div>
      )}
    </div>
  );
}
