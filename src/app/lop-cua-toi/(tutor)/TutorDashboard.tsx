// FE-141..144 — tổng quan của gia sư ("Lớp của tôi"): thẻ số liệu, việc cần làm,
// danh sách lớp dạng thẻ, trạng thái rỗng có nút "Tạo lớp đầu tiên".
// Server component: số liệu lấy thẳng từ DB, không cần JS phía client.
import Link from "next/link";
import { loadTutorDashboard } from "@/lib/tutorDashboard";
import { buildTodoItems } from "@/lib/tutorTodo";
import TutorClassList from "./TutorClassList";

const CARD = { background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" } as const;
const vnd = (n: number) => `${Math.round(n).toLocaleString("vi-VN")}đ`;

export default async function TutorDashboard({ tutorId, name }: { tutorId: string; name: string }) {
  const d = await loadTutorDashboard(tutorId);
  const todo = buildTodoItems(d.todo);

  const stats = [
    { label: "Học viên đang học", value: String(d.totalStudents), href: null as string | null },
    { label: "Lớp đang dạy", value: `${d.openClasses}/${d.classes.length}`, sub: "đang nhận học viên / tổng số lớp", href: null },
    { label: "Đã thu tháng này", value: vnd(d.collectedThisMonth), sub: "học phí vào tài khoản của bạn", href: "/lop-cua-toi/doanh-thu" },
  ];

  return (
    <div style={{ background: "var(--kin-nen-trang)", minHeight: "100vh" }}>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <header className="mb-5 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-h3 font-bold" style={{ color: "var(--kin-chu-chinh)" }}>Lớp của tôi</h1>
            <p className="text-caption mt-1" style={{ color: "var(--kin-chu-phu)" }}>Xin chào {name} · {d.classes.length} lớp bạn đang dạy</p>
          </div>
          <nav aria-label="Lối tắt" className="flex gap-2 flex-wrap">
            {[["Học phí", "/lop-cua-toi/hoc-phi"], ["Doanh thu", "/lop-cua-toi/doanh-thu"], ["Hồ sơ gia sư", "/lop-cua-toi/ho-so"]].map(([l, h]) => (
              <Link key={h} href={h} className="px-3 py-2 text-sm rounded-lg min-h-[44px] inline-flex items-center"
                style={{ background: "var(--kin-nen-nhan)", color: "var(--kin-th-navy)", border: "1px solid var(--kin-vien-thuong)" }}>{l}</Link>
            ))}
          </nav>
        </header>

        <dl className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {stats.map(s => {
            const inner = (<>
              <dt className="text-xs" style={{ color: "var(--kin-chu-phu)" }}>{s.label}</dt>
              <dd className="text-2xl font-bold mt-1" style={{ color: "var(--kin-chu-chinh)" }}>{s.value}</dd>
              {s.sub && <p className="text-xs mt-0.5" style={{ color: "var(--kin-chu-phu)" }}>{s.sub}</p>}
            </>);
            return s.href
              ? <Link key={s.label} href={s.href} className="rounded-xl p-4 block hover:opacity-90" style={CARD}>{inner}</Link>
              : <div key={s.label} className="rounded-xl p-4" style={CARD}>{inner}</div>;
          })}
        </dl>

        <section className="mb-6" aria-labelledby="h-viec">
          <h2 id="h-viec" className="font-bold mb-2" style={{ color: "var(--kin-chu-chinh)" }}>Việc cần làm</h2>
          {todo.length === 0 ? (
            <p className="rounded-xl p-4 text-sm" style={{ ...CARD, color: "var(--kin-chu-phu)" }}>Hiện không có việc nào cần xử lý.</p>
          ) : (
            <ul className="space-y-2">
              {todo.map(t => (
                <li key={t.key}>
                  <Link href={t.href} className="rounded-xl px-4 py-3 flex items-center justify-between gap-3 min-h-[44px]" style={CARD}>
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
      </div>
    </div>
  );
}
