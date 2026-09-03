"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";

export default function DangNhapPage() {
  const { login, user, isLoading } = useAuth();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const redirectTo   = searchParams.get("redirect");

  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [error, setError]           = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPass, setShowPass]     = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      if (redirectTo) {
        router.replace(redirectTo);
      } else {
        router.replace(user.role === "admin" ? "/admin" : "/student/hoc-tap");
      }
    }
  }, [user, isLoading, router, redirectTo]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email || !password) { setError("Vui lòng nhập đầy đủ thông tin"); return; }
    setSubmitting(true);
    const result = await login(email, password);
    if (!result.success) {
      setError(result.message ?? "Đăng nhập thất bại");
      setSubmitting(false);
    }
  }

  if (isLoading) return null;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "var(--surface)" }}>
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex flex-col items-center gap-1">
            <span className="text-2xl font-bold" style={{ color: "#5645d4", letterSpacing: "-0.5px" }}>Midnight Elite</span>
            <span className="text-xs" style={{ color: "var(--stone)" }}>Education Platform</span>
          </Link>
          <h1 className="text-xl font-bold mt-6 mb-1" style={{ color: "var(--ink)", letterSpacing: "-0.3px" }}>Chào mừng trở lại</h1>
          <p className="text-sm" style={{ color: "var(--steel)" }}>Đăng nhập để tiếp tục học</p>
        </div>

        {/* Form card — Notion flat style */}
        <div className="rounded-xl p-8" style={{ background: "var(--canvas)", border: "1px solid var(--hairline)", boxShadow: "rgba(15,15,15,0.08) 0px 4px 12px 0px" }}>
          <form onSubmit={handleSubmit} className="space-y-4">

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--charcoal)" }}>Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="ten@gmail.com" autoComplete="email"
                className="notion-input w-full text-sm"
                style={{ color: "var(--ink)" }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--charcoal)" }}>Mật khẩu</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" autoComplete="current-password"
                  className="notion-input w-full text-sm pr-14"
                  style={{ color: "var(--ink)" }}
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-3 text-xs font-medium" style={{ color: "var(--stone)" }}>
                  {showPass ? "Ẩn" : "Hiện"}
                </button>
              </div>
            </div>

            {error && (
              <div className="px-4 py-3 rounded-lg text-sm font-medium" style={{ background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" }}>
                {error}
              </div>
            )}

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "var(--steel)" }}>
                <input type="checkbox" className="rounded" />
                Ghi nhớ đăng nhập
              </label>
              <Link href="/quen-mat-khau" className="text-xs font-medium" style={{ color: "#5645d4" }}>
                Quên mật khẩu?
              </Link>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all"
              style={{
                background: submitting ? "var(--muted)" : "#5645d4",
                borderRadius: "8px",
              }}
            >
              {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>
          </form>

          <p className="text-center text-sm mt-6" style={{ color: "var(--steel)" }}>
            Chưa có tài khoản?{" "}
            <Link href="/dang-ky" className="font-semibold" style={{ color: "#5645d4" }}>Đăng ký ngay</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
