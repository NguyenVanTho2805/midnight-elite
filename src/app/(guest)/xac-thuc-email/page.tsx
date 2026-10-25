"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { landingPath } from "@/lib/landing";

function VerifyContent() {
  const params = useSearchParams();
  const token  = params.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "already" | "error">("loading");
  const [name,   setName]   = useState("");
  // NC2-029: gia sư vừa đăng ký, hồ sơ chưa được duyệt → họ vào khung học viên; chữ phải nói đúng như vậy.
  const [tutorPending, setTutorPending] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    if (!token) { setStatus("error"); setErrMsg("Không tìm thấy token xác thực"); return; }
    fetch(`/api/auth/verify-email?token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setName(data.name ?? "");
          setTutorPending(data.tutorPending === true);
          setStatus("success");
          // Đã tự đăng nhập (máy chủ tạo phiên ở bước xác thực) → vào trang đầu của vai (học viên: "Việc của tôi", đúng như sau khi đăng nhập). Trước đây là /student/hoc-tap:
          // học viên mới thấy "Bạn chưa có khóa học nào" dù trang vừa ghi "Đang chuyển đến Dashboard".
          // TẢI CỨNG chứ không router.push: AuthProvider chỉ hỏi /api/auth/me MỘT lần lúc mở trang (lúc đó chưa có phiên) nên `user` vẫn null; chuyển trang kiểu máy khách vào khu học viên thì
          // AuthGuard thấy user = null, đẩy sang /dang-nhap, proxy lại đẩy về (đã có cookie) → học viên mới thấy TRANG TRẮNG sau khi xác thực (dựng lại 16/10/2026).
          // /dat-lai-mat-khau vốn đã tải cứng vì lý do này.
          const landing = typeof data.landing === "string" && data.landing.startsWith("/") ? data.landing : landingPath("student");
          setTimeout(() => window.location.assign(landing), 3000);
        } else if (data.already) {
          setStatus("already");
        } else {
          setStatus("error");
          setErrMsg(data.error ?? "Xác thực thất bại");
        }
      })
      .catch(() => { setStatus("error"); setErrMsg("Lỗi kết nối"); });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--kin-nen-bang)" }}>
      <div className="w-full max-w-md">
        <div className="rounded-xl p-10 text-center" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)", boxShadow: "rgba(15,15,15,0.08) 0px 4px 12px 0px" }}>

          {status === "loading" && (
            <>
              <div className="w-14 h-14 rounded-xl mx-auto mb-5 flex items-center justify-center" style={{ background: "var(--kin-nhan-nen-nhat)", border: "1px solid var(--kin-nhan-vien)" }}>
                <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              </div>
              <h1 className="text-lg font-bold" style={{ color: "var(--kin-chu-chinh)" }}>Đang xác thực email...</h1>
            </>
          )}

          {status === "success" && (
            <>
              <div className="w-14 h-14 rounded-xl mx-auto mb-5 flex items-center justify-center" style={{ background: "var(--kin-tt-nen-xong)", border: "1px solid var(--kin-tt-vien-xong)" }}>
                <svg className="w-7 h-7" fill="none" stroke="var(--kin-tt-chu-xong)" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-xl font-bold mb-2" style={{ color: "var(--kin-chu-chinh)", letterSpacing: "-0.3px" }}>Xác thực thành công!</h1>
              <p className="text-sm mb-1" style={{ color: "var(--kin-chu-mo)" }}>
                Chào mừng <strong style={{ color: "var(--kin-nhan-link)" }}>{name}</strong> đến với KiN
              </p>
              {tutorPending ? (
                <p className="text-xs mb-5" style={{ color: "var(--kin-chu-mo)" }}>Hồ sơ gia sư của bạn đang chờ quản trị duyệt. Trong lúc chờ, bạn vào KiN bằng tài khoản học viên…</p>
              ) : (
                <p className="text-xs mb-5" style={{ color: "var(--kin-chu-mo)" }}>Đang chuyển vào KiN…</p>
              )}
              <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--kin-vien-thuong)" }}>
                <div className="h-1 animate-pulse" style={{ background: "var(--kin-nhan-nen)", width: "100%" }} />
              </div>
            </>
          )}

          {status === "already" && (
            <>
              <div className="w-14 h-14 rounded-xl mx-auto mb-5 flex items-center justify-center" style={{ background: "var(--kin-nhan-nen-nhat)", border: "1px solid var(--kin-nhan-vien)" }}>
                <svg className="w-7 h-7" fill="none" stroke="var(--kin-nhan-nen)" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-xl font-bold mb-2" style={{ color: "var(--kin-chu-chinh)" }}>Email đã được xác thực</h1>
              <p className="text-sm mb-6" style={{ color: "var(--kin-chu-mo)" }}>Tài khoản của bạn đã kích hoạt trước đó rồi.</p>
              <Link href="/dang-nhap"
                className="inline-block px-5 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: "var(--kin-nhan-nen)", borderRadius: "8px" }}>
                Đăng nhập
              </Link>
            </>
          )}

          {status === "error" && (
            <>
              <div className="w-14 h-14 rounded-xl mx-auto mb-5 flex items-center justify-center" style={{ background: "var(--kin-tt-nen-loi)", border: "1px solid var(--kin-tt-vien-loi)" }}>
                <svg className="w-7 h-7" fill="none" stroke="var(--kin-tt-chu-loi)" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="text-xl font-bold mb-2" style={{ color: "var(--kin-chu-chinh)" }}>Xác thực thất bại</h1>
              <p className="text-sm mb-6" style={{ color: "var(--kin-chu-mo)" }}>{errMsg}</p>
              <div className="flex gap-2 justify-center">
                <Link href="/dang-ky"
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                  style={{ background: "var(--kin-nhan-nen)", borderRadius: "8px" }}>
                  Đăng ký lại
                </Link>
                <Link href="/dang-nhap"
                  className="px-4 py-2 rounded-lg text-sm font-medium"
                  style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-mo)", borderRadius: "8px" }}>
                  Đăng nhập
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function XacThucEmailPage() {
  return (
    <Suspense>
      <VerifyContent />
    </Suspense>
  );
}
