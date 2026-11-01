// ĐX-03 (NC1-043) — bảng điểm danh THÁNG để in. KHÔNG thêm thư viện PDF: gia sư bấm "In / Lưu thành PDF" rồi chọn
// "Lưu thành PDF" trong hộp thoại in của trình duyệt (cùng cách với Kế hoạch buổi, PH-223).
//
// Dữ liệu lấy từ api/courses/[id]/attendance-export?format=json (cùng nguồn với tệp CSV / Excel nên ba bản luôn khớp nhau).
// Khi in chỉ còn khối `.kin-print` (ẩn vỏ trang), khổ A4 ngang, chữ đen trên giấy trắng bất kể chủ đề sáng / tối.
"use client";
import { Suspense, useCallback, useEffect, useState, use as usePromise } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { KinButton, kinButtonClass } from "@/components/kin";
import { useContentHref } from "@/components/tutor/useContentHref";
import { GRID_LEGEND, NA_SYMBOL, SUMMARY_HEADERS, cellText, parseExportMonth, type AttendanceGrid } from "@/lib/attendanceExport";
import { vnDateKeyOf } from "@/lib/classSessions";

// useSearchParams cần Suspense khi dựng sẵn trang.
export default function InBangDiemDanhPage(props: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={null}><InBangDiemDanh {...props} /></Suspense>;
}

const PRINT_CSS = `
@page { size: A4 landscape; margin: 10mm; }
@media print {
  body * { visibility: hidden !important; }
  .kin-print, .kin-print * { visibility: visible !important; }
  .kin-print { position: absolute; left: 0; top: 0; width: 100%; background: white !important; color: black !important; }
  .kin-print th, .kin-print td { border-color: black !important; color: black !important; background: white !important; }
  .kin-print .kin-print-scroll { overflow: visible !important; }
}`;
const CELL: React.CSSProperties = { border: "1px solid var(--kin-vien-thuong)", padding: "4px 6px", textAlign: "center", fontSize: "var(--kin-co-small)" };

function InBangDiemDanh({ params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = usePromise(params);
  const href = useContentHref(); // BU-00 bước 3
  const queryMonth = useSearchParams().get("month");
  const [month, setMonth] = useState<string>(() => {
    const p = parseExportMonth(queryMonth);
    return p.ok && queryMonth ? p.month : vnDateKeyOf(new Date()).slice(0, 7);
  });
  const [grid, setGrid] = useState<AttendanceGrid | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  const load = useCallback(async () => {
    await Promise.resolve();
    setState("loading");
    try {
      const r = await fetch(`/api/courses/${courseId}/attendance-export?month=${month}&format=json`, { credentials: "same-origin", cache: "no-store" });
      if (!r.ok) { setState("error"); return; }
      setGrid(await r.json() as AttendanceGrid);
      setState("ok");
    } catch { setState("error"); }
  }, [courseId, month]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const monthOk = parseExportMonth(month).ok;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <style>{PRINT_CSS}</style>
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-h4" style={{ color: "var(--kin-chu-chinh)" }}>Bảng điểm danh tháng</h1>
          <p className="text-body-sm mt-1" style={{ color: "var(--kin-chu-mo)" }}>
            Bấm “In / Lưu thành PDF” rồi chọn máy in hoặc “Lưu thành PDF”. Ô trống là chưa điểm danh.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label htmlFor="in-month" className="text-body-sm font-semibold" style={{ color: "var(--kin-chu-phu)" }}>Tháng</label>
          <input id="in-month" type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="px-3 py-1.5 text-body-sm font-semibold rounded-lg"
            style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-chinh)" }} />
          <KinButton onClick={() => window.print()} disabled={state !== "ok" || !grid || grid.dates.length === 0}>In / Lưu thành PDF</KinButton>
          <Link href={href(`/admin/khoa-hoc/${courseId}/diem-danh`)} className={kinButtonClass("secondary")}>Về điểm danh</Link>
        </div>
      </div>

      {!monthOk ? (
        <div role="alert" className="rounded-xl p-6 text-body-sm" style={{ background: "var(--kin-nen-bang)", border: "1px dashed var(--kin-vien-thuong)" }}>
          Chọn một tháng hợp lệ để xem bảng.
        </div>
      ) : state === "loading" ? (
        <div role="status" className="rounded-xl p-10 text-center text-body-sm" style={{ background: "var(--kin-nen-bang)" }}>Đang tải…</div>
      ) : state === "error" || !grid ? (
        <div role="alert" className="rounded-xl p-6 text-body-sm space-y-3" style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
          <p>Không tải được bảng điểm danh. Bạn có thể không có quyền với lớp này.</p>
          <KinButton variant="secondary" onClick={() => void load()}>Thử lại</KinButton>
        </div>
      ) : grid.dates.length === 0 ? (
        <div className="rounded-xl p-8 text-center text-body-sm" style={{ background: "var(--kin-nen-bang)", border: "1px dashed var(--kin-vien-thuong)" }}>
          {grid.monthLabel} chưa có buổi điểm danh nào.
        </div>
      ) : (
        <div className="kin-print rounded-xl p-4" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-chinh)" }}>
          <h2 className="text-h5" style={{ fontWeight: 700 }}>Bảng điểm danh — {grid.courseName}</h2>
          <p className="text-body-sm" style={{ marginBottom: 8 }}>{grid.monthLabel}</p>
          <div className="kin-print-scroll overflow-x-auto">
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th style={CELL} scope="col">STT</th>
                  <th style={{ ...CELL, textAlign: "left" }} scope="col">Học sinh</th>
                  {grid.dates.map(d => <th key={d.dateKey} style={CELL} scope="col">{d.label}</th>)}
                  {SUMMARY_HEADERS.map(h => <th key={h} style={CELL} scope="col">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {grid.rows.map((r, i) => (
                  <tr key={r.id}>
                    <td style={CELL}>{i + 1}</td>
                    <th style={{ ...CELL, textAlign: "left", fontWeight: 600 }} scope="row">{r.name}</th>
                    {r.cells.map((c, j) => (
                      <td key={grid.dates[j].dateKey} style={CELL} aria-label={c === null ? "Chưa điểm danh" : c === "na" ? "Không thuộc lớp ở ngày đó" : undefined}>
                        {cellText(c)}
                      </td>
                    ))}
                    <td style={CELL}>{r.counts.present}</td>
                    <td style={CELL}>{r.counts.late}</td>
                    <td style={CELL}>{r.counts.excused}</td>
                    <td style={CELL}>{r.counts.absent}</td>
                    <td style={CELL}>{r.counts.unmarked}</td>
                    <td style={CELL}>{r.rate === null ? "" : r.rate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-body-sm" style={{ marginTop: 8 }}>{GRID_LEGEND}</p>
          <p className="text-caption" style={{ marginTop: 2 }}>“{NA_SYMBOL}” = chưa ghi danh vào lớp hoặc đã rời lớp. Chuyên cần tính theo hệ số 1 / 0,9 / 0,8 / 0,5 của các buổi đã điểm danh.</p>
        </div>
      )}
    </div>
  );
}
