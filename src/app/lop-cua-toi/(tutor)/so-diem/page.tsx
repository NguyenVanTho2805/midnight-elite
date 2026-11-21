// SCL-C (21/11/2026, P1-1, Q5) — Sổ điểm THƯỜNG TRỰC (không còn theo cờ SO_DIEM): bảng học sinh × bài của MỘT lớp (bài tập nộp tệp, quiz, đề Azota).
// Mỗi ô: điểm hoặc chữ trạng thái. Ô "Chờ chấm" của bài tập có ô nhập điểm; ô "Chờ duyệt" (điểm tự khai) có Duyệt / Sửa điểm / Từ chối. Mọi ghi = form POST + 303.
// Chủ nhiệm (quản trị trung tâm) mở được mọi lớp; gia sư chỉ lớp mình làm chủ (ma trận courseAccess `score.write`).
import Link from "next/link";
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import { courseRoleForPage } from "@/lib/courseAccessServer";
import { gradebookCourses, loadClassGradebook, type GradeCell } from "@/lib/gradebookServer";
import { canWriteScore, KIND_LABEL, SO_DIEM_MESSAGE, type CellState } from "@/lib/soDiem";
import { fmtScore } from "@/lib/studentTodo";
import { KinPage, KinPageHeader, KIN_FIELD, KIN_LABEL } from "@/components/kin/PageLayout";
import { KinCallout } from "@/components/kin/Callout";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinStatus, type StatusTone } from "@/components/kin/Status";
import { kinButtonClass } from "@/components/kin/buttonClass";
import { TuChoiButton } from "./TuChoiButton";

export const dynamic = "force-dynamic";

const TONE: Record<CellState, StatusTone> = { "chua-nop": "mo", "cho-cham": "cho", "cho-duyet": "cho", "da-cham": "xong" };
// Ô nhập điểm 16px (iOS không phóng to trang khi chạm vào ô).
const SCORE_FIELD = `${KIN_FIELD.replace("text-[length:var(--kin-co-goc)]", "text-base")} w-20`;

