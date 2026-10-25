// 404 theo bộ trạng thái dùng chung (Figma 299:117032): thẻ canh trái, nói rõ chuyện gì và đi tiếp đâu.
"use client";
import Link from "next/link";
import { KinStateCard, KinStatus, kinButtonClass } from "@/components/kin";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-[var(--kin-nen-bang)]">
      <KinStateCard
        as="h1"
        className="w-full max-w-[460px]"
        kicker="Không tìm thấy · 404"
        title="Trang không tồn tại"
        status={<KinStatus tone="mo">Không có trang ở địa chỉ này</KinStatus>}
        actions={
          <>
            <Link href="/" className={kinButtonClass("primary")}>Về trang chủ</Link>
            <Link href="/khoa-hoc" className={kinButtonClass("secondary")}>Xem khóa học</Link>
          </>
        }
        note={<>Đường dẫn bạn truy cập không tồn tại hoặc đã bị xóa. Nếu bạn cho rằng đây là lỗi, hãy gọi{" "}
          <a href="tel:0384409051" className="font-medium underline text-[var(--kin-nhan-link)]">0384 409 051</a>.</>}
      >
        Có thể đường dẫn đã gõ sai, hoặc nội dung đã được chuyển đi. Bạn quay về trang chủ để đi tiếp.
      </KinStateCard>
    </div>
  );
}
