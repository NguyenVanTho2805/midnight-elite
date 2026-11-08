// "Tiếp tục với Google" / "Tiếp tục với Facebook" (08/11/2026) — chỉ cho HỌC SINH, ở /dang-nhap và /dang-ky. Mỗi nút tự ẩn khi máy chủ chưa có cặp biến môi trường của nó
// (hỏi /api/auth/<nhà>/enabled; chưa trả lời hoặc lỗi → không hiện, không báo lỗi). Không nút nào bật thì cả khối (kể cả ngăn "hoặc") không vẽ gì.
// Là liên kết thường (<a>), KHÔNG phải next/link: phải tải trang đầy đủ để máy chủ đặt cookie rồi chuyển sang nhà cung cấp.
// Nút viền = kiểu "Thường" của KiN (≥44px, token --kin-*). Chữ "G" / "f" đơn sắc theo token thay logo nhiều màu (không mã hex).
// Ngăn "hoặc" nằm NGAY SAU các nút, trước form bên dưới.
"use client";

import { useEffect, useState } from "react";
import { kinButtonClass } from "@/components/kin/buttonClass";

const PROVIDERS = [
  { key: "google", glyph: "G", label: "Tiếp tục với Google", enabledUrl: "/api/auth/google/enabled", startUrl: "/api/auth/google/start" },
  { key: "facebook", glyph: "f", label: "Tiếp tục với Facebook", enabledUrl: "/api/auth/facebook/enabled", startUrl: "/api/auth/facebook/start" },
] as const;
type Key = (typeof PROVIDERS)[number]["key"];

export function SocialButtons({ redirect, consent }: { redirect?: string | null; consent?: boolean }) {
  const [on, setOn] = useState<Record<Key, boolean>>({ google: false, facebook: false });
  useEffect(() => {
    let alive = true;
    for (const p of PROVIDERS) {
      fetch(p.enabledUrl, { cache: "no-store" }).then(r => r.json()).then(d => { if (alive && d?.[p.key] === true) setOn(o => ({ ...o, [p.key]: true })); }).catch(() => {});
    }
    return () => { alive = false; };
  }, []);
  const shown = PROVIDERS.filter(p => on[p.key]);
  if (shown.length === 0) return null;
  return (
    <div data-social-auth className="flex flex-col gap-3">
      {shown.map(p => (
        <a key={p.key} data-social-provider={p.key} className={`${kinButtonClass("secondary", "lg")} w-full`}
          href={`${p.startUrl}${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ""}`}>
          <span aria-hidden="true" className="font-bold text-[length:var(--kin-co-body)] text-[var(--kin-nhan-link)]">{p.glyph}</span>
          {p.label}
        </a>
      ))}
      {consent && (
        <p className="text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">
          Khi tiếp tục, bạn đồng ý với Điều khoản dịch vụ và Chính sách bảo mật của KiN. KiN chỉ nhận tên và email từ nhà cung cấp bạn chọn.
        </p>
      )}
      <div role="separator" className="flex items-center gap-3 text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">
        <span className="h-px flex-1 bg-[var(--kin-vien-thuong)]" />hoặc<span className="h-px flex-1 bg-[var(--kin-vien-thuong)]" />
      </div>
    </div>
  );
}
