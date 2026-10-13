"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { KinLogo } from "@/components/kin/KinLogo";

export default function QuenMatKhauPage() {
  const [email, setEmail]   = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    document.title = "Quên mật khẩu — KiN";
  }, []);

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
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "var(--kin-nen-bang)" }}>
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" aria-label="KiN — trang chủ" className="inline-flex flex-col items-center gap-2">
            <KinLogo size={36} textSize="var(--kin-co-h2)" />
            <span className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>Lớp học của bạn, gọn trong một chỗ</span>
          </Link>
        </div>

        <div className="rounded-xl p-8" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)", boxShadow: "rgba(15,15,15,0.08) 0px 4px 12px 0px" }}>

          {status === "sent" ? (
            <div className="text-center py-2">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-5"
                style={{ background: "var(--kin-nen-nhan)", border: "1px solid var(--kin-nhan-vien)" }}>
                <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ color: "var(--kin-chu-chinh)", letterSpacing: "-0.3px" }}>Kiểm tra hộp thư</h2>
              <p className="text-sm mb-4" style={{ color: "var(--kin-chu-mo)" }}>
                Nếu email <strong style={{ color: "var(--kin-chu-phu)" }}>{email}</strong> tồn tại trong hệ thống,
                chúng tôi đã gửi link đặt lại mật khẩu.
              </p>
              <p className="text-xs mb-6" style={{ color: "var(--kin-chu-mo)" }}>
                Link có hiệu lực trong <strong>1 giờ</strong>. Kiểm tra thư mục Spam nếu không thấy.
              </p>
              <div className="flex gap-2 justify-center">
                <button onClick={() => { setStatus("idle"); setEmail(""); }}
                  className="px-4 py-2 rounded-lg text-sm font-medium"
                  style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-mo)", borderRadius: "8px" }}>
                  Thử email khác
                </button>
                <Link href="/dang-nhap"
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                  style={{ background: "var(--kin-nhan-nen)", borderRadius: "8px" }}>
                  Về đăng nhập
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-xl font-bold mb-1" style={{ color: "var(--kin-chu-chinh)", letterSpacing: "-0.3px" }}>Quên mật khẩu?</h1>
                <p className="text-sm" style={{ color: "var(--kin-chu-mo)" }}>
                  Nhập email tài khoản — chúng tôi sẽ gửi link đặt lại mật khẩu.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--kin-chu-phu)" }}>Email</label>
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="ten@gmail.com" autoComplete="email" required
                    className="notion-input w-full text-sm"
                    style={{ color: "var(--kin-chu-chinh)" }}
                  />
                </div>

                {status === "error" && (
                  <div className="px-4 py-3 rounded-lg text-sm font-medium"
                    style={{ background: "var(--kin-tt-nen-loi)", color: "var(--kin-tt-chu-loi)", border: "1px solid var(--kin-tt-vien-loi)" }}>
                    {errMsg}
                  </div>
                )}

                <button type="submit" disabled={status === "loading" || !email.trim()}
                  className="w-full py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50"
                  style={{ background: "var(--kin-nhan-nen)", borderRadius: "8px" }}>
                  {status === "loading" ? "Đang gửi..." : "Gửi link đặt lại mật khẩu"}
                </button>
              </form>

              <p className="text-center text-sm mt-6" style={{ color: "var(--kin-chu-mo)" }}>
                Nhớ mật khẩu rồi?{" "}
                <Link href="/dang-nhap" className="font-semibold" style={{ color: "var(--kin-nhan-link)" }}>Đăng nhập</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