function CellView({ c }: { c: GradeCell }) {
  const score = c.score !== null && c.max !== null ? <span className="tabular-nums font-medium text-[var(--kin-chu-chinh)]">{fmtScore(c.score)}/{fmtScore(c.max)}</span> : null;
  return (
    <div className="flex flex-col gap-2">
      {score}
      <KinStatus tone={TONE[c.state]}>{c.label}</KinStatus>
      {c.state === "cho-cham" && c.submissionId && (
        <form method="post" action="/api/tutor/so-diem/cham" className="flex gap-2 items-center" data-cham>
          <input type="hidden" name="submissionId" value={c.submissionId} />
          <input name="score" inputMode="decimal" required aria-label="Điểm" placeholder="Điểm" className={SCORE_FIELD} />
          <button type="submit" className={kinButtonClass("secondary")}>Lưu</button>
        </form>
      )}
      {c.state === "cho-duyet" && c.resultId && (
        // Ba form riêng: Enter trong ô "Điểm sửa" chỉ gửi được "Sửa điểm" (chung form thì nút đầu — Duyệt — được gửi, số vừa gõ bị bỏ).
        <div className="flex flex-wrap gap-2 items-center" data-duyet>
          <form method="post" action="/api/tutor/so-diem/duyet" data-duyet-sua className="flex gap-2 items-center">
            <input type="hidden" name="resultId" value={c.resultId} />
            <input type="hidden" name="action" value="sua" />
            <input name="score" inputMode="decimal" required defaultValue={c.score === null ? "" : fmtScore(c.score)} aria-label="Điểm sửa" className={SCORE_FIELD} />
            <button type="submit" className={kinButtonClass("secondary")}>Sửa điểm</button>
          </form>
          <form method="post" action="/api/tutor/so-diem/duyet" data-duyet-ok>
            <input type="hidden" name="resultId" value={c.resultId} />
            <button type="submit" name="action" value="duyet" className={kinButtonClass("primary")}>Duyệt</button>
          </form>
          <form method="post" action="/api/tutor/so-diem/duyet" data-duyet-tu-choi>
            <input type="hidden" name="resultId" value={c.resultId} />
            <input type="hidden" name="action" value="tu-choi" />
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
  const msg = SO_DIEM_MESSAGE[one("ghi") ?? ""] ?? null;
  const role = lop ? await courseRoleForPage(session, lop) : null;
  const allowed = !!role && canWriteScore(role.role);
  const book = lop && allowed ? await loadClassGradebook(lop) : null;
  const name = courses.find(c => c.id === lop)?.name ?? null;

  return (
    <KinPage>
      <KinPageHeader
        back={{ href: "/lop-cua-toi/lop", label: "← Lớp" }}
        title="Sổ điểm"
        sub="Điểm từng bài của từng học sinh. Điểm học sinh tự khai (đề Azota) chờ bạn duyệt rồi mới vào báo cáo và bảng xếp hạng."
        actions={<Link href="/lop-cua-toi/bai-tap/giao" className={kinButtonClass("primary")}>+ Giao bài</Link>}
      />
      {msg && <div role="status" data-so-diem-ghi={one("ghi") ?? ""}><KinCallout title={msg} className="mb-6" /></div>}
      {courses.length === 0 ? (
        <KinEmptyState title="Bạn chưa có lớp nào" action={<Link href="/lop-cua-toi/lop" className={kinButtonClass("secondary")}>Tạo lớp</Link>}>Sổ điểm hiện theo lớp. Tạo lớp và giao bài trước nhé.</KinEmptyState>
      ) : (
        <>
          <form method="get" className="flex flex-col sm:flex-row sm:items-end gap-3 mb-6 max-w-xl">
            <div className="min-w-0 sm:flex-1">
              <label htmlFor="sd-lop" className={KIN_LABEL}>Lớp</label>
              <select id="sd-lop" name="lop" defaultValue={lop ?? ""} className={`${KIN_FIELD} mt-1`}>
                {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <button type="submit" className={kinButtonClass("secondary")}>Xem lớp</button>
          </form>
          {!allowed ? (
            <KinCallout title="Bạn không có quyền với sổ điểm của lớp này" />
          ) : !book ? null : book.rows.length === 0 ? (
            <KinEmptyState title="Lớp chưa có học sinh">Khi học sinh vào lớp, sổ điểm sẽ có một dòng cho mỗi em.</KinEmptyState>
          ) : book.columns.length === 0 ? (
            <KinEmptyState title="Lớp chưa có bài nào" action={<Link href={`/lop-cua-toi/bai-tap/giao?lop=${encodeURIComponent(lop!)}`} className={kinButtonClass("primary")}>Giao bài đầu tiên</Link>}>Bài tập, quiz và đề Azota của lớp sẽ thành các cột ở đây.</KinEmptyState>
          ) : (
            <div data-so-diem className="overflow-x-auto border border-[var(--kin-vien-nhat)] rounded-[var(--kin-bo-md)] max-w-full">
              <table className="text-[length:var(--kin-co-goc)] border-collapse min-w-full">
                <caption className="sr-only">Sổ điểm lớp {name}</caption>
                <thead>
                  <tr className="bg-[var(--kin-nen-bang)] text-[var(--kin-chu-mo)] text-left">
                    <th scope="col" className="sticky left-0 z-10 bg-[var(--kin-nen-bang)] px-3 py-3 font-medium min-w-[140px]">Học sinh</th>
                    {book.columns.map(c => (
                      <th key={c.id} scope="col" className="px-3 py-3 font-medium align-bottom min-w-[180px]">
                        <span className="block text-[var(--kin-chu-chinh)] [overflow-wrap:anywhere]">{c.title}</span>
                        <span className="block">{KIND_LABEL[c.kind]} · tối đa {fmtScore(c.max)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {book.rows.map(r => (
                    <tr key={r.studentId} data-so-diem-hang className="border-t border-[var(--kin-vien-nhat)] align-top">
                      <th scope="row" className="sticky left-0 bg-[var(--kin-nen-trang)] px-3 py-3 text-left font-normal text-[var(--kin-chu-chinh)] [overflow-wrap:anywhere]">{r.name}</th>
                      {book.columns.map(c => <td key={c.id} className="px-3 py-3" data-o={r.cells[c.id]?.state}>{r.cells[c.id] && <CellView c={r.cells[c.id]} />}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {book?.truncated && <p className="mt-3 text-[var(--kin-chu-mo)]">Sổ điểm hiện 200 học sinh đầu tiên của lớp.</p>}
        </>
      )}
    </KinPage>
  );
}
