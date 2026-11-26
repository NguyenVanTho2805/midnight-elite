"use client";
// Đếm ngược "còn 3 giờ 20 phút", cập nhật mỗi phút; lần dựng đầu ở máy chủ.
// HenLamMoi: trang mở trước 21:45 — tới giờ mở điểm danh thì router.refresh() MỘT lần để máy chủ dựng lại thẻ
// (nút "Điểm danh mở lúc 21:45" đổi thành nút vàng "Điểm danh") mà không cần tải lại trang.
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { khoangThoiGian } from "../dinh-dang";

export function DemNguoc({ den, luc }: { den: number; luc: number }) {
  const [bay, setBay] = useState(luc);
  useEffect(() => {
    setBay(Date.now());
    const t = setInterval(() => setBay(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return <span suppressHydrationWarning>{khoangThoiGian(den - bay)}</span>;
}

/** setTimeout giới hạn ~24,8 ngày; thẻ tối nay luôn < 24 giờ nên một lần hẹn là đủ. */
export function HenLamMoi({ luc }: { luc: number }) {
  const router = useRouter();
  useEffect(() => {
    const cho = luc - Date.now() + 1000; // trễ 1 giây cho chắc đã qua mốc ở giờ máy chủ
    if (cho > 2 ** 31 - 1) return;
    const t = setTimeout(() => router.refresh(), Math.max(0, cho));
    return () => clearTimeout(t);
  }, [luc, router]);
  return null;
}
