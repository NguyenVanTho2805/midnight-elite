// TK-178 (09/10/2026) — "Sổ của con" cho phụ huynh.
//
// Public token link. Phụ huynh KHÔNG đăng ký tài khoản vẫn mở được từ
// Zalo. Hiển thị tháng hiện tại: chuyên cần theo lớp + học phí breakdown.
//
// Server component — không bắt client load thêm, PH mở mạng chậm cũng
// thấy ngay.
import { KinPanel } from "@/components/kin/Panel";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isValidPortalToken } from "@/lib/parentPortal";
import { computeAttendanceStats } from "@/lib/attendance";
import { attendanceDateWindow } from "@/lib/taughtSessions";
import { computeMonthlyFee, type SubjectFeeInput } from "@/lib/tuition";
import { vnMonthKey } from "@/lib/revenue";
import { emptyEnrollmentNotice } from "@/lib/parentPortal";
import { loadPartyInvoices } from "@/lib/invoiceServer";
import InvoiceCard from "@/components/parent/InvoiceCard";
import UpcomingSessions from "@/components/parent/UpcomingSessions";
import { loadStudentUpcoming } from "@/lib/absenceServer";
import MonthlyReportCard from "@/components/parent/MonthlyReportCard";
import { loadPartyReports } from "@/lib/monthlyReportServer";
import { prevYearMonth } from "@/lib/monthlyReport";
import { vnDateKeyOf, vnMinutesOfDay, hmOf } from "@/lib/classSessions";
import ParentSection from "@/components/parent/Section";
import SessionScores from "@/components/parent/SessionScores";
import { loadPartyScores } from "@/lib/sessionScoreServer";

export const dynamic = "force-dynamic"; // link cá nhân, không cache

type PageProps = { params: Promise<{ token: string }> };

