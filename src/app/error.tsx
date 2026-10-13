"use client";

import { useEffect } from "react";
import { AlertTriangle } from "griddy-icons";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--kin-nen-bang)" }}>
      <div className="text-center max-w-md">
        <div className="w-24 h-24 rounded-xl flex items-center justify-center mx-auto mb-6"
          style={{ background: "var(--kin-tt-nen-loi)", border: "1px solid var(--kin-tt-vien-loi)" }}>
          <AlertTriangle size={44} style={{ color: "var(--kin-tt-chu-loi)" }} />
        </div>

        <h1 className="text-2xl font-bold mb-3" style={{ color: "var(--kin-chu-phu)" }}>
          Có lỗi xảy ra
        </h1>
        <p className="text-sm mb-2" style={{ color: "var(--kin-chu-mo)" }}>
          Trang gặp sự cố không mong muốn. Thử tải lại hoặc quay về trang chủ.
        </p>
        {error.digest && (
          <p className="text-xs mb-6 font-mono px-3 py-1.5 rounded-lg inline-block"
            style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-mo)" }}>
            #{error.digest}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
          <button onClick={reset}
            className="px-8 py-3.5 rounded-lg text-sm font-bold text-white"
            style={{ background: "var(--kin-nhan-nen)", borderRadius: "8px" }}>
            Thử lại
          </button>
          <a href="/"
            className="px-8 py-3.5 rounded-lg text-sm font-bold"
            style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-mo)", borderRadius: "8px" }}>
            Về trang chủ
          </a>
        </div>
      </div>
    </div>
  );
}
