"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

type Status = "loading" | "pending" | "approved" | "rejected" | "expired" | "error";

interface ConsentInfo {
  status:      string;
  studentName: string;
  courseName:  string | null;
  expiresAt:   string;
}

function ConsentContent() {
  const params = useSearchParams();
  const token  = params.get("token");

  const [status,    setStatus]    = useState<Status>("loading");
  const [info,       setInfo]     = useState<ConsentInfo | null>(null);
  const [errMsg,     setErrMsg]   = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    if (!token) { setStatus("error"); setErrMsg("Không tìm thấy token xác nhận"); return; }
    fetch(`/api/parent-consents/${token}`)
      .then(r => r.json())
      .then((data: ConsentInfo & { error?: string }) => {
        if (data.error) { setStatus("error"); setErrMsg(data.error); return; }
        if (data.status === "invalid") {
          setStatus("error");
          setErrMsg("Yêu cầu không còn hiệu lực (liên kết phụ huynh đã bị thu hồi hoặc lớp đã huỷ).");
          return;
        }
        setInfo(data);
        setStatus(data.status as Status);
      })
      .catch(() => { setStatus("error"); setErrMsg("Lỗi kết nối"); });
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function respond(decision: "approved" | "rejected") {
    if (!token || submitting) return;
    setSubmitting(true);
    try {
      const res  = await fetch(`/api/parent-consents/${token}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ decision }),
      });
      const data = await res.json();
      if (!res.ok) { setErrMsg(data.error ?? "Có lỗi xảy ra"); setStatus("error"); return; }
      setStatus(data.status as Status);
    } catch {
      setErrMsg("Lỗi kết nối");
      setStatus("error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--kin-nen-bang)" }}>
      <div className="w-full max-w-md">
        <div className="rounded-xl p-10 text-center" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)", boxShadow: "rgba(15,15,15,0.08) 0px 4px 12px 0px" }}>

          {status === "loading" && (
            <>
              <div className="w-14 h-14 rounded-xl mx-auto mb-5 flex items-center justify-center" style={{ background: "var(--kin-nhan-nen-nhat)", border: "1px solid var(--kin-nhan-vien)" }}>
                <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              </div>
              <h1 className="text-lg font-bold" style={{ color: "var(--kin-chu-chinh)" }}>Đang tải yêu cầu...</h1>
            </>
          )}

          {status === "pending" && info && (
            <>
              <div className="w-14 h-14 rounded-xl mx-auto mb-5 flex items-center justify-center" style={{ background: "var(--kin-nhan-nen-nhat)", border: "1px solid var(--kin-nhan-vien)" }}>
                <span className="text-2xl">👪</span>
              </div>
              <h1 className="text-xl font-bold mb-2" style={{ color: "var(--kin-chu-chinh)", letterSpacing: "-0.3px" }}>Yêu cầu xác nhận</h1>
              <p className="text-sm mb-6" style={{ color: "var(--kin-chu-mo)" }}>
                <strong style={{ color: "var(--kin-chu-chinh)" }}>{info.studentName}</strong> đang đăng ký tham gia lớp{" "}
                <strong style={{ color: "var(--kin-nhan-link)" }}>&ldquo;{info.courseName}&rdquo;</strong>. Bạn có đồng ý không?
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => respond("approved")}
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: "var(--kin-tt-chu-xong)", borderRadius: "8px" }}
                >
                  Đồng ý
                </button>
                <button
                  onClick={() => respond("rejected")}
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50"
                  style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-mo)", borderRadius: "8px" }}
                >
                  Từ chối
                </button>
              </div>
            </>
          )}

          {status === "approved" && (
            <>
              <div className="w-14 h-14 rounded-xl mx-auto mb-5 flex items-center justify-center" style={{ background: "var(--kin-tt-nen-xong)", border: "1px solid var(--kin-tt-vien-xong)" }}>
                <svg className="w-7 h-7" fill="none" stroke="var(--kin-tt-chu-xong)" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-xl font-bold mb-2" style={{ color: "var(--kin-chu-chinh)" }}>Đã xác nhận đồng ý</h1>
              <p className="text-sm" style={{ color: "var(--kin-chu-mo)" }}>Cảm ơn bạn. Yêu cầu đã được ghi nhận.</p>
            </>
          )}

          {status === "rejected" && (
            <>
              <div className="w-14 h-14 rounded-xl mx-auto mb-5 flex items-center justify-center" style={{ background: "var(--kin-tt-nen-loi)", border: "1px solid var(--kin-tt-vien-loi)" }}>
                <svg className="w-7 h-7" fill="none" stroke="var(--kin-tt-chu-loi)" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="text-xl font-bold mb-2" style={{ color: "var(--kin-chu-chinh)" }}>Đã từ chối</h1>
              <p className="text-sm" style={{ color: "var(--kin-chu-mo)" }}>Yêu cầu đã được ghi nhận là từ chối.</p>
            </>
          )}

          {status === "expired" && (
            <>
              <div className="w-14 h-14 rounded-xl mx-auto mb-5 flex items-center justify-center" style={{ background: "var(--kin-tt-nen-cho)", border: "1px solid var(--kin-tt-vien-cho)" }}>
                <svg className="w-7 h-7" fill="none" stroke="var(--kin-tt-chu-cho)" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-xl font-bold mb-2" style={{ color: "var(--kin-chu-chinh)" }}>Link đã hết hạn</h1>
              <p className="text-sm" style={{ color: "var(--kin-chu-mo)" }}>Vui lòng liên hệ gia sư để được gửi lại yêu cầu.</p>
            </>
          )}

          {status === "error" && (
            <>
              <div className="w-14 h-14 rounded-xl mx-auto mb-5 flex items-center justify-center" style={{ background: "var(--kin-tt-nen-loi)", border: "1px solid var(--kin-tt-vien-loi)" }}>
                <svg className="w-7 h-7" fill="none" stroke="var(--kin-tt-chu-loi)" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="text-xl font-bold mb-2" style={{ color: "var(--kin-chu-chinh)" }}>Có lỗi xảy ra</h1>
              <p className="text-sm mb-6" style={{ color: "var(--kin-chu-mo)" }}>{errMsg}</p>
              <Link href="/"
                className="inline-block px-5 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: "var(--kin-nhan-nen)", borderRadius: "8px" }}>
                Về trang chủ
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function XacNhanPhuHuynhPage() {
  return (
    <Suspense>
      <ConsentContent />
    </Suspense>
  );
}
