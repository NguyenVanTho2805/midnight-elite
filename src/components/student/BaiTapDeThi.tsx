// Bài tập & đề thi của học sinh (Figma "Học sinh · Bài tập và đề thi" 299:114951): mỗi trạng thái có một khu riêng, không lẫn bài đã hoàn thành.
// Tab "Cần làm · n" (mặc định: Cần làm, Chờ chấm, Kết quả gần đây + cột phải đề thi), "Chờ chấm · n", "Kết quả", "Đề thi".
// Dữ liệu: /api/student/viec-cua-toi (bài tập, hạn nộp) + /api/schedule (buổi thi). KHÔNG có dữ liệu thật nên bỏ: số bài tự luận, tên tệp đã nộp,
// "Chưa vào bài / đồng hồ chỉ bắt đầu khi bạn xác nhận" (không có trạng thái làm bài ở đây), "Thi thử giữa kỳ" thật chỉ gồm tên, giờ mở, số câu/thời lượng nếu đề có.
"use client";
import Link from "next/link";
import { useState } from "react";
import { ErrorStrip } from "@/components/kin/shell/Outlook";
import { kinButtonClass } from "@/components/kin/Button";
import { KinTabs } from "@/components/kin/Tabs";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinCallout } from "@/components/kin/Callout";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinStatus } from "@/components/kin/Status";
import type { StudentTodoItem } from "@/lib/studentTodo";
import type { ScheduleEvent } from "@/lib/studentSchedule";
import { choCham, chuaNop, dmOfKey, examTarget, TaskRow, useStudentWork, WorkSkeleton } from "@/components/student/shared";

type Tab = "can-lam" | "cho-cham" | "ket-qua" | "de-thi";

function Waiting({ list }: { list: StudentTodoItem[] }) {
  return (
    <ul aria-label="Chờ chấm">
      {list.map(i => i.task && (
        <TaskRow key={i.id} title={i.task.name} sub={`${i.task.courseLine} · ${i.task.sentText ?? ""}`} status={choCham} href={i.task.href} action="Xem bài nộp" />
      ))}
    </ul>
  );
}

