// "Cần làm" của học sinh (/student/viec-cua-toi) theo bản chốt SCL-G (QUYET-DINH-GIAO-DIEN §2.1, §3.3, §3.4, §3.9; khung 2 "Học sinh · Cần làm").
// Một câu hỏi: "hôm nay em phải làm gì". Gom MỌI việc của MỌI lớp (bài tập + kiểm tra + hạn nộp ngoài KiN) thành thẻ, nhóm Quá hạn / Tuần này / Tuần sau / Sau đó,
// xếp theo hạn; chỉ thẻ bài tập hạn gần nhất mang nút chính, các thẻ sau nút phụ (bài quá hạn xếp đầu nên không bao giờ nhạt hơn bài ít khẩn hơn, §3.2).
// "Nộp bài" ngay trong thẻ (ảnh → PDF, components/student/CanLam) → POST + 303 về đây (?nop=ok&bt=<mã bài>): role=status + thẻ "Đã nộp lúc …".
// Dưới thẻ: "Đã nộp, chờ chấm" (hàng mảnh), "Buổi học sắp tới" (hàng, có link học online), "Đề thi được giao" (hàng mảnh, cả hàng là link, bỏ đề đã có thẻ).
// Kết quả đã chấm nằm ở mục Điểm.
// Giữ từ trước: thẻ "chờ duyệt" của gia sư mới đăng ký (NC2-029), lối "Nhập mã lớp" ở đầu trang (SCL P2-13), tải lại khi cửa sổ lấy lại focus.
"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { ErrorStrip } from "@/components/kin/shell/Outlook";
import { kinButtonClass } from "@/components/kin/Button";
import { KinPanel } from "@/components/kin/Panel";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinListRow } from "@/components/kin/ListRow";
import { KinGradeStatus, KinStatus } from "@/components/kin/Status";
import { todayLine, useStudentWork, WorkSkeleton } from "@/components/student/shared";
import { HocThuBang } from "@/components/student/HocThu";
import { LopCuaBan, NhatKyDemHoc } from "@/components/student/HomNayPhu";
import type { ThuVienResp, ThuVienRow } from "@/lib/studentLop";
import { DaNopCard, TodoCardView } from "@/components/student/CanLam";
import { useAuth } from "@/contexts/AuthContext";
import { useMyClasses } from "@/hooks/useMyClasses";
import { useAssignments } from "@/components/student/exam-room/AssignmentList";
import { ASSIGNMENT_ACTION, ASSIGNMENT_STATE_LABEL } from "@/components/student/exam-room/roomLogic";
import { daysLeftLabel } from "@/lib/examRoomLib";
import type { AssignmentState } from "@/lib/examRoomApi";
import { classAccent } from "@/lib/classColor";
import { nopTepResultMessage } from "@/lib/nopTep";
import { BUCKET_TITLE, buildTodoCards, nextClass, todoBucket, vnWeekdayDate, type TodoBucket } from "@/lib/studentClassPage";

const H2 = "text-[length:var(--kin-co-tieu-de)] leading-6 font-semibold text-[var(--kin-chu-chinh)]";
const GOC = "text-[length:var(--kin-co-goc)]";
const BUCKETS: TodoBucket[] = ["qua-han", "tuan-nay", "tuan-sau", "sau"];
const EXAM_TONE: Record<AssignmentState, "xong" | "cho" | "mo"> = { "dang-lam": "cho", "dang-mo": "xong", "chua-mo": "mo", "da-dong": "mo", "cho-cong-bo": "cho", "da-lam": "xong" };

