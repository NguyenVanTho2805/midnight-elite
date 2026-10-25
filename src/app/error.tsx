// Trang lỗi theo bộ trạng thái dùng chung (Figma 299:117032, thẻ "Lỗi · có thể thử lại").
"use client";

import { useEffect } from "react";
import { KinButton, KinStateCard, KinStatus, kinButtonClass } from "@/components/kin";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-[var(--kin-nen-bang)]">
      <KinStateCard
        as="h1"
        tone="loi"
        className="w-full max-w-[460px]"
        kicker="Lỗi · Có thể thử lại"
        title="Có lỗi xảy ra"
        status={<KinStatus tone="loi">Trang gặp sự cố không mong muốn</KinStatus>}
        actions={
          <>
            <KinButton variant="primary" onClick={reset}>Thử lại</KinButton>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- tải lại hẳn trang để thoát khỏi trạng thái lỗi */}
            <a href="/" className={kinButtonClass("secondary")}>Về trang chủ</a>
          </>
        }
        note={error.digest ? <>Mã lỗi để báo cho chúng tôi: <span className="font-mono">#{error.digest}</span></> : undefined}
      >
        Thử tải lại trang. Nếu vẫn lỗi, quay về trang chủ rồi vào lại.
      </KinStateCard>
    </div>
  );
}
