// SCL-C (21/11/2026, P1-1, Q5) — Sổ điểm THƯỜNG TRỰC (không còn theo cờ SO_DIEM): bảng học sinh × bài của MỘT lớp (bài tập nộp tệp, quiz, đề Azota).
// SCL-G-SD (21/11/2026, QUYET-DINH-GIAO-DIEN §2.3, §3.5; bản chốt khung 732:2): bảng THƯỜNG (không role=grid), mỗi ô là một link mở hộp "bài nộp" (?mo=<ô>);
// ô điểm in đậm "8,0", ô chưa có điểm là nhãn trạng thái có hình + chữ; đầu cột tên bài đầy đủ + hạn + thang "/10" một lần; cột "Trung bình"; cột tên dính.
// Chip lọc theo HÀNG (?loc=, form GET, button aria-pressed). MỘT nút chính "Chấm N bài đang chờ" mở lần lượt từng bài (có "Bài tiếp"; lưu xong tự sang bài kế).
// Mọi ghi vẫn là form POST + 303 (chấm / duyệt / sửa / từ chối như đợt 2). Chủ nhiệm mở được mọi lớp; gia sư chỉ lớp mình làm chủ (courseAccess `score.write`).
import Link from "next/link";
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import { courseRoleForPage } from "@/lib/courseAccessServer";
import { gradebookCourses, loadClassGradebook, loadSubmissionBrief, type GradeCell, type GradeRow } from "@/lib/gradebookServer";
import {
  canWriteScore, cellKey, cellQueue, cellText, fmtDiem, fmtThang, isCellKey, isLoc, KIND_LABEL, LOC_FILTERS, queueAfter, rowAverage, rowHas, shownState,
  SO_DIEM_MESSAGE, type Column, type LocFilter,
} from "@/lib/soDiem";
import { vnDateKeyOf } from "@/lib/classSessions";
import { KinPage, KinPageHeader, KIN_FIELD, KIN_LABEL } from "@/components/kin/PageLayout";
import { KinCallout } from "@/components/kin/Callout";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { GRADE_STATUS, KinGradeStatus, KinStatusIcon, STATUS_DOT } from "@/components/kin/Status";
import { kinButtonClass } from "@/components/kin/buttonClass";
import { NopTepStudentFiles } from "@/components/student/nop-tep/NopTepBox";
import { TuChoiButton } from "./TuChoiButton";
import { SoDiemHop } from "./SoDiemHop";

export const dynamic = "force-dynamic";

// Ô nhập điểm 16px (iOS không phóng to trang khi chạm vào ô).
const SCORE_FIELD = `${KIN_FIELD.replace("text-[length:var(--kin-co-goc)]", "text-base")} w-28`;
const CELL = "px-[14px] py-[6px] h-14 border-b border-r border-[var(--kin-vien-nhat)] align-middle";
const STICKY = "sticky left-0 z-[1] min-w-[180px] sm:min-w-[210px]";
const ddmm = (d: Date) => { const k = vnDateKeyOf(d); return `${k.slice(8, 10)}/${k.slice(5, 7)}`; };

