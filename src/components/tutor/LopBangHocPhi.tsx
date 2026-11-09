// HP-LOP-TRUONG — nội dung tab "Học phí" của lớp tính học phí THEO BẢNG HỌC PHÍ THÁNG (feeMode = "monthly_sheet"), mục 5 của đặc tả.
// Máy rộng (md+): bảng, mỗi em một dòng, dòng tổng dính cuối; bấm tên em → panel sửa ở cột phải (không hộp thoại). Điện thoại: mỗi em một THẺ, panel là cả màn.
// Giao diện CHỈ HIỂN THỊ: mọi số tiền do máy chủ tính (hocPhiSheet.ts), ở đây không cộng / nhân. Chữ kỳ dùng `period.label` máy chủ trả.
// Ba trạng thái: tải (khung xương) / lỗi (role=alert + Thử lại) / rỗng (3 loại: chưa đặt bảng bậc · lớp chưa có học sinh · tháng chưa nhập).
// `readOnly`: quản trị xem trong trang quản khoá — không nút ghi, không panel. Giao diện sửa cho quản trị chưa làm (quản trị dùng được API).
// Cũng xuất `SheetEnableOffer`: lời mời bật chế độ này cho lớp cũ CHƯA có tiền (chỉ hiện khi máy chủ báo canEnable).
"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { KinButton } from "@/components/kin";
import { kinButtonClass } from "@/components/kin/buttonClass";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinCallout } from "@/components/kin/Callout";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinPanel } from "@/components/kin/Panel";
import { KinStatus } from "@/components/kin/Status";
import { KinMoney } from "@/components/kin/MoneyVisibility";
import { Badge, callApi, invoiceTone } from "@/components/tutor/shared";
import BangHocPhiCauHinh from "@/components/tutor/BangHocPhiCauHinh";
import BangHocPhiDong from "@/components/tutor/BangHocPhiDong";
import BangHocPhiChu from "@/components/tutor/BangHocPhiChu";
import {
  YM_RANGE_MONTHS, capFirst, currentYmVn, isYm, normConfig, normSheet, periodText, sessionsText, shiftYm, sheetErrorText, sourceShort, useIsWide, useMinWidth, vndText,
  type SheetConfig, type SheetData, type SheetRow,
} from "@/components/tutor/bangHocPhiTypes";

type Load = { state: "loading" } | { state: "error"; text: string } | { state: "notsheet" } | { state: "ok"; data: SheetData };
type Panel = { ym: string; kind: "config" } | { ym: string; kind: "row"; studentId: string };

const apiBase = (courseId: string) => `/api/tutor/lop/${encodeURIComponent(courseId)}/bang-hoc-phi`;
const Money = ({ n }: { n: number }) => <KinMoney>{vndText(n)}</KinMoney>;
const dash = <span className="text-[var(--kin-chu-mo)]">—</span>;

