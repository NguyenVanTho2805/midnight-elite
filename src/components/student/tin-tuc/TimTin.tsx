"use client";
// Ô tìm kiếm: lọc tại chỗ trên các bài ĐÃ TẢI (tiêu đề + sapo), không gọi máy chủ.
import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { hrefBai, nhanMuc } from "./kieu";

export interface MucTim { slug: string; title: string; excerpt: string; category: string }

const bo = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase();

export function TimTin({ bai }: { bai: MucTim[] }) {
  const [q, setQ] = useState("");
  const id = useId();
  const kq = useMemo(() => {
    const k = bo(q.trim());
    if (!k) return [];
    return bai.filter((a) => bo(a.title).includes(k) || bo(a.excerpt).includes(k)).slice(0, 8);
  }, [q, bai]);
  return (
    <div className="relative min-w-0">
      <label htmlFor={id} className="sr-only">Tìm bài viết</label>
      <input
        id={id} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm bài viết…" autoComplete="off"
        className="min-h-[var(--kin-cham-toi-thieu)] w-full rounded-[var(--kin-bo-md)] border px-3 text-[length:var(--kin-co-goc)]"
        style={{ borderColor: "var(--kin-vien-o-nhap)", background: "var(--kin-nen-trang)", color: "var(--kin-chu-chinh)" }}
      />
      {q.trim() !== "" && (
        <div role="status" className="absolute inset-x-0 top-full z-10 mt-1 rounded-[var(--kin-bo-lg)] border p-2 shadow-sm" style={{ borderColor: "var(--kin-vien-thuong)", background: "var(--kin-nen-trang)" }}>
          {kq.length === 0
            ? <p className="p-2 text-[length:var(--kin-co-goc)]" style={{ color: "var(--kin-chu-mo)" }}>Không thấy bài nào khớp trong các bài đang hiện. Thử từ khoá khác hoặc chọn chuyên mục.</p>
            : <ul>{kq.map((a) => (
                <li key={a.slug}><Link href={hrefBai(a.slug)} className="block min-h-[var(--kin-cham-toi-thieu)] rounded-[var(--kin-bo-sm)] p-2 text-[length:var(--kin-co-goc)] hover:bg-[var(--kin-nen-re-chuot)]" style={{ color: "var(--kin-chu-chinh)" }}>
                  <span className="font-medium">{a.title}</span><span className="ml-2 text-[length:var(--kin-co-phu)]" style={{ color: "var(--kin-chu-mo)" }}>{nhanMuc(a.category)}</span>
                </Link></li>))}</ul>}
        </div>
      )}
    </div>
  );
}