/** Nội dung hộp "bài nộp" của một ô. Máy chủ dựng; form ghi giữ nguyên luồng đợt 2, thêm mo=<ô> để quay lại đúng chỗ. */
async function CellDetail({ k, row, col, now }: { k: string; row: GradeRow; col: Column; now: Date }) {
  const c: GradeCell = row.cells[col.id];
  const s = shownState(c, col, now);
  const brief = c.submissionId ? await loadSubmissionBrief(c.submissionId) : null;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[var(--kin-chu-phu)]">{[KIND_LABEL[col.kind], col.dueLabel, `Điểm tối đa ${fmtThang(col.max).slice(1)}`].filter(Boolean).join(" · ")}</p>
      <KinGradeStatus state={s}>{c.state === "da-cham" && c.score !== null ? `Đã chấm ${fmtDiem(c.score)}${fmtThang(col.max)}` : cellText(c, s)}</KinGradeStatus>
      {brief && (
        <div className="flex flex-col gap-2">
          <p className="text-[var(--kin-chu-phu)]">{brief.fileName || "Bài nộp"} · nộp ngày {ddmm(brief.submittedAt)}</p>
          {brief.kind === "done" ? <p>Học sinh báo đã làm xong, không gửi tệp.</p>
            : brief.fileUrl.startsWith("/api/media/nop-bai/") ? <NopTepStudentFiles assignmentId={brief.assignmentId} submissionId={brief.id} />
            : <a href={brief.fileUrl} target="_blank" rel="noopener noreferrer" className={`${kinButtonClass("secondary")} self-start`}>Mở bài nộp gốc ↗</a>}
        </div>
      )}
      {brief && (
        <form method="post" action="/api/tutor/so-diem/cham" className="flex flex-wrap gap-3 items-end" data-cham>
          <input type="hidden" name="submissionId" value={brief.id} />
          <input type="hidden" name="mo" value={k} />
          <div>
            <label htmlFor="sd-diem" className={KIN_LABEL}>Điểm, tối đa {fmtThang(col.max).slice(1)}</label>
            <input id="sd-diem" name="score" inputMode="decimal" required autoFocus autoComplete="off" defaultValue={c.score === null ? "" : fmtDiem(c.score)} className={`${SCORE_FIELD} mt-1 block`} />
          </div>
          <button type="submit" className={kinButtonClass("primary")}>{c.state === "da-cham" ? "Lưu điểm mới" : "Lưu điểm"}</button>
        </form>
      )}
      {c.state === "cho-cham" && !brief && <p>Bài tự luận của đề này được chấm ở trang đề thi.</p>}
      {c.state === "chua-nop" && <p>{s === "qua-han" ? "Học sinh chưa nộp bài này và đã qua hạn." : "Học sinh chưa nộp bài này."}</p>}
      {c.state === "cho-duyet" && c.resultId && (
        // Ba form riêng: Enter trong ô "Điểm sửa" chỉ gửi được "Sửa điểm" (chung form thì nút đầu — Duyệt — được gửi, số vừa gõ bị bỏ).
        <div className="flex flex-col gap-3" data-duyet>
          <p className="text-[var(--kin-chu-phu)]">Điểm học sinh tự khai. Bạn duyệt xong học sinh mới thấy và điểm mới vào Trung bình.</p>
          <form method="post" action="/api/tutor/so-diem/duyet" data-duyet-ok>
            <input type="hidden" name="resultId" value={c.resultId} />
            <input type="hidden" name="mo" value={k} />
            <button type="submit" name="action" value="duyet" className={kinButtonClass("primary")}>Duyệt</button>
          </form>
          <form method="post" action="/api/tutor/so-diem/duyet" data-duyet-sua className="flex flex-wrap gap-3 items-end">
            <input type="hidden" name="resultId" value={c.resultId} />
            <input type="hidden" name="action" value="sua" />
            <input type="hidden" name="mo" value={k} />
            <div>
              <label htmlFor="sd-sua" className={KIN_LABEL}>Điểm sửa</label>
              <input id="sd-sua" name="score" inputMode="decimal" required autoComplete="off" defaultValue={c.score === null ? "" : fmtDiem(c.score)} className={`${SCORE_FIELD} mt-1 block`} />
            </div>
            <button type="submit" className={kinButtonClass("secondary")}>Sửa điểm</button>
          </form>
          <form method="post" action="/api/tutor/so-diem/duyet" data-duyet-tu-choi>
            <input type="hidden" name="resultId" value={c.resultId} />
            <input type="hidden" name="action" value="tu-choi" />
            <input type="hidden" name="mo" value={k} />
            <TuChoiButton />
          </form>
        </div>
      )}
    </div>
  );
}

