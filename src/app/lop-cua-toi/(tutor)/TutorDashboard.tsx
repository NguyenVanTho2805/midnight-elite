// FE-141..144 — Trang chủ của gia sư ("Lớp của tôi"): lời chào, thẻ một con số, buổi hôm nay, việc cần làm,
// danh sách lớp dạng thẻ, lối tắt ở cuối. Thiết kế rút từ 102 ảnh research: docs/kin/thiet-ke/gia-su-giao-dien-tu-102-anh.md.
// Server component: số liệu lấy thẳng từ DB, không cần JS phía client.
import Link from "next/link";
import { loadTutorDashboard } from "@/lib/tutorDashboard";
import { buildTodoItems } from "@/lib/tutorTodo";
import { loadTutorSchedule, type ScheduleOccurrence } from "@/lib/reminderServer";
import { addDaysKey, dayOfWeekOfKey, hmOf, vnDateKeyOf, vnMinutesOfDay } from "@/lib/classSessions";
import { classAccent, greetingForHour } from "@/lib/classColor";
import { KinMoney, KinMoneyEye } from "@/components/kin/MoneyVisibility";
import TutorClassList from "./TutorClassList";

const CARD = { background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" } as const;
const vnd = (n: number) => `${Math.round(n).toLocaleString("vi-VN")}đ`;
const WEEKDAY = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
const ddmm = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;
const vnHm = (iso: string) => hmOf(vnMinutesOfDay(new Date(iso)));

type Tone = "xong" | "cho" | "loi" | "trung";
const TONE_COLOR: Record<Tone, string> = { xong: "var(--kin-tt-chu-xong)", cho: "var(--kin-tt-chu-cho)", loi: "var(--kin-tt-chu-loi)", trung: "var(--kin-chu-phu)" };

function Chip({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap" style={{ background: "var(--kin-nen-re-chuot)", color: TONE_COLOR[tone] }}>
      <span aria-hidden className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: TONE_COLOR[tone] }} />
      {children}
    </span>
  );
}

function statusOf(o: ScheduleOccurrence, nowMs: number): { tone: Tone; text: string } {
  if (o.status === "cancelled") return { tone: "trung", text: "Đã huỷ" };
  if (new Date(o.endAt).getTime() < nowMs) return { tone: "xong", text: "Đã kết thúc" };
  if (o.started) return { tone: "cho", text: "Đang diễn ra" };
  return { tone: "trung", text: "Sắp tới" };
}

function SessionRow({ o, nowMs, showDay }: { o: ScheduleOccurrence; nowMs: number; showDay?: boolean }) {
  const st = statusOf(o, nowMs);
  const cancelled = o.status === "cancelled";
  return (
    <li>
      <Link href="/lop-cua-toi/lich" className="rounded-lg flex items-stretch gap-3 min-h-[48px] overflow-hidden hover:opacity-90" style={CARD}>
        <span aria-hidden className="w-1 flex-shrink-0" style={{ background: classAccent(o.courseId) }} />
        <span className="flex-1 min-w-0 py-2">
          <span className="block text-sm font-semibold tabular-nums" style={{ color: "var(--kin-chu-chinh)", textDecoration: cancelled ? "line-through" : undefined }}>
            {showDay ? `${WEEKDAY[dayOfWeekOfKey(o.dateKey)]} ${ddmm(o.dateKey)} · ` : ""}{vnHm(o.startAt)}–{vnHm(o.endAt)}
          </span>
          <span className="block text-xs truncate" style={{ color: "var(--kin-chu-phu)" }}>{o.courseName} · {o.students.length} học viên</span>
        </span>
        <span className="flex items-center pr-3 flex-shrink-0"><Chip tone={st.tone}>{st.text}</Chip></span>
      </Link>
    </li>
  );
}

