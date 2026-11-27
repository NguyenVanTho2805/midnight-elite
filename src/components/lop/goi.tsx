"use client";
// Dùng chung cho các nút GHI của Lớp ôn: gọi /api/lop/*, dòng lỗi cạnh nút, và thanh báo "đã làm xong + Hoàn tác 10 giây" (KiN lớp bước 6).
// Thanh báo nằm ở layout /admin/lop-on nên vẫn còn sau router.refresh() (hàng vừa xử lý có thể đã biến khỏi danh sách).
import { useEffect, useState, useSyncExternalStore } from "react";
import { KinToast, kinButtonClass } from "@/components/kin";

export type Kq = { ok: boolean; status: number; d: Record<string, unknown> & { error?: string; ma?: string } };
/** `url` luôn viết đủ từ /api/… ở chỗ gọi (t-links đọc được đường dẫn thật). */
export async function goi(method: string, url: string, body?: unknown): Promise<Kq> {
  try {
    const r = await fetch(url, { method, ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }) });
    return { ok: r.ok, status: r.status, d: await r.json().catch(() => ({})) };
  } catch { return { ok: false, status: 0, d: { error: "Mất mạng — chưa lưu được, thử lại khi có mạng." } }; }
}
export const Loi = ({ chu }: { chu: string | null }) => (chu ? <p role="alert" className="mt-2 text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi-dam)] [overflow-wrap:anywhere]">{chu}</p> : null);
export const TOM = "inline-flex min-h-11 cursor-pointer items-center rounded-[var(--kin-bo-md)] px-3 text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-nhan-link)] hover:bg-[var(--kin-nen-re-chuot)]";

type Bao = { id: number; chu: string; loi?: boolean; hoanTac?: () => Promise<Kq>; sauHoanTac?: () => void };
let hien: Bao | null = null, dem = 0;
const nghe = new Set<() => void>();
const dat = (b: Bao | null) => { hien = b; nghe.forEach((f) => f()); };
/** Báo một việc vừa xong. Có `hoanTac` ⇒ kèm nút Hoàn tác trong 10 giây (hạn thật do máy chủ giữ). */
export const baoLop = (b: Omit<Bao, "id">) => dat({ ...b, id: ++dem });

export function LopThongBao() {
  const b = useSyncExternalStore((f) => { nghe.add(f); return () => { nghe.delete(f); }; }, () => hien, () => null);
  const [dang, setDang] = useState(false);
  useEffect(() => {
    if (!b) return;
    const t = setTimeout(() => { if (hien?.id === b.id) dat(null); }, b.hoanTac ? 10_000 : 6_000);
    return () => clearTimeout(t);
  }, [b]);
  if (!b) return null;
  async function hoanTac(x: Bao) {
    setDang(true);
    const k = await x.hoanTac!();
    setDang(false);
    baoLop(k.ok ? { chu: "Đã hoàn tác" } : { chu: k.d.error ?? "Không hoàn tác được", loi: true });
    x.sauHoanTac?.();
  }
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-20 z-[150] flex justify-center sm:bottom-6">
      <div className="pointer-events-auto w-full max-w-[400px]">
        <KinToast tone={b.loi ? "loi" : "xong"} title={b.chu} onClose={() => dat(null)}
          detail={b.hoanTac ? <button type="button" disabled={dang} data-kin-nut className={`${kinButtonClass("secondary")} mt-1`} onClick={() => void hoanTac(b)}>Hoàn tác</button> : undefined} />
      </div>
    </div>
  );
}
