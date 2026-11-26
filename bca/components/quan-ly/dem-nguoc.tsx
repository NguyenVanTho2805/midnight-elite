"use client";
// Đếm ngược "còn 3 giờ 20 phút", cập nhật mỗi phút; lần dựng đầu ở máy chủ.
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
