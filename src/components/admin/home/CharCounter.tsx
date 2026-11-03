// Bộ đếm ký tự dưới ô chữ (HOME-02). Từ 85% giới hạn: cam + chữ "Sắp hết chỗ"; vượt: đỏ + chữ "Dài hơn N ký tự". Màu không bao giờ là tín hiệu duy nhất.
"use client";
import { countChars } from "@/lib/homeContentGuard";

export function charState(value: string, limit: number): { n: number; level: "ok" | "gan" | "vuot"; text: string } {
  const n = countChars(value);
  if (n > limit) return { n, level: "vuot", text: `Dài hơn ${n - limit} ký tự` };
  if (n >= Math.ceil(limit * 0.85)) return { n, level: "gan", text: "Sắp hết chỗ" };
  return { n, level: "ok", text: "" };
}

export default function CharCounter({ id, value, limit }: { id: string; value: string; limit: number }) {
  const s = charState(value, limit);
  const color = s.level === "vuot" ? "var(--kin-tt-chu-loi)" : s.level === "gan" ? "var(--kin-tt-chu-cho)" : "var(--kin-chu-mo)";
  return (
    <span id={id} data-counter={s.level} className="text-[length:var(--kin-co-caption)] tabular-nums" style={{ color }}>
      {s.n}/{limit}{s.text ? ` · ${s.text}` : ""}
    </span>
  );
}
