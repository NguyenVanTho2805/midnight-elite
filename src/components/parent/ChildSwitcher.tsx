// PH-05 — chuyển nhanh giữa các Sổ của con ĐÃ MỞ trên máy này. Xem quy tắc ở src/lib/parentChildList.ts:
// mỗi liên kết một em, không gộp dữ liệu, danh sách chỉ nằm trên trình duyệt này và xoá được.
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CHILD_LIST_KEY, parseChildList, rememberChild, serializeChildList, type ChildLink } from "@/lib/parentChildList";

export default function ChildSwitcher({ token, name }: { token: string; name: string }) {
  const [list, setList] = useState<ChildLink[]>([]);
  useEffect(() => {
    let next: ChildLink[] = [];
    try {
      next = rememberChild(parseChildList(localStorage.getItem(CHILD_LIST_KEY)), { token, name });
      localStorage.setItem(CHILD_LIST_KEY, serializeChildList(next));
    } catch { next = [{ token, name }]; } // trình duyệt chặn lưu: vẫn xem được Sổ, chỉ không có danh sách
    Promise.resolve().then(() => setList(next));
  }, [token, name]);

  if (list.length < 2) return null;
  const clear = () => { try { localStorage.removeItem(CHILD_LIST_KEY); } catch { /* bỏ qua */ } setList([]); };
  return (
    <nav aria-label="Chuyển giữa các em" data-testid="child-switcher" className="mb-5">
      <p className="text-xs mb-2" style={{ color: "var(--kin-chu-mo)" }}>Sổ của các em bạn đã mở trên máy này</p>
      <ul className="flex flex-wrap gap-2">
        {list.map(c => {
          const here = c.token === token;
          return (
            <li key={c.token}>
              <Link href={`/so-cua-con/${c.token}`} aria-current={here ? "page" : undefined}
                className="inline-flex items-center min-h-[44px] px-4 rounded-full text-sm font-medium border"
                style={here
                  ? { background: "var(--kin-nhan-nen)", color: "var(--kin-nhan-chu-tren-nen)", borderColor: "var(--kin-nhan-nen)" }
                  : { background: "var(--kin-nen-trang)", color: "var(--kin-chu-chinh)", borderColor: "var(--kin-vien-o-nhap)" }}>
                {c.name}{here ? " · đang xem" : ""}
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs" style={{ color: "var(--kin-chu-mo)" }}>
        Mỗi liên kết chỉ cho xem một em; KiN không gộp số liệu giữa các em. Danh sách chỉ lưu trên máy này.{" "}
        <button type="button" onClick={clear} className="underline min-h-[44px] px-1" style={{ color: "var(--kin-chu-phu)" }}>Xoá danh sách khỏi máy này</button>
      </p>
    </nav>
  );
}
