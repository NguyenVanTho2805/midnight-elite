// FE-125/126 — trang học viên nhập mã mời lớp (ClassInvite redeem).
//
// Flow:
//   1. Học viên gõ code (8 ký tự alphabet an toàn, ép uppercase).
//   2. Sau 400ms debounce, gọi GET /api/invites/<code> → preview lớp.
//   3. Nếu "ok", hiện thẻ xác nhận (tên lớp + gia sư + nút "Tham gia").
//   4. Bấm → POST /api/invites/<code>/redeem → chuyển sang
//      /student/hoc-tap?course=<id> + toast.
"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/ui";

type OwnerLite = { id: string; name: string };
type PreviewOk = {
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
type PreviewInvalid = { status: "invalid"; error?: string; reason?: number };
type PreviewResp = PreviewOk | PreviewInvalid;

function normalizeCode(raw: string) {
  // Chỉ giữ chữ/số, in hoa (code 8 ký tự alphabet 2-9/A-Z của BE-064).
  return raw.replace(/[^0-9a-zA-Z]/g, "").toUpperCase().slice(0, 20);
}

export default function NhapMaLopPage() {
  const router = useRouter();
  const toast  = useToast();
  const [input, setInput]         = useState("");
  const [preview, setPreview]     = useState<PreviewResp | null>(null);
  const [checking, setChecking]   = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce validate — code quá ngắn thì không gọi.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Wrap setState trong Promise.resolve để tránh eslint-rule
    // "set-state-in-effect" (chạy đồng bộ gây cascading render).
    if (input.length < 4) {
      Promise.resolve().then(() => { setPreview(null); setChecking(false); });
      return;
    }
    Promise.resolve().then(() => setChecking(true));
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/invites/${encodeURIComponent(input)}`, { credentials: "same-origin" });
        if (r.status === 401) {
          setPreview({ status: "invalid", error: "Bạn cần đăng nhập để nhập mã mời." });
          return;
        }
        const d: PreviewResp = await r.json();
        setPreview(d);
      } catch {
        setPreview({ status: "invalid", error: "Không kết nối được máy chủ." });
      } finally {
        setChecking(false);
      }
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [input]);

  async function redeem() {
    if (!preview || preview.status !== "ok" || preview.alreadyEnrolled) return;
    setRedeeming(true);
    try {
      const r = await fetch(`/api/invites/${encodeURIComponent(preview.code)}/redeem`, {
        method: "POST", credentials: "same-origin",
      });
      const d = await r.json();
      if (!r.ok) {
        toast.err(d.error ?? "Không tham gia được lớp");
        return;
      }
      toast.ok("Đã vào lớp!");
      router.push(`/student/hoc-tap?course=${encodeURIComponent(preview.course.id)}`);
    } catch {
      toast.err("Mạng lỗi, thử lại sau.");
    } finally {
      setRedeeming(false);
    }
  }

  const ok = preview && preview.status === "ok";

  return (
    <div className="max-w-xl mx-auto px-4 py-10 space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-extrabold" style={{ color: "#1E2938" }}>Nhập mã mời lớp</h1>
        <p className="text-sm mt-2" style={{ color: "#6B7280" }}>
          Gia sư gửi cho bạn 1 mã (vd <code className="font-mono">A7B2K9D4</code>). Gõ hoặc dán vào ô dưới.
        </p>
      </div>

      <div className="rounded-2xl p-6 space-y-4" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
        <input
          autoFocus
          value={input}
          onChange={e => setInput(normalizeCode(e.target.value))}
          placeholder="Mã mời (8 ký tự)"
          aria-label="Mã mời lớp"
          className="w-full text-center text-2xl font-mono tracking-widest font-bold py-3 rounded-xl focus:outline-none"
          style={{ background: "#f6f5f4", border: "1px solid #e5e3df", color: "#1E2938", letterSpacing: "0.4em" }}
        />

        {input.length > 0 && input.length < 4 && (
          <p className="text-xs text-center" style={{ color: "#9CA3AF" }}>Mã có ít nhất 4 ký tự.</p>
        )}

        {checking && (
          <div className="flex justify-center py-2 gap-1.5">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full animate-bounce"
                style={{ background: "#0068FF", animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        )}

        {!checking && preview && preview.status === "invalid" && (
          <div className="rounded-xl p-3 text-center" style={{ background: "#FEE2E2", color: "#B91C1C" }}>
            <p className="text-sm font-semibold">{preview.error ?? "Mã không hợp lệ"}</p>
          </div>
        )}

        {!checking && ok && (
          <div className="rounded-xl p-4 space-y-2" style={{ background: "#f0f9ff", border: "1px solid #bae6fd" }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#0369a1" }}>Mã hợp lệ</p>
            <p className="text-lg font-bold" style={{ color: "#1E2938" }}>{preview.course.name}</p>
            {preview.course.owner && (
              <p className="text-sm" style={{ color: "#4B5563" }}>Gia sư: {preview.course.owner.name}</p>
            )}
            <p className="text-xs" style={{ color: "#6B7280" }}>
              {preview.course.classStatus === "open" ? "Đang nhận học viên." : "Lớp đang đóng — không nhận thêm."}
              {preview.maxUses !== null && (
                <> · Còn {Math.max(0, preview.maxUses - preview.usedCount)} / {preview.maxUses} lượt dùng.</>
              )}
              {preview.expiresAt && (
                <> · Hết hạn: {new Date(preview.expiresAt).toLocaleDateString("vi-VN")}.</>
              )}
            </p>
            {preview.alreadyEnrolled && (
              <p className="text-xs font-semibold" style={{ color: "#16a34a" }}>Bạn đã trong lớp này rồi.</p>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={redeem}
          disabled={!ok || redeeming || (ok && preview.alreadyEnrolled)}
          className="w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-50"
          style={{ background: "#0068FF" }}
        >
          {redeeming ? "Đang xử lý..."
            : ok && preview.alreadyEnrolled ? "Bạn đã trong lớp"
            : "Tham gia lớp"}
        </button>

        {ok && preview.alreadyEnrolled && (
          <Link href={`/student/hoc-tap?course=${encodeURIComponent(preview.course.id)}`}
            className="block text-center text-sm font-semibold" style={{ color: "#0068FF" }}>
            Vào lớp ngay →
          </Link>
        )}
      </div>
    </div>
  );
}