export default async function SoDiemPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await redirectIfNotTutor(await getSession(), { path: "/lop-cua-toi/so-diem", studentTo: "/student/diem", allowAdmin: true });
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : null);
  const courses = await gradebookCourses(session);
  const lop = one("lop") ?? courses[0]?.id ?? null;
  const ghi = one("ghi") ?? "";
  const msg = SO_DIEM_MESSAGE[ghi] ?? null;
  const loc: LocFilter = isLoc(one("loc")) ? (one("loc") as LocFilter) : "tat-ca";
  const role = lop ? await courseRoleForPage(session, lop) : null;
  const allowed = !!role && canWriteScore(role.role);
  const book = lop && allowed ? await loadClassGradebook(lop) : null;
  const name = courses.find(c => c.id === lop)?.name ?? null;
  const now = new Date();

  const rows = book?.rows ?? [], cols = book?.columns ?? [];
  const queue = cellQueue(rows, cols);
  const href = (extra: Record<string, string> = {}) =>
    `/lop-cua-toi/so-diem?${new URLSearchParams({ ...(lop ? { lop } : {}), ...(loc !== "tat-ca" ? { loc } : {}), ...extra })}`;
  // Ô đang mở: ?mo=<ô>; sau khi chấm xong (&tiep=1) thì mở bài kế trong hàng đợi.
  const mo = one("mo");
  const openKey = isCellKey(mo) ? (one("tiep") === "1" ? queueAfter(queue, mo, rows, cols) : mo) : null;
  const [openStudent, openCol] = openKey?.split("~") ?? [];
  const openRow = rows.find(r => r.studentId === openStudent), col = cols.find(c => c.id === openCol);
  const open = openKey && openRow && col && openRow.cells[col.id] ? { k: openKey, row: openRow, col } : null;
  const inQueue = open ? queue.indexOf(open.k) : -1;
  const next = inQueue >= 0 ? queueAfter(queue, open!.k, rows, cols) : null;
  const shown = rows.filter(r => rowHas(r.cells, loc));
  const msgBox = msg && <div role="status" data-so-diem-ghi={ghi}><KinCallout title={msg} className="mb-4" /></div>;

  return (
    <KinPage>
      <KinPageHeader
        back={{ href: "/lop-cua-toi/lop", label: "← Lớp" }}
        title="Sổ điểm"
        sub={book && cols.length > 0 ? `${name} · ${queue.length ? `Còn ${queue.length} bài phải chấm` : "Không còn bài nào phải chấm"}` : "Điểm từng bài của từng học sinh trong lớp."}
        actions={book && cols.length > 0 && rows.length > 0 ? (
          <>
            <a href={`/api/tutor/so-diem?courseId=${encodeURIComponent(lop!)}&format=csv`} download data-so-diem-csv className={kinButtonClass("secondary", "lg")}>Xuất CSV</a>
            {queue.length > 0 && <Link href={href({ mo: queue[0] })} scroll={false} data-so-diem-cham-loat className={kinButtonClass("primary", "lg")}>Chấm {queue.length} bài đang chờ</Link>}
          </>
        ) : undefined}
      />
      {!open && msgBox}
      {courses.length === 0 ? (
        <KinEmptyState title="Bạn chưa có lớp nào" action={<Link href="/lop-cua-toi/lop" className={kinButtonClass("secondary")}>Tạo lớp</Link>}>Sổ điểm hiện theo lớp. Tạo lớp và giao bài trước nhé.</KinEmptyState>
      ) : (
        <>
          {courses.length > 1 && (
            <form method="get" className="flex flex-col sm:flex-row sm:items-end gap-3 mb-6 max-w-xl">
              <div className="min-w-0 sm:flex-1">
                <label htmlFor="sd-lop" className={KIN_LABEL}>Lớp</label>
                <select id="sd-lop" name="lop" defaultValue={lop ?? ""} className={`${KIN_FIELD} mt-1`}>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <button type="submit" className={kinButtonClass("secondary")}>Xem lớp</button>
            </form>
          )}
          {!allowed ? (
            <KinCallout title="Bạn không có quyền với sổ điểm của lớp này" />
          ) : !book ? null : rows.length === 0 ? (
            <KinEmptyState title="Lớp chưa có học sinh">Khi học sinh vào lớp, sổ điểm sẽ có một dòng cho mỗi em.</KinEmptyState>
          ) : cols.length === 0 ? (
            <KinEmptyState title="Lớp chưa có bài nào" action={<Link href={`/lop-cua-toi/bai-tap/giao?lop=${encodeURIComponent(lop!)}`} className={kinButtonClass("primary")}>Giao bài đầu tiên</Link>}>Bài tập, quiz và đề Azota của lớp sẽ thành các cột ở đây.</KinEmptyState>
          ) : (
            <>
              <form method="get" data-so-diem-loc role="group" aria-label="Lọc học sinh theo trạng thái" className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="lop" value={lop!} />
                {LOC_FILTERS.map(f => {
                  const n = rows.filter(r => rowHas(r.cells, f.id)).length, on = f.id === loc, g = f.id === "tat-ca" ? null : GRADE_STATUS[f.id];
                  return (
                    <button key={f.id} type="submit" name="loc" value={f.id} data-loc={f.id} aria-pressed={on}
                      className={`inline-flex items-center gap-[6px] min-h-[var(--kin-cham-toi-thieu)] px-[14px] rounded-full border font-medium text-[length:var(--kin-co-goc)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)] ${on
                        ? "bg-[var(--kin-nhan-nen-nhat)] border-[var(--kin-nhan-nen)] text-[var(--kin-nhan-chu-tren-nhat)] font-semibold"
                        : "bg-[var(--kin-nen-trang)] border-[var(--kin-vien-thuong)] text-[var(--kin-chu-phu)] hover:bg-[var(--kin-nen-re-chuot)]"}`}>
                      {g && <KinStatusIcon shape={g.shape} color={STATUS_DOT[g.tone]} />}
                      {f.label} {n}
                    </button>
                  );
                })}
                <p className="basis-full sm:basis-auto sm:ml-auto text-[var(--kin-chu-phu)]">Bấm một ô để mở bài nộp</p>
              </form>
              <div data-so-diem role="region" aria-label="Sổ điểm, cuộn ngang" tabIndex={0} className="mt-[14px] overflow-x-auto max-w-full bg-[var(--kin-nen-trang)] border border-[var(--kin-vien-thuong)] rounded-[var(--kin-bo-the)] focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]">
                <table className="border-separate border-spacing-0 min-w-full text-[length:var(--kin-co-goc)]">
                  <caption className="sr-only">Sổ điểm lớp {name}</caption>
                  <thead>
                    <tr className="text-left text-[var(--kin-chu-chinh)]">
                      <th scope="col" className={`${CELL} ${STICKY} bg-[var(--kin-nen-bang)] font-semibold`}>Học sinh</th>
                      {cols.map(c => (
                        <th key={c.id} scope="col" className={`${CELL} bg-[var(--kin-nen-bang)] font-semibold align-bottom min-w-[160px] max-w-[240px] leading-5`}>
                          <span className="block [overflow-wrap:anywhere]">{c.title}</span>
                          {c.dueLabel && <span className="block font-normal text-[var(--kin-chu-phu)]">{c.dueLabel}</span>}
                          <span className="block font-normal text-xs text-[var(--kin-chu-mo)]">{fmtThang(c.max)}</span>
                        </th>
                      ))}
                      <th scope="col" className={`${CELL} border-r-0 bg-[var(--kin-nen-bang)] font-semibold align-bottom leading-5 whitespace-nowrap`}>
                        Trung bình<span className="block font-normal text-xs text-[var(--kin-chu-mo)]">/10</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map(r => {
                      const avg = rowAverage(r.cells, cols);
                      return (
                        <tr key={r.studentId} data-so-diem-hang>
                          <th scope="row" className={`${CELL} ${STICKY} bg-[var(--kin-nen-trang)] text-left font-medium text-base text-[var(--kin-chu-chinh)] [overflow-wrap:anywhere]`}>{r.name}</th>
                          {cols.map(c => {
                            const x = r.cells[c.id];
                            if (!x) return <td key={c.id} className={CELL} />;
                            const s = shownState(x, c, now), k = cellKey(r.studentId, c.id);
                            return (
                              <td key={c.id} className={`${CELL} ${open?.k === k ? "bg-[var(--kin-nen-dang-chon)]" : ""}`} data-o={s}>
                                <Link href={href({ mo: k })} scroll={false} data-o-mo
                                  aria-label={`${r.name}, ${c.title}: ${cellText(x, s)}. Mở bài nộp`}
                                  className="flex items-center min-h-[var(--kin-cham-toi-thieu)] -mx-2 px-2 rounded-[var(--kin-bo-md)] hover:bg-[var(--kin-nen-re-chuot)] focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]">
                                  {x.state === "da-cham" && x.score !== null
                                    ? <span className="font-bold text-base tabular-nums text-[var(--kin-chu-chinh)]">{fmtDiem(x.score)}</span>
                                    : <KinGradeStatus state={s}>{cellText(x, s)}</KinGradeStatus>}
                                </Link>
                              </td>
                            );
                          })}
                          <td data-so-diem-tb className={`${CELL} border-r-0 bg-[var(--kin-nen-bang)] whitespace-nowrap ${avg === null ? "text-[var(--kin-chu-phu)]" : "font-bold text-base tabular-nums text-[var(--kin-chu-chinh)]"}`}>
                            {avg === null ? "Chưa có" : fmtDiem(avg)}
                          </td>
                        </tr>
                      );
                    })}
                    {shown.length === 0 && (
                      <tr><td colSpan={cols.length + 2} className="px-[14px] py-4 text-[var(--kin-chu-phu)]">Không có học sinh nào ở trạng thái này.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p data-so-diem-giai-thich className="flex items-start gap-2 mt-[14px] text-[var(--kin-chu-phu)]">
                <span className="mt-[2px]"><KinStatusIcon shape="ba-phan-tu" color={STATUS_DOT.cho} /></span>
                <span><b className="font-semibold">Chờ duyệt:</b> điểm học sinh tự khai (đề Azota), bạn duyệt xong học sinh mới thấy. Trung bình chỉ tính điểm đã duyệt, đổi về thang 10.</span>
              </p>
              {book.truncated && <p className="mt-3 text-[var(--kin-chu-phu)]">Sổ điểm hiện 200 học sinh đầu tiên của lớp.</p>}
            </>
          )}
        </>
      )}
      {open && (
        <SoDiemHop key={open.k} title={`${open.row.name} · ${open.col.title}`} closeHref={href()}
          footer={next ? <Link href={href({ mo: next })} scroll={false} data-so-diem-bai-tiep className={kinButtonClass("secondary")}>Bài tiếp</Link> : undefined}>
          {msgBox}
          {inQueue >= 0 && <p className="mb-3 text-[var(--kin-chu-phu)]">Bài {inQueue + 1} trên {queue.length} bài đang chờ chấm</p>}
          <CellDetail k={open.k} row={open.row} col={open.col} now={now} />
        </SoDiemHop>
      )}
    </KinPage>
  );
}