export default async function SoCuaConPage({ params }: PageProps) {
  const { token } = await params;
  if (!isValidPortalToken(token)) notFound();

  const link = await prisma.parentLink.findFirst({
    where: { portalToken: token, status: "verified" },
    include: {
      student: { select: { id: true, name: true, school: true } },
      parent:  { select: { name: true } },
    },
  });
  if (!link) notFound();

  const studentId = link.student.id;
  const ym = vnMonthKey(new Date()); // tháng theo giờ Việt Nam
  const [yStr, mStr] = ym.split("-");
  const y = Number(yStr), m = Number(mStr);
  const firstDay = new Date(Date.UTC(y, m - 1, 1));
  const nextMonth = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1));

  const enrollments = await prisma.enrollment.findMany({
    where: { userId: studentId, status: "active" },
    include: { course: { select: { id: true, name: true } } },
  });
  const courseIds = enrollments.map(e => e.course.id);
  // Không có lớp đang học: chỉ cần TRẠNG THÁI ghi danh (không lấy tên lớp) để nói đúng câu.
  const otherStatuses = enrollments.length === 0
    ? (await prisma.enrollment.findMany({ where: { userId: studentId, status: { in: ["suspended", "pending_consent"] } }, select: { status: true } })).map(e => e.status)
    : [];

  const now = new Date();
  const [attendance, fees, override, invoices, sessions, reports] = await Promise.all([
    courseIds.length === 0
      ? Promise.resolve([] as Array<{ status: string; session: { courseId: string } }>)
      : prisma.attendanceRecord.findMany({
          where: { userId: studentId, session: { courseId: { in: courseIds }, date: attendanceDateWindow(firstDay, nextMonth, now) } },
          select: { status: true, session: { select: { courseId: true } } },
        }),
    courseIds.length === 0
      ? Promise.resolve([] as Array<{ courseId: string; sessionCount: number; freeCount: number }>)
      : prisma.monthlyCourseFee.findMany({ where: { courseId: { in: courseIds }, yearMonth: ym } }),
    // TuitionOverride chỉ có khoá @unique theo userId. Trước đây gọi bằng khoá ghép
    // userId_yearMonth (không tồn tại) → Prisma ném lỗi và cả trang trả 500.
    prisma.tuitionOverride.findUnique({ where: { userId: studentId } }),
    // TT-200: phiếu gia sư đã GỬI — tháng này + các phiếu tháng trước chưa đóng.
    loadPartyInvoices(studentId).then(list => list.filter(i => i.yearMonth === ym || i.status !== "paid")),
    // TT-202: buổi 14 ngày tới + nút báo nghỉ + số buổi bù đang giữ.
    loadStudentUpcoming(studentId, now),
    // NV-189: báo cáo tháng gia sư đã duyệt (tháng này + tháng trước).
    loadPartyReports(studentId, [ym, prevYearMonth(ym)]),
  ]);

  const attByCourse = new Map<string, { status: string }[]>();
  for (const r of attendance) {
    const list = attByCourse.get(r.session.courseId) ?? [];
    list.push({ status: r.status });
    attByCourse.set(r.session.courseId, list);
  }
  const feeByCourse = new Map(fees.map(f => [f.courseId, f] as const));

  const subjects: SubjectFeeInput[] = enrollments
    .filter(e => feeByCourse.has(e.course.id))
    .map(e => {
      const f = feeByCourse.get(e.course.id)!;
      return { courseId: e.course.id, courseName: e.course.name, sessionCount: f.sessionCount, freeCount: f.freeCount };
    });
  const feeBreakdown = subjects.length > 0
    ? computeMonthlyFee({ subjects, override: override?.pricePerSession ?? null, scholarship: 0, discount: 0 })
    : null;

  // ── Khối tóm tắt đầu trang (Figma: 4 chỉ số, không khung). Chỉ DIỄN LẠI số đã có ở các mục bên dưới, không tính thêm gì mới. ──
  const allRecords = enrollments.flatMap(e => attByCourse.get(e.course.id) ?? []);
  const overall = computeAttendanceStats(allRecords);
  const todayKey = vnDateKeyOf(now);
  const nextSession = sessions.upcoming.find(u => u.status !== "cancelled") ?? null;
  const openInvoices = invoices.filter(i => i.status !== "paid");
  const owed = openInvoices.reduce((a, i) => a + i.remaining, 0);
  const thisMonthInvoices = invoices.filter(i => i.yearMonth === ym);
  const feeTile = openInvoices.length > 0
    ? {
        label: "Học phí còn phải đóng",
        value: formatVnd(owed),
        sub: `${openInvoices.length} phiếu chưa đóng xong${openInvoices.some(i => i.yearMonth !== ym) ? ", gồm cả các tháng trước" : ""}`,
      }
    : thisMonthInvoices.length > 0
      ? { label: `Học phí tháng ${m}`, value: "Đã đóng", sub: "Phiếu tháng này đã được gia sư ghi nhận" }
      : feeBreakdown
        ? { label: `Học phí tháng ${m}`, value: formatVnd(feeBreakdown.finalAmount), sub: "Tạm tính theo số buổi đã học" }
        : { label: `Học phí tháng ${m}`, value: "Chưa có", sub: "Gia sư chưa gửi phiếu" };
  const stats: { label: string; value: string; sub: string }[] = [
    {
      label: "Chuyên cần",
      value: overall.ratio === null ? "Chưa có" : `${Math.round(overall.ratio * 100)}%`,
      sub: overall.ratio === null ? "Chưa có buổi nào được điểm danh" : `${overall.total} buổi đã điểm danh trong tháng`,
    },
    {
      label: "Buổi tiếp theo",
      value: nextSession ? `${nextSession.dateKey === todayKey ? "Hôm nay" : ddmm(nextSession.dateKey)} · ${hmOf(vnMinutesOfDay(new Date(nextSession.startAt)))}` : "Chưa có lịch",
      sub: nextSession ? nextSession.courseName : "14 ngày tới chưa có buổi theo lịch",
    },
    {
      label: "Báo cáo tháng",
      value: reports.length > 0 ? "Đã có" : "Chưa có",
      sub: reports.length > 0 ? `Mới nhất: tháng ${Number(reports[0].yearMonth.slice(5, 7))}/${reports[0].yearMonth.slice(0, 4)}` : "Gia sư chưa gửi báo cáo",
    },
    feeTile,
  ];

  const hasFeeBlock = invoices.length > 0 || !!feeBreakdown;
  // BU-11: điểm từng buổi của ĐÚNG em này, chỉ khi đồng ý ghi điểm còn hiệu lực.
  const sessionScores = await loadPartyScores(studentId);

  return (
    <div style={{ background: "var(--kin-nen-trang)" }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
        <header className="mb-5">
          <p className="text-caption" style={{ color: "var(--kin-chu-phu)" }}>
            Kính gửi {link.parent.name},
          </p>
          <h1 className="mt-1 text-h3 font-bold" style={{ color: "var(--kin-chu-chinh)" }}>
            Sổ của con: {link.student.name}
          </h1>
          <p className="text-caption mt-1" style={{ color: "var(--kin-chu-phu)" }}>
            Tháng {m.toString().padStart(2, "0")}/{y}
            {link.student.school && <> · {link.student.school}</>}
            {" · Liên kết riêng, không cần tài khoản"}
          </p>
        </header>

        {enrollments.length === 0 ? (
          <div className="rounded-xl p-5 text-center" role="status"
            style={{ background: "var(--kin-nen-bang)", color: "var(--kin-chu-phu)" }}>
            {emptyEnrollmentNotice(otherStatuses)}
          </div>
        ) : (
          <>
            <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-8" aria-label="Tóm tắt tháng này">
              {stats.map(st => (
                <KinPanel key={st.label} className="!p-4">
                  <dt className="text-xs" style={{ color: "var(--kin-chu-phu)" }}>{st.label}</dt>
                  <dd className="mt-1 text-[20px] leading-7 font-semibold tabular-nums break-words" style={{ color: "var(--kin-chu-chinh)" }}>{st.value}</dd>
                  <dd className="mt-0.5 text-xs" style={{ color: "var(--kin-chu-mo)" }}>{st.sub}</dd>
                </KinPanel>
              ))}
            </dl>

            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
              <div className="space-y-8 min-w-0">
                <ParentSection id="h-bao-cao" title="Báo cáo tháng">
                  {reports.length > 0 ? (
                    <div className="space-y-5">
                      {reports.map(r => <MonthlyReportCard key={`${r.yearMonth}-${r.tutorName}`} report={r} />)}
                    </div>
                  ) : (
                    <p className="text-sm" style={{ color: "var(--kin-chu-phu)" }}>Gia sư chưa gửi báo cáo tháng này. Khi gia sư duyệt, báo cáo sẽ hiện ở đây.</p>
                  )}
                </ParentSection>

                <ParentSection id="h-chuyen-can" title="Chuyên cần tháng này">
                  <ul className="divide-y divide-[color:var(--kin-vien-nhat)]">
                    {enrollments.map(e => {
                      const stats = computeAttendanceStats(attByCourse.get(e.course.id) ?? []);
                      return (
                        <li key={e.course.id} className="py-3 flex items-center justify-between gap-3">
                          <span className="font-medium min-w-0 break-words" style={{ color: "var(--kin-chu-chinh)" }}>{e.course.name}</span>
                          {stats.ratio !== null ? (
                            <span className="text-sm text-right flex-shrink-0">
                              <span className="font-semibold" style={{ color: ratioColor(stats.ratio) }}>
                                {Math.round(stats.ratio * 100)}% · {stats.total} buổi
                              </span>
                              <span className="block text-xs font-semibold" style={{ color: ratioColor(stats.ratio) }}>{ratioWord(stats.ratio)}</span>
                            </span>
                          ) : (
                            <span className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>
                              Chưa có buổi điểm danh
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </ParentSection>

                <UpcomingSessions token={token} upcoming={sessions.upcoming} makeup={sessions.makeup} nowIso={now.toISOString()} />

                <SessionScores items={sessionScores} />
              </div>

              <KinPanel as="aside" className="space-y-6 lg:sticky lg:top-4" aria-label="Học phí">
                {invoices.length > 0 && (
                  <section aria-labelledby="h-phieu">
                    <h2 id="h-phieu" className="text-sm font-semibold mb-3" style={{ color: "var(--kin-chu-chinh)" }}>Phiếu học phí</h2>
                    <div className="space-y-5 divide-y divide-[color:var(--kin-vien-thuong)]">
                      {invoices.map(inv => (
                        <div key={inv.id} className="first:pt-0 pt-5">
                          <InvoiceCard plain invoice={inv} reportUrl={`/api/parent-portal/${token}/invoices/${inv.code}/reported`} />
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {feeBreakdown && (
                  <section aria-labelledby="h-hoc-phi">
                    <h2 id="h-hoc-phi" className="text-sm font-semibold mb-2" style={{ color: "var(--kin-chu-chinh)" }}>
                      Học phí tháng {m.toString().padStart(2, "0")}/{y}
                    </h2>
                    <p className="text-caption mb-3" style={{ color: "var(--kin-chu-phu)" }}>
                      {feeBreakdown.subjectCount} môn · {formatVnd(feeBreakdown.pricePerSession)} / buổi
                    </p>
                    <ul className="space-y-2">
                      {feeBreakdown.perSubject.map(s => (
                        <li key={s.courseId} className="flex items-center justify-between gap-3 text-sm">
                          <span style={{ color: "var(--kin-chu-chinh)" }}>{s.courseName}</span>
                          <span className="text-right" style={{ color: "var(--kin-chu-phu)" }}>
                            {s.billable}/{s.sessionCount} buổi · <strong style={{ color: "var(--kin-chu-chinh)" }}>{formatVnd(s.subtotal)}</strong>
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 pt-3 flex items-center justify-between"
                      style={{ borderTop: "1px solid var(--kin-vien-thuong)" }}>
                      <span className="font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>Tổng phải đóng</span>
                      <span className="font-semibold text-[20px] tabular-nums" style={{ color: "var(--kin-nhan-diem)" }}>
                        {formatVnd(feeBreakdown.finalAmount)}
                      </span>
                    </div>
                    <p className="text-caption mt-2" style={{ color: "var(--kin-chu-mo)" }}>
                      Vắng không trừ tiền (buổi nào cũng có bản ghi để xem lại).
                    </p>
                  </section>
                )}

                {!hasFeeBlock && (
                  <section aria-labelledby="h-phieu-trong">
                    <h2 id="h-phieu-trong" className="text-sm font-semibold mb-2" style={{ color: "var(--kin-chu-chinh)" }}>Học phí</h2>
                    <p className="text-sm" style={{ color: "var(--kin-chu-phu)" }}>Gia sư chưa gửi phiếu học phí. Khi có phiếu, anh/chị sẽ thấy số tiền và cách chuyển khoản ở đây.</p>
                  </section>
                )}
              </KinPanel>
            </div>
          </>
        )}

        <footer className="mt-8 pt-4 text-center"
          style={{ borderTop: "1px solid var(--kin-vien-nhat)" }}>
          <p className="text-caption" style={{ color: "var(--kin-chu-mo)" }}>
            Sổ của con · KiN
          </p>
        </footer>
      </div>
    </div>
  );
}

const ddmm = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;

function formatVnd(n: number): string {
  return `${n.toLocaleString("vi-VN")}đ`;
}

function ratioColor(r: number): string {
  // 3 màu nghĩa (TK-169): ≥90% xong, 70-89% chờ, <70% lỗi.
  if (r >= 0.9) return "var(--kin-tt-chu-xong)";
  if (r >= 0.7) return "var(--kin-tt-chu-cho)";
  return "var(--kin-tt-chu-loi)";
}

// Trạng thái luôn có CHỮ đi kèm màu (cùng ngưỡng với ratioColor).
function ratioWord(r: number): string {
  if (r >= 0.9) return "Đều đặn";
  if (r >= 0.7) return "Cần chú ý";
  return "Vắng nhiều";
}
