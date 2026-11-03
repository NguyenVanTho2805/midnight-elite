// Dải đầu trang Cộng đồng (BU-08, phần B): "N câu hỏi của khách chờ duyệt — Mở hàng chờ". Chỉ hiện khi API hàng chờ có đếm loại `khach-hoi`
// (cắm khi BU-05 gộp; chưa gộp thì API không có khoá này và dải không hiện). Lỗi tải thì im lặng — đây là gợi ý, không phải việc chính của trang.
"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { KinCallout } from "@/components/kin";

export default function GuestQuestionStrip() {
  const [n, setN] = useState(0);
  useEffect(() => {
    let off = false;
    fetch("/api/admin/kiem-duyet?limit=1", { credentials: "same-origin", cache: "no-store" })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { const c = d?.counts?.["khach-hoi"]; if (!off && typeof c === "number") setN(c); })
      .catch(() => {});
    return () => { off = true; };
  }, []);
  if (n <= 0) return null;
  return (
    <KinCallout title={`${n} câu hỏi của khách chờ duyệt`}>
      <span data-guest-strip>Khách chưa đăng nhập đã gửi câu hỏi. <Link href="/admin/kiem-duyet?loai=khach-hoi" className="font-medium underline text-[var(--kin-nhan-link)]">Mở hàng chờ</Link> để duyệt trước khi hiện công khai.</span>
    </KinCallout>
  );
}
