import Link from "next/link";
import { THANH_MUC, hrefMuc } from "./kieu";

/** Thanh chuyên mục: các liên kết ?muc= (chia sẻ/SEO được), cuộn ngang trên điện thoại. */
export function ThanhChuyenMuc({ muc }: { muc: string }) {
  return (
    <nav aria-label="Chuyên mục tin tức" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max min-w-full gap-2 sm:w-auto sm:flex-wrap">
        {THANH_MUC.map(({ muc: m, nhan }) => {
          const dang = m === muc;
          return (
            <li key={m || "tat-ca"}>
              <Link
                href={hrefMuc(m)} aria-current={dang ? "page" : undefined}
                className="inline-flex min-h-[var(--kin-cham-toi-thieu)] items-center whitespace-nowrap rounded-[var(--kin-bo-md)] border px-4 text-[length:var(--kin-co-goc)] font-medium"
                style={dang
                  ? { background: "var(--kin-nhan-nen)", color: "var(--kin-nhan-chu-tren-nen)", borderColor: "transparent" }
                  : { background: "var(--kin-nen-trang)", color: "var(--kin-chu-phu)", borderColor: "var(--kin-vien-thuong)" }}
              >{nhan}</Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
