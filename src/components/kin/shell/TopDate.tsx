// Ngày hôm nay ở dải trên (Figma: "Thứ Sáu, 23/10/2026"), theo giờ Việt Nam (vnDateKeyOf), chỉ máy tính.
// Tính SAU khi vào trang (useEffect) để máy chủ và trình duyệt không lệch nhau → không báo hydration.
"use client";
import { useEffect, useState } from "react";
import { dayOfWeekOfKey, vnDateKeyOf } from "@/lib/classSessions";

const WEEKDAY = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

export function vnDateLabel(d: Date = new Date()): string {
  const key = vnDateKeyOf(d);
  const [y, m, day] = key.split("-");
  return `${WEEKDAY[dayOfWeekOfKey(key)]}, ${day}/${m}/${y}`;
}

export function TopDate({ className = "" }: { className?: string }) {
  const [label, setLabel] = useState("");
  useEffect(() => { void Promise.resolve().then(() => setLabel(vnDateLabel())); }, []);
  return <time data-top-date suppressHydrationWarning className={`hidden md:block text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)] whitespace-nowrap ${className}`}>{label}</time>;
}