export default async function TutorDashboard({ tutorId, name }: { tutorId: string; name: string }) {
  const now = new Date();
  const todayKey = vnDateKeyOf(now);
  const [d, sched] = await Promise.all([loadTutorDashboard(tutorId), loadTutorSchedule(tutorId, todayKey, addDaysKey(todayKey, 6), now)]);
  const todo = buildTodoItems(d.todo);
  const todoTotal = todo.reduce((n, t) => n + t.count, 0);
  const anyUrgent = todo.some(t => t.urgent);
  const nowMs = now.getTime();

  const live = sched.occurrences.filter(o => o.status !== "cancelled");
  const today = live.filter(o => o.dateKey === todayKey);
  const upcoming = live.filter(o => o.dateKey > todayKey || (o.dateKey === todayKey && new Date(o.startAt).getTime() > nowMs)).slice(0, 3);
  const hour = Math.floor(vnMinutesOfDay(now) / 60);

  const stats = [
    { label: "Học viên đang học", value: <>{String(d.totalStudents)}</>, sub: null as string | null, accent: "var(--kin-th-xanh-troi)", color: "var(--kin-chu-chinh)", href: null as string | null },
    { label: "Lớp đang dạy", value: <>{`${d.openClasses}/${d.classes.length}`}</>, sub: "đang nhận học viên / tổng số lớp", accent: "var(--kin-th-xanh-link)", color: "var(--kin-chu-chinh)", href: null },
    { label: "Đã thu tháng này", value: <KinMoney>{vnd(d.collectedThisMonth)}</KinMoney>, sub: "học phí vào tài khoản của bạn", accent: "var(--kin-tt-cham-xong)", color: "var(--kin-tt-chu-xong)", href: "/lop-cua-toi/doanh-thu" },
    { label: "Việc cần làm", value: <>{todoTotal === 0 ? "Ổn" : String(todoTotal)}</>, sub: todoTotal === 0 ? "không có việc nào chờ" : anyUrgent ? "có việc gấp" : "đang chờ bạn xử lý", accent: todoTotal === 0 ? "var(--kin-tt-cham-xong)" : anyUrgent ? "var(--kin-tt-chu-loi)" : "var(--kin-tt-cham-cho)", color: todoTotal === 0 ? "var(--kin-tt-chu-xong)" : anyUrgent ? "var(--kin-tt-chu-loi)" : "var(--kin-tt-chu-cho)", href: "/lop-cua-toi" },
  ];

  return (
    <div style={{ background: "var(--kin-nen-trang)", minHeight: "100vh" }}>
      <div className="max-w-4xl mx-auto px-4 py-5">
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>Lớp của tôi</h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--kin-chu-phu)" }}>{greetingForHour(hour)}, {name} · {WEEKDAY[dayOfWeekOfKey(todayKey)]} {ddmm(todayKey)}/{todayKey.slice(0, 4)}</p>
          </div>
          <KinMoneyEye />
        </header>

        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
          {stats.map(s => {
            const inner = (<>
              <dt className="text-xs" style={{ color: "var(--kin-chu-phu)" }}>{s.label}</dt>
              <dd className="text-xl font-semibold mt-0.5 tabular-nums" style={{ color: s.color }}>{s.value}</dd>
            </>);
            const style = { ...CARD, borderTop: `2px solid ${s.accent}` };
            return s.href
              ? <Link key={s.label} href={s.href} className="rounded-lg px-3 py-2.5 block hover:opacity-90" style={style}>{inner}</Link>
              : <div key={s.label} className="rounded-lg px-3 py-2.5" style={style}>{inner}</div>;
          })}
        </dl>

        <section className="mb-5" aria-labelledby="h-homnay">
          <div className="flex items-baseline justify-between gap-3 mb-2">
            <h2 id="h-homnay" className="text-sm font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>Hôm nay</h2>
            <Link href="/lop-cua-toi/lich" className="text-xs underline min-h-[44px] inline-flex items-center" style={{ color: "var(--kin-nhan-link)" }}>Xem cả tuần</Link>
          </div>
          {today.length > 0 ? (
            <ul className="space-y-2">{today.map(o => <SessionRow key={o.key} o={o} nowMs={nowMs} />)}</ul>
          ) : (
            <div className="rounded-lg px-3 py-2.5" style={CARD}>
              <p className="text-sm" style={{ color: "var(--kin-chu-chinh)" }}>Hôm nay không có buổi dạy nào.</p>
              {upcoming.length === 0 && <p className="text-sm mt-1" style={{ color: "var(--kin-chu-phu)" }}>7 ngày tới cũng chưa có buổi nào. Thêm khung giờ học ở trang quản khoá của lớp.</p>}
            </div>
          )}
          {today.length > 0 && upcoming.length === 0 ? null : upcoming.length > 0 && (
            <>
              <h3 className="text-xs font-semibold mt-3 mb-1.5" style={{ color: "var(--kin-chu-phu)" }}>Sắp tới</h3>
              <ul className="space-y-2">{upcoming.map(o => <SessionRow key={o.key} o={o} nowMs={nowMs} showDay={o.dateKey !== todayKey} />)}</ul>
            </>
          )}
        </section>

        <section className="mb-5" aria-labelledby="h-viec">
          <h2 id="h-viec" className="text-sm font-semibold mb-2" style={{ color: "var(--kin-chu-chinh)" }}>Việc cần làm</h2>
          {todo.length === 0 ? (
            <p className="rounded-lg px-3 py-2.5 text-sm" style={{ ...CARD, color: "var(--kin-chu-phu)" }}>Hiện không có việc nào cần xử lý.</p>
          ) : (
            <ul className="space-y-2">
              {todo.map(t => (
                <li key={t.key}>
                  <Link href={t.href} className="rounded-lg px-3 py-1.5 flex items-center justify-between gap-3 min-h-[44px]" style={{ ...CARD, borderLeft: `3px solid ${t.urgent ? "var(--kin-tt-chu-loi)" : "var(--kin-tt-cham-cho)"}` }}>
                    <span className="text-sm" style={{ color: "var(--kin-chu-chinh)" }}>{t.label}</span>
                    <span className="inline-flex items-center gap-1.5 text-sm font-bold tabular-nums flex-shrink-0" style={{ color: t.urgent ? "var(--kin-tt-chu-loi)" : "var(--kin-tt-chu-cho)" }}>
                      <span aria-hidden className="w-2 h-2 rounded-full inline-block" style={{ background: t.urgent ? "var(--kin-tt-chu-loi)" : "var(--kin-tt-cham-cho)" }} />
                      {t.count}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <TutorClassList classes={d.classes} headingId="h-lop" />

        <nav aria-label="Lối tắt" className="flex gap-x-4 flex-wrap mt-4">
          {[["Học phí", "/lop-cua-toi/hoc-phi"], ["Báo cáo tháng", "/lop-cua-toi/bao-cao-thang"], ["Bài đăng tìm HS", "/lop-cua-toi/bai-dang"], ["Kế hoạch buổi", "/lop-cua-toi/ke-hoach-buoi"], ["Doanh thu", "/lop-cua-toi/doanh-thu"], ["Hồ sơ gia sư", "/lop-cua-toi/ho-so"]].map(([l, h]) => (
            <Link key={h} href={h} className="text-xs underline min-h-[44px] inline-flex items-center"
              style={{ color: "var(--kin-nhan-link)" }}>{l}</Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
