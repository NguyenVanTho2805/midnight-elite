"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { SignupCodeForm } from "@/components/guest/SignupCodeForm";

export default function VerifyEmailBanner() {
  const { user } = useAuth();
  const [sending,  setSending]  = useState(false);
  const [sent,     setSent]     = useState(false);
  const [dismissed, setDismiss] = useState(false);
  const [err,      setErr]      = useState("");
  const [entering, setEntering] = useState(false);

  if (!user || user.emailVerified || dismissed) return null;

  async function resend() {
    setSending(true);
    try {
      // Gửi MÃ 6 số (kèm link dự phòng); xong mở ô nhập mã ngay trong băng.
      const res = await fetch("/api/auth/resend-verification", { method: "POST" });
      if (res.ok) { setSent(true); setEntering(true); setErr(""); }
      else if (res.status === 429) { setEntering(true); setErr(""); } // đã có mã còn hạn (vừa gửi < 60 giây): cho nhập luôn
      else setErr(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "Chưa gửi được email. Thử lại sau.");
    } catch {
      setErr("Mất kết nối, chưa gửi được email.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="w-full px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap"
      style={{ background: "var(--kin-tt-nen-cho)", borderBottom: "2px solid var(--kin-tt-cham-cho)" }}>

      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-lg flex-shrink-0">⚠️</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-none" style={{ color: "var(--kin-tt-chu-cho)" }}>
            Email chưa được xác thực
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--kin-tt-chu-cho)" }}>
            Nhập mã 6 số gửi tới <strong>{user.email}</strong> (hoặc bấm link trong thư)
          </p>
          {err && <p role="alert" className="text-xs mt-0.5 font-semibold" style={{ color: "var(--kin-tt-chu-cho)" }}>{err}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {sent ? (
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full"
            style={{ background: "var(--kin-tt-nen-xong)", color: "var(--kin-tt-chu-xong)" }}>
            ✓ Đã gửi mã
          </span>
        ) : (
          <button onClick={resend} disabled={sending}
            className="text-xs font-bold px-3 min-h-11 rounded-full transition-all disabled:opacity-60"
            style={{ background: "var(--kin-tt-cham-cho)", color: "var(--kin-chu-tren-nut-chinh)" }}>
            {sending ? "Đang gửi..." : "Gửi mã xác thực"}
          </button>
        )}
        <button onClick={() => setDismiss(true)} aria-label="Đóng"
          className="w-11 h-11 rounded-full flex items-center justify-center text-sm transition-all hover:opacity-70"
          style={{ color: "var(--kin-tt-chu-cho)" }}>
          ✕
        </button>
      </div>

      {entering && (
        <div className="w-full max-w-sm mx-auto pt-2" style={{ color: "var(--kin-chu-chinh)" }}>
          <SignupCodeForm email={user.email.trim().toLowerCase()} />
        </div>
      )}
    </div>
  );
}
