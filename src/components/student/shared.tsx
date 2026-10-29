// Mảnh dùng chung của các màn học sinh dựng theo Figma (Việc của tôi 299:114360, Bài tập & đề thi 299:114951, Lịch học 299:114537):
// dòng bài tập, khung buổi học tiếp theo, hàm tải việc + lịch, câu ngày. Chỉ có dữ liệu học sinh vốn thấy về chính mình.
"use client";
import { KinPanel } from "@/components/kin/Panel";
import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { StudentTodoItem } from "@/lib/studentTodo";
import type { ScheduleEvent } from "@/lib/studentSchedule";
import { dayOfWeekOfKey, vnDateKeyOf } from "@/lib/classSessions";
import { kinButtonClass } from "@/components/kin/Button";
import { KinStatus } from "@/components/kin/Status";

const WEEKDAY_FULL = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
export const dmOfKey = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;
/** "Thứ Sáu, 23/10" theo giờ Việt Nam (tính ở máy khách sau khi vào trang). */
export function todayLine(d: Date = new Date()): string {
  const k = vnDateKeyOf(d);
  return `${WEEKDAY_FULL[dayOfWeekOfKey(k)]}, ${dmOfKey(k)}`;
}
export function dayTitle(key: string): string {
  return `${WEEKDAY_FULL[dayOfWeekOfKey(key)]} · ${dmOfKey(key)}`;
}

/** Tải việc của tôi + lịch (buổi học, hạn nộp, buổi thi). Lỗi riêng từng nguồn: `error` (việc), `eventsError` (lịch). */
export function useStudentWork() {
  const [items, setItems] = useState<StudentTodoItem[] | null>(null);
  const [events, setEvents] = useState<ScheduleEvent[] | null>(null);
  const [error, setError] = useState(false);
  const [eventsError, setEventsError] = useState(false);
  const load = useCallback(() => {
    fetch("/api/student/viec-cua-toi", { credentials: "same-origin", cache: "no-store" })
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(d => { setItems(Array.isArray(d.items) ? d.items : []); setError(false); })
      .catch(() => setError(true));
    fetch("/api/schedule", { credentials: "same-origin", cache: "no-store" })
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(d => { setEvents(Array.isArray(d.events) ? d.events : []); setEventsError(false); })
      .catch(() => setEventsError(true));
  }, []);
  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);
  return { items, events, error, eventsError, load };
}

export function WorkSkeleton({ label }: { label: string }) {
  const sk = "kin-skel kin-skel--soft";
  return (
    <div aria-busy="true" aria-label={label} className="mt-6 grid lg:grid-cols-[minmax(0,1fr)_354px] gap-x-8 gap-y-6">
      <div className="space-y-3">{[0, 1, 2].map(i => <div key={i} className={`h-[96px] rounded ${sk}`} />)}</div>
      <div className={`h-[220px] rounded ${sk}`} />
    </div>
  );
}

/** Dòng bài tập (Figma "Cần làm", "Chờ chấm"): tên, dòng phụ xám, trạng thái bên trái; nút bên phải cùng hàng trạng thái. */
export function TaskRow({ title, sub, status, href, action, external, secondary = true }: {
  title: ReactNode; sub?: ReactNode; status?: ReactNode; href: string; action: string; external?: boolean; secondary?: boolean;
}) {
  const btn = external
    ? <a href={href} target="_blank" rel="noopener noreferrer" className={`${kinButtonClass(secondary ? "secondary" : "primary")} flex-shrink-0`}>{action}</a>
    : <Link href={href} className={`${kinButtonClass(secondary ? "secondary" : "primary")} flex-shrink-0`}>{action}</Link>;
  return (
    <li data-student-task className="py-[var(--kin-kc-7)] px-[var(--kin-kc-6)] border-b border-[var(--kin-vien-nhat)]">
      <p className="text-[length:var(--kin-co-body)] leading-6 text-[var(--kin-chu-chinh)]">{title}</p>
      {sub && <p className="mt-2 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">{sub}</p>}
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="min-w-0 text-[length:var(--kin-co-goc)]">{status}</div>
        {btn}
      </div>
    </li>
  );
}

export const chuaNop = <KinStatus tone="cho">Chưa nộp</KinStatus>;
export const choCham = <KinStatus tone="mo">Chờ chấm</KinStatus>;

/** Khung "Buổi học tiếp theo" (nền xanh nhạt): giờ, lớp, ghi chú, nút "Vào lớp học". */
export function NextSession({ item, className = "" }: { item: StudentTodoItem; className?: string }) {
  const s = item.session;
  if (!s) return null;
  return (
    <KinPanel variant="nhan" data-next-session className={className}>
      <p className="text-[length:var(--kin-co-goc)] uppercase tracking-[0.02em] text-[var(--kin-chu-mo)]">Buổi học tiếp theo · {s.dayText}</p>
      <p className="mt-3 text-[22px] leading-7 font-medium tabular-nums text-[var(--kin-chu-chinh)]">{s.range}</p>
      <p className="mt-4 text-[length:var(--kin-co-tieu-de)] leading-6 text-[var(--kin-chu-chinh)]">{s.courseLine}</p>
      {s.topic && <p className="mt-2 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">{s.topic}</p>}
      {s.place && <p className="mt-1 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">{s.place}</p>}
      <div className="mt-5 flex flex-wrap gap-3">
        <Link href={s.href} className={kinButtonClass("primary")}>Vào lớp học</Link>
        {s.joinUrl && <a href={s.joinUrl} target="_blank" rel="noopener noreferrer" className={kinButtonClass("secondary")}>Mở link học online</a>}
      </div>
    </KinPanel>
  );
}

/** Buổi thi sắp tới gần nhất (chỉ đọc từ lịch). */
export function nextExam(events: ScheduleEvent[] | null): ScheduleEvent | null {
  return (events ?? []).filter(e => e.type === "exam").sort((a, b) => a.isoDate.localeCompare(b.isoDate) || a.time.localeCompare(b.time))[0] ?? null;
}

/** Đường dẫn + cờ "mở tab ngoài" của một buổi thi: có link ngoài (Azota) thì dùng, không thì vào màn chuẩn bị thi trong KiN. */
export function examTarget(e: ScheduleEvent): { href: string; external: boolean } {
  if (e.link) return { href: e.link, external: /^https?:/.test(e.link) };
  return { href: `/student/thi-thu/${e.id.replace(/^exam-/, "")}`, external: false };
}
