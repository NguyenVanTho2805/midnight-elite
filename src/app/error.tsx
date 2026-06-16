"use client";

import { useEffect } from "react";
import { AlertTriangle } from "griddy-icons";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#f6f5f4" }}>
      <div className="text-center max-w-md">
        <div className="w-24 h-24 rounded-xl flex items-center justify-center mx-auto mb-6"
          style={{ background: "#fee2e2", border: "1px solid #fca5a5" }}>
          <AlertTriangle size={44} style={{ color: "#dc2626" }} />
        </div>

        <h1 className="text-2xl font-bold mb-3" style={{ color: "#37352f" }}>
          Có lỗi xảy ra
        </h1>
        <p className="text-sm mb-2" style={{ color: "#787671" }}>
          Trang gặp sự cố không mong muốn. Thử tải lại hoặc quay về trang chủ.
        </p>
        {error.digest && (
          <p className="text-xs mb-6 font-mono px-3 py-1.5 rounded-lg inline-block"
            style={{ background: "#f6f5f4", border: "1px solid #e5e3df", color: "#a4a097" }}>
            #{error.digest}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
          <button onClick={reset}
            className="px-8 py-3.5 rounded-lg text-sm font-bold text-white"
            style={{ background: "#0068FF", borderRadius: "8px" }}>
            Thử lại
          </button>
          <a href="/"
            className="px-8 py-3.5 rounded-lg text-sm font-bold"
            style={{ background: "#ffffff", border: "1px solid #e5e3df", color: "#787671", borderRadius: "8px" }}>
            Về trang chủ
          </a>
        </div>
      </div>
    </div>
  );
}
