// "Việc của tôi" của học sinh (Figma "Học sinh · Desktop · Việc của tôi" 299:114360, điện thoại 299:116497): TRANG DỌC, không còn hai khung.
// Tiêu đề + "Xem lịch tuần"; cột trái "Cần làm" (bài chưa nộp + hạn nộp ngoài KiN), "Đã nộp · đang chờ chấm", "Kết quả gần đây";
// cột phải "Buổi học tiếp theo", "Đề thi được giao", "Kiểm tra sắp mở" và "Thi thử sắp tới". Điện thoại: một cột, buổi học tiếp theo lên đầu.
// ĐIỀU HƯỚNG B1 (08/11/2026): đây là NƠI DUY NHẤT cho cần làm / chờ chấm / kết quả; trang "Bài tập" đã bỏ khỏi thanh module (/student/bai-tap chuyển về đây), phần chỉ nó có
// (đề thi được giao, thi thử sắp tới) nằm ở cột phải. "Kết quả gần đây" chỉ hiện 5 bài mới nhất kèm nút "Xem thêm" khi nhiều hơn.
// KHÔNG có dữ liệu thật nên BỎ khỏi Figma: "Chuẩn bị cho buổi học" (danh sách tích), "Học trực tuyến · Buổi 3/5", số trang ảnh đã nộp, số câu của bài tự luận.
// Dữ liệu: /api/student/viec-cua-toi ({ items }) + /api/schedule (buổi thi); tải lại khi cửa sổ lấy lại focus.
// LOI-03 (11/11/2026): ngay dưới tiêu đề là phiếu "Hôm nay có lớp" (components/student/HomNayCoLop, GET /api/student/hom-nay) — full-width ở mọi cỡ màn.
"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ScheduleEvent } from "@/lib/studentSchedule";
import { ErrorStrip } from "@/components/kin/shell/Outlook";
import { kinButtonClass } from "@/components/kin/Button";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinPanel } from "@/components/kin/Panel";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinStatus } from "@/components/kin/Status";
import { choCham, chuaNop, examTarget, nextExam, NextSession, TaskRow, todayLine, useStudentWork, WorkSkeleton } from "@/components/student/shared";
import { dmOfKey } from "@/components/student/shared";
import { useAuth } from "@/contexts/AuthContext";
import AssignmentList, { useAssignments } from "@/components/student/exam-room/AssignmentList";
import HomNayCoLop from "@/components/student/HomNayCoLop";
import { asideState } from "@/lib/studentLop";

const RESULT_LIMIT = 5; // "Kết quả gần đây": 5 bài mới nhất, còn lại sau nút "Xem thêm"
const ASSIGN_LIMIT = 3; // "Đề thi được giao": 3 đề đầu (đã sắp theo hạn), còn lại sau nút "Xem thêm"
const moreBtn = "mt-2 inline-flex items-center min-h-11 px-1 text-[length:var(--kin-co-goc)] text-[var(--kin-nhan-link)] underline";

function UpcomingExam({ e }: { e: ScheduleEvent }) {
  const t = examTarget(e);
  const cls = "inline-flex items-center min-h-11 text-[var(--kin-nhan-link)] underline";
  return (
    <li data-exam-card className="py-[var(--kin-kc-6)] px-[var(--kin-kc-6)] border-b border-[var(--kin-vien-nhat)]">
      <p className="text-[length:var(--kin-co-body)] leading-6 text-[var(--kin-chu-chinh)]">{e.topic}</p>
      <p className="mt-2 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">{dmOfKey(e.isoDate)} · {e.time}{e.meta ? ` · ${e.meta}` : ""}</p>
      {t.external ? <a href={t.href} target="_blank" rel="noopener noreferrer" className={cls}>Xem thông tin đề</a> : <Link href={t.href} className={cls}>Xem thông tin đề</Link>}
    </li>
  );
}

