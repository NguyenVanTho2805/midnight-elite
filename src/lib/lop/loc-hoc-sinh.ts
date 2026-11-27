// Lọc / tìm / sắp / phân trang danh sách học sinh theo tham số trên URL (?q=&mon=&loai=&lua=&het=&sap=&trang=). Hàm thuần, chép luật `khop` của
// bca/components/quan-ly/danh-sach-hs.tsx (ở đó lọc tại máy khách; KiN lọc ở máy chủ để phân trang 50).
import { boDau } from "./chuan-hoa";

export type OMon = "hoc" | "thu" | "nghi" | null;
export type DongHs = {
  ma_hs: string; ho_ten: string; lua?: { ma: string } | null; sdt_hs?: string | null; sdt_ph?: string | null; gmail?: string | null;
  mon: Record<string, OMon>; tinh_trang: string; thu: { den: string; con_ngay: number } | null; dang_ky: string | null;
};
export const LOAI = { thu: "thu", "chinh-thuc": "hoc", nghi: "nghi" } as const;
export const TEN_LOAI = { thu: "Học thử", "chinh-thuc": "Chính thức", nghi: "Nghỉ" } as const;
export const TEN_HET = { "3": "Hết thử ≤ 3 ngày", "da-het": "Đã hết, chưa quyết" } as const;
export const TEN_SAP = { ten: "Tên", moi: "Mới đăng ký", het: "Hạn thử" } as const;
export const MOI_TRANG = 50;
export type LocHs = { q: string; mon: string | null; loai: keyof typeof LOAI | null; lua: string | null; het: keyof typeof TEN_HET | null; sap: keyof typeof TEN_SAP; trang: number };

const mot = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const trong = <T extends string>(v: string, o: Record<T, unknown>): T | null => (Object.hasOwn(o, v) ? (v as T) : null);

/** Đọc tham số URL; giá trị lạ ⇒ coi như không lọc (không ném lỗi). */
export function docLoc(sp: Record<string, string | string[] | undefined>): LocHs {
  const trang = Number.parseInt(mot(sp.trang), 10);
  return {
    q: mot(sp.q).trim().slice(0, 100), mon: mot(sp.mon) || null, loai: trong(mot(sp.loai), LOAI), lua: mot(sp.lua) || null,
    het: trong(mot(sp.het), TEN_HET), sap: trong(mot(sp.sap), TEN_SAP) ?? "ten", trang: trang >= 1 ? trang : 1,
  };
}

export const daHetThu = (x: DongHs) => x.tinh_trang.startsWith("Hết thử");
export const sapHetThu = (x: DongHs) => !!x.thu && x.thu.con_ngay <= 3 && !Object.values(x.mon).includes("hoc");

/** `ds` đã sắp theo tên. Trả đúng một trang + tổng số em khớp; trang vượt quá thì về trang cuối. */
export function locHocSinh<T extends DongHs>(ds: T[], p: LocHs) {
  const qq = boDau(p.q), so = qq.replace(/\D/g, ""), o = p.loai ? LOAI[p.loai] : null;
  let hien = ds.filter((x) => {
    if ((p.mon || o) && !Object.entries(x.mon).some(([ma, v]) => (!p.mon || ma === p.mon) && (o ? v === o : !!v))) return false;
    if (p.lua && x.lua?.ma !== p.lua) return false;
    if (p.het === "3" && !sapHetThu(x)) return false;
    if (p.het === "da-het" && !daHetThu(x)) return false;
    return !qq || boDau(x.ho_ten).includes(qq) || x.ma_hs.toLowerCase().includes(qq) || (so.length >= 3 && !!(x.sdt_hs?.includes(so) || x.sdt_ph?.includes(so))) || !!x.gmail?.includes(p.q.toLowerCase());
  });
  if (p.sap === "moi") hien = [...hien].sort((a, b) => (b.dang_ky ?? "").localeCompare(a.dang_ky ?? ""));
  if (p.sap === "het") hien = [...hien].sort((a, b) => (a.thu?.den ?? "9").localeCompare(b.thu?.den ?? "9"));
  const soTrang = Math.max(1, Math.ceil(hien.length / MOI_TRANG)), trang = Math.min(p.trang, soTrang), tu = (trang - 1) * MOI_TRANG;
  return { tong: hien.length, trang, soTrang, tu: hien.length ? tu + 1 : 0, den: Math.min(tu + MOI_TRANG, hien.length), hien: hien.slice(tu, tu + MOI_TRANG) };
}

/** Địa chỉ danh sách với bộ lọc `p` (bỏ tham số mặc định để URL gọn). */
export function hrefLoc(goc: string, p: LocHs, doi: Partial<LocHs> = {}) {
  const n = { ...p, trang: 1, ...doi }, q = new URLSearchParams();
  if (n.q) q.set("q", n.q);
  if (n.mon) q.set("mon", n.mon);
  if (n.loai) q.set("loai", n.loai);
  if (n.lua) q.set("lua", n.lua);
  if (n.het) q.set("het", n.het);
  if (n.sap !== "ten") q.set("sap", n.sap);
  if (n.trang > 1) q.set("trang", String(n.trang));
  const s = q.toString();
  return s ? `${goc}?${s}` : goc;
}
