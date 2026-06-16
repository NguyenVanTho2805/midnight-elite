"use client";

import { useState } from "react";
import Link from "next/link";

export default function QuenMatKhauPage() {
  const [email, setEmail]   = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { setErrMsg(data.error); setStatus("error"); return; }
      setStatus("sent");
    } catch {
      setErrMsg("Lỗi kết nối, vui lòng thử lại");
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "#f6f5f4" }}>
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex flex-col items-center gap-1">
            <span className="text-2xl font-bold" style={{ color: "#0068FF", letterSpacing: "-0.5px" }}>Midnight Elite</span>
            <span className="text-xs" style={{ color: "#a4a097" }}>Education Platform</span>
          </Link>
        </div>

        <div className="rounded-xl p-8" style={{ background: "#ffffff", border: "1px solid #e5e3df", boxShadow: "rgba(15,15,15,0.08) 0px 4px 12px 0px" }}>

          {status === "sent" ? (
            <div className="text-center py-2">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-5"
                style={{ background: "#dbeafe", border: "1px solid #bfdbfe" }}>
                <svg className="w-7 h-7" fill="none" stroke="#0068FF" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ color: "#1a1a1a", letterSpacing: "-0.3px" }}>Kiểm tra hộp thư</h2>
              <p className="text-sm mb-4" style={{ color: "#787671" }}>
                Nếu email <strong style={{ color: "#37352f" }}>{email}</strong> tồn tại trong hệ thống,
                chúng tôi đã gửi link đặt lại mật khẩu.
              </p>
              <p className="text-xs mb-6" style={{ color: "#a4a097" }}>
                Link có hiệu lực trong <strong>1 giờ</strong>. Kiểm tra thư mục Spam nếu không thấy.
              </p>
              <div className="flex gap-2 justify-center">
                <button onClick={() => { setStatus("idle"); setEmail(""); }}
                  className="px-4 py-2 rounded-lg text-sm font-medium"
                  style={{ background: "#f6f5f4", border: "1px solid #e5e3df", color: "#787671", borderRadius: "8px" }}>
                  Thử email khác
                </button>
                <Link href="/dang-nhap"
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                  style={{ background: "#0068FF", borderRadius: "8px" }}>
                  Về đăng nhập
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-xl font-bold mb-1" style={{ color: "#1a1a1a", letterSpacing: "-0.3px" }}>Quên mật khẩu?</h1>
                <p className="text-sm" style={{ color: "#787671" }}>
                  Nhập email tài khoản — chúng tôi sẽ gửi link đặt lại mật khẩu.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "#37352f" }}>Email</label>
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="ten@gmail.com" autoComplete="email" required
                    className="notion-input w-full text-sm"
                    style={{ color: "#1a1a1a" }}
                  />
                </div>

                {status === "error" && (
                  <div className="px-4 py-3 rounded-lg text-sm font-medium"
                    style={{ background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" }}>
                    {errMsg}
                  </div>
                )}

                <button type="submit" disabled={status === "loading" || !email.trim()}
                  className="w-full py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50"
                  style={{ background: "#0068FF", borderRadius: "8px" }}>
                  {status === "loading" ? "Đang gửi..." : "Gửi link đặt lại mật khẩu"}
                </button>
              </form>

              <p className="text-center text-sm mt-6" style={{ color: "#787671" }}>
                Nhớ mật khẩu rồi?{" "}
                <Link href="/dang-nhap" className="font-semibold" style={{ color: "#0068FF" }}>Đăng nhập</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
