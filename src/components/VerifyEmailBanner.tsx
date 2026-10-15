"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export default function VerifyEmailBanner() {
  const { user } = useAuth();
  const [sending,  setSending]  = useState(false);
  const [sent,     setSent]     = useState(false);
  const [dismissed, setDismiss] = useState(false);

  if (!user || user.emailVerified || dismissed) return null;

  async function resend() {
    setSending(true);
    try {
      const res = await fetch("/api/auth/resend-verification", { method: "POST" });
      if (res.ok) setSent(true);
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
            Kiểm tra hộp thư <strong>{user.email}</strong> và bấm link xác thực
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {sent ? (
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full"
            style={{ background: "var(--kin-tt-nen-xong)", color: "var(--kin-tt-chu-xong)" }}>
            ✓ Đã gửi lại!
          </span>
        ) : (
          <button onClick={resend} disabled={sending}
            className="text-xs font-bold px-3 py-1.5 rounded-full transition-all disabled:opacity-60"
            style={{ background: "var(--kin-tt-cham-cho)", color: "var(--kin-chu-tren-nut-chinh)" }}>
            {sending ? "Đang gửi..." : "Gửi lại email"}
          </button>
        )}
        <button onClick={() => setDismiss(true)}
          className="w-6 h-6 rounded-full flex items-center justify-center text-sm transition-all hover:opacity-70"
          style={{ color: "var(--kin-tt-chu-cho)" }}>
          ✕
        </button>
      </div>
    </div>
  );
}
