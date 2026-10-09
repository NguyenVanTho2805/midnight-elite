// TK-170 — màn đăng nhập theo thiết kế KiN (Figma 32:2).
// Dùng var(--kin-*) + text-h4/body-sm/caption nhất quán tokens.
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
    <div className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: "var(--kin-nen-bang)" }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex flex-col items-center gap-1">
            <span className="text-h3" style={{ color: "var(--kin-th-navy)", letterSpacing: "-0.5px" }}>KiN</span>
            <span className="text-caption" style={{ color: "var(--kin-chu-mo)" }}>Sổ lớp cho gia sư</span>
          </Link>
          <h1 className="text-h4 mt-6 mb-1" style={{ color: "var(--kin-chu-chinh)" }}>Chào mừng trở lại</h1>
          <p className="text-body-sm" style={{ color: "var(--kin-chu-mo)" }}>Đăng nhập để tiếp tục</p>
        </div>

        {/* Form card */}
        <div className="rounded-xl p-8"
          style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)", boxShadow: "0 4px 12px rgba(15,15,15,0.08)" }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-caption font-semibold mb-1.5" style={{ color: "var(--kin-chu-phu)" }}>Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="ten@gmail.com" autoComplete="email"
                className="w-full px-3 py-2.5 text-body-sm rounded-lg focus:outline-none"
                style={{ background: "var(--kin-nen-bang)", color: "var(--kin-chu-chinh)", border: "1px solid var(--kin-vien-o-nhap)" }}
              />
            </div>

            <div>
              <label className="block text-caption font-semibold mb-1.5" style={{ color: "var(--kin-chu-phu)" }}>Mật khẩu</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" autoComplete="current-password"
                  className="w-full px-3 py-2.5 text-body-sm rounded-lg focus:outline-none pr-14"
                  style={{ background: "var(--kin-nen-bang)", color: "var(--kin-chu-chinh)", border: "1px solid var(--kin-vien-o-nhap)" }}
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-3 text-caption font-medium"
                  style={{ color: "var(--kin-chu-mo)" }}>
                  {showPass ? "Ẩn" : "Hiện"}
                </button>
              </div>
            </div>

            {error && (
              <div className="px-4 py-3 rounded-lg text-body-sm font-medium"
                style={{ background: "#fee2e2", color: "var(--kin-tt-chu-loi)", border: "1px solid #fecaca" }}>
                {error}
              </div>
            )}

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-caption cursor-pointer" style={{ color: "var(--kin-chu-mo)" }}>
                <input type="checkbox" className="rounded" />
                Ghi nhớ đăng nhập
              </label>
              <Link href="/quen-mat-khau" className="text-caption font-medium" style={{ color: "var(--kin-th-xanh-link)" }}>
                Quên mật khẩu?
              </Link>
            </div>

            <button type="submit" disabled={submitting}
              className="w-full py-2.5 rounded-lg text-body-sm font-semibold transition-all disabled:opacity-60"
              style={{ background: "var(--kin-th-navy)", color: "var(--kin-chu-tren-nut-chinh)" }}>
              {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>
          </form>

          <p className="text-center text-body-sm mt-6" style={{ color: "var(--kin-chu-mo)" }}>
            Chưa có tài khoản?{" "}
            <Link href="/dang-ky" className="font-semibold" style={{ color: "var(--kin-th-xanh-link)" }}>Đăng ký ngay</Link>
          </p>
        </div>

        {/* Vào lớp qua mã mời (link ngắn ngay dưới card — TK-170 "nhập mã mời") */}
        <p className="text-center text-body-sm mt-6" style={{ color: "var(--kin-chu-mo)" }}>
          Đã có tài khoản và có mã mời lớp?{" "}
          <Link href="/dang-nhap?redirect=/student/nhap-ma-lop"
            className="font-semibold" style={{ color: "var(--kin-th-xanh-link)" }}>
            Vào bằng mã mời
          </Link>
        </p>
      </div>
    </div>
  );
}
