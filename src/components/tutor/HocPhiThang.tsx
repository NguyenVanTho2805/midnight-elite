// HOCPHI-THEO-BUOI mục 5.3 — bảng học phí theo tháng, dùng chung cho trang gia sư (/lop-cua-toi/hoc-phi/thang) và trang quản trị (/admin/hoc-phi-thang, phòng Quản trị nhúng).
// CHỈ HIỂN THỊ số máy chủ trả (hợp đồng 4.3/4.4): không cộng, không nhân, không tính phần trăm ở đây. Không có tên/ID học sinh ở bất kỳ đâu.
// 1280px+ : bảng 9 cột, dòng tổng cuối bảng. Dưới md: mỗi lớp một thẻ, dòng tổng là thẻ cuối. Ba trạng thái: tải (kin-skel) / lỗi (alert + Thử lại) / rỗng (lời giải thích + liên kết đi tiếp).
"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { KinMoney } from "@/components/kin/MoneyVisibility";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { kinButtonClass } from "@/components/kin/buttonClass";
import { vnd, monthLabel } from "@/components/tutor/shared";
import { FEE_MODE_LABEL, normalizeFeeMode } from "@/lib/tuitionFee";
import { SHEET_MODE_SHORT, isSheetFeeMode } from "@/components/tutor/bangHocPhiTypes";

// ─── Kiểu dữ liệu theo hợp đồng 4.3 (4.4 thêm tutorId/tutorName/byTutor) ───────────────────────────
export interface HocPhiThangRow {
  courseId: string; courseName: string; feeMode: string;
  source: "fee_charge" | "invoice";
  closedSessions: number; students: number;
  tuition: number | null; extra: number;
  prevTuition: number | null; delta: number | null; deltaPct: number | null;
  /** Chỉ trang quản trị (4.4): tên GIA SƯ, không phải học sinh. */
  tutorId?: string; tutorName?: string;
}
export interface HocPhiThangTotals {
  tuition: number; extra: number; prevTuition: number | null; delta: number | null; deltaPct: number | null;
  closedSessions: number; invoiced: number; uninvoiced: number; inCancelledInvoice: number;
  perSession: number; legacyByInvoice: number;
}
export interface HocPhiThangData {
  yearMonth: string; prevYearMonth: string; emptyMonth: boolean;
  rows: HocPhiThangRow[]; totals: HocPhiThangTotals;
}