function ResultTable({ list }: { list: StudentTodoItem[] }) {
  return (
    <div>
      <div aria-hidden className="hidden md:grid grid-cols-[1.4fr_1fr_1.4fr] px-[var(--kin-kc-6)] h-11 items-center bg-[var(--kin-nen-bang)] text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">
        <span>Bài tập</span><span>Điểm</span><span>Phản hồi</span>
      </div>
      <ul aria-label="Kết quả gần đây">
        {list.map(i => i.task && (
          <li key={i.id} data-student-task className="grid md:grid-cols-[1.4fr_1fr_1.4fr] gap-x-4 gap-y-1 items-center px-[var(--kin-kc-6)] py-[var(--kin-kc-6)] min-h-[62px] border-b border-[var(--kin-vien-nhat)] text-[length:var(--kin-co-goc)]">
            <span className="text-[var(--kin-chu-chinh)]">{i.task.name}</span>
            <span className="tabular-nums text-[var(--kin-chu-chinh)] max-md:text-[22px] max-md:font-medium">{i.task.scoreText}</span>
            <span className="min-w-0">
              <span className="text-[var(--kin-chu-mo)]">{i.task.gradedText}{i.task.comment ? ` · “${i.task.comment}”` : ""} · </span>
              <Link href={i.task.href} className="text-[var(--kin-nhan-link)] underline inline-flex items-center min-h-11">Xem nhận xét →</Link>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ExamBlock({ e, highlight }: { e: ScheduleEvent; highlight?: boolean }) {
  const t = examTarget(e);
  const link = t.external
    ? <a href={t.href} target="_blank" rel="noopener noreferrer" className={highlight ? kinButtonClass("secondary") : "inline-flex items-center min-h-11 text-[var(--kin-nhan-link)] underline"}>Xem thông tin đề</a>
    : <Link href={t.href} className={highlight ? kinButtonClass("secondary") : "inline-flex items-center min-h-11 text-[var(--kin-nhan-link)] underline"}>Xem thông tin đề</Link>;
  if (highlight) {
    return (
      <div data-exam-card className="rounded-[var(--kin-bo-sm)] bg-[var(--kin-nen-nhan)] px-[var(--kin-kc-8)] py-[var(--kin-kc-8)]">
        <p className="text-[length:var(--kin-co-goc)]"><KinStatus tone="mo">Mở {dmOfKey(e.isoDate)} · {e.time}</KinStatus></p>
        <p className="mt-3 text-[length:var(--kin-co-tieu-de)] leading-6 font-medium text-[var(--kin-chu-chinh)]">{e.topic}</p>
        {e.meta && <p className="mt-3 text-[length:var(--kin-co-body)] text-[var(--kin-chu-chinh)]">{e.meta}</p>}
        <div className="mt-4">{link}</div>
      </div>
    );
  }
  return (
    <li data-exam-card className="py-[var(--kin-kc-6)] px-[var(--kin-kc-6)] border-b border-[var(--kin-vien-nhat)]">
      <p className="text-[length:var(--kin-co-body)] leading-6 text-[var(--kin-chu-chinh)]">{e.topic}</p>
      <p className="mt-2 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">{dmOfKey(e.isoDate)} · {e.time}{e.meta ? ` · ${e.meta}` : ""}</p>
      {link}
    </li>
  );
}

export default function BaiTapDeThi() {
  const { items, events, error, eventsError, load } = useStudentWork();
  const [tab, setTab] = useState<Tab>("can-lam");
  const list = items ?? [];
  const todo = list.filter(i => !i.done && i.kind !== "buoi-hoc");
  const waiting = list.filter(i => i.task?.phase === "cho-cham");
  const graded = list.filter(i => i.task?.phase === "da-cham");
  const exams = (events ?? []).filter(e => e.type === "exam").sort((a, b) => a.isoDate.localeCompare(b.isoDate) || a.time.localeCompare(b.time));
  const loading = (items === null && !error) || (events === null && !eventsError);

  const tabs = [
    { key: "can-lam" as const, label: `Cần làm${items ? ` · ${todo.length}` : ""}` },
    { key: "cho-cham" as const, label: `Chờ chấm${items ? ` · ${waiting.length}` : ""}` },
    { key: "ket-qua" as const, label: "Kết quả" },
    { key: "de-thi" as const, label: "Đề thi" },
  ];
  const noExams = <KinEmptyState title="Chưa có đề thi sắp mở" action={<Link href="/thi-thu" className={kinButtonClass("secondary")}>Xem các đề thi thử</Link>}>Khi có đề thi thử mới, thời gian mở và thông tin đề sẽ hiện ở đây.</KinEmptyState>;

  const todoSection = (
    <section aria-labelledby="bt-todo">
      <KinSectionHead id="bt-todo" title="Cần làm" aside="Sắp đến hạn trước" />
      {todo.length === 0 ? (
        <KinEmptyState title="Bạn không còn bài nào cần làm" action={<Link href="/student/lich-hoc" className={kinButtonClass("secondary")}>Xem lịch học</Link>}>
          Bài mới thầy cô giao sẽ hiện ở đây, mỗi trạng thái một khu riêng.
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
  );

  return (
    <div className="px-4 md:px-10 pt-6 md:pt-8 pb-10 bg-[var(--kin-nen-trang)]">
      <header className="pb-6">
        <h1 className="text-[length:var(--kin-co-h2)] leading-9 font-medium tracking-[-0.01em] text-[var(--kin-chu-chinh)]">Bài tập &amp; đề thi</h1>
        <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Mỗi trạng thái có một khu vực riêng, không lẫn bài đã hoàn thành.</p>
      </header>
      {error && <ErrorStrip message="Không tải được bài tập." onRetry={load} />}
      {eventsError && !error && <ErrorStrip message="Không tải được danh sách đề thi." onRetry={load} />}
      <KinTabs tabs={tabs} value={tab} onChange={setTab} label="Bài tập và đề thi" tabId={k => `bt-tab-${k}`} panelId={() => "bt-panel"} />
      <div role="tabpanel" id="bt-panel" aria-labelledby={`bt-tab-${tab}`} className="pt-8">
        {loading ? (!error && !eventsError ? <WorkSkeleton label="Đang tải Bài tập và đề thi" /> : null) : tab === "can-lam" ? (
          <div className="grid lg:grid-cols-[minmax(0,1fr)_354px] gap-x-8 gap-y-8 items-start">
            <div className="lg:col-start-1 lg:row-start-1 min-w-0">
              {todoSection}
              {waiting.length > 0 && (
                <section aria-labelledby="bt-wait" className="mt-8">
                  <KinSectionHead id="bt-wait" title="Chờ chấm" />
                  <Waiting list={waiting} />
                </section>
              )}
              {graded.length > 0 && (
                <section aria-labelledby="bt-res" className="mt-8">
                  <KinSectionHead id="bt-res" title="Kết quả gần đây" />
                  <ResultTable list={graded} />
                  <p className="pt-4 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Bài đã chấm không xuất hiện trong “Cần làm”.</p>
                </section>
              )}
            </div>
            <aside aria-label="Đề thi sắp tới" className="lg:col-start-2 lg:row-start-1 min-w-0">
              {exams[0] ? <ExamBlock e={exams[0]} highlight /> : noExams}
              {exams.length > 1 && (
                <section aria-labelledby="bt-next-exam" className="mt-8">
                  <KinSectionHead id="bt-next-exam" title="Thi thử sắp tới" />
                  <ul>{exams.slice(1, 4).map(e => <ExamBlock key={e.id} e={e} />)}</ul>
                </section>
              )}
              <KinCallout title="Trước khi làm bài" className="mt-8">Chuẩn bị giấy nháp và kết nối ổn định.</KinCallout>
            </aside>
          </div>
        ) : tab === "cho-cham" ? (
          <section aria-labelledby="bt-wait2">
            <KinSectionHead id="bt-wait2" title="Chờ chấm" />
            {waiting.length === 0
              ? <KinEmptyState title="Chưa có bài nào đang chờ chấm" action={<button type="button" onClick={() => setTab("can-lam")} className={kinButtonClass("secondary")}>Xem bài cần làm</button>}>Bài bạn đã nộp mà thầy cô chưa chấm sẽ nằm ở đây.</KinEmptyState>
              : <Waiting list={waiting} />}
          </section>
        ) : tab === "ket-qua" ? (
          <section aria-labelledby="bt-res2">
            <KinSectionHead id="bt-res2" title="Kết quả gần đây" />
            {graded.length === 0
              ? <KinEmptyState title="Chưa có bài nào được chấm" action={<button type="button" onClick={() => setTab("can-lam")} className={kinButtonClass("secondary")}>Xem bài cần làm</button>}>Khi thầy cô chấm xong, điểm và nhận xét sẽ hiện ở đây (giữ trong 14 ngày gần nhất).</KinEmptyState>
              : <ResultTable list={graded} />}
          </section>
        ) : (
          <section aria-labelledby="bt-exams">
            <KinSectionHead id="bt-exams" title="Đề thi" aside={<Link href="/thi-thu" className="text-[var(--kin-nhan-link)] underline">Tất cả đề thi thử</Link>} />
            {exams.length === 0 ? noExams : <ul>{exams.map(e => <ExamBlock key={e.id} e={e} />)}</ul>}
          </section>
        )}
      </div>
    </div>
  );
}
