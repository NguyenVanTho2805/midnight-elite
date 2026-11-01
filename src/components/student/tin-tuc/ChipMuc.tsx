import Link from "next/link";
import { hrefMuc, mauMuc, nhanMuc } from "./kieu";

/** Nhãn chuyên mục (liên kết ?muc=). Có chữ, không chỉ màu. */
export function ChipMuc({ muc, lienKet = true }: { muc: string; lienKet?: boolean }) {
  const m = mauMuc(muc);
  const cls = "inline-flex items-center rounded-[var(--kin-bo-tron)] px-2.5 py-0.5 text-[length:var(--kin-co-phu)] font-semibold";
  const st = { background: m.nen, color: m.chu };
  return lienKet
    ? <Link href={hrefMuc(muc)} className={cls} style={st}>{nhanMuc(muc)}</Link>
    : <span className={cls} style={st}>{nhanMuc(muc)}</span>;
}
