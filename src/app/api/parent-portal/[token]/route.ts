// TK-178 (09/10/2026) — API công khai cho "Sổ của con".
//
// GET /api/parent-portal/[token]
//   Trả về báo cáo học của con theo token mẹ/bố mở từ Zalo. Không cần
//   đăng nhập. Trả 404 nếu token sai hoặc ParentLink bị revoke.
//
// Nội dung trả:
//   - student { name, school }  (không trả email/phone để không lộ)
//   - parent  { name }          (ai đang xem — in trên đầu trang)
//   - yearMonth: "YYYY-MM" hiện tại
//   - courses: [{
//       id, name,
//       attendance: { attended, total, ratio } tháng này,
//       fee: { gross, scholarship, discount, finalAmount, sessionCount, freeCount, pricePerSession } | null
//     }]
//
// KHÔNG trả: điểm thi/mastery (chưa có nguồn ổn định) — V2.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidPortalToken } from "@/lib/parentPortal";
import { computeAttendanceStats } from "@/lib/attendance";
import { currentYearMonth, parseYearMonth, pricePerSessionVnd, computeMonthlyFee, type SubjectFeeInput } from "@/lib/tuition";

type MonthlyFeeRow = {
  courseId: string;
  yearMonth: string;
  sessionCount: number;
  freeCount: number;
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isValidPortalToken(token)) {
    return NextResponse.json({ error: "Mã không hợp lệ" }, { status: 404 });
  }

  // Query ParentLink theo token. Chỉ chấp nhận status = "verified".
  // findFirst (không @unique vì tránh prisma db push data-loss trên
  // production) — entropy 128 bit đã chống trùng; nếu trùng, trả bản
  // ghi đầu tiên khớp status verified là an toàn (không có bản ghi khác
  // được tạo ra qua đường chính thức).
  const link = await (prisma as unknown as {
    parentLink: {
      findFirst(args: {
        where: { portalToken: string; status: string };
        include: { student: { select: { id: true; name: true; school: true } }; parent: { select: { name: true } } };
      }): Promise<null | {
        id: string;
        status: string;
        studentId: string;
        portalToken: string | null;
        student: { id: string; name: string; school: string | null };
        parent: { name: string };
      }>;
    };
  }).parentLink.findFirst({
    where: { portalToken: token, status: "verified" },
    include: {
      student: { select: { id: true, name: true, school: true } },
      parent:  { select: { name: true } },
    },
  });

  if (!link) {
    return NextResponse.json({ error: "Mã không hợp lệ hoặc đã bị thu hồi" }, { status: 404 });
  }

  // yearMonth: lấy từ query ?yearMonth=YYYY-MM, mặc định tháng hiện tại.
  const ym = parseYearMonth(new URL(req.url).searchParams.get("yearMonth"))?.yearMonth
          ?? currentYearMonth();

  const studentId = link.student.id;

  // Các lớp em đang học (status = active).
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: studentId, status: "active" },
    include: { course: { select: { id: true, name: true } } },
  });

  const courseIds = enrollments.map(e => e.course.id);
  if (courseIds.length === 0) {
    return NextResponse.json({
      student:   { name: link.student.name, school: link.student.school },
      parent:    { name: link.parent.name },
      yearMonth: ym,
      courses:   [],
    });
  }

  // Range tháng ym cho attendance:
  //   firstDay = YYYY-MM-01 00:00 UTC
  //   lastDay  = tháng sau 01 00:00 UTC
  const [yStr, mStr] = ym.split("-");
  const y = Number(yStr), m = Number(mStr);
  const firstDay = new Date(Date.UTC(y, m - 1, 1));
  const nextMonth = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1));

  // Attendance records của em trong tháng, group theo courseId.
  const attendance = await (prisma as unknown as {
    attendanceRecord: {
      findMany(args: {
        where: { userId: string; session: { courseId: { in: string[] }; date: { gte: Date; lt: Date } } };
        select: { status: true; session: { select: { courseId: true } } };
      }): Promise<Array<{ status: string; session: { courseId: string } }>>;
    };
  }).attendanceRecord.findMany({
    where: {
      userId: studentId,
      session: { courseId: { in: courseIds }, date: { gte: firstDay, lt: nextMonth } },
    },
    select: { status: true, session: { select: { courseId: true } } },
  });

  const attByCourse = new Map<string, { status: string }[]>();
  for (const r of attendance) {
    const list = attByCourse.get(r.session.courseId) ?? [];
    list.push({ status: r.status });
    attByCourse.set(r.session.courseId, list);
  }

  // MonthlyCourseFee cho các môn em học, tháng ym.
  const fees = await (prisma as unknown as {
    monthlyCourseFee: {
      findMany(args: { where: { courseId: { in: string[] }; yearMonth: string } }): Promise<MonthlyFeeRow[]>;
    };
  }).monthlyCourseFee.findMany({ where: { courseId: { in: courseIds }, yearMonth: ym } });
  const feeByCourse = new Map(fees.map(f => [f.courseId, f] as const));

  // Override cho em này (nếu có) — chung cho mọi môn, theo spec AS-192.
  const override = await (prisma as unknown as {
    tuitionOverride: {
      findUnique(args: { where: { userId_yearMonth: { userId: string; yearMonth: string } } }): Promise<{ pricePerSession: number } | null>;
    };
  }).tuitionOverride.findUnique({ where: { userId_yearMonth: { userId: studentId, yearMonth: ym } } });

  // Tổng hợp theo môn. Dùng computeMonthlyFee từ src/lib/tuition.ts cho
  // nhất quán với phiếu học phí AS-193.
  const subjects: SubjectFeeInput[] = enrollments
    .filter(e => feeByCourse.has(e.course.id))
    .map(e => {
      const f = feeByCourse.get(e.course.id)!;
      return {
        courseId:     e.course.id,
        courseName:   e.course.name,
        sessionCount: f.sessionCount,
        freeCount:    f.freeCount,
      };
    });

  const feeBreakdown = subjects.length > 0
    ? computeMonthlyFee({ subjects, override: override?.pricePerSession ?? null, scholarship: 0, discount: 0 })
    : null;

  // Trả output theo từng môn em học — kể cả môn chưa có MonthlyCourseFee
  // (hiển thị attendance mà không có fee).
  const courses = enrollments.map(e => {
    const atts = attByCourse.get(e.course.id) ?? [];
    const stats = computeAttendanceStats(atts);
    const perSubject = feeBreakdown?.perSubject.find(s => s.courseId === e.course.id);
    return {
      id:   e.course.id,
      name: e.course.name,
      attendance: {
        attended: stats.attended,
        total:    stats.total,
        ratio:    stats.ratio,
      },
      fee: perSubject
        ? {
            sessionCount:    perSubject.sessionCount,
            freeCount:       perSubject.freeCount,
            billable:        perSubject.billable,
            pricePerSession: feeBreakdown!.pricePerSession,
            subtotal:        perSubject.subtotal,
          }
        : null,
    };
  });

  return NextResponse.json({
    student:   { name: link.student.name, school: link.student.school },
    parent:    { name: link.parent.name },
    yearMonth: ym,
    courses,
    total: feeBreakdown
      ? { gross: feeBreakdown.gross, finalAmount: feeBreakdown.finalAmount, pricePerSession: feeBreakdown.pricePerSession, subjectCount: feeBreakdown.subjectCount }
      : null,
  });
}
