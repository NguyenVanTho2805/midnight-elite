// FE-125/126 — trang học viên nhập mã mời lớp (ClassInvite redeem).
//
// Flow:
//   1. Học viên gõ code (8 ký tự alphabet an toàn, ép uppercase).
//   2. Sau 400ms debounce, gọi GET /api/invites/by-code/<code> → preview
//      (tách khỏi /api/invites/[id] vì Next.js app router không cho hai
//      dynamic segment anh em cùng level cùng khớp root của folder).
//   3. Nếu "ok", hiện thẻ xác nhận (tên lớp + gia sư + nút "Tham gia").
//   4. Bấm → POST /api/invites/<code>/redeem → chuyển sang
//      /student/hoc-tap?course=<id> + toast.
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/ui";
import InviteCodeInput, { normalizeInviteCode, type InvitePreview } from "@/components/student/InviteCodeInput";

export default function NhapMaLopPage() {
  const router = useRouter();
  const toast  = useToast();
  const [input, setInput]         = useState("");
  const [preview, setPreview]     = useState<InvitePreview | null>(null);
  const [checking, setChecking]   = useState(false);
  const [redeeming, setRedeeming] = useState(false);

  // Link mời của gia sư có dạng /student/nhap-ma-lop?code=ABCD2345 → điền sẵn mã.
  // Đọc ở effect (không ở useState) để HTML server và lần render đầu của client khớp nhau.
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("code");
    if (c) Promise.resolve().then(() => setInput(normalizeInviteCode(c)));
  }, []);

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
        <h1 className="text-2xl font-extrabold" style={{ color: "var(--kin-chu-chinh)" }}>Nhập mã mời lớp</h1>
        <p className="text-sm mt-2" style={{ color: "var(--kin-chu-mo)" }}>
          Gia sư gửi cho bạn 1 mã (vd <code className="font-mono">A7B2K9D4</code>). Gõ hoặc dán vào ô dưới.
        </p>
      </div>

      <div className="rounded-2xl p-6 space-y-4" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
        <InviteCodeInput
          autoFocus
          value={input}
          onChange={setInput}
          onResult={(p, c) => { setPreview(p); setChecking(c); }}
        />

        {!checking && ok && (
          <div className="rounded-xl p-4 space-y-2" style={{ background: "var(--kin-nhan-nen-nhat)", border: "1px solid var(--kin-nhan-vien)" }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--kin-nhan-link)" }}>Mã hợp lệ</p>
            <p className="text-lg font-bold" style={{ color: "var(--kin-chu-chinh)" }}>{preview.course.name}</p>
            {preview.course.owner && (
              <p className="text-sm" style={{ color: "var(--kin-chu-phu)" }}>Gia sư: {preview.course.owner.name}</p>
            )}
            <p className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>
              {preview.course.classStatus === "open" ? "Đang nhận học viên." : "Lớp đang đóng — không nhận thêm."}
              {preview.maxUses !== null && (
                <> · Còn {Math.max(0, preview.maxUses - preview.usedCount)} / {preview.maxUses} lượt dùng.</>
              )}
              {preview.expiresAt && (
                <> · Hết hạn: {new Date(preview.expiresAt).toLocaleDateString("vi-VN")}.</>
              )}
            </p>
            {preview.alreadyEnrolled && (
              <p className="text-xs font-semibold" style={{ color: "var(--kin-tt-chu-xong)" }}>Bạn đã trong lớp này rồi.</p>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={redeem}
          disabled={!ok || redeeming || (ok && preview.alreadyEnrolled)}
          className="w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-50"
          style={{ background: "var(--kin-nhan-nen)" }}
        >
          {redeeming ? "Đang xử lý..."
            : ok && preview.alreadyEnrolled ? "Bạn đã trong lớp"
            : "Tham gia lớp"}
        </button>

        {ok && preview.alreadyEnrolled && (
          <Link href={`/student/hoc-tap?course=${encodeURIComponent(preview.course.id)}`}
            className="block text-center text-sm font-semibold" style={{ color: "var(--kin-nhan-link)" }}>
            Vào lớp ngay →
          </Link>
        )}
      </div>
    </div>
  );
}
