"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

function getPasswordStrength(p: string) {
  if (!p) return { level: 0, label: "", color: "" };
  if (p.length < 6)  return { level: 1, label: "Quá yếu",    color: "#ef4444" };
  if (p.length < 8)  return { level: 2, label: "Yếu",         color: "#f97316" };
  if (/[A-Z]/.test(p) && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p))
                     return { level: 5, label: "Rất mạnh",    color: "#0068FF" };
  if (/[A-Z]/.test(p) && /[0-9]/.test(p))
                     return { level: 4, label: "Mạnh",         color: "#16a34a" };
  return             { level: 3, label: "Trung bình",          color: "#f97316" };
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
      setTimeout(() => router.push(data.role === "admin" ? "/admin" : "/student"), 2000);
    } catch {
      setErrMsg("Lỗi kết nối, vui lòng thử lại");
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "#f6f5f4" }}>
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <Link href="/" className="inline-flex flex-col items-center gap-1">
            <span className="text-2xl font-bold" style={{ color: "#0068FF", letterSpacing: "-0.5px" }}>Midnight Elite</span>
            <span className="text-xs" style={{ color: "#a4a097" }}>Education Platform</span>
          </Link>
        </div>

        <div className="rounded-xl p-8" style={{ background: "#ffffff", border: "1px solid #e5e3df", boxShadow: "rgba(15,15,15,0.08) 0px 4px 12px 0px" }}>

          {status === "success" && (
            <div className="text-center py-2">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-5"
                style={{ background: "#d1fae5", border: "1px solid #a7f3d0" }}>
                <svg className="w-7 h-7" fill="none" stroke="#16a34a" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ color: "#1a1a1a", letterSpacing: "-0.3px" }}>
                Đặt lại mật khẩu thành công!
              </h2>
              <p className="text-sm mb-4" style={{ color: "#787671" }}>Đang chuyển đến Dashboard...</p>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: "#e5e3df" }}>
                <div className="h-1 animate-pulse" style={{ background: "#0068FF", width: "100%" }} />
              </div>
            </div>
          )}

          {status === "error" && !password && (
            <div className="text-center py-2">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-5"
                style={{ background: "#fee2e2", border: "1px solid #fecaca" }}>
                <svg className="w-7 h-7" fill="none" stroke="#dc2626" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-bold mb-2" style={{ color: "#1a1a1a" }}>Link không hợp lệ</h2>
              <p className="text-sm mb-6" style={{ color: "#787671" }}>{errMsg}</p>
              <Link href="/quen-mat-khau"
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white"
                style={{ background: "#0068FF", borderRadius: "8px" }}>
                Yêu cầu link mới
              </Link>
            </div>
          )}

          {status !== "success" && (status !== "error" || password.length > 0) && token && (
            <>
              <div className="mb-6">
                <h1 className="text-xl font-bold mb-1" style={{ color: "#1a1a1a", letterSpacing: "-0.3px" }}>Tạo mật khẩu mới</h1>
                <p className="text-sm" style={{ color: "#787671" }}>Nhập mật khẩu mới cho tài khoản của bạn.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "#37352f" }}>Mật khẩu mới</label>
                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"} value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Tối thiểu 8 ký tự" required
                      className="notion-input w-full text-sm pr-14"
                      style={{ color: "#1a1a1a" }}
                    />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-3 text-xs font-medium" style={{ color: "#a4a097" }}>
                      {showPass ? "Ẩn" : "Hiện"}
                    </button>
                  </div>
                  {password.length > 0 && (
                    <div className="mt-2">
                      <div className="flex gap-1 mb-1">
                        {[1,2,3,4,5].map(i => (
                          <div key={i} className="flex-1 h-1 rounded-full transition-all"
                            style={{ background: i <= strength.level ? strength.color : "#e5e3df" }} />
                        ))}
                      </div>
                      {strength.label && <p className="text-xs font-semibold" style={{ color: strength.color }}>{strength.label}</p>}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: "#37352f" }}>Xác nhận mật khẩu</label>
                  <input
                    type={showPass ? "text" : "password"} value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Nhập lại mật khẩu" required
                    className="notion-input w-full text-sm"
                    style={{ color: "#1a1a1a", borderColor: mismatch ? "#fca5a5" : undefined }}
                  />
                  {mismatch && <p className="text-xs mt-1" style={{ color: "#dc2626" }}>Mật khẩu không khớp</p>}
                  {!mismatch && confirm.length > 0 && password === confirm && (
                    <p className="text-xs mt-1" style={{ color: "#16a34a" }}>✓ Mật khẩu khớp</p>
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
                  style={{ background: "#0068FF", borderRadius: "8px" }}>
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
