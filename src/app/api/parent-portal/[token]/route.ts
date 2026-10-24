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
import { attendanceDateWindow } from "@/lib/taughtSessions";
import { loadPartyInvoices } from "@/lib/invoiceServer";
import { loadStudentUpcoming } from "@/lib/absenceServer";
import { loadPartyReports } from "@/lib/monthlyReportServer";
import { loadPartyScores } from "@/lib/sessionScoreServer";
import { loadPartyNotes } from "@/lib/sessionNoteServer";
import { prevYearMonth } from "@/lib/monthlyReport";
import { vnMonthKey } from "@/lib/revenue";
import { parseYearMonth, pricePerSessionVnd, computeMonthlyFee, type SubjectFeeInput } from "@/lib/tuition";

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
          ?? vnMonthKey(new Date()); // tháng theo giờ Việt Nam (00:00–06:59 ngày 01 không còn hiện tháng trước)

  const studentId = link.student.id;

  // TT-200: phiếu học phí gia sư đã GỬI (nháp/huỷ ẩn) — tháng đang xem + các phiếu
  // tháng trước chưa đóng. QR trỏ vào tài khoản của gia sư, không phải của KiN.
  const invoices = (await loadPartyInvoices(studentId)).filter(i => i.yearMonth === ym || i.status !== "paid");

  // TT-202: buổi sắp tới (14 ngày) kèm nút báo nghỉ + số buổi bù đang giữ — hai bên cùng thấy một con số.
  const { upcoming, makeup } = await loadStudentUpcoming(studentId, new Date());
  // NV-189: báo cáo tháng ĐÃ DUYỆT (tháng đang xem + tháng trước) — mục "Điều chưa đạt" luôn có trong mỗi báo cáo.
  const reports = await loadPartyReports(studentId, [ym, prevYearMonth(ym)]);
  // BU-11: điểm từng buổi của ĐÚNG em này (chỉ khi đồng ý ghi điểm còn hiệu lực).
  const scores = await loadPartyScores(studentId);
  // BU-07: nhận xét riêng của đúng em này mà gia sư đã tick cho phụ huynh xem (và đồng ý hồ sơ còn hiệu lực).
  const notes = await loadPartyNotes(studentId);

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
      invoices,
      upcoming,
      makeup,
      reports,
      scores,
      notes,
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
      session: { courseId: { in: courseIds }, date: attendanceDateWindow(firstDay, nextMonth) },
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
  // TuitionOverride chỉ có khoá @unique theo userId (không theo tháng); trước
  // đây gọi bằng khoá ghép userId_yearMonth không tồn tại → Prisma ném
  // "Unknown argument" và cả trang trả 500 với mọi em đang có lớp.
  const override = await prisma.tuitionOverride.findUnique({ where: { userId: studentId } });

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
    invoices,
    upcoming,
    makeup,
    reports,
    scores,
    notes,
    total: feeBreakdown
      ? { gross: feeBreakdown.gross, finalAmount: feeBreakdown.finalAmount, pricePerSession: feeBreakdown.pricePerSession, subjectCount: feeBreakdown.subjectCount }
      : null,
  });
}
