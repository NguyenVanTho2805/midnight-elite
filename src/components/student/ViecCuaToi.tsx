// "Việc của tôi" của học sinh (Figma "Học sinh · Desktop · Việc của tôi" 299:114360, điện thoại 299:116497): TRANG DỌC, không còn hai khung.
// Tiêu đề + "Xem lịch tuần"; cột trái "Cần làm" (bài chưa nộp + hạn nộp ngoài KiN), "Đã nộp · đang chờ chấm", "Kết quả gần đây";
// cột phải "Buổi học tiếp theo" và "Kiểm tra sắp mở". Điện thoại: một cột, buổi học tiếp theo lên đầu.
// KHÔNG có dữ liệu thật nên BỎ khỏi Figma: "Chuẩn bị cho buổi học" (danh sách tích), "Học trực tuyến · Buổi 3/5", số trang ảnh đã nộp, số câu của bài tự luận.
// Dữ liệu: /api/student/viec-cua-toi ({ items }) + /api/schedule (buổi thi); tải lại khi cửa sổ lấy lại focus.
"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ErrorStrip } from "@/components/kin/shell/Outlook";
import { kinButtonClass } from "@/components/kin/Button";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinCallout } from "@/components/kin/Callout";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinStatus } from "@/components/kin/Status";
import { choCham, chuaNop, examTarget, nextExam, NextSession, TaskRow, todayLine, useStudentWork, WorkSkeleton } from "@/components/student/shared";
import { dmOfKey } from "@/components/student/shared";
import { useAuth } from "@/contexts/AuthContext";

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
  const nothing = items !== null && list.length === 0;

  const sessionBlock = next && <NextSession item={next} />;
  const examBlock = exam && (
    <KinCallout title="Kiểm tra sắp mở">
      <p>{exam.topic}{exam.meta ? ` · ${exam.meta}` : ""} · mở {dmOfKey(exam.isoDate)} lúc {exam.time}.</p>
      {examTarget(exam).external
        ? <a href={examTarget(exam).href} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center min-h-11 text-[var(--kin-nhan-link)] underline">Xem thông tin đề</a>
        : <Link href={examTarget(exam).href} className="mt-1 inline-flex items-center min-h-11 text-[var(--kin-nhan-link)] underline">Xem thông tin đề</Link>}
    </KinCallout>
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

      {tutorPending && (
        <div role="status" data-tutor-pending className="mb-6">
          <KinCallout title="Hồ sơ gia sư của bạn đang chờ quản trị duyệt.">KiN sẽ báo khi xong.</KinCallout>
        </div>
      )}
      {error && <ErrorStrip message="Không tải được danh sách." onRetry={load} />}
      {items === null ? (!error ? <WorkSkeleton label="Đang tải Việc của tôi" /> : null) : nothing ? (
        <>
        <KinEmptyState title="Chưa có việc nào cho bạn" action={<Link href="/student/nhap-ma-lop" className={kinButtonClass("primary")}>Nhập mã lớp</Link>}>
          Khi bạn vào lớp và thầy cô giao bài, bài phải nộp, hạn nộp và buổi học sắp tới sẽ hiện ở đây.
        </KinEmptyState>
        {exam && <div className="mt-6">{examBlock}</div>}
        </>
      ) : (
        <div className="mt-2 grid lg:grid-cols-[minmax(0,1fr)_354px] gap-x-8 gap-y-8 items-start">
          {/* Điện thoại: buổi học lên đầu; máy tính: cột phải. */}
          <aside aria-label="Buổi học tiếp theo" className="lg:col-start-2 lg:row-start-1 min-w-0">
            {sessionBlock || (
              <KinEmptyState title="3 ngày tới chưa có buổi học" action={<Link href="/student/lich-hoc" className={kinButtonClass("secondary")}>Mở Lịch học</Link>}>
                Khi lớp có khung giờ học, buổi gần nhất sẽ hiện ở đây.
              </KinEmptyState>
            )}
          </aside>

          <div className="lg:col-start-1 lg:row-start-1 lg:row-span-2 min-w-0">
            <section aria-labelledby="vc-todo">
              <KinSectionHead id="vc-todo" title="Cần làm" aside={todo.length > 0 ? <><span className="md:hidden">{todo.length} bài</span><span className="hidden md:inline">Theo hạn nộp</span></> : undefined} />
              {todo.length === 0 ? (
                <KinEmptyState title="Bạn không còn bài nào cần làm" action={<Link href="/student/lich-hoc" className={kinButtonClass("secondary")}>Xem lịch học</Link>}>
                  Bài mới thầy cô giao và hạn nộp sắp tới sẽ hiện ở đây.
                </KinEmptyState>
              ) : (
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
              )}
            </section>

            {waiting.length > 0 && (
              <section aria-labelledby="vc-wait" className="mt-8">
                <KinSectionHead id="vc-wait" title="Đã nộp · đang chờ chấm" />
                <ul aria-label="Đã nộp, đang chờ chấm">
                  {waiting.map(i => i.task && (
                    <TaskRow key={i.id} title={i.task.name} sub={`${i.task.courseLine} · ${i.task.sentText ?? ""}`} status={choCham} href={i.task.href} action="Xem bài nộp" />
                  ))}
                </ul>
                <p className="pt-4 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Bài đã nộp không nằm trong danh sách cần làm.</p>
              </section>
            )}

            {graded.length > 0 && (
              <section aria-labelledby="vc-done" className="mt-8">
                <KinSectionHead id="vc-done" title="Kết quả gần đây" />
                <ul aria-label="Kết quả gần đây">
                  {graded.map(i => i.task && (
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
              </section>
            )}
          </div>
          {exam && <div className="lg:col-start-2 lg:row-start-2 min-w-0">{examBlock}</div>}
        </div>
      )}
    </div>
  );
}