function CanLamPage() {
  const { user } = useAuth();
  const tutorPending = user?.tutorPending === true;
  const { items, events, error, load } = useStudentWork();
  const { classes } = useMyClasses();
  const as = useAssignments();
  const params = useSearchParams();
  const nop = params.get("nop"), bt = params.get("bt");

  const now = useMemo(() => new Date(), [items]); // eslint-disable-line react-hooks/exhaustive-deps -- mốc "bây giờ" lấy lại mỗi lần dữ liệu về
  const nameOf = (id: string) => classes.find(c => c.id === id)?.name ?? "";
  const cards = items ? buildTodoCards(items, events ?? [], now, nameOf) : null;
  const waiting = (items ?? []).filter(i => i.task?.phase === "cho-cham");
  // SCL5 (P2-8): buổi học HÔM NAY lên đầu màn kèm nút vào phòng; "Buổi học sắp tới" bên dưới chỉ còn các ngày sau (không lặp).
  const allSessions = (items ?? []).filter(i => i.kind === "buoi-hoc" && !i.done && i.session);
  const tonight = allSessions.filter(i => i.session!.dayText === "Hôm nay");
  const sessions = allSessions.filter(i => i.session!.dayText !== "Hôm nay").slice(0, 3);
  // SCL5: lớp của em (tiến độ thật, học thử) — /api/student/lop; lỗi ⇒ bỏ hai khối phụ, màn chính vẫn đủ.
  const [lop, setLop] = useState<ThuVienRow[] | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/student/lop", { credentials: "same-origin", cache: "no-store" }).then(r => (r.ok ? r.json() : null))
      .then((d: ThuVienResp | null) => { if (live) setLop(d?.classes ?? []); }).catch(() => { if (live) setLop([]); });
    return () => { live = false; };
  }, []);
  const thu = (lop ?? []).filter(r => r.trial);
  const thuBang = thu.find(r => r.trial?.kind === "dang_thu")?.trial ?? thu[0]?.trial;
  const hocTiepRow = (lop ?? []).find(r => r.hocTiep && r.hocTiep.reason !== "on-lai") ?? null;
  const nc = events ? nextClass(events, now) : null;
  const sent = nop === "ok" && bt ? waiting.find(i => i.id === `bai-tap:${bt}`) ?? null : null;
  const nopErr = nop && nop !== "ok" ? nopTepResultMessage(nop) : null;
  const nothing = items !== null && items.length === 0 && (as.data?.items.length ?? 0) === 0;
  const lopCount = new Set((cards ?? []).map(c => c.courseId ?? c.courseName)).size;

  // "Đề thi được giao" (§3.2, §3.3): hàng mảnh, cả hàng là link, KHÔNG nút — và bỏ đề đã có thẻ kiểm tra ở trên (không lặp một đề hai lần).
  const carded = new Set((cards ?? []).flatMap(c => (c.action.type === "thi" ? [c.action.event.id.replace(/^exam-/, "")] : [])));
  const exams = (as.data?.items ?? []).filter(it => !carded.has(it.id));
  const assignBlock = ((as.error && !as.data) || exams.length > 0) && (
    <section aria-labelledby="vc-giao" className="mt-10">
      <h2 id="vc-giao" className={`${H2} pb-2`}>Đề thi được giao</h2>
      {as.error && !as.data ? <ErrorStrip message="Không tải được danh sách đề được giao." onRetry={as.load} />
        : <ul aria-label="Đề thi được giao" className="border-t border-[var(--kin-vien-nhat)]">
          {exams.map(it => {
            const due = as.data ? daysLeftLabel(it.dueAt, as.data.serverNow) : "";
            const act = ASSIGNMENT_ACTION[it.state];
            return (
              <li key={it.id} data-de-thi-hang data-trang-thai={it.state}>
                <KinListRow size="lg" href={act ? `/student/thi-thu/${it.id}` : undefined} title={it.title}
                  sub={[it.courseName ?? (it.source === "link" ? "Giao qua đường dẫn" : "Thư viện thi thử"), it.durationMinutes ? `${it.durationMinutes} phút` : "", due].filter(Boolean).join(" · ")}
                  aside={<>
                    <KinStatus tone={EXAM_TONE[it.state]}>{ASSIGNMENT_STATE_LABEL[it.state]}</KinStatus>
                    {act && <span className="font-medium text-[var(--kin-nhan-link)] underline">{act}</span>}
                  </>} />
              </li>
            );
          })}
        </ul>}
    </section>
  );

  return (
    <div className="px-4 md:px-10 pt-5 md:pt-8 pb-10 max-w-[1120px] bg-[var(--kin-nen-trang)]">
     <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8 lg:items-start">
     <div className="min-w-0">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p data-hn-ngay className={`${GOC} font-semibold text-[var(--kin-nhan-link)]`}>{todayLine(now)}</p>
          {/* P1-2: số ở tiêu đề = số thẻ việc = số trên thanh dưới (cùng buildTodoCards). Buổi học không tính là việc. */}
          <h1 className="text-[length:var(--kin-co-h2)] leading-9 font-bold tracking-[-0.01em] text-[var(--kin-chu-chinh)]">
            {!cards ? "Việc cần làm hôm nay" : cards.length > 0 ? <>Hôm nay còn <span data-hn-so-viec className="tabular-nums">{cards.length}</span> việc cần làm</> : "Hôm nay không còn việc cần làm"}
          </h1>
          {cards && (
            <p data-can-lam-tom-tat className={`mt-1 ${GOC} text-[var(--kin-chu-phu)]`}>
              {cards.length > 0 ? `${cards.length} việc${lopCount > 1 ? ` ở ${lopCount} lớp` : ""}, xếp theo hạn` : "Không còn việc nào cần làm"}
            </p>
          )}
        </div>
        {!nothing && <Link href="/student/nhap-ma-lop" data-nhap-ma-dau className={kinButtonClass("secondary")}>Nhập mã lớp</Link>}
      </header>

      {thuBang && <HocThuBang t={thuBang} mon={thu.map(r => r.name)} className="mt-4" />}
      {tutorPending && (
        <div role="status" data-tutor-pending className="mt-6">
          <KinPanel variant="canh-bao"><p className={`${GOC} font-medium text-[var(--kin-chu-chinh)]`}>Hồ sơ gia sư của bạn đang chờ quản trị duyệt.</p><p className={`mt-1.5 ${GOC} text-[var(--kin-chu-phu)]`}>KiN sẽ báo khi xong.</p></KinPanel>
        </div>
      )}
      {nop === "ok" && <p role="status" data-nop-xong className={`mt-4 ${GOC} font-medium text-[var(--kin-tt-chu-xong)]`}>Đã nộp {sent?.task?.name ?? "bài"}. Gia sư sẽ chấm và báo điểm cho bạn.</p>}
      {nopErr && <p role="alert" className={`mt-4 ${GOC} font-medium text-[var(--kin-tt-chu-loi-dam)]`}>{nopErr}</p>}
      {error && <div className="mt-4"><ErrorStrip message="Không tải được danh sách." onRetry={load} /></div>}

      {items === null ? (!error ? <WorkSkeleton label="Đang tải việc cần làm" /> : null) : nothing ? (
        <div className="mt-6">
          <KinEmptyState title="Chưa có việc nào cho bạn" action={<Link href="/student/nhap-ma-lop" className={kinButtonClass("primary")}>Nhập mã lớp</Link>}>
            Khi bạn vào lớp và thầy cô giao bài, bài phải nộp, hạn nộp và buổi học sắp tới sẽ hiện ở đây.
          </KinEmptyState>
        </div>
      ) : (
        <>
          {sent?.task && <div className="mt-4"><DaNopCard title={sent.task.name} line={(sent.task.sentText ?? "Đã nộp").replace(/^Nộp /, "Đã nộp ")} href={sent.task.href} /></div>}
          {tonight.map(i => { const s = i.session!; return (
            <KinPanel key={i.id} variant="nhan" data-buoi-toi-nay className="mt-6">
              <p className={`${GOC} text-[var(--kin-chu-phu)]`}>Buổi học hôm nay · <span className="tabular-nums">{s.range}</span></p>
              <p className="mt-1 text-[length:var(--kin-co-tieu-de)] leading-6 font-semibold text-[var(--kin-chu-chinh)] [overflow-wrap:anywhere]">{s.courseLine}{s.topic ? `: ${s.topic}` : ""}</p>
              {s.place && <p className={`mt-1 ${GOC} text-[var(--kin-chu-phu)] [overflow-wrap:anywhere]`}>{s.place}</p>}
              {s.joinUrl
                ? <a href={s.joinUrl} target="_blank" rel="noopener noreferrer" data-vao-phong className={`${kinButtonClass(cards && cards.some(c => c.primary) ? "secondary" : "primary", "lg")} mt-3 w-full font-semibold`}>Vào phòng học online</a>
                : <Link href={s.href} className={`${kinButtonClass("secondary", "lg")} mt-3 w-full`}>Vào lớp</Link>}
            </KinPanel>
          ); })}
          {cards && cards.length === 0 && (
            // P1-4: không để trắng — một câu ghi nhận, buổi kế tiếp, và lối học tiếp (bài thật từ tiến độ của em).
            <div className="mt-6" data-hn-rong>
              <KinEmptyState title="Bạn đã xong mọi việc hôm nay"
                action={hocTiepRow?.hocTiep ? <Link href={`/student/bai-giang/${encodeURIComponent(hocTiepRow.hocTiep.lessonId)}`} data-hn-hoc-tiep className={kinButtonClass(tonight.some(i => i.session?.joinUrl) ? "secondary" : "primary")}>Học tiếp: {hocTiepRow.hocTiep.title}</Link> : undefined}>
                {nc ? <>Buổi học kế tiếp: <b data-hn-buoi-ke className="tabular-nums">{nc.today ? "Hôm nay" : vnWeekdayDate(nc.start)} {nc.event.time}</b>. </> : null}
                Bài mới thầy cô giao và hạn nộp sắp tới sẽ hiện ở đây.
              </KinEmptyState>
            </div>
          )}
          {BUCKETS.map(b => {
            const group = (cards ?? []).filter(c => todoBucket(c.dueIso, now) === b);
            if (!group.length) return null;
            return (
              <section key={b} aria-labelledby={`vc-${b}`} data-can-lam-nhom={b} className="mt-6">
                <h2 id={`vc-${b}`} className={`${H2} flex flex-wrap items-baseline justify-between gap-x-2`}>
                  {BUCKET_TITLE[b]}{b === "qua-han" && <span className={`${GOC} font-normal text-[var(--kin-chu-phu)]`}>vẫn còn nhận bài</span>}
                </h2>
                <div className="mt-3 space-y-3">
                  {group.map(c => <TodoCardView key={c.key} card={c} now={now} ve="can-lam" classColor={classAccent(c.courseId ?? c.courseName)} />)}
                </div>
              </section>
            );
          })}

          {waiting.length > 0 && (
            <section aria-labelledby="vc-wait" className="mt-10">
              <h2 id="vc-wait" className={`${H2} pb-2`}>Đã nộp, chờ chấm</h2>
              <ul aria-label="Đã nộp, đang chờ chấm" className="border-t border-[var(--kin-vien-nhat)]">
                {waiting.map(i => i.task && (
                  <li key={i.id} data-cho-cham={i.id}>
                    <KinListRow size="lg" href={i.task.href} title={`${i.task.name} · ${i.task.courseLine.split(" · ")[0]}`}
                      sub={(i.task.sentText ?? "").replace(/^Nộp /, "Đã nộp ")} aside={<KinGradeStatus state="cho-cham" />} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {sessions.length > 0 && (
            <section aria-labelledby="vc-buoi" className="mt-10">
              <h2 id="vc-buoi" className={`${H2} pb-2`}>Buổi học sắp tới</h2>
              <ul className="border-t border-[var(--kin-vien-nhat)]">
                {sessions.map(i => { const s = i.session!; return (
                  <li key={i.id} data-buoi-sap-toi className="flex flex-wrap items-center justify-between gap-3 py-3 px-[var(--kin-kc-6)] border-b border-[var(--kin-vien-nhat)]">
                    <div className="min-w-0 flex-1">
                      <p className="text-[length:var(--kin-co-body)] leading-6 font-medium text-[var(--kin-chu-chinh)] [overflow-wrap:anywhere]">{s.courseLine}</p>
                      <p className={`mt-0.5 ${GOC} text-[var(--kin-chu-phu)] tabular-nums`}>{s.dayText} · {s.range}{s.place ? ` · ${s.place}` : ""}</p>
                      {s.cancelled && <p className="mt-1"><KinStatus tone="loi">Buổi học đã huỷ</KinStatus></p>}
                    </div>
                    {!s.cancelled && s.joinUrl
                      ? <a href={s.joinUrl} target="_blank" rel="noopener noreferrer" data-join-soon={s.joinSoon ? "" : undefined} className={kinButtonClass("secondary")}>Mở link học online</a>
                      : <Link href={s.href} className={kinButtonClass("secondary")}>Vào lớp</Link>}
                  </li>
                ); })}
              </ul>
            </section>
          )}
        </>
      )}
      {assignBlock}
     </div>
     {lop && (lop.length > 0) && (
       <aside className="mt-10 lg:mt-0 space-y-6" aria-label="Lớp và nhật ký học">
         <LopCuaBan rows={lop} />
         <NhatKyDemHoc />
       </aside>
     )}
     </div>
    </div>
  );
}

export default function ViecCuaToi() {
  return <Suspense><CanLamPage /></Suspense>;
}
