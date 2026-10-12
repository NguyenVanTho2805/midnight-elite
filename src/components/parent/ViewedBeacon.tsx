// TT-199 — báo "phụ huynh đã xem" một lần khi trang phiếu được mở trong trình duyệt thật.
"use client";
import { useEffect } from "react";

export default function ViewedBeacon({ url }: { url: string }) {
  useEffect(() => {
    void fetch(url, { method: "POST", credentials: "same-origin", keepalive: true }).catch(() => { /* im lặng: không ảnh hưởng người xem */ });
  }, [url]);
  return null;
}
