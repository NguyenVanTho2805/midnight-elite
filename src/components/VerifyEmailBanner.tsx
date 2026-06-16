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
      style={{ background: "linear-gradient(90deg,#FEF3C7,#FDE68A)", borderBottom: "2px solid #FCD34D" }}>

      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-lg flex-shrink-0">⚠️</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-none" style={{ color: "#92400E" }}>
            Email chưa được xác thực
          </p>
          <p className="text-xs mt-0.5" style={{ color: "#B45309" }}>
            Kiểm tra hộp thư <strong>{user.email}</strong> và bấm link xác thực
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {sent ? (
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full"
            style={{ background: "#D1FAE5", color: "#065F46" }}>
            ✓ Đã gửi lại!
          </span>
        ) : (
          <button onClick={resend} disabled={sending}
            className="text-xs font-bold px-3 py-1.5 rounded-full transition-all disabled:opacity-60"
            style={{ background: "#F59E0B", color: "white" }}>
            {sending ? "Đang gửi..." : "Gửi lại email"}
          </button>
        )}
        <button onClick={() => setDismiss(true)}
          className="w-6 h-6 rounded-full flex items-center justify-center text-sm transition-all hover:opacity-70"
          style={{ color: "#92400E" }}>
          ✕
        </button>
      </div>
    </div>
  );
}
