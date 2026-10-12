"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { KinLogo } from "@/components/kin/KinLogo";

function getPasswordStrength(p: string) {
  if (!p) return { level: 0, label: "", color: "" };
  if (p.length < 6)  return { level: 1, label: "Quá yếu",    color: "var(--kin-tt-chu-loi)" };
  if (p.length < 8)  return { level: 2, label: "Yếu",         color: "var(--kin-tt-chu-cho)" };
  if (/[A-Z]/.test(p) && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p))
                     return { level: 5, label: "Rất mạnh",    color: "var(--kin-nhan-link)" };
  if (/[A-Z]/.test(p) && /[0-9]/.test(p))
                     return { level: 4, label: "Mạnh",         color: "var(--kin-tt-chu-xong)" };
  return             { level: 3, label: "Trung bình",          color: "var(--kin-tt-chu-cho)" };
}

function ResetContent() {
  const params = useSearchParams();
  const router = useRouter();
  const token  = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [showPass, setShowPass] = useState(false);
  const [status,   setStatus]   = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errMsg,   setErrMsg]   = useState("");

  const strength = getPasswordStrength(password);
  const mismatch = confirm.length > 0 && password !== confirm;

  useEffect(() => {
    document.title = "Đặt lại mật khẩu — KiN";
  }, []);

  useEffect(() => {
    if (!token) { setStatus("error"); setErrMsg("Link không hợp lệ"); }
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setErrMsg("Mật khẩu cần ít nhất 8 ký tự"); return; }
    if (password !== confirm) { setErrMsg("Mật khẩu xác nhận không khớp"); return; }
    setStatus("loading"); setErrMsg("");
    try {
      const res  = await fetch("/api/auth/reset-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) { setErrMsg(data.error); setStatus("error"); return; }
      setStatus("success");
      setTimeout(() => router.push(data.role === "admin" ? "/admin" : "/student/hoc-tap"), 2000);
    } catch {
      setErrMsg("Lỗi kết nối, vui lòng thử lại");
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "var(--kin-nen-bang)" }}>
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <Link href="/" aria-label="KiN — trang chủ" className="inline-flex flex-col items-center gap-2">
            <KinLogo size={36} textSize="var(--kin-co-h2)" />
            <span className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>Lớp học của bạn, gọn trong một chỗ</span>
          </Link>
        </div>

        <div className="rounded-xl p-8" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)", boxShadow: "rgba(15,15,15,0.08) 0px 4px 12px 0px" }}>

          {status === "success" && (
            <div className="text-center py-2">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-5"
                style={{ background: "#d1fae5", border: "1px solid #a7f3d0" }}>
                <svg className="w-7 h-7" fill="none" stroke="var(--kin-tt-chu-xong)" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ color: "var(--kin-chu-chinh)", letterSpacing: "-0.3px" }}>
                Đặt lại mật khẩu thành công!
              </h2>
              <p className="text-sm mb-4" style={{ color: "var(--kin-chu-mo)" }}>Đang chuyển đến Dashboard...</p>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--kin-vien-thuong)" }}>
                <div className="h-1 animate-pulse" style={{ background: "var(--kin-nhan-nen)", width: "100%" }} />
              </div>
            </div>
          )}

          {status === "error" && !password && (
            <div className="text-center py-2">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-5"
                style={{ background: "#fee2e2", border: "1px solid #fecaca" }}>
                <svg className="w-7 h-7" fill="none" stroke="var(--kin-tt-chu-loi)" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ color: "var(--kin-chu-chinh)" }}>Link không hợp lệ</h2>
              <p className="text-sm mb-6" style={{ color: "var(--kin-chu-mo)" }}>{errMsg}</p>
              <Link href="/quen-mat-khau"
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white"
                style={{ background: "var(--kin-nhan-nen)", borderRadius: "8px" }}>
                Yêu cầu link mới
              </Link>
            </div>
          )}

          {status !== "success" && (status !== "error" || password.length > 0) && token && (
            <>
              <div className="mb-6">
                <h1 className="text-xl font-bold mb-1" style={{ color: "var(--kin-chu-chinh)", letterSpacing: "-0.3px" }}>Tạo mật khẩu mới</h1>
                <p className="text-sm" style={{ color: "var(--kin-chu-mo)" }}>Nhập mật khẩu mới cho tài khoản của bạn.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--kin-chu-phu)" }}>Mật khẩu mới</label>
                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"} value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Tối thiểu 8 ký tự" required
                      className="notion-input w-full text-sm pr-14"
                      style={{ color: "var(--kin-chu-chinh)" }}
                    />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-3 text-xs font-medium" style={{ color: "var(--kin-chu-mo)" }}>
                      {showPass ? "Ẩn" : "Hiện"}
                    </button>
                  </div>
                  {password.length > 0 && (
                    <div className="mt-2">
                      <div className="flex gap-1 mb-1">
                        {[1,2,3,4,5].map(i => (
                          <div key={i} className="flex-1 h-1 rounded-full transition-all"
                            style={{ background: i <= strength.level ? strength.color : "var(--kin-vien-thuong)" }} />
                        ))}
                      </div>
                      {strength.label && <p className="text-xs font-semibold" style={{ color: strength.color }}>{strength.label}</p>}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--kin-chu-phu)" }}>Xác nhận mật khẩu</label>
                  <input
                    type={showPass ? "text" : "password"} value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Nhập lại mật khẩu" required
                    className="notion-input w-full text-sm"
                    style={{ color: "var(--kin-chu-chinh)", borderColor: mismatch ? "var(--kin-tt-chu-loi)" : undefined }}
                  />
                  {mismatch && <p className="text-xs mt-1" style={{ color: "var(--kin-tt-chu-loi)" }}>Mật khẩu không khớp</p>}
                  {!mismatch && confirm.length > 0 && password === confirm && (
                    <p className="text-xs mt-1" style={{ color: "var(--kin-tt-chu-xong)" }}>✓ Mật khẩu khớp</p>
                  )}
                </div>

                {errMsg && (
                  <div className="px-4 py-3 rounded-lg text-sm font-medium"
                    style={{ background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" }}>
                    {errMsg}
                  </div>
                )}

                <button type="submit"
                  disabled={status === "loading" || mismatch || password.length < 8}
                  className="w-full py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50"
                  style={{ background: "var(--kin-nhan-nen)", borderRadius: "8px" }}>
                  {status === "loading" ? "Đang lưu..." : "Đặt lại mật khẩu"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DatLaiMatKhauPage() {
  return (
    <Suspense>
      <ResetContent />
    </Suspense>
  );
}
