"use client";
// Chia sẻ bài: Sao chép link · Facebook · Web Share (nếu máy hỗ trợ). Không bộ đếm, không script bên thứ ba.
import { useState } from "react";
import { kinButtonClass } from "@/components/kin/buttonClass";

async function saoChep(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* rơi về cách cũ */ }
  try {
    const t = document.createElement("textarea");
    t.value = text; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
    document.body.appendChild(t); t.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(t);
    return ok;
  } catch { return false; }
}

export function ChiaSe({ duongDan, tieuDe, kieu = "bai" }: {
  /** Đường dẫn tương đối của bài, vd /tin-tuc/abc. */
  duongDan: string; tieuDe: string;
  /** "bai": đủ ba nút ở trang bài. "dong": một nút "Chia sẻ" gọn ở dòng tin điện thoại. */
  kieu?: "bai" | "dong";
}) {
  const [tb, setTb] = useState("");
  const url = () => `${window.location.origin}${duongDan}`;

  async function chiaSeMay() {
    try {
      if (typeof navigator.share === "function") { await navigator.share({ title: tieuDe, url: url() }); return; }
    } catch (e) { if ((e as { name?: string })?.name === "AbortError") return; }
    setTb((await saoChep(url())) ? "Đã sao chép link." : "Chưa sao chép được. Hãy chép link trên thanh địa chỉ.");
  }
  async function chepLink() { setTb((await saoChep(url())) ? "Đã sao chép link." : "Chưa sao chép được. Hãy chép link trên thanh địa chỉ."); }

  if (kieu === "dong") {
    return (
      <>
        <button type="button" data-chia-se onClick={chiaSeMay} className="inline-flex min-h-[var(--kin-cham-toi-thieu)] min-w-[var(--kin-cham-toi-thieu)] items-center px-2 text-[length:var(--kin-co-goc)] font-medium" style={{ color: "var(--kin-chu-mo)" }}>
          Chia sẻ
        </button>
        <span role="status" className="text-[length:var(--kin-co-phu)]" style={{ color: "var(--kin-chu-mo)" }}>{tb}</span>
      </>
    );
  }
  return (
    <div data-chia-se-bai className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={chepLink} className={kinButtonClass("secondary")}>Sao chép link</button>
      <button type="button" onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url())}`, "_blank", "noopener,noreferrer")} className={kinButtonClass("secondary")}>Facebook</button>
      <button type="button" onClick={chiaSeMay} className={`${kinButtonClass("secondary")} md:hidden`}>Chia sẻ…</button>
      <span role="status" className="text-[length:var(--kin-co-small)]" style={{ color: "var(--kin-chu-mo)" }}>{tb}</span>
    </div>
  );
}