export default function LopBangHocPhi({ courseId, readOnly = false }: { courseId: string; readOnly?: boolean }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const ymParam = sp.get("ym");
  const ymReq = isYm(ymParam) ? ymParam : null;
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [tick, setTick] = useState(0);
  const [panel, setPanel] = useState<Panel | null>(null);
  const silent = useRef(false);
  const wide = useIsWide();
  const split = useMinWidth(1024);

  useEffect(() => {
    let alive = true;
    if (!silent.current) setLoad({ state: "loading" });
    silent.current = false;
    callApi<Record<string, unknown> & { code?: string }>(`${apiBase(courseId)}${ymReq ? `?ym=${ymReq}` : ""}`).then(r => {
      if (!alive) return;
      if (r.ok) setLoad({ state: "ok", data: normSheet(r.data, ymReq ?? "") });
      else if (r.status === 409 && r.data.code === "NOT_SHEET_MODE") setLoad({ state: "notsheet" });
      else setLoad({ state: "error", text: sheetErrorText(r.status, r.data) });
    });
    return () => { alive = false; };
  }, [courseId, ymReq, tick]);
  const retry = useCallback(() => setTick(t => t + 1), []);
  /** Tải lại âm thầm sau khi lưu: giữ bảng cũ trên màn tới khi số mới về (không nháy khung xương). */
  const refresh = useCallback(() => { silent.current = true; setTick(t => t + 1); }, []);

  if (load.state === "loading") {
    return (
      <div aria-busy="true" aria-label="Đang tải bảng học phí tháng" data-bh-state="loading" className="space-y-3">
        <div className="h-16 rounded kin-skel kin-skel--soft" />
        {[0, 1, 2, 3].map(i => <div key={i} className="h-14 rounded kin-skel kin-skel--soft" />)}
      </div>
    );
  }
  if (load.state === "error") {
    return (
      <div role="alert" data-bh-state="error" className="py-8 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">
        {load.text}{" "}
        <button type="button" className="underline font-medium text-[var(--kin-nhan-link)] min-h-11 px-2" onClick={retry}>Thử lại</button>
      </div>
    );
  }
  if (load.state === "notsheet") {
    return (
      <div role="status" data-bh-state="notsheet" className="max-w-xl">
        <KinEmptyState title="Lớp này chưa tính học phí theo bảng tháng">Cách tính học phí của lớp được chọn lúc tạo lớp. Cô tải lại trang nếu vừa đổi.</KinEmptyState>
      </div>
    );
  }

  const data = load.data;
  const ym = data.yearMonth;
  const open = panel && panel.ym === ym ? panel : null;
  const closePanel = () => setPanel(null);
  const onSaved = () => { setPanel(null); refresh(); };
  const cfg = data.config;
  const hasRows = data.rows.some(r => r.filled);
  const unit = (data.period?.startDay ?? 1) > 1 ? "kỳ" : "tháng";
  const nowYm = data.currentYearMonth ?? currentYmVn();
  const minYm = shiftYm(nowYm, -YM_RANGE_MONTHS), maxYm = shiftYm(nowYm, YM_RANGE_MONTHS);
  const monthHref = (target: string) => { const q = new URLSearchParams(sp.toString()); q.set("ym", target); return `${pathname}?${q.toString()}`; };
  const nhapHref = `/lop-cua-toi/${encodeURIComponent(courseId)}/bang-hoc-phi/nhap?ym=${ym}`;
  const navBtn = `${kinButtonClass("secondary")} min-w-11`;

  const configPanel = (
    <KinPanel className="p-[var(--kin-kc-8)]">
      <BangHocPhiCauHinh courseId={courseId} config={cfg} suggested={data.suggestedConfig} hasRows={hasRows} onSaved={onSaved} onClose={closePanel} />
    </KinPanel>
  );
  const rowOf = open?.kind === "row" ? data.rows.find(r => r.studentId === open.studentId) ?? null : null;
  const rowPanel = rowOf && cfg ? (
    <KinPanel className="p-[var(--kin-kc-8)]">
      <BangHocPhiDong key={rowOf.studentId + ym} courseId={courseId} ym={ym} periodLabel={periodText(data.period, ym)} config={cfg} row={rowOf} readOnly={readOnly} onSaved={onSaved} onClose={closePanel} />
    </KinPanel>
  ) : null;
  const sidePanel = open?.kind === "config" ? configPanel : rowPanel;

  // Điện thoại / máy hẹp: panel là CẢ MÀN (không hộp thoại nhỏ), đóng thì về bảng.
  if (sidePanel && !split) return <div data-bh-tab data-bh-panel-full>{sidePanel}</div>;

  const openRow = (r: SheetRow) => { if (!readOnly && (!r.left || r.filled)) setPanel({ ym, kind: "row", studentId: r.studentId }); };

  const nameCell = (r: SheetRow) => (
    <>
      {readOnly || !cfg || (r.left && !r.filled) // em đã rời lớp còn dòng: mở panel CHỈ-GỠ (máy chủ không nhận sửa, vẫn cho gỡ)
        ? <span className="font-medium break-words">{r.name}</span>
        : <button type="button" data-bh-row={r.studentId} onClick={() => openRow(r)} aria-label={`Sửa học phí của ${r.name}`} className="inline-flex items-center min-h-11 text-left font-medium text-[var(--kin-nhan-link)] hover:underline break-words">{r.name}</button>}
      {r.left && <span className="block text-[length:var(--kin-co-phu)] font-normal text-[var(--kin-chu-mo)]">Đã rời lớp</span>}
      {r.warnings.map((w, i) => <span key={i} className="block text-[length:var(--kin-co-phu)] font-normal text-[var(--kin-tt-chu-cho)]"><BangHocPhiChu text={w} /></span>)}
    </>
  );
  const invoiceCell = (r: SheetRow) => {
    if (r.invoice) {
      const i = r.invoice;
      return (
        <div className="space-y-0.5">
          <p><span className="tabular-nums">{i.code}</span> <Badge tone={invoiceTone(i.status)}>{i.statusLabel}</Badge></p>
          {i.remaining != null && <p className="text-[var(--kin-chu-mo)]">Còn lại <Money n={i.remaining} /></p>}
        </div>
      );
    }
    if (r.locked) return <KinStatus tone="mo">Đã vào phiếu</KinStatus>;
    return r.filled ? <span className="text-[var(--kin-chu-mo)]">Chưa lập phiếu</span> : dash;
  };
  const netCell = (r: SheetRow) => {
    if (!r.filled || r.net == null) return <span className="text-[var(--kin-chu-mo)]">Chưa nhập</span>;
    return (
      <>
        <Money n={r.net} />
        {r.net === 0 && <span className="block text-[length:var(--kin-co-phu)] font-normal text-[var(--kin-tt-chu-cho)]">Không tạo khoản phí</span>}
      </>
    );
  };

  const th = "px-3 py-3 text-left font-medium text-[var(--kin-chu-mo)] align-bottom";
  const thR = "px-3 py-3 text-right font-medium text-[var(--kin-chu-mo)] align-bottom";
  const td = "px-3 py-1 align-top";
  const tdR = "px-3 py-1 align-top text-right tabular-nums";
  const subjects = cfg?.subjects ?? [];

  const table = (
    <div className="overflow-x-auto" data-bh-table>
      <table className="w-full text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">
        <caption className="sr-only">Học phí {periodText(data.period, ym)} theo từng em</caption>
        <thead>
          <tr className="bg-[var(--kin-nen-bang)]">
            <th scope="col" className={th}>Họ tên</th>
            {subjects.map(s => <th key={s} scope="col" className={thR}>{s}<span className="sr-only"> (số buổi)</span></th>)}
            <th scope="col" className={thR}>Số môn</th>
            <th scope="col" className={thR}>Miễn</th>
            <th scope="col" className={thR}>Đơn giá áp</th>
            <th scope="col" className={thR}>Học bổng</th>
            <th scope="col" className={thR}>Giảm trừ</th>
            <th scope="col" className={thR}>Phải đóng</th>
            <th scope="col" className={th}>Phiếu</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map(r => (
            <tr key={r.studentId} data-bh-tr className={`border-t border-[var(--kin-vien-nhat)] ${open?.kind === "row" && open.studentId === r.studentId ? "bg-[var(--kin-nen-nhan)]" : ""}`}>
              <th scope="row" className={`${td} text-left`}>{nameCell(r)}</th>
              {subjects.map(s => <td key={s} className={`${tdR} py-3`}>{r.filled ? (r.sessions[s] ?? 0) : dash}</td>)}
              <td className={`${tdR} py-3`}>
                {r.filled && r.subjectCount != null ? <>{r.subjectCount}{sourceShort(r.subjectCountSource) && <span className="block text-[length:var(--kin-co-phu)] text-[var(--kin-chu-mo)]">{sourceShort(r.subjectCountSource)}</span>}</> : dash}
              </td>
              <td className={`${tdR} py-3`}>{r.filled ? (r.freeSessions ?? 0) : dash}</td>
              <td className={`${tdR} py-3`}>{r.filled && r.unitRate != null ? <><Money n={r.unitRate} /><span className="block text-[length:var(--kin-co-phu)] text-[var(--kin-chu-mo)]">{r.rateOverride != null ? "đơn giá riêng" : "theo bậc"}</span></> : dash}</td>
              <td className={`${tdR} py-3`}>{r.filled ? <Money n={r.scholarship ?? 0} /> : dash}</td>
              <td className={`${tdR} py-3`}>{r.filled ? <Money n={r.discount ?? 0} /> : dash}</td>
              <td className={`${tdR} py-3 font-medium`}>{netCell(r)}</td>
              <td className={`${td} py-3`}>{invoiceCell(r)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr data-bh-total className="border-t-2 border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-bang)] font-medium">
            <th scope="row" colSpan={subjects.length + 6} className="px-3 py-3 text-left">Tổng Phải đóng · {data.totals.filled} em đã nhập, {data.totals.unfilled} em chưa nhập</th>
            <td className={`${tdR} py-3`}><Money n={data.totals.net} /></td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );

  const cards = (
    <ul className="space-y-3" aria-label={`Học phí ${periodText(data.period, ym)} theo từng em`} data-bh-cards>
      {data.rows.map(r => (
        <li key={r.studentId} data-bh-card className="p-4 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-nhat)] bg-[var(--kin-nen-trang)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 text-[length:var(--kin-co-body)]">{nameCell(r)}</div>
            <p className="text-right text-[length:var(--kin-co-tieu-de)] font-medium tabular-nums text-[var(--kin-chu-chinh)] flex-shrink-0">{netCell(r)}</p>
          </div>
          {r.filled && (
            <p className="pt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)] break-words">
              {sessionsText(r.sessions, subjects)}{(r.freeSessions ?? 0) > 0 ? ` · miễn ${r.freeSessions} buổi` : ""}
              {r.subjectCount != null ? ` · ${r.subjectCount} môn${sourceShort(r.subjectCountSource) ? ` (${sourceShort(r.subjectCountSource)})` : ""}` : ""}
            </p>
          )}
          <div className="pt-2 text-[length:var(--kin-co-goc)]">{invoiceCell(r)}</div>
        </li>
      ))}
      <li data-bh-total-card className="p-4 rounded-[var(--kin-bo-md)] border-2 border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-bang)]">
        <p className="font-medium text-[var(--kin-chu-chinh)]">Tổng Phải đóng</p>
        <p className="pt-1 text-[length:var(--kin-co-tieu-de)] font-medium tabular-nums text-[var(--kin-chu-chinh)]"><Money n={data.totals.net} /></p>
        <p className="pt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{data.totals.filled} em đã nhập, {data.totals.unfilled} em chưa nhập</p>
      </li>
    </ul>
  );

  let body;
  if (!cfg) {
    body = (
      <div data-bh-state="empty-config">
        <KinEmptyState title="Cô chưa đặt bảng bậc"
          action={readOnly ? undefined : <KinButton onClick={() => setPanel({ ym, kind: "config" })}>Đặt bảng bậc</KinButton>}>
          {readOnly ? "Chủ lớp chưa đặt bảng bậc cho lớp này." : `Đặt một lần, dùng cho mọi ${unit}.${data.suggestedConfig ? " KiN điền sẵn từ lớp trước của cô, cô sửa được." : ""}`}
        </KinEmptyState>
      </div>
    );
  } else if (data.rows.length === 0) {
    body = (
      <div data-bh-state="empty-students">
        <KinEmptyState title="Lớp chưa có học sinh"
          action={readOnly ? undefined : <a href={`/lop-cua-toi/${encodeURIComponent(courseId)}?tab=hoc-sinh`} className={kinButtonClass("secondary")}>Mở tab Học sinh</a>}>
          {readOnly ? "Lớp chưa có học sinh nên chưa có học phí để xem." : "Thêm học sinh rồi quay lại để nhập học phí."}
        </KinEmptyState>
      </div>
    );
  } else {
    body = (
      <div data-bh-state="ok" className="space-y-4">
        {!hasRows && (
          <div role="status" data-bh-empty-month>
            <KinCallout title={`${capFirst(periodText(data.period, ym))} chưa có học phí`}>
              {readOnly ? "Chủ lớp chưa nhập học phí kỳ này." : "Tải mẫu Excel hoặc nhập từng em (bấm tên em trong bảng)."}
            </KinCallout>
          </div>
        )}
        {wide ? table : cards}
        <p className="text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">
          Số ở bảng này là số Phải đóng, đã trừ học bổng và giảm trừ (ở Học phí theo tháng, lớp theo buổi được tính trước giảm).
          Học phí đã vào phiếu thì sửa số tiền ngay trên phiếu, ở Học phí và đối soát.
        </p>
        {!readOnly && <Link href="/lop-cua-toi/hoc-phi" className={kinButtonClass("secondary")}>Mở Học phí và đối soát để lập phiếu</Link>}
      </div>
    );
  }

  const main = (
    <div className="min-w-0 space-y-[var(--kin-cach-muc)]">
      {cfg && (
        <section aria-labelledby="bh-bac-t" data-bh-tiers>
          <KinPanel variant="nhan" className="p-[var(--kin-kc-8)]">
            <KinSectionHead id="bh-bac-t" title="Bảng bậc của lớp" aside={readOnly ? undefined : <button type="button" onClick={() => setPanel({ ym, kind: "config" })} className="min-h-11 px-2 underline text-[var(--kin-nhan-link)]">Sửa bảng bậc</button>} />
            <p className="pt-3 text-[length:var(--kin-co-goc)] leading-6 text-[var(--kin-chu-chinh)] break-words">
              {cfg.tiers.map((t, i) => <span key={i}>{i > 0 ? " · " : ""}{t.subjects} môn <Money n={t.rate} /></span>)}
              {cfg.subjects.length > 0 && <span> · Môn: {cfg.subjects.join(", ")}</span>}
            </p>
          </KinPanel>
        </section>
      )}

      {cfg && (
        <nav aria-label={`Chọn ${unit}`} className="flex flex-col gap-3 md:flex-row md:items-center md:flex-wrap">
          <div className="flex items-center justify-between md:justify-start gap-2">
            {ym > minYm
              ? <Link href={monthHref(shiftYm(ym, -1))} scroll={false} className={navBtn} aria-label={`Xem ${unit} trước`}>←<span className="hidden sm:inline"> {capFirst(unit)} trước</span></Link>
              : <span aria-disabled="true" className={`${navBtn} opacity-45`}>←<span className="hidden sm:inline"> {capFirst(unit)} trước</span></span>}
            <span aria-current="date" data-bh-ky className="px-2 min-h-11 inline-flex flex-1 md:flex-none items-center justify-center font-medium text-[var(--kin-chu-chinh)] text-center">{capFirst(periodText(data.period, ym))}</span>
            {ym < maxYm
              ? <Link href={monthHref(shiftYm(ym, 1))} scroll={false} className={navBtn} aria-label={`Xem ${unit} sau`}><span className="hidden sm:inline">{capFirst(unit)} sau </span>→</Link>
              : <span aria-disabled="true" className={`${navBtn} opacity-45`}><span className="hidden sm:inline">{capFirst(unit)} sau </span>→</span>}
          </div>
          {!readOnly && (
            <div className="flex flex-col sm:flex-row gap-2 md:ml-auto">
              <a href={`${apiBase(courseId)}/mau?ym=${ym}`} download className={`${kinButtonClass("secondary")} w-full sm:w-auto`}>Tải mẫu Excel</a>
              <Link href={nhapHref} className={`${kinButtonClass("primary")} w-full sm:w-auto`}>Nhập từ Excel / Google Sheet</Link>
            </div>
          )}
        </nav>
      )}

      {body}
    </div>
  );

  if (sidePanel) {
    return (
      <div data-bh-tab className="grid lg:grid-cols-[minmax(0,1fr)_minmax(340px,400px)] gap-x-[var(--kin-cach-cot)] gap-y-[var(--kin-cach-muc)] items-start">
        {main}
        <aside aria-label="Sửa học phí" data-bh-panel className="min-w-0 lg:sticky lg:top-4">{sidePanel}</aside>
      </div>
    );
  }
  return <div data-bh-tab>{main}</div>;
}

/** Lời mời bật "Theo bảng học phí tháng" cho lớp cũ / lớp theo buổi CHƯA có học phí nào (máy chủ báo canEnable). Không hiện gì khi không bật được hoặc lỗi — đây chỉ là lối phụ. */
export function SheetEnableOffer({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [s, setS] = useState<{ state: "probing" } | { state: "none" } | { state: "offer"; suggested: SheetConfig | null } | { state: "form"; suggested: SheetConfig | null }>({ state: "probing" });
  useEffect(() => {
    let alive = true;
    callApi<Record<string, unknown> & { code?: string }>(apiBase(courseId)).then(r => {
      if (!alive) return;
      if (r.status === 409 && r.data.code === "NOT_SHEET_MODE" && r.data.canEnable === true) setS({ state: "offer", suggested: normConfig(r.data.suggestedConfig) });
      else setS({ state: "none" });
    });
    return () => { alive = false; };
  }, [courseId]);
  if (s.state === "probing" || s.state === "none") return null;
  if (s.state === "form") {
    return (
      <KinPanel className="p-[var(--kin-kc-8)] max-w-3xl" data-bh-enable>
        <BangHocPhiCauHinh courseId={courseId} config={null} suggested={s.suggested} enable onSaved={() => router.refresh()} onClose={() => setS({ state: "offer", suggested: s.suggested })} />
      </KinPanel>
    );
  }
  return (
    <section aria-labelledby="bh-bat-t" data-bh-enable className="max-w-xl">
      <KinSectionHead id="bh-bat-t" title="Theo bảng học phí tháng" aside="Tuỳ chọn" />
      <p className="pt-3 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">
        Lớp này chưa có học phí nào nên cô chuyển được sang cách nhập từ Excel hoặc Google Sheet: bậc đơn giá theo số môn, số buổi từng môn của từng em, buổi miễn phí, học bổng, giảm trừ. Chuyển rồi thì không quay lại cách cũ được.
      </p>
      <KinButton variant="secondary" className="mt-4" onClick={() => setS({ state: "form", suggested: s.suggested })}>Dùng bảng học phí tháng cho lớp này</KinButton>
    </section>
  );
}
