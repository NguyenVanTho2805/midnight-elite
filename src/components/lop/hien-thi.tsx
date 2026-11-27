// Mảnh hiển thị dùng chung của các màn Lớp ôn (Server Component được). Màu môn / phép / nền đêm: token --kin-lop-* (cuối src/app/kin-site.css).
import type { ReactNode } from "react";
import { KinPanel, kinButtonClass } from "@/components/kin";

export const LOP_GOC = "/admin/lop-on";
export const mauMon = (ma: string | undefined) => `var(--kin-lop-mon-${ma ?? "x"}, var(--kin-chu-mo))`;

/** Chấm màu môn (trang trí; tên môn luôn đi kèm bằng chữ). */
export function MonCham({ ma }: { ma: string | undefined }) {
  return <span aria-hidden className="inline-block size-2 shrink-0 rounded-full" style={{ background: mauMon(ma) }} />;
}

const TEN_O = { hoc: "chính thức", thu: "học thử", nghi: "đã nghỉ" } as const;
/** Bốn ô môn của một em: tô màu = đang học / thử, viền = đã nghỉ hoặc chưa ghi danh. Chữ đầy đủ nằm trong aria-label. */
export function MonHuyHieu({ mon, o }: { mon: { ma: string; ten: string }[]; o: Record<string, "hoc" | "thu" | "nghi" | null> }) {
  return (
    <ul className="flex gap-1" aria-label={mon.map((m) => `${m.ten}: ${o[m.ma] ? TEN_O[o[m.ma]!] : "chưa ghi danh"}`).join(", ")}>
      {mon.map((m) => {
        const bat = o[m.ma] === "hoc" || o[m.ma] === "thu";
        return (
          <li key={m.ma} aria-hidden title={`${m.ten}: ${o[m.ma] ? TEN_O[o[m.ma]!] : "chưa ghi danh"}`}
            className="inline-flex size-6 items-center justify-center rounded-full border text-[length:var(--kin-co-caption)] font-semibold"
            style={bat ? { background: mauMon(m.ma), borderColor: mauMon(m.ma), color: "var(--kin-nen-trang)", opacity: o[m.ma] === "thu" ? 0.72 : 1 }
              : { borderColor: "var(--kin-vien-thuong)", color: "var(--kin-chu-mo)", background: "var(--kin-nen-bang)" }}>
            {m.ten.slice(0, 1)}
          </li>
        );
      })}
    </ul>
  );
}

type Tone = "xong" | "cho" | "loi" | "thu" | "mo";
const NHAN: Record<Tone, { background: string; color: string }> = {
  xong: { background: "var(--kin-tt-nen-xong)", color: "var(--kin-tt-chu-xong)" },
  cho: { background: "var(--kin-tt-nen-cho)", color: "var(--kin-tt-chu-cho)" },
  loi: { background: "var(--kin-tt-nen-loi)", color: "var(--kin-tt-chu-loi-dam)" },
  thu: { background: "var(--kin-nhan-nen-nhat)", color: "var(--kin-nhan-chu-tren-nhat)" },
  mo: { background: "var(--kin-nen-re-chuot)", color: "var(--kin-chu-phu)" },
};
export function Nhan({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className="inline-flex min-h-6 items-center whitespace-nowrap rounded-full px-2.5 text-[length:var(--kin-co-phu)] font-medium tabular-nums" style={NHAN[tone]}>{children}</span>;
}

/** Nhãn tình trạng một em (chữ lấy từ quy tắc tinhTrang + hạn thử; màu chỉ phụ hoạ). */
export function NhanTinhTrang({ tinhTrang, thu }: { tinhTrang: string; thu: { den: string; con_ngay: number } | null }) {
  if (tinhTrang === "Đang học") return <Nhan tone="xong">Chính thức</Nhan>;
  if (thu) return <Nhan tone={thu.con_ngay <= 3 ? "cho" : "thu"}>Thử · còn {thu.con_ngay} ngày</Nhan>;
  if (tinhTrang.startsWith("Hết thử")) return <Nhan tone="loi">{tinhTrang.replace(" – hỏi em", "")}</Nhan>;
  return <Nhan tone="mo">{tinhTrang}</Nhan>;
}

/** Khối không tải được: nói rõ khối nào, có lối thử lại (tải lại đúng trang đang xem). */
export function KhoiLoi({ ten, href }: { ten: string; href: string }) {
  return (
    <KinPanel variant="loi" role="alert">
      <p className="font-medium text-[var(--kin-tt-chu-loi-dam)]">Chưa tải được {ten}</p>
      <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">Máy chủ gặp lỗi khi đọc dữ liệu. Các phần khác của trang không bị ảnh hưởng.</p>
      {/* <a> thường để tải lại cả trang (Link cùng địa chỉ không gọi lại máy chủ). */}
      <a href={href} className={`${kinButtonClass("secondary")} mt-3`}>Thử lại</a>
    </KinPanel>
  );
}

/** Chạy một truy vấn của khối; lỗi ⇒ ghi log máy chủ, trả null để khối tự hiện KhoiLoi (không sập cả trang). */
export async function thuTai<T>(ten: string, f: () => Promise<T>): Promise<T | null> {
  try { return await f(); } catch (e) { console.error(`lop-on: không tải được ${ten}`, e); return null; }
}

export const lienKet = "inline-flex min-h-11 items-center font-medium text-[var(--kin-nhan-link)] hover:underline";
