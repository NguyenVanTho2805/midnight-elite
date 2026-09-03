"use client";

import { useEffect } from "react";
import { Warning as AlertTriangle } from "@phosphor-icons/react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--surface)" }}>
      <div className="text-center max-w-md">
        <div className="w-24 h-24 rounded-xl flex items-center justify-center mx-auto mb-6"
          style={{ background: "#fee2e2", border: "1px solid #fca5a5" }}>
          <AlertTriangle size={44} style={{ color: "#dc2626" }} />
        </div>

        <h1 className="text-2xl font-bold mb-3" style={{ color: "var(--charcoal)" }}>
          Có lỗi xảy ra
        </h1>
        <p className="text-sm mb-2" style={{ color: "var(--steel)" }}>
          Trang gặp sự cố không mong muốn. Thử tải lại hoặc quay về trang chủ.
        </p>
        {error.digest && (
          <p className="text-xs mb-6 font-mono px-3 py-1.5 rounded-lg inline-block"
            style={{ background: "var(--surface)", border: "1px solid var(--hairline)", color: "var(--stone)" }}>
            #{error.digest}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
          <button onClick={reset}
            className="px-8 py-3.5 rounded-lg text-sm font-bold text-white"
            style={{ background: "#5645d4", borderRadius: "8px" }}>
            Thử lại
          </button>
          <a href="/"
            className="px-8 py-3.5 rounded-lg text-sm font-bold"
            style={{ background: "var(--canvas)", border: "1px solid var(--hairline)", color: "var(--steel)", borderRadius: "8px" }}>
            Về trang chủ
          </a>
        </div>
      </div>
    </div>
  );
}
