// TK-178 (09/10/2026) — "Sổ của con" cho phụ huynh.
//
// Public token link. Phụ huynh KHÔNG đăng ký tài khoản vẫn mở được từ
// Zalo. Hiển thị tháng hiện tại: chuyên cần theo lớp + học phí breakdown.
//
// Server component — không bắt client load thêm, PH mở mạng chậm cũng
// thấy ngay.
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isValidPortalToken } from "@/lib/parentPortal";
import { computeAttendanceStats } from "@/lib/attendance";
import { currentYearMonth, computeMonthlyFee, type SubjectFeeInput } from "@/lib/tuition";

export const dynamic = "force-dynamic"; // link cá nhân, không cache

type PageProps = { params: Promise<{ token: string }> };

export default async function SoCuaConPage({ params }: PageProps) {
  const { token } = await params;
  if (!isValidPortalToken(token)) notFound();

  const link = await (prisma as unknown as {
    parentLink: {
      findUnique(args: {
        where: { portalToken: string };
        include: { student: { select: { id: true; name: true; school: true } }; parent: { select: { name: true } } };
      }): Promise<null | {
        id: string;
        status: string;
        student: { id: string; name: string; school: string | null };
        parent: { name: string };
      }>;
    };
  }).parentLink.findUnique({
    where: { portalToken: token },
    include: {
      student: { select: { id: true, name: true, school: true } },
      parent:  { select: { name: true } },
    },
  });
  if (!link || link.status !== "verified") notFound();

  const studentId = link.student.id;
  const ym = currentYearMonth();
  const [yStr, mStr] = ym.split("-");
  const y = Number(yStr), m = Number(mStr);
  const firstDay = new Date(Date.UTC(y, m - 1, 1));
  const nextMonth = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1));

  const enrollments = await prisma.enrollment.findMany({
    where: { userId: studentId, status: "active" },
    include: { course: { select: { id: true, name: true } } },
  });
  const courseIds = enrollments.map(e => e.course.id);

  const [attendance, fees, override] = await Promise.all([
    courseIds.length === 0
      ? Promise.resolve([] as Array<{ status: string; session: { courseId: string } }>)
      : (prisma as unknown as {
          attendanceRecord: {
            findMany(args: {
              where: { userId: string; session: { courseId: { in: string[] }; date: { gte: Date; lt: Date } } };
              select: { status: true; session: { select: { courseId: true } } };
            }): Promise<Array<{ status: string; session: { courseId: string } }>>;
          };
        }).attendanceRecord.findMany({
          where: { userId: studentId, session: { courseId: { in: courseIds }, date: { gte: firstDay, lt: nextMonth } } },
          select: { status: true, session: { select: { courseId: true } } },
        }),
    courseIds.length === 0
      ? Promise.resolve([] as Array<{ courseId: string; sessionCount: number; freeCount: number }>)
      : (prisma as unknown as {
          monthlyCourseFee: {
            findMany(args: { where: { courseId: { in: string[] }; yearMonth: string } }): Promise<Array<{ courseId: string; sessionCount: number; freeCount: number }>>;
          };
        }).monthlyCourseFee.findMany({ where: { courseId: { in: courseIds }, yearMonth: ym } }),
    (prisma as unknown as {
      tuitionOverride: {
        findUnique(args: { where: { userId_yearMonth: { userId: string; yearMonth: string } } }): Promise<{ pricePerSession: number } | null>;
      };
    }).tuitionOverride.findUnique({ where: { userId_yearMonth: { userId: studentId, yearMonth: ym } } }),
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

  return (
    <div style={{ background: "var(--kin-nen-trang)", minHeight: "100vh" }}>
      <div className="max-w-xl mx-auto px-4 py-6">
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
          </p>
        </header>

        {enrollments.length === 0 ? (
          <div className="rounded-xl p-5 text-center"
            style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-phu)" }}>
            Em chưa ghi danh lớp nào.
          </div>
        ) : (
          <>
            <section>
              <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--kin-chu-chinh)" }}>
                Chuyên cần tháng này
              </h2>
              <div className="space-y-2 mb-5">
                {enrollments.map(e => {
                  const stats = computeAttendanceStats(attByCourse.get(e.course.id) ?? []);
                  return (
                    <div key={e.course.id} className="rounded-xl p-4"
                      style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium" style={{ color: "var(--kin-chu-chinh)" }}>{e.course.name}</span>
                        {stats.ratio !== null ? (
                          <span className="text-sm font-semibold"
                            style={{ color: ratioColor(stats.ratio) }}>
                            {Math.round(stats.ratio * 100)}% · {stats.total} buổi
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>
                            Chưa có buổi điểm danh
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {feeBreakdown && (
              <section>
                <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--kin-chu-chinh)" }}>
                  Học phí tháng {m.toString().padStart(2, "0")}/{y}
                </h2>
                <div className="rounded-xl p-4 mb-2"
                  style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
                  <p className="text-caption mb-3" style={{ color: "var(--kin-chu-phu)" }}>
                    {feeBreakdown.subjectCount} môn · {formatVnd(feeBreakdown.pricePerSession)} / buổi
                  </p>
                  <ul className="space-y-2">
                    {feeBreakdown.perSubject.map(s => (
                      <li key={s.courseId} className="flex items-center justify-between text-sm">
                        <span style={{ color: "var(--kin-chu-chinh)" }}>{s.courseName}</span>
                        <span style={{ color: "var(--kin-chu-phu)" }}>
                          {s.billable}/{s.sessionCount} buổi · <strong style={{ color: "var(--kin-chu-chinh)" }}>{formatVnd(s.subtotal)}</strong>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 pt-3 flex items-center justify-between"
                    style={{ borderTop: "1px solid var(--kin-vien-nhat)" }}>
                    <span className="font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>Tổng phải đóng</span>
                    <span className="font-bold text-lg" style={{ color: "var(--kin-th-navy)" }}>
                      {formatVnd(feeBreakdown.finalAmount)}
                    </span>
                  </div>
                </div>
                <p className="text-caption" style={{ color: "var(--kin-chu-mo)" }}>
                  Vắng không trừ tiền (buổi nào cũng có bản ghi để xem lại).
                </p>
              </section>
            )}
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

function formatVnd(n: number): string {
  return `${n.toLocaleString("vi-VN")}đ`;
}

function ratioColor(r: number): string {
  // 3 màu nghĩa (TK-169): ≥90% xong, 70-89% chờ, <70% lỗi.
  if (r >= 0.9) return "var(--kin-tt-chu-xong)";
  if (r >= 0.7) return "var(--kin-tt-chu-cho)";
  return "var(--kin-tt-chu-loi)";
}
