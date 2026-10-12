// PH-210 — đo lượt mở và lượt xem hết hồ sơ công khai, theo kênh (đuôi ?n=). Chạy ở trình duyệt, không phải lúc máy chủ
// dựng trang, để bot xem trước link (Zalo, Facebook) không bị tính là người xem. Mã khách là số ngẫu nhiên theo PHIÊN
// (sessionStorage), chỉ để không đếm trùng — không phải định danh người.
"use client";
import { useEffect } from "react";

function visitorKey(): string {
  const fresh = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`);
  try {
    const k = sessionStorage.getItem("kin-vk");
    if (k) return k;
    const n = fresh();
    sessionStorage.setItem("kin-vk", n);
    return n;
  } catch { return fresh(); }
}

export default function ProfileTracker({ tutorId }: { tutorId: string }) {
  useEffect(() => {
    const n = new URLSearchParams(window.location.search).get("n") ?? undefined;
    const vk = visitorKey();
    const send = (kind: "open" | "full") => fetch(`/api/tutors/${tutorId}/visit`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ n, kind, vk }), keepalive: true,
    }).catch(() => { /* im lặng: việc đo không được làm hỏng trang */ });
    void send("open");
    const end = document.getElementById("kin-profile-end");
    if (!end || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { void send("full"); io.disconnect(); } }, { threshold: 0.1 });
    io.observe(end);
    return () => io.disconnect();
  }, [tutorId]);
  return null;
}