// ─── Hàm định dạng (chỉ chữ, không tính tiền) ───────────────────────────────────────────────────
const pctText = (p: number) => `${p > 0 ? "+" : p < 0 ? "−" : ""}${Math.abs(p).toFixed(1).replace(".", ",")}%`;
const moneyText = (n: number) => vnd(n); // luôn viết đầy đủ 1.250.000đ, không "tr", không "k"
const signedMoney = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${vnd(Math.abs(n))}`;

/** Chữ chênh lệch so với tháng trước: "+1.200.000đ (+20,0%)" / "Tháng trước chưa có" / "Mới" khi tháng trước 0đ. */
export function deltaText(delta: number | null, pct: number | null): string {
  if (delta == null) return "Tháng trước chưa có";
  return pct == null ? `${signedMoney(delta)} (Mới)` : `${signedMoney(delta)} (${pctText(pct)})`;
}
const deltaTone = (delta: number | null) =>
  delta == null || delta === 0 ? "text-[var(--kin-chu-mo)]" : delta > 0 ? "text-[var(--kin-tt-chu-xong)]" : "text-[var(--kin-tt-chu-loi)]";

/** Tháng kề (không có DB, không phụ thuộc lib máy chủ). */
export function shiftYearMonth(ym: string, by: number): string {
  const [y, m] = ym.split("-").map(Number);
  const i = y * 12 + (m - 1) + by;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
}

function Tuition({ row }: { row: HocPhiThangRow }) {
  if (row.tuition == null) return <span className="text-[var(--kin-chu-mo)]">Chưa lập phiếu</span>;
  return <KinMoney>{moneyText(row.tuition)}</KinMoney>;
}
// HP-LOP-TRUONG: lớp "theo bảng học phí tháng" nhập tay theo bảng, không có buổi đã chốt sinh phí → nhãn ngắn và ô "Buổi đã chốt" hiện "—" (không hứa số buổi nào).
const isSheet = (row: HocPhiThangRow) => row.source !== "invoice" && isSheetFeeMode(row.feeMode);
const modeLabel = (row: HocPhiThangRow) => (row.source === "invoice" ? "Cách cũ, theo phiếu" : isSheet(row) ? SHEET_MODE_SHORT : FEE_MODE_LABEL[normalizeFeeMode(row.feeMode)]);

export interface HocPhiThangProps {
  state: "loading" | "error" | "ok";
  data: HocPhiThangData | null;
  /** Chữ lỗi máy chủ trả (nếu có). */
  errorText?: string | null;
  onRetry: () => void;
  /** Tháng đang xem (YYYY-MM) và tháng mới nhất được phép xem (không cho sang tương lai). */
  ym: string; maxYm: string;
  /** Tạo liên kết đổi tháng (GET ?ym=); trang quản trị truyền hàm riêng để giữ bộ lọc. */
  monthHref: (ym: string) => string;
  csvHref: string;
  /** Liên kết "đi tiếp" của trạng thái rỗng (Lịch của gia sư). */
  emptyHref?: string;
  /** Trang quản trị: hiện cột Gia sư. */
  showTutor?: boolean;
  /** Trang quản trị: nút phụ mỗi lớp (vd "Đổi đơn giá"). */
  rowAction?: (row: HocPhiThangRow) => ReactNode;
}

export default function HocPhiThang(p: HocPhiThangProps) {
  const prevYm = shiftYearMonth(p.ym, -1);
  const nextYm = shiftYearMonth(p.ym, 1);
  const canNext = nextYm <= p.maxYm;
  const nav = "inline-flex items-center justify-center min-h-11 min-w-11 px-3";

  const picker = (
    <nav aria-label="Chọn tháng" className="flex items-center justify-between md:justify-start gap-2 flex-wrap">
      <Link href={p.monthHref(prevYm)} className={`${kinButtonClass("secondary")} ${nav}`} aria-label={`Xem ${monthLabel(prevYm)}`}>← {monthLabel(prevYm)}</Link>
      <span className="px-3 min-h-11 inline-flex items-center font-medium text-[var(--kin-chu-chinh)]" aria-current="date">{monthLabel(p.ym)}</span>
      {canNext
        ? <Link href={p.monthHref(nextYm)} className={`${kinButtonClass("secondary")} ${nav}`} aria-label={`Xem ${monthLabel(nextYm)}`}>{monthLabel(nextYm)} →</Link>
        : <span aria-disabled="true" className={`${nav} rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-nhat)] text-[var(--kin-chu-mo)]`}>Chưa tới tháng sau</span>}
      <a href={p.csvHref} download className={`${kinButtonClass("secondary")} ${nav} md:ml-auto`}>Tải CSV</a>
    </nav>
  );

  let body: ReactNode;
  if (p.state === "loading") {
    body = (
      <div aria-busy="true" aria-label="Đang tải học phí tháng" data-hpt-state="loading" className="space-y-3">
        {[0, 1, 2].map(i => <div key={i} className="h-16 rounded kin-skel kin-skel--soft" />)}
      </div>
    );
  } else if (p.state === "error" || !p.data) {
    body = (
      <div role="alert" data-hpt-state="error" className="py-8 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">
        {p.errorText || "Không tải được bảng học phí tháng này."}{" "}
        <button type="button" className="underline font-medium text-[var(--kin-nhan-link)] min-h-11 px-2" onClick={p.onRetry}>Thử lại</button>
      </div>
    );
  } else if (p.data.emptyMonth || p.data.rows.length === 0) {
    body = (
      <div data-hpt-state="empty">
        <KinEmptyState title="Tháng này chưa có buổi nào được chốt"
          action={p.emptyHref ? <Link href={p.emptyHref} className={kinButtonClass("secondary")}>Mở Lịch</Link> : undefined}>
          Bấm Đã dạy xong ở trang buổi để học phí được tính.
        </KinEmptyState>
      </div>
    );
  } else {
    const { rows, totals } = p.data;
    const th = "px-3 py-3 text-left font-medium text-[var(--kin-chu-mo)]";
    const thR = "px-3 py-3 text-right font-medium text-[var(--kin-chu-mo)]";
    const td = "px-3 py-3 align-top";
    const tdR = "px-3 py-3 align-top text-right tabular-nums";
    body = (
      <div data-hpt-state="ok">
        {/* 1280px+ : bảng */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">
            <caption className="sr-only">Học phí {monthLabel(p.data.yearMonth)} theo từng lớp</caption>
            <thead>
              <tr className="bg-[var(--kin-nen-bang)]">
                <th scope="col" className={th}>Lớp</th>
                {p.showTutor && <th scope="col" className={th}>Gia sư</th>}
                <th scope="col" className={th}>Cách tính</th>
                <th scope="col" className={thR}>Buổi đã chốt</th>
                <th scope="col" className={thR}>Học sinh</th>
                <th scope="col" className={thR}>Học phí tháng</th>
                <th scope="col" className={thR}>Phí khác</th>
                <th scope="col" className={thR}>Tháng trước</th>
                <th scope="col" className={thR}>Chênh</th>
                {p.rowAction && <th scope="col" className={th}><span className="sr-only">Thao tác</span></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={`${r.tutorId ?? ""}:${r.courseId}`} data-hpt-row className="border-t border-[var(--kin-vien-nhat)]">
                  <th scope="row" className={`${td} text-left font-medium`}>{r.courseName}</th>
                  {p.showTutor && <td className={td}>{r.tutorName ?? ""}</td>}
                  <td className={`${td} text-[var(--kin-chu-mo)]`}>{modeLabel(r)}</td>
                  <td className={tdR}>{isSheet(r) ? <span className="text-[var(--kin-chu-mo)]">—</span> : r.closedSessions}</td>
                  <td className={tdR}>{r.students}</td>
                  <td className={`${tdR} font-medium`}><Tuition row={r} /></td>
                  <td className={tdR}><KinMoney>{moneyText(r.extra)}</KinMoney></td>
                  <td className={tdR}>{r.prevTuition == null ? <span className="text-[var(--kin-chu-mo)]">—</span> : <KinMoney>{moneyText(r.prevTuition)}</KinMoney>}</td>
                  <td className={`${tdR} ${deltaTone(r.delta)}`}>{r.delta == null ? "Tháng trước chưa có" : <KinMoney>{deltaText(r.delta, r.deltaPct)}</KinMoney>}</td>
                  {p.rowAction && <td className={td}>{p.rowAction(r)}</td>}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-bang)] font-medium" data-hpt-total>
                <th scope="row" className={`${td} text-left`} colSpan={p.showTutor ? 3 : 2}>Tổng</th>
                <td className={tdR}>{totals.closedSessions}</td>
                <td className={tdR} />
                <td className={tdR}><KinMoney>{moneyText(totals.tuition)}</KinMoney></td>
                <td className={tdR}><KinMoney>{moneyText(totals.extra)}</KinMoney></td>
                <td className={tdR}>{totals.prevTuition == null ? "—" : <KinMoney>{moneyText(totals.prevTuition)}</KinMoney>}</td>
                <td className={`${tdR} ${deltaTone(totals.delta)}`}>{totals.delta == null ? "Tháng trước chưa có" : <KinMoney>{deltaText(totals.delta, totals.deltaPct)}</KinMoney>}</td>
                {p.rowAction && <td />}
              </tr>
            </tfoot>
          </table>
        </div>

        {/* dưới md: thẻ */}
        <ul className="md:hidden space-y-3" aria-label={`Học phí ${monthLabel(p.data.yearMonth)} theo từng lớp`}>
          {rows.map(r => (
            <li key={`${r.tutorId ?? ""}:${r.courseId}`} data-hpt-card className="p-4 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-nhat)] bg-[var(--kin-nen-trang)]">
              <p className="font-medium text-[var(--kin-chu-chinh)] break-words">{r.courseName}</p>
              <p className="text-[length:var(--kin-co-phu)] text-[var(--kin-chu-mo)]">{modeLabel(r)}{p.showTutor && r.tutorName ? ` · ${r.tutorName}` : ""}</p>
              <p className="pt-2 text-[length:var(--kin-co-tieu-de)] font-medium tabular-nums text-[var(--kin-chu-chinh)]"><Tuition row={r} /></p>
              <p className="pt-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">
                {isSheet(r) ? "Nhập từ bảng học phí tháng" : `${r.closedSessions} buổi đã chốt`} · {r.students} học sinh{r.extra > 0 ? <> · phí khác <KinMoney>{moneyText(r.extra)}</KinMoney></> : null}
              </p>
              <p className={`pt-1 text-[length:var(--kin-co-goc)] tabular-nums ${deltaTone(r.delta)}`}>
                {r.delta == null ? "Tháng trước chưa có" : <>So với tháng trước: <KinMoney>{deltaText(r.delta, r.deltaPct)}</KinMoney></>}
              </p>
              {p.rowAction && <div className="pt-3">{p.rowAction(r)}</div>}
            </li>
          ))}
          <li data-hpt-total-card className="p-4 rounded-[var(--kin-bo-md)] border-2 border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-bang)]">
            <p className="font-medium text-[var(--kin-chu-chinh)]">Tổng {monthLabel(p.data.yearMonth)}</p>
            <p className="pt-2 text-[length:var(--kin-co-tieu-de)] font-medium tabular-nums text-[var(--kin-chu-chinh)]"><KinMoney>{moneyText(totals.tuition)}</KinMoney></p>
            <p className="pt-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{totals.closedSessions} buổi đã chốt{totals.extra > 0 ? <> · phí khác <KinMoney>{moneyText(totals.extra)}</KinMoney></> : null}</p>
            <p className={`pt-1 text-[length:var(--kin-co-goc)] tabular-nums ${deltaTone(totals.delta)}`}>
              {totals.delta == null ? "Tháng trước chưa có" : <>So với tháng trước: <KinMoney>{deltaText(totals.delta, totals.deltaPct)}</KinMoney></>}
            </p>
          </li>
        </ul>

        {/* tách hai nguồn để không trộn thầm (3.4) */}
        <dl className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-3 text-[length:var(--kin-co-goc)]" data-hpt-split>
          <div><dt className="text-[var(--kin-chu-mo)]">Theo buổi</dt><dd className="font-medium tabular-nums text-[var(--kin-chu-chinh)]"><KinMoney>{moneyText(totals.perSession)}</KinMoney></dd></div>
          <div><dt className="text-[var(--kin-chu-mo)]">Cách cũ (theo phiếu)</dt><dd className="font-medium tabular-nums text-[var(--kin-chu-chinh)]"><KinMoney>{moneyText(totals.legacyByInvoice)}</KinMoney></dd></div>
          <div><dt className="text-[var(--kin-chu-mo)]">Cộng</dt><dd className="font-medium tabular-nums text-[var(--kin-chu-chinh)]"><KinMoney>{moneyText(totals.tuition)}</KinMoney></dd></div>
          <div><dt className="text-[var(--kin-chu-mo)]">Đã vào phiếu</dt><dd className="tabular-nums text-[var(--kin-chu-chinh)]"><KinMoney>{moneyText(totals.invoiced)}</KinMoney></dd></div>
          <div><dt className="text-[var(--kin-chu-mo)]">Chưa vào phiếu</dt><dd className="tabular-nums text-[var(--kin-chu-chinh)]"><KinMoney>{moneyText(totals.uninvoiced)}</KinMoney></dd></div>
          {totals.inCancelledInvoice > 0 && <div><dt className="text-[var(--kin-chu-mo)]">Nằm trong phiếu đã huỷ</dt><dd className="tabular-nums text-[var(--kin-chu-chinh)]"><KinMoney>{moneyText(totals.inCancelledInvoice)}</KinMoney></dd></div>}
        </dl>
        <p className="mt-4 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">
          Tính từ các buổi đã chốt, trước học bổng và giảm giá.<br />Lớp cũ lấy theo phiếu đã lập.<br />Lớp theo bảng học phí tháng lấy số cô đã nhập ở bảng, đã trừ học bổng và giảm trừ.
        </p>
      </div>
    );
  }

  return (
    <div data-hocphi-thang>
      <div className="pb-5">{picker}</div>
      {body}
    </div>
  );
}