export default function ViecCuaToi() {
  // NC2-029: gia sư vừa đăng ký, hồ sơ chưa duyệt → thẻ báo "chờ duyệt" (cờ lấy từ /api/auth/me qua AuthContext, chỉ của chính người dùng).
  const { user } = useAuth();
  const tutorPending = user?.tutorPending === true;
  const { items, events, error, load } = useStudentWork();
  const [today, setToday] = useState("");
  useEffect(() => { void Promise.resolve().then(() => setToday(todayLine())); }, []);

  const list = items ?? [];
  const todo = list.filter(i => !i.done && i.kind !== "buoi-hoc");
  const waiting = list.filter(i => i.task?.phase === "cho-cham");
  const graded = list.filter(i => i.task?.phase === "da-cham");
  const next = list.find(i => i.kind === "buoi-hoc" && !i.done) ?? null;
  const exam = nextExam(events);
  const moreExams = (events ?? []).filter(e => e.type === "exam").sort((a, b) => a.isoDate.localeCompare(b.isoDate) || a.time.localeCompare(b.time)).filter(e => e.id !== exam?.id).slice(0, 3);
  const [allResults, setAllResults] = useState(false);
  const [allAssign, setAllAssign] = useState(false);
  const as = useAssignments();
  const nothing = items !== null && list.length === 0;

  const sessionBlock = next && <NextSession item={next} />;
  // LOI-03 (vòng test 2): phiếu "Hôm nay có lớp" (Lesson.scheduledAt) đang có bài mà khung buổi học rỗng ⇒ KHÔNG vẽ "3 ngày tới chưa có buổi học" (hai khối nói ngược nhau);
  // bỏ hẳn cột aside, khối đề thi lên hàng 1 cột phải. Phiếu rỗng / lỗi ⇒ như cũ.
  // LOI-07 (nợ P3 LOI-03): null = phiếu CHƯA tải xong. Đang tải ≠ rỗng: chưa biết thì giữ chỗ bằng khung xương, KHÔNG vẽ "3 ngày tới chưa có buổi học"
  // (bản cũ mặc định false nên khối trống chớp lên rồi biến mất khi phiếu có bài). Logic thuần: asideState (src/lib/studentLop.ts).
  const [homNayHas, setHomNayHas] = useState<boolean | null>(null);
  const aside = asideState(!!sessionBlock, homNayHas);
  const showAside = aside !== "an";
  const examBlock = exam && (
    <KinPanel data-exam-card>
      <p className="text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-chu-chinh)]">Kiểm tra sắp mở</p>
      <p className="mt-1.5 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-phu)]">{exam.topic}{exam.meta ? ` · ${exam.meta}` : ""} · mở {dmOfKey(exam.isoDate)} lúc {exam.time}.</p>
      {examTarget(exam).external
        ? <a href={examTarget(exam).href} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center min-h-11 text-[var(--kin-nhan-link)] underline">Xem thông tin đề</a>
        : <Link href={examTarget(exam).href} className="mt-1 inline-flex items-center min-h-11 text-[var(--kin-nhan-link)] underline">Xem thông tin đề</Link>}
    </KinPanel>
  );

  // Đề được giao: ba trạng thái riêng (đang tải / lỗi + Thử lại / rỗng). Lối tới đề thi thử công khai là liên kết "Đề thi thử" ở đầu khối (một đường chính), nên khối rỗng không thêm nút nữa.
  const assignCount = as.data?.items.length ?? 0;
  const assignBlock = (
    <section aria-labelledby="vc-giao">
      <KinSectionHead id="vc-giao" title="Đề thi được giao" aside={<Link href="/thi-thu" className="text-[var(--kin-nhan-link)] underline inline-flex items-center min-h-11">Đề thi thử</Link>} />
      {as.error && !as.data
        ? <ErrorStrip message="Không tải được danh sách đề được giao." onRetry={as.load} />
        : !as.data ? <div aria-busy="true" aria-label="Đang tải đề được giao" className="mt-4 h-[96px] rounded kin-skel kin-skel--soft" />
        : <AssignmentList items={as.data.items} serverNow={as.data.serverNow} limit={allAssign ? undefined : ASSIGN_LIMIT} emptyLink={false} />}
      {assignCount > ASSIGN_LIMIT && (
        <button type="button" data-assign-more aria-expanded={allAssign} onClick={() => setAllAssign(v => !v)} className={moreBtn}>
          {allAssign ? "Thu gọn" : `Xem thêm ${assignCount - ASSIGN_LIMIT} đề`}
        </button>
      )}
    </section>
  );
  const moreExamBlock = moreExams.length > 0 && (
    <section aria-labelledby="vc-next-exam" className="mt-8">
      <KinSectionHead id="vc-next-exam" title="Thi thử sắp tới" />
      <KinPanel flush className="mt-4"><ul>{moreExams.map(e => <UpcomingExam key={e.id} e={e} />)}</ul></KinPanel>
    </section>
  );

  return (
    <div className="px-4 md:px-10 pt-6 md:pt-8 pb-10 bg-[var(--kin-nen-trang)]">
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-6">
        <div className="min-w-0">
          <h1 className="text-[length:var(--kin-co-h2)] leading-9 font-medium tracking-[-0.01em] text-[var(--kin-chu-chinh)]">Việc của tôi</h1>
          <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">
            {today ? `${today} · ` : ""}<span className="md:hidden">Bài phải nộp và buổi sắp tới</span><span className="hidden md:inline">Ưu tiên bài đến hạn và buổi học tiếp theo.</span>
          </p>
        </div>
        <Link href="/student/lich-hoc" className={`${kinButtonClass("secondary")} self-start flex-shrink-0 max-md:hidden`}>Xem lịch tuần</Link>
      </header>

      {/* LOI-03 mục 4.4: phiếu "Hôm nay có lớp" (bài có ngày học hôm nay + 7 ngày tới). Không có bài hẹn thì không vẽ gì. */}
      <HomNayCoLop onHasItems={setHomNayHas} />

      {tutorPending && (
        <div role="status" data-tutor-pending className="mb-6">
          <KinPanel variant="canh-bao"><p className="text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-chu-chinh)]">Hồ sơ gia sư của bạn đang chờ quản trị duyệt.</p><p className="mt-1.5 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">KiN sẽ báo khi xong.</p></KinPanel>
        </div>
      )}
      {error && <ErrorStrip message="Không tải được danh sách." onRetry={load} />}
      {items === null ? (!error ? <WorkSkeleton label="Đang tải Việc của tôi" /> : null) : nothing ? (
        <>
        <KinEmptyState title="Chưa có việc nào cho bạn" action={<Link href="/student/nhap-ma-lop" className={kinButtonClass("primary")}>Nhập mã lớp</Link>}>
          Khi bạn vào lớp và thầy cô giao bài, bài phải nộp, hạn nộp và buổi học sắp tới sẽ hiện ở đây.
        </KinEmptyState>
        <div className="mt-8 max-w-[560px]">{assignBlock}{exam && <div className="mt-8">{examBlock}</div>}{moreExamBlock}</div>
        </>
      ) : (
        <div className="mt-2 grid lg:grid-cols-[minmax(0,1fr)_354px] gap-x-8 gap-y-8 items-start">
          {/* Điện thoại: buổi học lên đầu; máy tính: cột phải. */}
          {showAside && (
            <aside aria-label="Buổi học tiếp theo" className="lg:col-start-2 lg:row-start-1 min-w-0">
              {aside === "buoi-hoc" ? sessionBlock : aside === "dang-tai" ? (
                <div role="status" aria-busy="true" aria-label="Đang tải buổi học tiếp theo" data-aside-dang-tai className="h-[112px] rounded kin-skel kin-skel--soft" />
              ) : (
                <KinEmptyState title="3 ngày tới chưa có buổi học">
                  Khi lớp có khung giờ học, buổi gần nhất sẽ hiện ở đây.
                </KinEmptyState>
              )}
            </aside>
          )}

          <div className="lg:col-start-1 lg:row-start-1 lg:row-span-2 min-w-0">
            <section aria-labelledby="vc-todo">
              <KinSectionHead id="vc-todo" title="Cần làm" aside={todo.length > 0 ? <><span className="md:hidden">{todo.length} bài</span><span className="hidden md:inline">Theo hạn nộp</span></> : undefined} />
              {todo.length === 0 ? (
                <KinEmptyState title="Bạn không còn bài nào cần làm">
                  Bài mới thầy cô giao và hạn nộp sắp tới sẽ hiện ở đây.
                </KinEmptyState>
              ) : (
                <KinPanel flush className="mt-4">
                <ul aria-label="Cần làm">
                  {todo.map(i => i.task ? (
                    <TaskRow key={i.id} title={i.task.name} sub={`${i.task.courseLine} · ${i.task.dueText}`}
                      status={i.status.tone === "loi" ? <KinStatus tone="loi">{i.status.label}</KinStatus> : chuaNop}
                      href={i.task.href} action={i.task.interactive ? "Làm bài" : "Nộp bài"} />
                  ) : (
                    <TaskRow key={i.id} title={i.title} sub={i.subtitle} status={<KinStatus tone={i.status.tone}>{i.status.label}</KinStatus>}
                      href={i.detail.commands[0]?.href ?? "/student/lich-hoc"} external={i.detail.commands[0]?.external} action={i.detail.commands[0]?.label ?? "Xem lịch"} />
                  ))}
                </ul>
                </KinPanel>
              )}
            </section>

            {waiting.length > 0 && (
              <section aria-labelledby="vc-wait" className="mt-8">
                <KinSectionHead id="vc-wait" title="Đã nộp · đang chờ chấm" />
                <KinPanel flush className="mt-4">
                <ul aria-label="Đã nộp, đang chờ chấm">
                  {waiting.map(i => i.task && (
                    <TaskRow key={i.id} title={i.task.name} sub={`${i.task.courseLine} · ${i.task.sentText ?? ""}`} status={choCham} href={i.task.href} action="Xem bài nộp" />
                  ))}
                </ul>
                </KinPanel>
                <p className="pt-4 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Bài đã nộp không nằm trong danh sách cần làm.</p>
              </section>
            )}

            {graded.length > 0 && (
              <section aria-labelledby="vc-done" className="mt-8">
                <KinSectionHead id="vc-done" title="Kết quả gần đây" />
                <KinPanel flush className="mt-4">
                <ul aria-label="Kết quả gần đây">
                  {(allResults ? graded : graded.slice(0, RESULT_LIMIT)).map(i => i.task && (
                    <li key={i.id} data-student-task className="py-[var(--kin-kc-7)] px-[var(--kin-kc-6)] border-b border-[var(--kin-vien-nhat)] flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[length:var(--kin-co-body)] leading-6 text-[var(--kin-chu-chinh)]">{i.task.name}</p>
                        <p className="mt-2 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">{i.task.gradedText}{i.task.comment ? ` · “${i.task.comment}”` : ""}</p>
                        <Link href={i.task.href} className="mt-1 inline-flex items-center min-h-11 text-[length:var(--kin-co-goc)] text-[var(--kin-nhan-link)] underline">Xem nhận xét</Link>
                      </div>
                      <p className="flex-shrink-0 text-[22px] leading-7 font-medium tabular-nums text-[var(--kin-chu-chinh)]">{i.task.scoreText}</p>
                    </li>
                  ))}
                </ul>
                </KinPanel>
                {graded.length > RESULT_LIMIT && (
                  <button type="button" data-results-more aria-expanded={allResults} onClick={() => setAllResults(v => !v)} className={moreBtn}>
                    {allResults ? "Thu gọn" : `Xem thêm ${graded.length - RESULT_LIMIT} bài`}
                  </button>
                )}
              </section>
            )}
          </div>
          <div className={`lg:col-start-2 ${showAside ? "lg:row-start-2" : "lg:row-start-1"} min-w-0`}>
            {assignBlock}
            {exam && <div className="mt-8">{examBlock}</div>}
            {moreExamBlock}
          </div>
        </div>
      )}
    </div>
  );
}
